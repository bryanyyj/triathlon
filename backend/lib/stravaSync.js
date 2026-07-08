import { fetchStravaActivitiesSince, fetchActivityHeartRateStream, StravaRateLimitError } from "./stravaClient.js";
import {
  upsertActivities,
  getLastSyncedStartDate,
  getMaxObservedHeartRate,
  getActivityIdsMissingZones,
  saveActivityZones,
} from "./activityStore.js";
import { computeZoneSeconds } from "./hrZones.js";

const DEFAULT_ZONE_BACKFILL_BATCH = 80;

let syncInFlight = null;
let zoneBackfillInFlight = null;

export function syncActivities({ full = false } = {}) {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    let afterEpochSeconds;

    if (!full) {
      const lastDate = getLastSyncedStartDate();
      if (lastDate) afterEpochSeconds = Math.floor(new Date(lastDate).getTime() / 1000);
    }

    const activities = await fetchStravaActivitiesSince(afterEpochSeconds);
    upsertActivities(activities);
    return activities.length;
  })();

  return syncInFlight.finally(() => {
    syncInFlight = null;
  });
}

export function backfillActivityZones({ batchSize = DEFAULT_ZONE_BACKFILL_BATCH } = {}) {
  if (zoneBackfillInFlight) return zoneBackfillInFlight;

  zoneBackfillInFlight = (async () => {
    const maxHr = getMaxObservedHeartRate();
    const activityIds = getActivityIdsMissingZones(batchSize);

    let processed = 0;
    let rateLimited = false;

    for (const activityId of activityIds) {
      try {
        const stream = await fetchActivityHeartRateStream(activityId);

        if (stream) {
          const zoneSeconds = computeZoneSeconds(stream.time, stream.heartrate, maxHr);
          saveActivityZones(activityId, zoneSeconds, true);
        } else {
          saveActivityZones(activityId, {}, false);
        }

        processed += 1;
      } catch (error) {
        if (error instanceof StravaRateLimitError) {
          rateLimited = true;
          break;
        }
        saveActivityZones(activityId, {}, false);
        processed += 1;
      }
    }

    return { processed, rateLimited };
  })();

  return zoneBackfillInFlight.finally(() => {
    zoneBackfillInFlight = null;
  });
}
