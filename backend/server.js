import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db.js";
import { healthRouter } from "./routes/health.js";
import { activitiesRouter } from "./routes/activities.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { racesRouter } from "./routes/races.js";
import { plannedWorkoutsRouter } from "./routes/plannedWorkouts.js";
import { aiCoachRouter } from "./routes/aiCoach.js";
import { stravaRouter } from "./routes/strava.js";
import { isStravaConnected } from "./lib/stravaClient.js";
import { syncActivities } from "./lib/stravaSync.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const origins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",");
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

app.use(cors({ origin: origins }));
app.use(express.json());

app.use(healthRouter);
app.use(activitiesRouter);
app.use(dashboardRouter);
app.use(racesRouter);
app.use(plannedWorkoutsRouter);
app.use(aiCoachRouter);
app.use(stravaRouter);

function syncIfConnected() {
  if (!isStravaConnected()) return;
  syncActivities().catch((error) => console.warn("Strava sync failed:", error.message));
}

app.listen(PORT, () => {
  console.log(`Backend API running at http://localhost:${PORT}`);
  syncIfConnected();
  setInterval(syncIfConnected, SYNC_INTERVAL_MS);
});
