const ZONE_UPPER_BOUNDS = [0.6, 0.7, 0.8, 0.9, 1.0];
const ZONE_KEYS = [
  "z1_recovery_sec",
  "z2_endurance_sec",
  "z3_tempo_sec",
  "z4_threshold_sec",
  "z5_vo2max_sec",
  "z6_anaerobic_sec",
] as const;

export type ZoneSeconds = Record<(typeof ZONE_KEYS)[number], number>;

function zoneIndex(hr: number, maxHr: number): number {
  const ratio = hr / maxHr;
  for (let i = 0; i < ZONE_UPPER_BOUNDS.length; i++) {
    if (ratio < ZONE_UPPER_BOUNDS[i]) return i;
  }
  return ZONE_KEYS.length - 1;
}

export function computeZoneSeconds(time: number[], heartrate: number[], maxHr: number): ZoneSeconds {
  const totals = Object.fromEntries(ZONE_KEYS.map((k) => [k, 0])) as ZoneSeconds;
  if (!maxHr || time.length < 2) return totals;

  for (let i = 0; i < time.length - 1; i++) {
    const duration = time[i + 1] - time[i];
    if (duration <= 0) continue;
    totals[ZONE_KEYS[zoneIndex(heartrate[i], maxHr)]] += duration;
  }

  return totals;
}
