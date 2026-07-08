import dotenv from "dotenv";
import { db } from "../db.js";

dotenv.config();

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const ACTIVITY_BASE_URL = "https://www.strava.com/api/v3/activities";
const PER_PAGE = 200;
const MAX_PAGES = 20;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function getClientCredentials() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Strava API is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in backend/.env.");
  }

  return { clientId, clientSecret };
}

function getStoredAuth() {
  const row = db.prepare(`SELECT * FROM strava_auth WHERE id = 1`).get();
  if (row) return row;

  if (process.env.STRAVA_REFRESH_TOKEN) {
    return { access_token: null, refresh_token: process.env.STRAVA_REFRESH_TOKEN, expires_at: 0, athlete_name: null };
  }

  return null;
}

function saveAuth({ access_token, refresh_token, expires_at, athlete }) {
  db.prepare(
    `
    INSERT INTO strava_auth (id, access_token, refresh_token, expires_at, athlete_id, athlete_name, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      athlete_id = COALESCE(excluded.athlete_id, strava_auth.athlete_id),
      athlete_name = COALESCE(excluded.athlete_name, strava_auth.athlete_name),
      updated_at = CURRENT_TIMESTAMP
    `
  ).run(
    access_token ?? null,
    refresh_token ?? null,
    expires_at ?? null,
    athlete?.id != null ? String(athlete.id) : null,
    athlete ? `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim() || null : null
  );
}

export function isStravaConnected() {
  return Boolean(getStoredAuth()?.refresh_token);
}

export function getStravaAthleteName() {
  return getStoredAuth()?.athlete_name || null;
}

export async function exchangeAuthorizationCode(code) {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  saveAuth(data);
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = data.expires_at;
  return data;
}

async function getAccessToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && nowSeconds < cachedAccessTokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  const auth = getStoredAuth();
  if (!auth?.refresh_token) {
    throw new Error('Strava is not connected. Click "Connect Strava" to authorize.');
  }

  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: auth.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  saveAuth(data);
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = data.expires_at;
  return cachedAccessToken;
}

export async function fetchStravaActivitiesSince(afterEpochSeconds) {
  const accessToken = await getAccessToken();
  const activities = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(ACTIVITIES_URL);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    if (afterEpochSeconds) url.searchParams.set("after", String(afterEpochSeconds));

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Strava activities request failed (${response.status}): ${text}`);
    }

    const batch = await response.json();
    activities.push(...batch);

    if (batch.length < PER_PAGE) break;
  }

  return activities;
}

export class StravaRateLimitError extends Error {}

// Returns { time: number[], heartrate: number[] } or null if the activity has no HR stream.
export async function fetchActivityHeartRateStream(activityId) {
  const accessToken = await getAccessToken();
  const url = new URL(`${ACTIVITY_BASE_URL}/${activityId}/streams`);
  url.searchParams.set("keys", "time,heartrate");
  url.searchParams.set("key_by_type", "true");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (response.status === 404) return null;
  if (response.status === 429) throw new StravaRateLimitError("Strava rate limit reached");

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava streams request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const time = data.time?.data;
  const heartrate = data.heartrate?.data;

  if (!time?.length || !heartrate?.length) return null;

  return { time, heartrate };
}
