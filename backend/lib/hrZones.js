// 6-zone model as a fraction of max heart rate, matching the common
// Recovery / Endurance / Tempo / Threshold / VO2max / Anaerobic breakdown.
const ZONE_UPPER_BOUNDS = [0.6, 0.7, 0.8, 0.9, 1.0];
const ZONE_KEYS = [
  "z1_recovery_sec",
  "z2_endurance_sec",
  "z3_tempo_sec",
  "z4_threshold_sec",
  "z5_vo2max_sec",
  "z6_anaerobic_sec",
];

function zoneIndexForHeartRate(hr, maxHr) {
  const ratio = hr / maxHr;
  for (let i = 0; i < ZONE_UPPER_BOUNDS.length; i += 1) {
    if (ratio < ZONE_UPPER_BOUNDS[i]) return i;
  }
  return ZONE_KEYS.length - 1;
}

// time/heartrate are parallel arrays from Strava's activity streams endpoint.
// Each gap between consecutive samples is credited to the zone of the sample at
// the start of that gap (time-weighted, not sample-count-weighted).
export function computeZoneSeconds(time, heartrate, maxHr) {
  const totals = Object.fromEntries(ZONE_KEYS.map((key) => [key, 0]));

  if (!maxHr || time.length < 2) return totals;

  for (let i = 0; i < time.length - 1; i += 1) {
    const durationSec = time[i + 1] - time[i];
    if (durationSec <= 0) continue;

    const zoneIndex = zoneIndexForHeartRate(heartrate[i], maxHr);
    totals[ZONE_KEYS[zoneIndex]] += durationSec;
  }

  return totals;
}
