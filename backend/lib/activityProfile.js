import { db } from "../db.js";
import { fetchActivityStreams, StravaRateLimitError } from "./stravaClient.js";
import { getMaxObservedHeartRate } from "./activityStore.js";
import { zoneIndexForHeartRate } from "./hrZones.js";

// Bars per activity in History. Enough to show intervals, small enough to cache cheaply.
const BUCKETS = 60;
// Strava allows ~100 reads per 15 min; cap how many uncached activities one request fetches.
const MAX_FETCH_PER_REQUEST = 20;

const STREAM_KEYS = ["time", "heartrate", "watts", "velocity_smooth"];

// Which stream drives bar height: power for rides, speed for runs/swims, HR as the fallback.
const METRIC_PREFERENCE = {
  bike: ["watts", "velocity_smooth", "heartrate"],
  run: ["velocity_smooth", "heartrate"],
  swim: ["velocity_smooth", "heartrate"],
  other: ["heartrate", "velocity_smooth"],
};

function hasSignal(values) {
  return Array.isArray(values) && values.some((v) => v > 0);
}

/**
 * Averages the chosen effort stream into equal-time buckets. Each bucket also gets the
 * HR zone (0–5) of its average heart rate, or null when there is no HR stream.
 */
export function buildProfile(streams, sportType, maxHr) {
  const time = streams?.time?.data;
  if (!time?.length) return null;

  const metric = (METRIC_PREFERENCE[sportType] || METRIC_PREFERENCE.other).find((key) => hasSignal(streams[key]?.data));
  if (!metric) return null;

  const values = streams[metric].data;
  const heartrate = hasSignal(streams.heartrate?.data) ? streams.heartrate.data : null;
  const end = time[time.length - 1] || 1;

  const sums = new Array(BUCKETS).fill(0);
  const hrSums = new Array(BUCKETS).fill(0);
  const counts = new Array(BUCKETS).fill(0);

  for (let i = 0; i < time.length; i += 1) {
    const bucket = Math.min(BUCKETS - 1, Math.floor((time[i] / end) * BUCKETS));
    sums[bucket] += values[i] || 0;
    if (heartrate) hrSums[bucket] += heartrate[i] || 0;
    counts[bucket] += 1;
  }

  return {
    metric,
    values: sums.map((sum, i) => (counts[i] ? Math.round((sum / counts[i]) * 10) / 10 : 0)),
    zones: hrSums.map((sum, i) =>
      heartrate && maxHr && counts[i] && sum > 0 ? zoneIndexForHeartRate(sum / counts[i], maxHr) : null
    ),
  };
}

const selectCached = db.prepare(`SELECT profile FROM activity_profiles WHERE activity_id = ?`);
const saveCached = db.prepare(`
  INSERT INTO activity_profiles (activity_id, profile) VALUES (?, ?)
  ON CONFLICT(activity_id) DO UPDATE SET profile = excluded.profile, fetched_at = CURRENT_TIMESTAMP
`);
const selectSport = db.prepare(`SELECT sport_type FROM activities WHERE id = ?`);

/**
 * Profiles for the given activity ids: cached ones straight from SQLite, missing ones
 * fetched from Strava (up to MAX_FETCH_PER_REQUEST). `pending` lists ids not fetched yet,
 * because of the cap or Strava's rate limit, so the client can ask again later.
 */
export async function getActivityProfiles(ids) {
  const profiles = {};
  const missing = [];

  for (const id of ids) {
    const row = selectCached.get(id);
    if (row) profiles[id] = row.profile ? JSON.parse(row.profile) : null;
    else missing.push(id);
  }

  const maxHr = getMaxObservedHeartRate();
  const pending = [];
  let rateLimited = false;

  for (const [index, id] of missing.entries()) {
    if (rateLimited || index >= MAX_FETCH_PER_REQUEST) {
      pending.push(id);
      continue;
    }
    try {
      const streams = await fetchActivityStreams(id, STREAM_KEYS);
      const profile = buildProfile(streams, selectSport.get(id)?.sport_type, maxHr);
      saveCached.run(id, profile ? JSON.stringify(profile) : null);
      profiles[id] = profile;
    } catch (error) {
      // Leave it uncached so a later request retries; stop calling Strava once rate limited.
      if (error instanceof StravaRateLimitError) rateLimited = true;
      pending.push(id);
    }
  }

  return { profiles, pending, rateLimited };
}
