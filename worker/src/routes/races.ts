import { Hono } from "hono";
import type { Env } from "../index";
import { fetchNormalizedActivities } from "./activities";

export const racesRoutes = new Hono<{ Bindings: Env }>();

interface RaceRow {
  id: string;
  race_name: string;
  race_type: string;
  race_distance: string | null;
  race_date: string;
  priority: string;
  target_goal: string | null;
  swim_distance_km: number | null;
  bike_distance_km: number | null;
  run_distance_km: number | null;
  notes: string | null;
}

function toDto(row: RaceRow) {
  return {
    id: row.id,
    raceName: row.race_name,
    raceType: row.race_type,
    raceDistance: row.race_distance,
    raceDate: row.race_date,
    priority: row.priority,
    targetGoal: row.target_goal,
    swimDistanceKm: row.swim_distance_km,
    bikeDistanceKm: row.bike_distance_km,
    runDistanceKm: row.run_distance_km,
    notes: row.notes,
  };
}

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }
function sum(vs: number[]) { return vs.reduce((a, b) => a + (Number(b) || 0), 0); }

type Activity = { sportType: string; distanceMeters: number; movingTimeSeconds: number; startDate: string };

function activitiesSince(activities: Activity[], days: number): Activity[] {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  return activities.filter((a) => new Date(a.startDate) >= cutoff);
}

function longestKm(activities: Activity[]) {
  return activities.length ? Math.max(...activities.map((a) => a.distanceMeters / 1000)) : 0;
}

function weeklyAvgKm(activities: Activity[], weeks: number) {
  return sum(activities.map((a) => a.distanceMeters)) / 1000 / weeks;
}

function weeksActive(activities: Activity[], weeks: number) {
  const set = new Set<string>();
  for (const a of activities) {
    const d = new Date(a.startDate);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    set.add(d.toISOString().slice(0, 10));
  }
  return clamp((set.size / weeks) * 100);
}

function calculateReadiness(race: ReturnType<typeof toDto>, activities: { sportType: string; distanceMeters: number; movingTimeSeconds: number; startDate: string }[]) {
  const bySport = (sport: string) => activities.filter((a) => a.sportType === sport);

  function runScore() {
    const runs8w = bySport("run").filter((a) => new Date(a.startDate) >= (() => { const d = new Date(); d.setDate(d.getDate() - 56); return d; })());
    const runs4w = activitiesSince(bySport("run"), 28);
    const longTarget = race.runDistanceKm ? race.runDistanceKm * 0.7 : 28;
    return {
      trainingProgress: Math.round(clamp((weeklyAvgKm(runs4w, 4) / 40) * 100)),
      readinessScore: Math.round(clamp(clamp((longestKm(runs8w) / longTarget) * 100) * 0.35 + clamp((weeklyAvgKm(runs4w, 4) / 40) * 100) * 0.3 + weeksActive(runs8w, 8) * 0.25 + 65 * 0.1)),
    };
  }

  function bikeScore() {
    const bikes8w = bySport("bike").filter((a) => new Date(a.startDate) >= (() => { const d = new Date(); d.setDate(d.getDate() - 56); return d; })());
    const bikes4w = activitiesSince(bySport("bike"), 28);
    const longTarget = race.bikeDistanceKm ? race.bikeDistanceKm * 0.6 : 80;
    return {
      trainingProgress: Math.round(clamp((weeklyAvgKm(bikes4w, 4) / 150) * 100)),
      readinessScore: Math.round(clamp(clamp((longestKm(bikes8w) / longTarget) * 100) * 0.4 + clamp((weeklyAvgKm(bikes4w, 4) / 150) * 100) * 0.3 + 70 * 0.3)),
    };
  }

  function swimScore() {
    const swims8w = bySport("swim").filter((a) => new Date(a.startDate) >= (() => { const d = new Date(); d.setDate(d.getDate() - 56); return d; })());
    const swims4w = activitiesSince(bySport("swim"), 28);
    return {
      trainingProgress: Math.round(clamp((weeklyAvgKm(swims4w, 4) / 8) * 100)),
      readinessScore: Math.round(clamp(clamp((longestKm(swims8w) / 3) * 100) * 0.4 + clamp((weeklyAvgKm(swims4w, 4) / 8) * 100) * 0.35 + weeksActive(swims8w, 8) * 0.25)),
    };
  }

  switch (race.raceType) {
    case "running": return runScore();
    case "cycling": return bikeScore();
    case "swimming": return swimScore();
    case "duathlon":
    case "triathlon":
    case "ironman_70_3":
    case "ironman": {
      const s = swimScore(); const b = bikeScore(); const r = runScore();
      return {
        trainingProgress: Math.round((s.trainingProgress + b.trainingProgress + r.trainingProgress) / 3),
        readinessScore: Math.round(clamp(s.readinessScore * 0.25 + b.readinessScore * 0.3 + r.readinessScore * 0.3 + 50 * 0.15)),
      };
    }
    default: return { trainingProgress: 0, readinessScore: 0 };
  }
}

racesRoutes.get("/api/races", async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM races ORDER BY race_date ASC").all<RaceRow>();
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, { limit: 5000 }).catch(() => []);
    const races = results.map((row) => {
      const race = toDto(row);
      return { ...race, ...calculateReadiness(race, activities) };
    });
    return c.json(races);
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

racesRoutes.post("/api/races", async (c) => {
  try {
    const race = await c.req.json<Record<string, unknown>>();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO races (id, race_name, race_type, race_distance, race_date, priority, target_goal, swim_distance_km, bike_distance_km, run_distance_km, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, race.raceName, race.raceType, race.raceDistance ?? null, race.raceDate, race.priority ?? "B", race.targetGoal ?? null, race.swimDistanceKm ?? null, race.bikeDistanceKm ?? null, race.runDistanceKm ?? null, race.notes ?? null).run();
    const row = await c.env.DB.prepare("SELECT * FROM races WHERE id = ?").bind(id).first<RaceRow>();
    return c.json(toDto(row!));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

racesRoutes.put("/api/races/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const race = await c.req.json<Record<string, unknown>>();
    const existing = await c.env.DB.prepare("SELECT 1 FROM races WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ message: "Race not found" }, 404);
    await c.env.DB.prepare(
      `UPDATE races SET race_name = COALESCE(?, race_name), race_type = COALESCE(?, race_type), race_distance = COALESCE(?, race_distance), race_date = COALESCE(?, race_date), priority = COALESCE(?, priority), target_goal = COALESCE(?, target_goal), swim_distance_km = COALESCE(?, swim_distance_km), bike_distance_km = COALESCE(?, bike_distance_km), run_distance_km = COALESCE(?, run_distance_km), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(race.raceName ?? null, race.raceType ?? null, race.raceDistance ?? null, race.raceDate ?? null, race.priority ?? null, race.targetGoal ?? null, race.swimDistanceKm ?? null, race.bikeDistanceKm ?? null, race.runDistanceKm ?? null, race.notes ?? null, id).run();
    const row = await c.env.DB.prepare("SELECT * FROM races WHERE id = ?").bind(id).first<RaceRow>();
    return c.json(toDto(row!));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

racesRoutes.delete("/api/races/:id", async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM races WHERE id = ?").bind(c.req.param("id")).run();
    return new Response(null, { status: 204 });
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});
