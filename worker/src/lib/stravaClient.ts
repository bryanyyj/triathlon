import type { Env } from "../index";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const ACTIVITY_BASE_URL = "https://www.strava.com/api/v3/activities";
const PER_PAGE = 200;
const MAX_PAGES = 20;

// Module-level cache — survives across requests on the same isolate
let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

interface StoredAuth {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  athlete_name: string | null;
}

async function getStoredAuth(db: D1Database, env: Env): Promise<StoredAuth | null> {
  const row = await db.prepare("SELECT * FROM strava_auth WHERE id = 1").first<StoredAuth>();
  if (row) return row;
  if (env.STRAVA_REFRESH_TOKEN) {
    return { access_token: null, refresh_token: env.STRAVA_REFRESH_TOKEN, expires_at: 0, athlete_name: null };
  }
  return null;
}

async function saveAuth(
  db: D1Database,
  data: { access_token: string; refresh_token: string; expires_at: number; athlete?: Record<string, unknown> }
) {
  const athleteName = data.athlete
    ? `${data.athlete.firstname || ""} ${data.athlete.lastname || ""}`.trim() || null
    : null;
  const athleteId = data.athlete?.id != null ? String(data.athlete.id) : null;

  await db
    .prepare(
      `INSERT INTO strava_auth (id, access_token, refresh_token, expires_at, athlete_id, athlete_name, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         athlete_id = COALESCE(excluded.athlete_id, strava_auth.athlete_id),
         athlete_name = COALESCE(excluded.athlete_name, strava_auth.athlete_name),
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(data.access_token, data.refresh_token, data.expires_at, athleteId, athleteName)
    .run();
}

export async function isStravaConnected(db: D1Database, env: Env): Promise<boolean> {
  const auth = await getStoredAuth(db, env);
  return Boolean(auth?.refresh_token);
}

export async function getStravaAthleteName(db: D1Database, env: Env): Promise<string | null> {
  const auth = await getStoredAuth(db, env);
  return auth?.athlete_name ?? null;
}

export async function exchangeAuthorizationCode(db: D1Database, env: Env, code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json() as Record<string, unknown>;
  await saveAuth(db, data as Parameters<typeof saveAuth>[1]);
  cachedToken = data.access_token as string;
  cachedTokenExpiresAt = data.expires_at as number;
  return data;
}

async function getAccessToken(db: D1Database, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiresAt - 60) return cachedToken;

  const auth = await getStoredAuth(db, env);
  if (!auth?.refresh_token) throw new Error("Strava is not connected.");

  // Token is still valid — use it directly without refreshing
  if (auth.access_token && auth.expires_at && now < auth.expires_at - 60) {
    cachedToken = auth.access_token;
    cachedTokenExpiresAt = auth.expires_at;
    return cachedToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: auth.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json() as Record<string, unknown>;
  await saveAuth(db, data as Parameters<typeof saveAuth>[1]);
  cachedToken = data.access_token as string;
  cachedTokenExpiresAt = data.expires_at as number;
  return cachedToken;
}

export async function fetchStravaActivitiesSince(
  db: D1Database,
  env: Env,
  afterEpochSeconds?: number
): Promise<Record<string, unknown>[]> {
  const token = await getAccessToken(db, env);
  const activities: Record<string, unknown>[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(ACTIVITIES_URL);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    if (afterEpochSeconds) url.searchParams.set("after", String(afterEpochSeconds));

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Strava activities request failed (${res.status}): ${text}`);
    }

    const batch = await res.json() as Record<string, unknown>[];
    activities.push(...batch);
    if (batch.length < PER_PAGE) break;
  }

  return activities;
}

export class StravaRateLimitError extends Error {}

export async function fetchActivityHeartRateStream(
  db: D1Database,
  env: Env,
  activityId: string
): Promise<{ time: number[]; heartrate: number[] } | null> {
  const token = await getAccessToken(db, env);
  const url = new URL(`${ACTIVITY_BASE_URL}/${activityId}/streams`);
  url.searchParams.set("keys", "time,heartrate");
  url.searchParams.set("key_by_type", "true");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (res.status === 429) throw new StravaRateLimitError("Strava rate limit reached");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava streams request failed (${res.status}): ${text}`);
  }

  const data = await res.json() as Record<string, { data: number[] }>;
  const time = data.time?.data;
  const heartrate = data.heartrate?.data;
  if (!time?.length || !heartrate?.length) return null;

  return { time, heartrate };
}
