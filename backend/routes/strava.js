import { Router } from "express";
import { exchangeAuthorizationCode, isStravaConnected, getStravaAthleteName } from "../lib/stravaClient.js";
import { syncActivities, backfillActivityZones } from "../lib/stravaSync.js";
import { syncGear } from "../lib/gearSync.js";
import { getZoneBackfillProgress } from "../lib/activityStore.js";

export const stravaRouter = Router();

function frontendUrl() {
  return (process.env.FRONTEND_ORIGINS || "http://localhost:5173").split(",")[0].trim();
}

let syncingInBackground = false;
let backgroundTasksInFlight = false;

export function getSyncingState() { return syncingInBackground; }

// Zone backfill + gear sync fire many sequential Strava requests and can easily
// exceed the client's request timeout. Run them detached so the HTTP response
// (and the freshly pulled activities) return immediately. `syncingInBackground`
// stays true while they run so the frontend can poll /status and refresh when done.
function runBackgroundSyncTasks() {
  if (backgroundTasksInFlight) return;
  backgroundTasksInFlight = true;
  syncingInBackground = true;
  (async () => {
    try {
      await backfillActivityZones();
      await syncGear();
    } catch (err) {
      console.warn("Background sync tasks failed:", err.message);
    } finally {
      backgroundTasksInFlight = false;
      syncingInBackground = false;
    }
  })();
}

stravaRouter.get("/api/strava/status", (req, res) => {
  res.json({ connected: isStravaConnected(), athleteName: getStravaAthleteName(), syncing: syncingInBackground });
});

stravaRouter.get("/api/strava/connect", (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;

  if (!clientId) {
    res.status(500).send("STRAVA_CLIENT_ID is not configured on the backend.");
    return;
  }

  const redirectUri = `${req.protocol}://${req.get("host")}/api/strava/callback`;
  const authorizeUrl =
    `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=auto&scope=activity:read_all,profile:read_all`;

  res.redirect(authorizeUrl);
});

stravaRouter.get("/api/strava/callback", async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) throw new Error(String(error));
    if (!code) throw new Error("Missing authorization code from Strava");

    await exchangeAuthorizationCode(String(code));
    syncingInBackground = true;
    syncActivities({ full: true })
      .then(() => backfillActivityZones())
      .then(() => syncGear())
      .catch((err) => console.warn("Post-connect Strava sync failed:", err.message))
      .finally(() => { syncingInBackground = false; });

    res.redirect(`${frontendUrl()}?strava=connected&syncing=true`);
  } catch (err) {
    res.redirect(`${frontendUrl()}?strava=error&message=${encodeURIComponent(err.message)}`);
  }
});

stravaRouter.get("/api/strava/zones-status", (req, res) => {
  res.json(getZoneBackfillProgress());
});

stravaRouter.post("/api/strava/sync", async (req, res) => {
  try {
    const synced = await syncActivities({ full: Boolean(req.body?.full) });
    // Kick off the slow HR-zone + gear work without blocking the response.
    runBackgroundSyncTasks();
    res.json({ synced });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
