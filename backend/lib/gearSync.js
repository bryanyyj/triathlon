import { fetchStravaAthlete, fetchStravaGearById, StravaRateLimitError } from "./stravaClient.js";
import { getDistinctGearIds } from "./activityStore.js";
import { upsertGear } from "./gearStore.js";

// Strava gear IDs are prefixed by type: bikes "b...", shoes "g...".
function classifyType(id, detail) {
  if (detail && detail.frame_type != null) return "bike";
  if (typeof id === "string" && id.startsWith("b")) return "bike";
  if (typeof id === "string" && id.startsWith("g")) return "shoe";
  return "other";
}

// Pulls every piece of gear the athlete owns — active gear from the /athlete
// endpoint, plus any (possibly retired) gear referenced by synced activities —
// and caches it in the DB. Retired = a gear id that is no longer in the
// athlete's active bikes/shoes lists. Called during Strava sync only, never on
// dashboard load, to respect Strava's rate limits.
export async function syncGear() {
  const athlete = await fetchStravaAthlete();
  const bikes = (athlete.bikes || []).map((g) => ({ ...g, type: "bike" }));
  const shoes = (athlete.shoes || []).map((g) => ({ ...g, type: "shoe" }));

  const summaries = new Map();
  for (const g of [...bikes, ...shoes]) summaries.set(String(g.id), g);
  const activeIds = new Set(summaries.keys());

  const allIds = new Set([...activeIds, ...getDistinctGearIds().map(String)]);

  const gearRows = [];
  for (const id of allIds) {
    let detail = null;
    try {
      detail = await fetchStravaGearById(id);
    } catch (err) {
      if (err instanceof StravaRateLimitError) break; // stop early, keep what we have
      // Otherwise skip this one and continue with the summary data below.
    }

    const summary = summaries.get(id);
    const type = summary?.type || classifyType(id, detail);
    const retired = detail?.retired ?? !activeIds.has(id);

    gearRows.push({
      id,
      type,
      name: detail?.name || summary?.name || id,
      brand: detail?.brand_name || null,
      model: detail?.model_name || null,
      distanceMeters: Number(detail?.distance ?? summary?.distance ?? 0),
      primary: Boolean(summary?.primary),
      retired,
    });
  }

  upsertGear(gearRows);
  return gearRows.length;
}
