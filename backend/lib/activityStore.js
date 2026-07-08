import { db } from "../db.js";
import { normalizeActivity } from "./normalizeActivity.js";

const upsertStatement = db.prepare(`
  INSERT INTO activities (
    id, name, sport_type, distance_m, moving_time_sec, elapsed_time_sec,
    elevation_gain_m, average_hr, max_hr, average_power, weighted_power, average_cadence, start_date, synced_at
  ) VALUES (
    @id, @name, @sport_type, @distance_m, @moving_time_sec, @elapsed_time_sec,
    @elevation_gain_m, @average_hr, @max_hr, @average_power, @weighted_power, @average_cadence, @start_date, CURRENT_TIMESTAMP
  )
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    sport_type = excluded.sport_type,
    distance_m = excluded.distance_m,
    moving_time_sec = excluded.moving_time_sec,
    elapsed_time_sec = excluded.elapsed_time_sec,
    elevation_gain_m = excluded.elevation_gain_m,
    average_hr = excluded.average_hr,
    max_hr = excluded.max_hr,
    average_power = excluded.average_power,
    weighted_power = excluded.weighted_power,
    average_cadence = excluded.average_cadence,
    start_date = excluded.start_date,
    synced_at = CURRENT_TIMESTAMP
`);

const upsertMany = db.transaction((rows) => {
  for (const row of rows) upsertStatement.run(row);
});

function toRow(activity) {
  return {
    id: activity.id,
    name: activity.name,
    sport_type: activity.sportType,
    distance_m: activity.distanceMeters,
    moving_time_sec: activity.movingTimeSeconds,
    elapsed_time_sec: activity.elapsedTimeSeconds,
    elevation_gain_m: activity.elevationGainMeters,
    average_hr: activity.averageHeartRate,
    max_hr: activity.maxHeartRate,
    average_power: activity.averagePower,
    weighted_power: activity.weightedPower,
    average_cadence: activity.averageCadence,
    start_date: activity.startDate,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    stravaActivityId: row.id,
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

export function upsertActivities(rawStravaActivities) {
  const rows = rawStravaActivities.map((activity) => toRow(normalizeActivity(activity)));
  if (rows.length) upsertMany(rows);
}

export function hasActivities() {
  return Boolean(db.prepare(`SELECT 1 FROM activities LIMIT 1`).get());
}

export function getLastSyncedStartDate() {
  const row = db.prepare(`SELECT MAX(start_date) AS maxDate FROM activities`).get();
  return row?.maxDate || null;
}

export function getMaxObservedHeartRate() {
  const row = db.prepare(`SELECT MAX(max_hr) AS maxHr FROM activities`).get();
  return row?.maxHr || null;
}

export function getActivityIdsMissingZones(limit) {
  const rows = db
    .prepare(
      `
      SELECT a.id FROM activities a
      LEFT JOIN activity_zone_seconds z ON z.activity_id = a.id
      WHERE z.activity_id IS NULL
      ORDER BY a.start_date DESC
      LIMIT ?
      `
    )
    .all(Number(limit));

  return rows.map((row) => row.id);
}

const saveZonesStatement = db.prepare(`
  INSERT INTO activity_zone_seconds (
    activity_id, z1_recovery_sec, z2_endurance_sec, z3_tempo_sec,
    z4_threshold_sec, z5_vo2max_sec, z6_anaerobic_sec, has_hr_data, fetched_at
  ) VALUES (@activity_id, @z1_recovery_sec, @z2_endurance_sec, @z3_tempo_sec,
    @z4_threshold_sec, @z5_vo2max_sec, @z6_anaerobic_sec, @has_hr_data, CURRENT_TIMESTAMP)
  ON CONFLICT(activity_id) DO UPDATE SET
    z1_recovery_sec = excluded.z1_recovery_sec,
    z2_endurance_sec = excluded.z2_endurance_sec,
    z3_tempo_sec = excluded.z3_tempo_sec,
    z4_threshold_sec = excluded.z4_threshold_sec,
    z5_vo2max_sec = excluded.z5_vo2max_sec,
    z6_anaerobic_sec = excluded.z6_anaerobic_sec,
    has_hr_data = excluded.has_hr_data,
    fetched_at = CURRENT_TIMESTAMP
`);

export function saveActivityZones(activityId, zoneSeconds, hasHrData) {
  saveZonesStatement.run({
    activity_id: activityId,
    z1_recovery_sec: zoneSeconds.z1_recovery_sec || 0,
    z2_endurance_sec: zoneSeconds.z2_endurance_sec || 0,
    z3_tempo_sec: zoneSeconds.z3_tempo_sec || 0,
    z4_threshold_sec: zoneSeconds.z4_threshold_sec || 0,
    z5_vo2max_sec: zoneSeconds.z5_vo2max_sec || 0,
    z6_anaerobic_sec: zoneSeconds.z6_anaerobic_sec || 0,
    has_hr_data: hasHrData ? 1 : 0,
  });
}

export function getZoneBackfillProgress() {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM activities`).get().c;
  const withZones = db.prepare(`SELECT COUNT(*) AS c FROM activity_zone_seconds`).get().c;
  return { total, withZones, missing: total - withZones };
}

export function getZoneTotalsBySport({ sport, startDate, endDate } = {}) {
  const values = [];
  const filters = [];

  if (sport && sport !== "all") {
    values.push(sport);
    filters.push(`a.sport_type = ?`);
  }

  if (startDate) {
    values.push(startDate);
    filters.push(`a.start_date >= ?`);
  }

  if (endDate) {
    values.push(endDate);
    filters.push(`a.start_date <= ?`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(z.z1_recovery_sec), 0) AS z1RecoverySec,
        COALESCE(SUM(z.z2_endurance_sec), 0) AS z2EnduranceSec,
        COALESCE(SUM(z.z3_tempo_sec), 0) AS z3TempoSec,
        COALESCE(SUM(z.z4_threshold_sec), 0) AS z4ThresholdSec,
        COALESCE(SUM(z.z5_vo2max_sec), 0) AS z5Vo2maxSec,
        COALESCE(SUM(z.z6_anaerobic_sec), 0) AS z6AnaerobicSec
      FROM activities a
      JOIN activity_zone_seconds z ON z.activity_id = a.id
      ${whereClause}
      `
    )
    .get(...values);

  return row;
}

export function queryActivities({ sport, startDate, endDate, limit = 5000 } = {}) {
  const values = [];
  const filters = [];

  if (sport && sport !== "all") {
    values.push(sport);
    filters.push(`sport_type = ?`);
  }

  if (startDate) {
    values.push(startDate);
    filters.push(`start_date >= ?`);
  }

  if (endDate) {
    values.push(endDate);
    filters.push(`start_date <= ?`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  values.push(Number(limit));

  const rows = db
    .prepare(
      `
      SELECT * FROM activities
      ${whereClause}
      ORDER BY start_date DESC
      LIMIT ?
      `
    )
    .all(...values);

  return rows.map(fromRow);
}
