import { Hono } from "hono";
import type { Env } from "../index";
import { fetchNormalizedActivities } from "./activities";

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

function sum(values: number[]) {
  return values.reduce((a, b) => a + (Number(b) || 0), 0);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return sum(values) / values.length;
}

function summarizeSport(activities: ReturnType<typeof Array.prototype.filter>, sport: string) {
  const filtered = (activities as { sportType: string; distanceMeters: number; movingTimeSeconds: number; averageHeartRate: number | null }[]).filter(
    (a) => a.sportType === sport
  );
  return {
    sessions: filtered.length,
    distanceKm: sum(filtered.map((a) => a.distanceMeters)) / 1000,
    durationHours: sum(filtered.map((a) => a.movingTimeSeconds)) / 3600,
    averageHeartRate: average(
      filtered.map((a) => a.averageHeartRate).filter((v): v is number => v != null)
    ),
  };
}

function getWeekKey(dateString: string): string {
  const d = new Date(dateString);
  const monday = new Date(d);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  return monday.toISOString().slice(0, 10);
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function estimateLoad(a: { movingTimeSeconds: number; averageHeartRate: number | null }) {
  const intensity = a.averageHeartRate ? Math.min(1.2, Math.max(0.5, a.averageHeartRate / 145)) : 0.75;
  return (a.movingTimeSeconds / 3600) * intensity * 100;
}

dashboardRoutes.get("/api/dashboard/summary", async (c) => {
  try {
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, { limit: 5000 });
    const tri = activities.filter((a) => ["swim", "bike", "run"].includes(a.sportType));
    return c.json({
      totalWorkouts: tri.length,
      totalDistanceKm: sum(tri.map((a) => a.distanceMeters)) / 1000,
      totalDurationHours: sum(tri.map((a) => a.movingTimeSeconds)) / 3600,
      totalTss: sum(tri.map(estimateLoad)),
      bySport: {
        swim: summarizeSport(tri, "swim"),
        bike: summarizeSport(tri, "bike"),
        run: summarizeSport(tri, "run"),
      },
    });
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

dashboardRoutes.get("/api/dashboard/weekly-volume", async (c) => {
  try {
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, { limit: 5000 });
    const map = new Map<string, { week: string; swim: number; bike: number; run: number; hours: number }>();

    for (const a of activities) {
      if (!["swim", "bike", "run"].includes(a.sportType)) continue;
      const week = getWeekKey(a.startDate);
      if (!map.has(week)) map.set(week, { week, swim: 0, bike: 0, run: 0, hours: 0 });
      const item = map.get(week)!;
      (item as unknown as Record<string, number>)[a.sportType] += a.distanceMeters / 1000;
      item.hours += a.movingTimeSeconds / 3600;
    }

    return c.json(Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week)));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

dashboardRoutes.get("/api/dashboard/fatigue", async (c) => {
  try {
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, { limit: 5000 });
    const now = new Date();
    const acute = new Date(now); acute.setDate(acute.getDate() - 7);
    const chronic = new Date(now); chronic.setDate(chronic.getDate() - 28);

    const acuteLoad = sum(activities.filter((a) => new Date(a.startDate) >= acute).map(estimateLoad));
    const chronicLoad = sum(activities.filter((a) => new Date(a.startDate) >= chronic).map(estimateLoad)) / 4;
    const fatigueScore = clamp(50 + (acuteLoad - chronicLoad) * 1.5);

    return c.json({ fatigueScore, readinessScore: clamp(100 - fatigueScore), acuteLoad, chronicLoad });
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});
