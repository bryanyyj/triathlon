import type { Activity } from "../types";
import { estimateActivityLoad } from "./calculations";
import { addDays, fromDateKey, toDateKey } from "./dates";

export type FitnessDay = { date: string; load: number; fitness: number; fatigue: number; form: number };

const FITNESS_DAYS = 42; // chronic load (CTL)
const FATIGUE_DAYS = 7; // acute load (ATL)

/**
 * Fitness (CTL), fatigue (ATL) and form (TSB) for every day from the first
 * activity to today. Form is yesterday's fitness minus yesterday's fatigue.
 * Load is this app's heart-rate estimate, not power-based TSS.
 */
export function buildFitnessSeries(activities: Activity[]): FitnessDay[] {
  const loads = new Map<string, number>();
  for (const activity of activities) {
    const key = toDateKey(new Date(activity.startDate));
    loads.set(key, (loads.get(key) || 0) + estimateActivityLoad(activity));
  }
  if (!loads.size) return [];

  const today = toDateKey(new Date());
  const series: FitnessDay[] = [];
  let fitness = 0;
  let fatigue = 0;

  for (let date = fromDateKey([...loads.keys()].sort()[0]); toDateKey(date) <= today; date = addDays(date, 1)) {
    const key = toDateKey(date);
    const load = loads.get(key) || 0;
    const form = fitness - fatigue;
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    series.push({ date: key, load, fitness, fatigue, form });
  }

  return series;
}
