import { Router } from "express";
import { fetchNormalizedActivities } from "./activities.js";
import { buildDashboardSummary, buildWeeklyVolume, calculateFatigueReadiness } from "../lib/dashboardCalculations.js";

export const dashboardRouter = Router();

dashboardRouter.get("/api/dashboard/summary", async (req, res) => {
  try {
    const activities = await fetchNormalizedActivities({ limit: 5000 });
    res.json(buildDashboardSummary(activities));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

dashboardRouter.get("/api/dashboard/weekly-volume", async (req, res) => {
  try {
    const activities = await fetchNormalizedActivities({ limit: 5000 });
    res.json(buildWeeklyVolume(activities));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

dashboardRouter.get("/api/dashboard/fatigue", async (req, res) => {
  try {
    const activities = await fetchNormalizedActivities({ limit: 5000 });
    res.json(calculateFatigueReadiness(activities));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
