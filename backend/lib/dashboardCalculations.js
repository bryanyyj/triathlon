export function buildDashboardSummary(activities) {
  const triSports = activities.filter((a) => ["swim", "bike", "run"].includes(a.sportType));

  const totalWorkouts = triSports.length;
  const totalDistanceKm = sum(triSports.map((a) => a.distanceMeters)) / 1000;
  const totalDurationHours = sum(triSports.map((a) => a.movingTimeSeconds)) / 3600;
  const totalTss = sum(triSports.map(estimateActivityLoad));

  const bySport = {
    swim: summarizeSport(triSports, "swim"),
    bike: summarizeSport(triSports, "bike"),
    run: summarizeSport(triSports, "run"),
  };

  return { totalWorkouts, totalDistanceKm, totalDurationHours, totalTss, bySport };
}

function summarizeSport(activities, sport) {
  const filtered = activities.filter((a) => a.sportType === sport);

  return {
    sessions: filtered.length,
    distanceKm: sum(filtered.map((a) => a.distanceMeters)) / 1000,
    durationHours: sum(filtered.map((a) => a.movingTimeSeconds)) / 3600,
    averageHeartRate: average(filtered.map((a) => a.averageHeartRate).filter(Boolean)),
  };
}

export function buildWeeklyVolume(activities) {
  const map = new Map();

  for (const activity of activities) {
    if (!["swim", "bike", "run"].includes(activity.sportType)) continue;

    const week = getWeekKey(activity.startDate);

    if (!map.has(week)) {
      map.set(week, { week, swim: 0, bike: 0, run: 0, hours: 0 });
    }

    const item = map.get(week);
    item[activity.sportType] += activity.distanceMeters / 1000;
    item.hours += activity.movingTimeSeconds / 3600;
  }

  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
}

function getWeekKey(dateString) {
  const date = new Date(dateString);
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function estimateIntensityFactor(activity) {
  if (activity.averageHeartRate) {
    return Math.min(1.2, Math.max(0.5, activity.averageHeartRate / 145));
  }
  return 0.75;
}

export function estimateActivityLoad(activity) {
  const durationHours = activity.movingTimeSeconds / 3600;
  const intensityFactor = estimateIntensityFactor(activity);
  return durationHours * intensityFactor * 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateFatigueReadiness(activities) {
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

function sum(values) {
  return values.reduce((a, b) => a + Number(b || 0), 0);
}

function average(values) {
  if (!values.length) return null;
  return sum(values) / values.length;
}
