import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { fetchNormalizedActivities } from "./activities.js";
import { calculateRaceReadiness } from "../lib/raceReadiness.js";

export const racesRouter = Router();

function toRaceDto(row) {
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

racesRouter.get("/api/races", async (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM races ORDER BY race_date ASC`).all();
    const activities = await fetchNormalizedActivities({ limit: 5000 }).catch(() => []);

    const races = rows.map((row) => {
      const race = toRaceDto(row);
      const readiness = calculateRaceReadiness(race, activities);
      return { ...race, ...readiness };
    });

    res.json(races);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

racesRouter.post("/api/races", async (req, res) => {
  try {
    const race = req.body;
    const id = randomUUID();

    db.prepare(
      `
      INSERT INTO races (
        id, race_name, race_type, race_distance, race_date, priority,
        target_goal, swim_distance_km, bike_distance_km, run_distance_km, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      race.raceName,
      race.raceType,
      race.raceDistance || null,
      race.raceDate,
      race.priority || "B",
      race.targetGoal || null,
      race.swimDistanceKm ?? null,
      race.bikeDistanceKm ?? null,
      race.runDistanceKm ?? null,
      race.notes || null
    );

    const row = db.prepare(`SELECT * FROM races WHERE id = ?`).get(id);
    res.json(toRaceDto(row));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

racesRouter.put("/api/races/:id", async (req, res) => {
  try {
    const race = req.body;

    const existing = db.prepare(`SELECT * FROM races WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ message: "Race not found" });

    db.prepare(
      `
      UPDATE races SET
        race_name = COALESCE(?, race_name),
        race_type = COALESCE(?, race_type),
        race_distance = COALESCE(?, race_distance),
        race_date = COALESCE(?, race_date),
        priority = COALESCE(?, priority),
        target_goal = COALESCE(?, target_goal),
        swim_distance_km = COALESCE(?, swim_distance_km),
        bike_distance_km = COALESCE(?, bike_distance_km),
        run_distance_km = COALESCE(?, run_distance_km),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run(
      race.raceName,
      race.raceType,
      race.raceDistance,
      race.raceDate,
      race.priority,
      race.targetGoal,
      race.swimDistanceKm,
      race.bikeDistanceKm,
      race.runDistanceKm,
      race.notes,
      req.params.id
    );

    const row = db.prepare(`SELECT * FROM races WHERE id = ?`).get(req.params.id);
    res.json(toRaceDto(row));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

racesRouter.delete("/api/races/:id", async (req, res) => {
  try {
    db.prepare(`DELETE FROM races WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
