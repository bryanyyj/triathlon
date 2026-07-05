function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function sum(values) {
  return values.reduce((a, b) => a + Number(b || 0), 0);
}

function activitiesSince(activities, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return activities.filter((a) => new Date(a.startDate) >= cutoff);
}

function bySport(activities, sport) {
  return activities.filter((a) => a.sportType === sport);
}

function longestDistanceKm(activities) {
  if (!activities.length) return 0;
  return Math.max(...activities.map((a) => a.distanceMeters / 1000));
}

function weeklyAverageDistanceKm(activities, weeks) {
  return sum(activities.map((a) => a.distanceMeters)) / 1000 / weeks;
}

function weeksWithActivity(activities, weeks) {
  const weekSet = new Set();
  for (const a of activities) {
    const d = new Date(a.startDate);
    const monday = new Date(d);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
    weekSet.add(monday.toISOString().slice(0, 10));
  }
  return clamp((weekSet.size / weeks) * 100);
}

function longRunTargetKm(race) {
  if (race.runDistanceKm) return race.runDistanceKm * 0.7;
  const distance = (race.raceDistance || "").toLowerCase();
  if (distance.includes("marathon") && !distance.includes("half")) return 32;
  if (distance.includes("half")) return 16;
  return 18;
}

function longRideTargetKm(race) {
  if (race.bikeDistanceKm) return race.bikeDistanceKm * 0.6;
  return 80;
}

function computeRunningReadiness(activities, race) {
  const recent8w = activitiesSince(activities, 56);
  const runs = bySport(recent8w, "run");
  const recent4w = activitiesSince(activities, 28);
  const recentRuns = bySport(recent4w, "run");

  const longRunScore = clamp((longestDistanceKm(runs) / longRunTargetKm(race)) * 100);
  const weeklyVolumeScore = clamp((weeklyAverageDistanceKm(recentRuns, 4) / 40) * 100);
  const consistencyScore = weeksWithActivity(runs, 8);
  const paceTrendScore = 65;

  const readinessScore =
    longRunScore * 0.35 + weeklyVolumeScore * 0.3 + consistencyScore * 0.25 + paceTrendScore * 0.1;

  return { trainingProgress: Math.round(weeklyVolumeScore), readinessScore: Math.round(clamp(readinessScore)) };
}

function computeCyclingReadiness(activities, race) {
  const recent8w = activitiesSince(activities, 56);
  const rides = bySport(recent8w, "bike");
  const recent4w = activitiesSince(activities, 28);
  const recentRides = bySport(recent4w, "bike");

  const longRideScore = clamp((longestDistanceKm(rides) / longRideTargetKm(race)) * 100);
  const weeklyVolumeScore = clamp((weeklyAverageDistanceKm(recentRides, 4) / 150) * 100);
  const intensityControlScore = 70;
  const elevationScore = 70;

  const readinessScore =
    longRideScore * 0.4 + weeklyVolumeScore * 0.3 + intensityControlScore * 0.2 + elevationScore * 0.1;

  return { trainingProgress: Math.round(weeklyVolumeScore), readinessScore: Math.round(clamp(readinessScore)) };
}

function computeSwimmingReadiness(activities) {
  const recent8w = activitiesSince(activities, 56);
  const swims = bySport(recent8w, "swim");
  const recent4w = activitiesSince(activities, 28);
  const recentSwims = bySport(recent4w, "swim");

  const longSwimScore = clamp((longestDistanceKm(swims) / 3) * 100);
  const weeklyVolumeScore = clamp((weeklyAverageDistanceKm(recentSwims, 4) / 8) * 100);
  const consistencyScore = weeksWithActivity(swims, 8);

  const readinessScore = longSwimScore * 0.4 + weeklyVolumeScore * 0.35 + consistencyScore * 0.25;

  return { trainingProgress: Math.round(weeklyVolumeScore), readinessScore: Math.round(clamp(readinessScore)) };
}

function computeTriathlonReadiness(activities, race) {
  const swim = computeSwimmingReadiness(activities);
  const bike = computeCyclingReadiness(activities, race);
  const run = computeRunningReadiness(activities, race);

  const recent8w = activitiesSince(activities, 56);
  const brickScore = clamp(weeksWithActivity(bySport(recent8w, "bike"), 8) * 0.6 + weeksWithActivity(bySport(recent8w, "run"), 8) * 0.4);

  const readinessScore =
    swim.readinessScore * 0.25 + bike.readinessScore * 0.3 + run.readinessScore * 0.3 + brickScore * 0.15;

  const trainingProgress = Math.round((swim.trainingProgress + bike.trainingProgress + run.trainingProgress) / 3);

  return { trainingProgress, readinessScore: Math.round(clamp(readinessScore)) };
}

export function calculateRaceReadiness(race, activities) {
  switch (race.raceType) {
    case "running":
      return computeRunningReadiness(activities, race);
    case "cycling":
      return computeCyclingReadiness(activities, race);
    case "swimming":
      return computeSwimmingReadiness(activities);
    case "duathlon":
    case "triathlon":
    case "ironman_70_3":
    case "ironman":
      return computeTriathlonReadiness(activities, race);
    default:
      return { trainingProgress: 0, readinessScore: 0 };
  }
}
