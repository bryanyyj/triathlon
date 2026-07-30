import { Router } from "express";
import { queryActivities } from "../lib/activityStore.js";

export const activitiesRouter = Router();

export async function fetchNormalizedActivities({ sport, startDate, endDate, limit = 5000 } = {}) {
  return queryActivities({ sport, startDate, endDate, limit });
}

activitiesRouter.get("/api/activities", async (req, res) => {
  try {
    const { sport, startDate, endDate, limit } = req.query;
    const activities = await fetchNormalizedActivities({ sport, startDate, endDate, limit });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
