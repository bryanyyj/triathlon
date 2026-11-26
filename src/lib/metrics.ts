import type { GarminDay } from "../types";
import type { FitnessDay } from "./fitness";
import { addDays, fromDateKey, toDateKey } from "./dates";

export type DayRow = GarminDay & {
  load?: number;
  loadPrev?: number;
  sleepHours?: number;
  deep?: number;
  light?: number;
  rem?: number;
  awake?: number;
};

const hours = (seconds?: number) => (seconds == null ? undefined : seconds / 3600);

/** One row per date in `dates`, joining Garmin values with that day's training load. */
export function buildDayRows(dates: string[], garminDays: GarminDay[], fitness: FitnessDay[]): DayRow[] {
  const garmin = new Map(garminDays.map((d) => [d.date, d]));
  const load = new Map(fitness.map((d) => [d.date, d.load]));
  return dates.map((date) => {
    const day: GarminDay = garmin.get(date) ?? { date };
    return {
      ...day,
      load: load.get(date),
      loadPrev: load.get(toDateKey(addDays(fromDateKey(date), -1))),
      sleepHours: hours(day.sleepSec),
      deep: hours(day.deepSec),
      light: hours(day.lightSec),
      rem: hours(day.remSec),
      awake: hours(day.awakeSec),
    };
  });
}

export const METRICS = [
  { key: "load", label: "Training load", unit: "TSS", digits: 0 },
  { key: "loadPrev", label: "Training load the day before", unit: "TSS", digits: 0 },
  { key: "sleepHours", label: "Sleep", unit: "h", digits: 1 },
  { key: "sleepScore", label: "Sleep score", unit: "", digits: 0 },
  { key: "deep", label: "Deep sleep", unit: "h", digits: 1 },
  { key: "hrv", label: "HRV", unit: "ms", digits: 0 },
  { key: "restingHr", label: "Resting heart rate", unit: "bpm", digits: 0 },
  { key: "bodyBatteryHigh", label: "Body Battery peak", unit: "", digits: 0 },
  { key: "avgStress", label: "Stress", unit: "", digits: 0 },
  { key: "readiness", label: "Training readiness", unit: "", digits: 0 },
  { key: "steps", label: "Steps", unit: "", digits: 0 },
  { key: "intensityMinutes", label: "Intensity minutes", unit: "min", digits: 0 },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export const metric = (key: MetricKey) => METRICS.find((m) => m.key === key)!;

export function formatMetric(key: MetricKey, value: number): string {
  const { digits, unit } = metric(key);
  const text = value.toLocaleString(undefined, { maximumFractionDigits: digits });
  return unit ? `${text} ${unit}` : text;
}

/** Pearson correlation of paired values, or null when there is too little to say. */
export function correlation(pairs: [number, number][]): number | null {
  if (pairs.length < 5) return null;
  const mean = (i: 0 | 1) => pairs.reduce((s, p) => s + p[i], 0) / pairs.length;
  const mx = mean(0);
  const my = mean(1);
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (const [x, y] of pairs) {
    xy += (x - mx) * (y - my);
    xx += (x - mx) ** 2;
    yy += (y - my) ** 2;
  }
  return xx && yy ? xy / Math.sqrt(xx * yy) : null;
}

export function describeCorrelation(pairs: [number, number][]): string {
  const r = correlation(pairs);
  if (r == null) return `${pairs.length} matching days · too few to compare`;
  const size = Math.abs(r);
  const strength = size < 0.2 ? "no clear" : size < 0.4 ? "a weak" : size < 0.7 ? "a moderate" : "a strong";
  const direction = size < 0.2 ? "link" : r > 0 ? "rise together" : "move in opposite directions";
  const verdict = size < 0.2 ? `${strength} ${direction}` : `${strength} tendency to ${direction}`;
  return `${pairs.length} days · r = ${r.toFixed(2)} · ${verdict}`;
}
