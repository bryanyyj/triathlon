import { Hono } from "hono";
import type { Env } from "../index";
import { queryActivities, hasActivities } from "../lib/activityStore";
import { syncActivities } from "../lib/stravaSync";
import type { NormalizedActivity } from "../lib/normalizeActivity";

export const activitiesRoutes = new Hono<{ Bindings: Env }>();

export async function fetchNormalizedActivities(
  db: D1Database,
  env: Env,
  opts: { sport?: string; startDate?: string; endDate?: string; limit?: number } = {}
): Promise<NormalizedActivity[]> {
  if (!(await hasActivities(db))) {
    await syncActivities(db, env, true).catch(() => {});
  }
  return queryActivities(db, opts);
}

activitiesRoutes.get("/api/activities", async (c) => {
  try {
    const { sport, startDate, endDate, limit } = c.req.query();
    const activities = await fetchNormalizedActivities(c.env.DB, c.env, {
      sport,
      startDate,
      endDate,
      limit: limit ? Number(limit) : undefined,
    });
    return c.json(activities);
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});
