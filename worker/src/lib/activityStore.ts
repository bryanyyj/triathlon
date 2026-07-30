import { normalizeActivity, type NormalizedActivity } from "./normalizeActivity";

interface ActivityRow {
  id: string;
  name: string;
  sport_type: string;
  distance_m: number;
  moving_time_sec: number;
  elapsed_time_sec: number;
  elevation_gain_m: number;
  average_hr: number | null;
  max_hr: number | null;
  average_power: number | null;
  weighted_power: number | null;
  average_cadence: number | null;
  start_date: string;
}

function fromRow(row: ActivityRow): NormalizedActivity {
  return {
    id: row.id,
    name: row.name,
    sportType: row.sport_type,
    distanceMeters: row.distance_m,
    movingTimeSeconds: row.moving_time_sec,
    elapsedTimeSeconds: row.elapsed_time_sec,
    elevationGainMeters: row.elevation_gain_m,
    averageHeartRate: row.average_hr,
    maxHeartRate: row.max_hr,
    averagePower: row.average_power,
    weightedPower: row.weighted_power,
    averageCadence: row.average_cadence,
    startDate: row.start_date,
  };
}

export async function upsertActivities(db: D1Database, rawActivities: Record<string, unknown>[]) {
  if (!rawActivities.length) return;

  const normalized = rawActivities.map(normalizeActivity);

  const statements = normalized.map((a) =>
    db
      .prepare(
        `INSERT INTO activities (
          id, name, sport_type, distance_m, moving_time_sec, elapsed_time_sec,
          elevation_gain_m, average_hr, max_hr, average_power, weighted_power,
          average_cadence, start_date, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, sport_type = excluded.sport_type,
          distance_m = excluded.distance_m, moving_time_sec = excluded.moving_time_sec,
          elapsed_time_sec = excluded.elapsed_time_sec, elevation_gain_m = excluded.elevation_gain_m,
          average_hr = excluded.average_hr, max_hr = excluded.max_hr,
          average_power = excluded.average_power, weighted_power = excluded.weighted_power,
          average_cadence = excluded.average_cadence, start_date = excluded.start_date,
          synced_at = CURRENT_TIMESTAMP`
      )
      .bind(
        a.id, a.name, a.sportType, a.distanceMeters, a.movingTimeSeconds, a.elapsedTimeSeconds,
        a.elevationGainMeters, a.averageHeartRate, a.maxHeartRate, a.averagePower,
        a.weightedPower, a.averageCadence, a.startDate
      )
  );

  // D1 batch limit is 100 statements; chunk if needed
  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }
}

export async function hasActivities(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM activities LIMIT 1").first();
  return row !== null;
}

export async function getLastSyncedStartDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare("SELECT MAX(start_date) AS maxDate FROM activities").first<{ maxDate: string | null }>();
  return row?.maxDate ?? null;
}

export async function getMaxObservedHeartRate(db: D1Database): Promise<number | null> {
  const row = await db.prepare("SELECT MAX(max_hr) AS maxHr FROM activities").first<{ maxHr: number | null }>();
  return row?.maxHr ?? null;
}

export async function getActivityIdsMissingZones(db: D1Database, limit: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id FROM activities a
       LEFT JOIN activity_zone_seconds z ON z.activity_id = a.id
       WHERE z.activity_id IS NULL
       ORDER BY a.start_date DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<{ id: string }>();

  return results.map((r) => r.id);
}

export async function saveActivityZones(
  db: D1Database,
  activityId: string,
  zoneSeconds: Record<string, number>,
  hasHrData: boolean
) {
  await db
    .prepare(
      `INSERT INTO activity_zone_seconds (
         activity_id, z1_recovery_sec, z2_endurance_sec, z3_tempo_sec,
         z4_threshold_sec, z5_vo2max_sec, z6_anaerobic_sec, has_hr_data, fetched_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(activity_id) DO UPDATE SET
         z1_recovery_sec = excluded.z1_recovery_sec, z2_endurance_sec = excluded.z2_endurance_sec,
         z3_tempo_sec = excluded.z3_tempo_sec, z4_threshold_sec = excluded.z4_threshold_sec,
         z5_vo2max_sec = excluded.z5_vo2max_sec, z6_anaerobic_sec = excluded.z6_anaerobic_sec,
         has_hr_data = excluded.has_hr_data, fetched_at = CURRENT_TIMESTAMP`
    )
    .bind(
      activityId,
      zoneSeconds.z1_recovery_sec ?? 0,
      zoneSeconds.z2_endurance_sec ?? 0,
      zoneSeconds.z3_tempo_sec ?? 0,
      zoneSeconds.z4_threshold_sec ?? 0,
      zoneSeconds.z5_vo2max_sec ?? 0,
      zoneSeconds.z6_anaerobic_sec ?? 0,
      hasHrData ? 1 : 0
    )
    .run();
}

export async function queryActivities(
  db: D1Database,
  { sport, startDate, endDate, limit = 5000 }: { sport?: string; startDate?: string; endDate?: string; limit?: number } = {}
): Promise<NormalizedActivity[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (sport && sport !== "all") {
    conditions.push("sport_type = ?");
    bindings.push(sport);
  }
  if (startDate) {
    conditions.push("start_date >= ?");
    bindings.push(startDate);
  }
  if (endDate) {
    conditions.push("start_date <= ?");
    bindings.push(endDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  bindings.push(limit);

  const { results } = await db
    .prepare(`SELECT * FROM activities ${where} ORDER BY start_date DESC LIMIT ?`)
    .bind(...bindings)
    .all<ActivityRow>();

  return results.map(fromRow);
}
