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
  swimHours: number;
  bikeHours: number;
  runHours: number;
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

export type GearType = "bike" | "shoe" | "other";

export type Gear = {
  id: string;
  type: GearType;
  name: string;
  brand: string | null;
  model: string | null;
  distanceMeters: number;
  primary: boolean;
  retired: boolean;
  activityCount: number;
  lastUsed: string | null;
};

export type GearMonthlyBreakdown = {
  month: string;
  sessions: number;
  distanceKm: number;
  durationMin: number;
};

export type GearRecentSession = {
  date: string;
  distanceKm: number;
  durationMin: number;
  avgHr: number | null;
  avgSpeed: number | null;
};

export type GearAnalytics = {
  totalSessions: number;
  avgDistanceKm: number;
  avgDurationMin: number;
  avgSpeedKmh: number | null;
  avgPaceMinKm: number | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  avgPower: number | null;
  totalElevationM: number;
  monthlyBreakdown: GearMonthlyBreakdown[];
  recentSessions: GearRecentSession[];
};

export type SportFilter = "all" | "swim" | "bike" | "run";

export type QuickFilter = "7d" | "30d" | "90d" | "ytd" | "all";

export type GarminStatus = {
  installed: boolean;
  signedIn: boolean;
  syncing: boolean;
  done: number;
  total: number;
  error: string | null;
  errorCode: string | null;
};

// One local calendar day. Sleep values describe the night that ended that morning.
export type GarminDay = {
  date: string;
  sleepSec?: number;
  deepSec?: number;
  lightSec?: number;
  remSec?: number;
  awakeSec?: number;
  sleepScore?: number;
  sleepStart?: string;
  sleepEnd?: string;
  sleepStress?: number;
  respiration?: number;
  steps?: number;
  stepGoal?: number;
  restingHr?: number;
  avgStress?: number;
  maxStress?: number;
  bodyBatteryHigh?: number;
  bodyBatteryLow?: number;
  bodyBatteryCharged?: number;
  bodyBatteryDrained?: number;
  totalCalories?: number;
  activeCalories?: number;
  intensityMinutes?: number;
  hrv?: number;
  hrvWeekly?: number;
  hrvBaselineLow?: number;
  hrvBaselineHigh?: number;
  hrvStatus?: string;
  readiness?: number;
  readinessLevel?: string;
};
