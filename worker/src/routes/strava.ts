import { Hono } from "hono";
import type { Env } from "../index";
import { isStravaConnected, getStravaAthleteName, exchangeAuthorizationCode } from "../lib/stravaClient";
import { syncActivities } from "../lib/stravaSync";

export const stravaRoutes = new Hono<{ Bindings: Env }>();

function frontendUrl(env: Env) {
  return (env.FRONTEND_ORIGINS || "http://localhost:5173").split(",")[0].trim();
}

stravaRoutes.get("/api/strava/status", async (c) => {
  const [connected, athleteName] = await Promise.all([
    isStravaConnected(c.env.DB, c.env),
    getStravaAthleteName(c.env.DB, c.env),
  ]);
  return c.json({ connected, athleteName });
});

stravaRoutes.get("/api/strava/connect", (c) => {
  if (!c.env.STRAVA_CLIENT_ID) {
    return c.text("STRAVA_CLIENT_ID is not configured.", 500);
  }
  const redirectUri = new URL("/api/strava/callback", new URL(c.req.url).origin).toString();
  const url =
    `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(c.env.STRAVA_CLIENT_ID)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=auto&scope=activity:read_all`;
  return c.redirect(url);
});

stravaRoutes.get("/api/strava/callback", async (c) => {
  const { code, error } = c.req.query();
  try {
    if (error) throw new Error(String(error));
    if (!code) throw new Error("Missing authorization code from Strava");

    await exchangeAuthorizationCode(c.env.DB, c.env, code);
    syncActivities(c.env.DB, c.env, true).catch((err) =>
      console.warn("Post-connect sync failed:", err.message)
    );

    return c.redirect(`${frontendUrl(c.env)}?strava=connected`);
  } catch (err) {
    return c.redirect(
      `${frontendUrl(c.env)}?strava=error&message=${encodeURIComponent((err as Error).message)}`
    );
  }
});

stravaRoutes.post("/api/strava/sync", async (c) => {
  try {
    const body = await c.req.json<{ full?: boolean }>().catch(() => ({ full: false }));
    const count = await syncActivities(c.env.DB, c.env, Boolean((body as { full?: boolean }).full));
    return c.json({ synced: count });
  } catch (err) {
    return c.json({ message: (err as Error).message }, 500);
  }
});
