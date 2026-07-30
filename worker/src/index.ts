import { Hono } from "hono";
import { cors } from "hono/cors";
import { stravaRoutes } from "./routes/strava";
import { activitiesRoutes } from "./routes/activities";
import { dashboardRoutes } from "./routes/dashboard";
import { racesRoutes } from "./routes/races";
import { plannedWorkoutsRoutes } from "./routes/plannedWorkouts";
import { syncActivities, backfillActivityZones } from "./lib/stravaSync";
import { isStravaConnected } from "./lib/stravaClient";

export interface Env {
  DB: D1Database;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_REFRESH_TOKEN: string;
  FRONTEND_ORIGINS: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const origins = (c.env.FRONTEND_ORIGINS || "http://localhost:5173").split(",").map((o) => o.trim());
  return cors({ origin: origins })(c, next);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/", stravaRoutes);
app.route("/", activitiesRoutes);
app.route("/", dashboardRoutes);
app.route("/", racesRoutes);
app.route("/", plannedWorkoutsRoutes);

export default {
  fetch: app.fetch,

  // Cron trigger: runs every 15 minutes per wrangler.toml schedule
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const connected = await isStravaConnected(env.DB, env);
        if (!connected) return;
        await syncActivities(env.DB, env).catch((err) =>
          console.warn("Scheduled sync failed:", err.message)
        );
        await backfillActivityZones(env.DB, env).catch((err) =>
          console.warn("Zone backfill failed:", err.message)
        );
      })()
    );
  },
};
