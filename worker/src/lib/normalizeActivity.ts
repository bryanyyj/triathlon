export interface NormalizedActivity {
  id: string;
  name: string;
  sportType: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averagePower: number | null;
  weightedPower: number | null;
  averageCadence: number | null;
  startDate: string;
}

function normalizeSport(sport: string): string {
  const value = String(sport || "").toLowerCase();
  if (value.includes("swim")) return "swim";
  if (value.includes("bike") || value.includes("ride") || value.includes("cycling")) return "bike";
  if (value.includes("run")) return "run";
  return value || "other";
}

export function normalizeActivity(activity: Record<string, unknown>): NormalizedActivity {
  return {
    id: String(activity.id),
    name: String(activity.name || "Untitled Activity"),
    sportType: normalizeSport(String(activity.sport_type || activity.type || "")),
    distanceMeters: Number(activity.distance ?? 0),
    movingTimeSeconds: Number(activity.moving_time ?? 0),
    elapsedTimeSeconds: Number(activity.elapsed_time ?? 0),
    elevationGainMeters: Number(activity.total_elevation_gain ?? 0),
    averageHeartRate: activity.average_heartrate != null ? Number(activity.average_heartrate) : null,
    maxHeartRate: activity.max_heartrate != null ? Number(activity.max_heartrate) : null,
    averagePower: activity.average_watts != null ? Number(activity.average_watts) : null,
    weightedPower: activity.weighted_average_watts != null ? Number(activity.weighted_average_watts) : null,
    averageCadence: activity.average_cadence != null ? Number(activity.average_cadence) : null,
    startDate: String(activity.start_date || activity.start_date_local || ""),
  };
}
