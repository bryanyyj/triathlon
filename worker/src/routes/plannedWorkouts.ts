import { Hono } from "hono";
import type { Env } from "../index";
import { fetchNormalizedActivities } from "./activities";

export const plannedWorkoutsRoutes = new Hono<{ Bindings: Env }>();

interface WorkoutRow {
  id: string;
  date: string;
  sport_type: string;
  workout_type: string | null;
  planned_duration_min: number | null;
  planned_distance_km: number | null;
  target_zone: string | null;
  target_tss: number | null;
  notes: string | null;
  matched_activity_id: string | null;
  status: string;
}

function toDto(row: WorkoutRow) {
  return {
    id: row.id,
    date: row.date,
    sportType: row.sport_type,
    workoutType: row.workout_type,
    plannedDurationMin: row.planned_duration_min,
    plannedDistanceKm: row.planned_distance_km,
    targetZone: row.target_zone,
    targetTss: row.target_tss,
    notes: row.notes,
    matchedActivityId: row.matched_activity_id,
    status: row.status,
  };
}

function matchWorkout(
  planned: ReturnType<typeof toDto>,
  activities: { id: string; sportType: string; startDate: string; movingTimeSeconds: number }[]
) {
  const candidates = activities.filter(
    (a) => a.sportType === planned.sportType && a.startDate.slice(0, 10) === planned.date
  );
  if (!candidates.length) return null;
  return candidates.sort((a, b) => {
    const target = planned.plannedDurationMin ?? 0;
    return Math.abs(a.movingTimeSeconds / 60 - target) - Math.abs(b.movingTimeSeconds / 60 - target);
  })[0];
}

plannedWorkoutsRoutes.get("/api/planned-workouts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM planned_workouts ORDER BY date ASC").all<WorkoutRow>();
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, { limit: 5000 }).catch(() => []);
    const today = new Date().toISOString().slice(0, 10);

    const workouts = results.map((row) => {
      const workout = toDto(row);
      if (workout.status !== "planned") return workout;
      const match = matchWorkout(workout, activities);
      if (match) return { ...workout, matchedActivityId: match.id, status: "completed" };
      if (workout.date < today) return { ...workout, status: "missed" };
      return workout;
    });

    return c.json(workouts);
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

plannedWorkoutsRoutes.post("/api/planned-workouts", async (c) => {
  try {
    const workout = await c.req.json<Record<string, unknown>>();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO planned_workouts (id, date, sport_type, workout_type, planned_duration_min, planned_distance_km, target_zone, target_tss, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, workout.date, workout.sportType, workout.workoutType ?? null, workout.plannedDurationMin ?? null, workout.plannedDistanceKm ?? null, workout.targetZone ?? null, workout.targetTss ?? null, workout.notes ?? null, workout.status ?? "planned").run();
    const row = await c.env.DB.prepare("SELECT * FROM planned_workouts WHERE id = ?").bind(id).first<WorkoutRow>();
    return c.json(toDto(row!));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

plannedWorkoutsRoutes.put("/api/planned-workouts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const workout = await c.req.json<Record<string, unknown>>();
    const existing = await c.env.DB.prepare("SELECT 1 FROM planned_workouts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ message: "Planned workout not found" }, 404);
    await c.env.DB.prepare(
      `UPDATE planned_workouts SET date = COALESCE(?, date), sport_type = COALESCE(?, sport_type), workout_type = COALESCE(?, workout_type), planned_duration_min = COALESCE(?, planned_duration_min), planned_distance_km = COALESCE(?, planned_distance_km), target_zone = COALESCE(?, target_zone), target_tss = COALESCE(?, target_tss), notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(workout.date ?? null, workout.sportType ?? null, workout.workoutType ?? null, workout.plannedDurationMin ?? null, workout.plannedDistanceKm ?? null, workout.targetZone ?? null, workout.targetTss ?? null, workout.notes ?? null, workout.status ?? null, id).run();
    const row = await c.env.DB.prepare("SELECT * FROM planned_workouts WHERE id = ?").bind(id).first<WorkoutRow>();
    return c.json(toDto(row!));
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});

plannedWorkoutsRoutes.delete("/api/planned-workouts/:id", async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM planned_workouts WHERE id = ?").bind(c.req.param("id")).run();
    return new Response(null, { status: 204 });
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});
