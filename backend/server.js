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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const origins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",");

app.use(cors({ origin: origins }));
app.use(express.json());

app.use(healthRouter);
app.use(activitiesRouter);
app.use(dashboardRouter);
app.use(racesRouter);
app.use(plannedWorkoutsRouter);
app.use(aiCoachRouter);
app.use(stravaRouter);

// Strava is only ever called on initial connect or when the user clicks "Re-pull" in
// the UI (POST /api/strava/sync) — no polling, to stay well under Strava's rate limit.
app.listen(PORT, () => {
  console.log(`Backend API running at http://localhost:${PORT}`);
});
