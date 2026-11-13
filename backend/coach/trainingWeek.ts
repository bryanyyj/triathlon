import { addDateDays, WEEKDAYS, weekdayIndex } from "./dates.ts";
import { trainingSport } from "./schedule.ts";
import type { Activity, TrainingSport } from "./types.ts";

/**
 * The athlete's standing week: which sessions they do on which weekday, at what intensity,
 * for how long and at what time of day. Saved by the athlete, or detected from history.
 */

export type SessionIntensity = "easy" | "tempo" | "threshold" | "vo2" | "long";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export interface WeekSession {
  sport: TrainingSport;
  intensity: SessionIntensity;
  durationMin: number;
  timeOfDay: TimeOfDay;
}

/** Monday first. null = automatic (use detected), [] = rest day. */
export type TrainingWeek = (WeekSession[] | null)[];

export interface DetectedSession extends WeekSession {
  /** Weeks (of weeksObserved) this weekday had this sport. */
  weeks: number;
}

export interface DetectedWeek {
  days: DetectedSession[][];
  weeksObserved: number;
  from: string;
  through: string;
}

const SPORTS: TrainingSport[] = ["Swim", "Ride", "Run"];
const INTENSITIES: SessionIntensity[] = ["easy", "tempo", "threshold", "vo2", "long"];
const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening", "any"];

export const INTENSITY_LABEL: Record<SessionIntensity, string> = {
  easy: "easy/base (Z2)",
  tempo: "tempo (Z3)",
  threshold: "threshold (Z4)",
  vo2: "VO2/intervals (Z5)",
  long: "long endurance",
};

export function parseTrainingWeek(value: unknown): TrainingWeek {
  if (!Array.isArray(value) || value.length !== 7) throw new Error("Provide seven days, Monday to Sunday.");
  return value.map((day, index) => {
    if (day === null) return null;
    if (!Array.isArray(day) || day.length > 4) throw new Error(`${WEEKDAYS[index]}: expected a list of up to 4 sessions, [] for rest, or null.`);
    return day.map((session) => {
      const s = session as Partial<WeekSession>;
      const durationMin = Math.round(Number(s.durationMin));
      if (!SPORTS.includes(s.sport as TrainingSport)) throw new Error(`${WEEKDAYS[index]}: sport must be Swim, Ride or Run.`);
      if (!INTENSITIES.includes(s.intensity as SessionIntensity)) throw new Error(`${WEEKDAYS[index]}: unknown intensity "${s.intensity}".`);
      if (!(durationMin >= 5 && durationMin <= 600)) throw new Error(`${WEEKDAYS[index]}: duration must be 5–600 minutes.`);
      return {
        sport: s.sport as TrainingSport,
        intensity: s.intensity as SessionIntensity,
        durationMin,
        timeOfDay: TIMES.includes(s.timeOfDay as TimeOfDay) ? (s.timeOfDay as TimeOfDay) : "any",
      };
    });
  });
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let max = 0;
  for (const [v, n] of counts) if (n > max) ((best = v), (max = n));
  return best;
}

function timeOfDay(hour: number | undefined): TimeOfDay {
  if (hour === undefined) return "any";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Checked in order, so "3x2km threshold intervals" is threshold, not VO2.
const NAME_INTENSITY: [RegExp, SessionIntensity][] = [
  [/\b(threshold|ftp|sweet ?spot|lt|css)\b/i, "threshold"],
  [/\btempo\b/i, "tempo"],
  [/\b(vo2|intervals?|repeats?|sprints?|track|[0-9]+\s*x\s*[0-9]+)/i, "vo2"],
  [/\blong\b/i, "long"],
  [/\b(easy|recovery|base|z2|zone ?2|endurance|aerobic)\b/i, "easy"],
];

/**
 * One session per date and sport: a run split into several recordings (e.g. "Treadmill
 * Long Run #1…#4") counts as one run of the combined length, with time-weighted HR.
 */
function combineSessions(activities: Activity[]): Activity[] {
  const byDay = new Map<string, Activity[]>();
  for (const a of activities) {
    const key = `${a.date}|${trainingSport(a.type)}`;
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  return Array.from(byDay.values()).map((parts) => {
    if (parts.length === 1) return parts[0]!;
    const durationMin = parts.reduce((sum, a) => sum + a.durationMin, 0);
    const withHr = parts.filter((a) => a.avgHr);
    const hrMinutes = withHr.reduce((sum, a) => sum + a.durationMin, 0);
    return {
      ...parts[0]!,
      name: parts.map((a) => a.name).filter(Boolean).join(" + "),
      durationMin,
      startHour: Math.min(...parts.map((a) => a.startHour ?? 24)) % 24,
      avgHr: hrMinutes ? withHr.reduce((sum, a) => sum + a.avgHr! * a.durationMin, 0) / hrMinutes : undefined,
    };
  });
}

/**
 * Best guess at a session's intensity: keywords in its name first, then how its average HR
 * compares with the athlete's usual HR for that sport (relative, so it works across sports),
 * and "long" for easy sessions well beyond the sport's usual length.
 */
function classify(activity: Activity, sportHr: number | undefined, sportMinutes: number): SessionIntensity {
  for (const [pattern, intensity] of NAME_INTENSITY) if (activity.name && pattern.test(activity.name)) return intensity;
  let intensity: SessionIntensity = "easy";
  if (activity.avgHr && sportHr) {
    const ratio = activity.avgHr / sportHr;
    if (ratio >= 1.1) intensity = "vo2";
    else if (ratio >= 1.06) intensity = "threshold";
    else if (ratio >= 1.03) intensity = "tempo";
  }
  if (intensity === "easy" && activity.durationMin >= sportMinutes * 1.5 && activity.durationMin >= 75) intensity = "long";
  return intensity;
}

/** Recurring weekday sessions over the last eight completed weeks; a sport needs ≥ half the weeks (min 2). */
export function detectTrainingWeek(activities: Activity[], today: string): DetectedWeek {
  const monday = addDateDays(today, -weekdayIndex(today));
  const from = addDateDays(monday, -56);
  const through = addDateDays(monday, -1);
  const history = combineSessions(activities.filter((a) => a.date >= from && a.date <= through && trainingSport(a.type)));
  const oldest = history.map((a) => a.date).sort()[0];
  const weeksObserved = oldest
    ? Math.min(8, Math.ceil((Date.parse(monday) - Date.parse(addDateDays(oldest, -weekdayIndex(oldest)))) / (7 * 86400000)))
    : 0;
  const minWeeks = Math.max(2, Math.ceil(weeksObserved / 2));

  const sportStats = new Map<TrainingSport, { hr?: number; minutes: number }>();
  for (const sport of SPORTS) {
    const own = history.filter((a) => trainingSport(a.type) === sport);
    if (!own.length) continue;
    const hrs = own.map((a) => a.avgHr).filter((v): v is number => typeof v === "number");
    sportStats.set(sport, { hr: hrs.length ? median(hrs) : undefined, minutes: median(own.map((a) => a.durationMin)) });
  }

  const days = WEEKDAYS.map((_, weekday) =>
    SPORTS.flatMap<DetectedSession>((sport) => {
      const sessions = history.filter((a) => weekdayIndex(a.date) === weekday && trainingSport(a.type) === sport);
      const weeks = new Set(sessions.map((a) => a.date)).size;
      if (weeks < minWeeks) return [];
      const stats = sportStats.get(sport)!;
      return [{
        sport,
        weeks,
        durationMin: Math.round(median(sessions.map((a) => a.durationMin)) / 5) * 5,
        intensity: mostCommon(sessions.map((a) => classify(a, stats.hr, stats.minutes))) ?? "easy",
        timeOfDay: mostCommon(sessions.map((a) => timeOfDay(a.startHour))) ?? "any",
      }];
    }),
  );

  return { days, weeksObserved, from, through };
}

/** The saved week, with automatic days filled from detection. Sports per day feed buildSchedule. */
export function effectiveWeek(saved: TrainingWeek, detected: DetectedWeek) {
  return saved.map((day, i) => ({
    source: day !== null ? ("saved" as const) : detected.days[i]!.length ? ("detected" as const) : ("unknown" as const),
    sessions: day ?? detected.days[i]!,
  }));
}

function describe(session: WeekSession | DetectedSession): string {
  const when = session.timeOfDay === "any" ? "" : ` (${session.timeOfDay})`;
  const seen = "weeks" in session ? ` — seen ${session.weeks} weeks` : "";
  return `${session.sport} ${INTENSITY_LABEL[session.intensity]} ${session.durationMin}min${when}${seen}`;
}

/** Prompt block: the standing sessions the coach should repeat week to week. */
export function formatTrainingWeek(saved: TrainingWeek, detected: DetectedWeek): string {
  const week = effectiveWeek(saved, detected);
  return [
    "STANDING SESSIONS (the athlete's usual week; repeat these week to week):",
    ...week.map((day, i) => {
      const label = WEEKDAYS[i];
      if (day.source === "unknown") return `- ${label}: no fixed session [unspecified]`;
      if (!day.sessions.length) return `- ${label}: Rest [saved]`;
      return `- ${label}: ${day.sessions.map(describe).join("; ")} [${day.source}]`;
    }),
    `Detected sessions come from the last ${detected.weeksObserved} completed weeks (${detected.from} to ${detected.through}); saved ones are the athlete's own settings and win.`,
    "When planning, keep each standing session's sport, weekday, time of day, intensity and duration (e.g. a 50min tempo ride stays a ~50min tempo ride next week). " +
      "Progress gently within the session (≤10% longer, or a harder structure at the same intensity) rather than changing what it is. " +
      "Only change a standing session for a deload, low readiness, a race taper, or when the athlete asks, and say which session changed and why.",
  ].join("\n");
}
