export function normalizeActivity(activity) {
  return {
    id: String(activity.id),
    stravaActivityId: String(activity.id),
    name: activity.name || "Untitled Activity",
    sportType: normalizeSport(activity.sport_type || activity.type),
    distanceMeters: Number(activity.distance ?? 0),
    movingTimeSeconds: Number(activity.moving_time ?? 0),
    elapsedTimeSeconds: Number(activity.elapsed_time ?? 0),
    elevationGainMeters: Number(activity.total_elevation_gain ?? 0),
    averageHeartRate: activity.average_heartrate != null ? Number(activity.average_heartrate) : null,
    maxHeartRate: activity.max_heartrate != null ? Number(activity.max_heartrate) : null,
    averagePower: activity.average_watts != null ? Number(activity.average_watts) : null,
    weightedPower: activity.weighted_average_watts != null ? Number(activity.weighted_average_watts) : null,
    averageCadence: activity.average_cadence != null ? Number(activity.average_cadence) : null,
    startDate: activity.start_date || activity.start_date_local,
  };
}

function normalizeSport(sport) {
  const value = String(sport || "").toLowerCase();

  if (value.includes("swim")) return "swim";
  if (value.includes("bike") || value.includes("ride") || value.includes("cycling")) return "bike";
  if (value.includes("run")) return "run";

  return value || "other";
}
