import { Router } from "express";
import { getActivityZoneMap, queryActivities } from "../lib/activityStore.js";
import { getActivityProfiles } from "../lib/activityProfile.js";

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

// ?ids=a,b,c → { profiles: { [id]: profile | null }, pending: string[], rateLimited }
activitiesRouter.get("/api/activities/profiles", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100);
    res.json(await getActivityProfiles(ids));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

activitiesRouter.get("/api/activities/zones", (req, res) => {
  try {
    res.json(getActivityZoneMap());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
