import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { fetchNormalizedActivities } from "./activities.js";
import { matchWorkout } from "../lib/workoutMatching.js";

export const plannedWorkoutsRouter = Router();

function toWorkoutDto(row) {
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

plannedWorkoutsRouter.get("/api/planned-workouts", async (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM planned_workouts ORDER BY date ASC`).all();
    const activities = await fetchNormalizedActivities({ limit: 5000 }).catch(() => []);
    const today = new Date().toISOString().slice(0, 10);

    const workouts = rows.map((row) => {
      const workout = toWorkoutDto(row);
      if (workout.status !== "planned") return workout;

      const match = matchWorkout(workout, activities);
      if (match) {
        return { ...workout, matchedActivityId: match.id, status: "completed" };
      }
      if (workout.date < today) {
        return { ...workout, status: "missed" };
      }
      return workout;
    });

    res.json(workouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

plannedWorkoutsRouter.post("/api/planned-workouts", async (req, res) => {
  try {
    const workout = req.body;
    const id = randomUUID();

    db.prepare(
      `
      INSERT INTO planned_workouts (
        id, date, sport_type, workout_type, planned_duration_min,
        planned_distance_km, target_zone, target_tss, notes, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      workout.date,
      workout.sportType,
      workout.workoutType || null,
      workout.plannedDurationMin ?? null,
      workout.plannedDistanceKm ?? null,
      workout.targetZone || null,
      workout.targetTss ?? null,
      workout.notes || null,
      workout.status || "planned"
    );

    const row = db.prepare(`SELECT * FROM planned_workouts WHERE id = ?`).get(id);
    res.json(toWorkoutDto(row));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

plannedWorkoutsRouter.put("/api/planned-workouts/:id", async (req, res) => {
  try {
    const workout = req.body;

    const existing = db.prepare(`SELECT * FROM planned_workouts WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ message: "Planned workout not found" });

    db.prepare(
      `
      UPDATE planned_workouts SET
        date = COALESCE(?, date),
        sport_type = COALESCE(?, sport_type),
        workout_type = COALESCE(?, workout_type),
        planned_duration_min = COALESCE(?, planned_duration_min),
        planned_distance_km = COALESCE(?, planned_distance_km),
        target_zone = COALESCE(?, target_zone),
        target_tss = COALESCE(?, target_tss),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run(
      workout.date,
      workout.sportType,
      workout.workoutType,
      workout.plannedDurationMin,
      workout.plannedDistanceKm,
      workout.targetZone,
      workout.targetTss,
      workout.notes,
      workout.status,
      req.params.id
    );

    const row = db.prepare(`SELECT * FROM planned_workouts WHERE id = ?`).get(req.params.id);
    res.json(toWorkoutDto(row));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

plannedWorkoutsRouter.delete("/api/planned-workouts/:id", async (req, res) => {
  try {
    db.prepare(`DELETE FROM planned_workouts WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
