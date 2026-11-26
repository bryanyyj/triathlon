import { db } from "../db.js";

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function saveGarminDay(date, data, { merge = false } = {}) {
  let next = data;
  if (merge) {
    const row = db.prepare(`SELECT data FROM garmin_daily WHERE date = ?`).get(date);
    if (row) next = { ...parse(row.data), ...data };
  }
  db.prepare(
    `
    INSERT INTO garmin_daily (date, data, synced_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET data = excluded.data, synced_at = CURRENT_TIMESTAMP
    `
  ).run(date, JSON.stringify(next));
}

export function getSyncedDates() {
  return new Set(db.prepare(`SELECT date FROM garmin_daily`).all().map((row) => row.date));
}

export function getGarminDays({ startDate, endDate } = {}) {
  return db
    .prepare(`SELECT date, data FROM garmin_daily WHERE date >= ? AND date <= ? ORDER BY date ASC`)
    .all(startDate || "0000-00-00", endDate || "9999-99-99")
    .map((row) => ({ ...parse(row.data), date: row.date }));
}
