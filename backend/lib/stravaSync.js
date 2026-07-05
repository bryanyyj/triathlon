import { fetchStravaActivitiesSince } from "./stravaClient.js";
import { upsertActivities, getLastSyncedStartDate } from "./activityStore.js";

let syncInFlight = null;

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
