import type { Activity, DashboardSummary, FatigueReadiness, SportSummary, WeeklyVolumePoint } from "../types";

function sum(values: number[]): number {
  return values.reduce((a, b) => a + (b || 0), 0);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return sum(values) / values.length;
}

function summarizeSport(activities: Activity[], sport: "swim" | "bike" | "run"): SportSummary {
  const filtered = activities.filter((a) => a.sportType === sport);
  return {
    sessions: filtered.length,
    distanceKm: sum(filtered.map((a) => a.distanceMeters)) / 1000,
    durationHours: sum(filtered.map((a) => a.movingTimeSeconds)) / 3600,
    averageHeartRate: average(filtered.map((a) => a.averageHeartRate).filter((v): v is number => v != null)),
  };
}

export function buildDashboardSummary(activities: Activity[]): DashboardSummary {
  const triSports = activities.filter((a) => ["swim", "bike", "run"].includes(a.sportType));

  return {
    totalWorkouts: triSports.length,
    totalDistanceKm: sum(triSports.map((a) => a.distanceMeters)) / 1000,
    totalDurationHours: sum(triSports.map((a) => a.movingTimeSeconds)) / 3600,
    totalTss: sum(triSports.map((a) => estimateActivityLoad(a))),
    bySport: {
      swim: summarizeSport(triSports, "swim"),
      bike: summarizeSport(triSports, "bike"),
      run: summarizeSport(triSports, "run"),
    },
  };
}

function getWeekKey(dateString: string): string {
  const date = new Date(dateString);
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export function buildWeeklyVolume(activities: Activity[]): WeeklyVolumePoint[] {
  const map = new Map<string, WeeklyVolumePoint>();

  for (const activity of activities) {
    if (!["swim", "bike", "run"].includes(activity.sportType)) continue;

    const week = getWeekKey(activity.startDate);

    if (!map.has(week)) {
      map.set(week, { week, swim: 0, bike: 0, run: 0, hours: 0 });
    }

    const item = map.get(week)!;
    const sport = activity.sportType as "swim" | "bike" | "run";
    item[sport] += activity.distanceMeters / 1000;
    item.hours += activity.movingTimeSeconds / 3600;
  }

  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
}

export function buildDailyLoad(activities: Activity[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const activity of activities) {
    if (!["swim", "bike", "run"].includes(activity.sportType)) continue;
    const day = activity.startDate.slice(0, 10);
    map.set(day, (map.get(day) || 0) + estimateActivityLoad(activity));
  }

  return map;
}

export type WeeklyTssPoint = { week: string; tss: number };

export function buildWeeklyTss(activities: Activity[]): WeeklyTssPoint[] {
  const map = new Map<string, number>();

  for (const activity of activities) {
    if (!["swim", "bike", "run"].includes(activity.sportType)) continue;
    const week = getWeekKey(activity.startDate);
    map.set(week, (map.get(week) || 0) + estimateActivityLoad(activity));
  }

  return Array.from(map.entries())
    .map(([week, tss]) => ({ week, tss }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function estimateIntensityFactor(activity: Activity): number {
  if (activity.averageHeartRate) {
    return Math.min(1.2, Math.max(0.5, activity.averageHeartRate / 145));
  }
  return 0.75;
}

export function estimateActivityLoad(activity: Activity): number {
  const durationHours = activity.movingTimeSeconds / 3600;
  const intensityFactor = estimateIntensityFactor(activity);
  return durationHours * intensityFactor * 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateFatigueReadiness(activities: Activity[]): FatigueReadiness {
  const now = new Date();
  const acuteCutoff = new Date(now);
  acuteCutoff.setDate(acuteCutoff.getDate() - 7);
  const chronicCutoff = new Date(now);
  chronicCutoff.setDate(chronicCutoff.getDate() - 28);

  const acuteActivities = activities.filter((a) => new Date(a.startDate) >= acuteCutoff);
  const chronicActivities = activities.filter((a) => new Date(a.startDate) >= chronicCutoff);

  const acuteLoad = sum(acuteActivities.map(estimateActivityLoad));
  const chronicLoad = sum(chronicActivities.map(estimateActivityLoad)) / 4;

  const fatigueScore = clamp(50 + (acuteLoad - chronicLoad) * 1.5, 0, 100);
  const readinessScore = clamp(100 - fatigueScore, 0, 100);

  return { fatigueScore, readinessScore, acuteLoad, chronicLoad };
}
