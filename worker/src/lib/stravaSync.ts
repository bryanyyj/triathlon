import type { Env } from "../index";
import { fetchStravaActivitiesSince, fetchActivityHeartRateStream, StravaRateLimitError } from "./stravaClient";
import {
  upsertActivities,
  getLastSyncedStartDate,
  getMaxObservedHeartRate,
  getActivityIdsMissingZones,
  saveActivityZones,
} from "./activityStore";
import { computeZoneSeconds } from "./hrZones";

const ZONE_BACKFILL_BATCH = 80;

export async function syncActivities(db: D1Database, env: Env, full = false): Promise<number> {
  let afterEpochSeconds: number | undefined;

  if (!full) {
    const lastDate = await getLastSyncedStartDate(db);
    if (lastDate) afterEpochSeconds = Math.floor(new Date(lastDate).getTime() / 1000);
  }

  const activities = await fetchStravaActivitiesSince(db, env, afterEpochSeconds);
  await upsertActivities(db, activities);
  return activities.length;
}

export async function backfillActivityZones(
  db: D1Database,
  env: Env,
  batchSize = ZONE_BACKFILL_BATCH
): Promise<{ processed: number; rateLimited: boolean }> {
  const maxHr = await getMaxObservedHeartRate(db);
  const activityIds = await getActivityIdsMissingZones(db, batchSize);

  let processed = 0;
  let rateLimited = false;

  for (const activityId of activityIds) {
    try {
      const stream = await fetchActivityHeartRateStream(db, env, activityId);
      if (stream && maxHr) {
        const zoneSeconds = computeZoneSeconds(stream.time, stream.heartrate, maxHr);
        await saveActivityZones(db, activityId, zoneSeconds, true);
      } else {
        await saveActivityZones(db, activityId, {}, false);
      }
      processed++;
    } catch (err) {
      if (err instanceof StravaRateLimitError) {
        rateLimited = true;
        break;
      }
      await saveActivityZones(db, activityId, {}, false);
      processed++;
    }
  }

  return { processed, rateLimited };
}
