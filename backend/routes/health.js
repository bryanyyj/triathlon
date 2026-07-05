import { Router } from "express";
import { db } from "../db.js";
import { isStravaConnected } from "../lib/stravaClient.js";

export const healthRouter = Router();

healthRouter.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", database: "connected", strava: isStravaConnected() ? "connected" : "not_connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
