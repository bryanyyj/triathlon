import { Router } from "express";
import { getGarminDays } from "../lib/garminStore.js";
import { getGarminState, startGarminSync } from "../lib/garminSync.js";

export const garminRouter = Router();

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;

garminRouter.get("/api/garmin/status", (req, res) => {
  res.json(getGarminState());
});

garminRouter.get("/api/garmin/daily", (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    res.json(getGarminDays({ startDate, endDate }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

garminRouter.post("/api/garmin/sync", (req, res) => {
  try {
    const requested = Math.trunc(Number(req.body?.days)) || DEFAULT_DAYS;
    startGarminSync(Math.min(MAX_DAYS, Math.max(1, requested)));
    res.status(202).json(getGarminState());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
