export type SportType = "swim" | "bike" | "run" | "other";

export type RaceType =
  | "running"
  | "cycling"
  | "swimming"
  | "duathlon"
  | "triathlon"
  | "ironman_70_3"
  | "ironman"
  | "custom";

export type RacePriority = "A" | "B" | "C";

export type Race = {
  id: string;
  raceName: string;
  raceType: RaceType;
  raceDistance?: string;
  raceDate: string;
  priority?: RacePriority;
  targetGoal?: string;
  swimDistanceKm?: number;
  bikeDistanceKm?: number;
  runDistanceKm?: number;
  notes?: string;
  trainingProgress?: number;
  readinessScore?: number;
};

export type Activity = {
  id: string;
  stravaActivityId: string;
  name: string;
  sportType: SportType;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averagePower: number | null;
  weightedPower: number | null;
  averageCadence: number | null;
  startDate: string;
};

export type SportSummary = {
  sessions: number;
  distanceKm: number;
  durationHours: number;
  averageHeartRate: number | null;
};

export type DashboardSummary = {
  totalWorkouts: number;
  totalDistanceKm: number;
  totalDurationHours: number;
  totalTss?: number;
  bySport: {
    swim: SportSummary;
    bike: SportSummary;
    run: SportSummary;
  };
};

export type WeeklyVolumePoint = {
  week: string;
  swim: number;
  bike: number;
  run: number;
  hours: number;
};

export type PlannedWorkoutStatus = "planned" | "completed" | "missed";

export type PlannedWorkout = {
  id: string;
  date: string;
  sportType: SportType;
  workoutType?: string;
  plannedDurationMin?: number;
  plannedDistanceKm?: number;
  targetZone?: string;
  targetTss?: number;
  notes?: string;
  matchedActivityId?: string | null;
  status: PlannedWorkoutStatus;
};

export type FatigueReadiness = {
  fatigueScore: number;
  readinessScore: number;
  acuteLoad: number;
  chronicLoad: number;
};

export type ZoneSeconds = {
  z1RecoverySec: number;
  z2EnduranceSec: number;
  z3TempoSec: number;
  z4ThresholdSec: number;
  z5Vo2maxSec: number;
  z6AnaerobicSec: number;
};

export type HrZonesBySport = {
  swim: ZoneSeconds;
  bike: ZoneSeconds;
  run: ZoneSeconds;
};

export type SportFilter = "all" | "swim" | "bike" | "run";

export type QuickFilter = "7d" | "30d" | "90d" | "ytd" | "all";
