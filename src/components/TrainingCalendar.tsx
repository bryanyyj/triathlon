import { useMemo, useState } from "react";
import type { Activity, PlannedWorkout } from "../types";
import { MULTI_SPORT_COLOR, REST_COLOR, SPORT_COLORS, SPORT_LABELS } from "../lib/sportColors";

type TriSport = keyof typeof SPORT_COLORS;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Below this, a day still reads as "active" but is faded toward the rest color;
// above it, opacity ramps up to fully saturated by DURATION_FULL_HOURS.
const DURATION_FULL_HOURS = 2.5;
const MIN_ACTIVE_OPACITY = 0.35;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first weekday index (0=Mon..6=Sun), matching calculations.ts's week convention.
function mondayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// Race order, so a brick day reads swim → bike → run left to right.
const SPORT_ORDER: TriSport[] = ["swim", "bike", "run"];

// Seconds per sport for the day; empty for a rest day.
type DayInfo = { segments: { sport: TriSport; seconds: number }[]; hours: number };

const REST_DAY: DayInfo = { segments: [], hours: 0 };

function dayOpacity(info: DayInfo): number {
  if (!info.segments.length) return 1;
  return Math.min(1, MIN_ACTIVE_OPACITY + (1 - MIN_ACTIVE_OPACITY) * (info.hours / DURATION_FULL_HOURS));
}

// Activity start times are UTC; bucket them by the athlete's local calendar day.
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isTriSport(sport: Activity["sportType"]): sport is TriSport {
  return sport === "swim" || sport === "bike" || sport === "run";
}

function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${pad2(m)}m` : `${m} min`;
}

function activitySummary(activity: Activity): string {
  const distance = !activity.distanceMeters
    ? null
    : activity.sportType === "swim"
      ? `${Math.round(activity.distanceMeters)} m`
      : `${(activity.distanceMeters / 1000).toFixed(1)} km`;
  return [
    isTriSport(activity.sportType) ? SPORT_LABELS[activity.sportType] : "Workout",
    formatDuration(activity.movingTimeSeconds),
    distance,
    activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function plannedSportColor(sport: PlannedWorkout["sportType"]): string {
  return sport === "other" ? MULTI_SPORT_COLOR : SPORT_COLORS[sport];
}

// One outline color per day: the sport's color, or the multi color for mixed days.
function plannedDayColor(workouts: PlannedWorkout[]): string {
  const sports = new Set(workouts.map((w) => w.sportType));
  return sports.size > 1 ? MULTI_SPORT_COLOR : plannedSportColor(workouts[0].sportType);
}

function plannedSummary(workout: PlannedWorkout): string {
  return [
    workout.sportType === "other" ? "Workout" : SPORT_LABELS[workout.sportType],
    workout.plannedDurationMin ? `${workout.plannedDurationMin} min` : null,
    workout.plannedDistanceKm ? `${workout.plannedDistanceKm} km` : null,
    workout.targetZone,
  ]
    .filter(Boolean)
    .join(" · ");
}

type TrainingCalendarProps = {
  activities: Activity[];
  plannedWorkouts: PlannedWorkout[];
};

export function TrainingCalendar({ activities, plannedWorkouts }: TrainingCalendarProps) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Workouts still to be done, by day. Completed ones already show as the activity itself.
  const plannedByDay = useMemo(() => {
    const result = new Map<string, PlannedWorkout[]>();
    for (const workout of plannedWorkouts) {
      if (workout.status !== "planned") continue;
      result.set(workout.date, [...(result.get(workout.date) || []), workout]);
    }
    return result;
  }, [plannedWorkouts]);

  // Until a day is clicked, show the next planned day so a fresh plan is visible straight away.
  const shownKey = selectedKey ?? Array.from(plannedByDay.keys()).sort()[0] ?? null;
  const shownPlanned = shownKey ? plannedByDay.get(shownKey) || [] : [];

  const activitiesByDay = useMemo(() => {
    const result = new Map<string, Activity[]>();
    for (const activity of activities) {
      const day = localDateKey(new Date(activity.startDate));
      result.set(day, [...(result.get(day) || []), activity]);
    }
    for (const list of result.values()) list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return result;
  }, [activities]);

  const shownDone = shownKey ? activitiesByDay.get(shownKey) || [] : [];

  const dailyInfo = useMemo(() => {
    const result = new Map<string, DayInfo>();

    for (const [day, list] of activitiesByDay) {
      const seconds = new Map<TriSport, number>();
      for (const activity of list) {
        if (!isTriSport(activity.sportType)) continue;
        seconds.set(activity.sportType, (seconds.get(activity.sportType) || 0) + activity.movingTimeSeconds);
      }
      const segments = SPORT_ORDER.filter((sport) => seconds.get(sport)).map((sport) => ({ sport, seconds: seconds.get(sport)! }));
      if (!segments.length) continue;
      const totalSeconds = segments.reduce((a, s) => a + s.seconds, 0);
      result.set(day, { segments, hours: totalSeconds / 3600 });
    }

    return result;
  }, [activitiesByDay]);

  const cells = useMemo(() => {
    const total = daysInMonth(year, month);
    const leadingBlanks = mondayIndex(new Date(year, month, 1));
    const result: { day: number | null; dateKey: string; info: DayInfo; planned: PlannedWorkout[] }[] = [];

    for (let i = 0; i < leadingBlanks; i += 1) result.push({ day: null, dateKey: "", info: REST_DAY, planned: [] });

    for (let day = 1; day <= total; day += 1) {
      const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      result.push({
        day,
        dateKey,
        info: dailyInfo.get(dateKey) || REST_DAY,
        planned: plannedByDay.get(dateKey) || [],
      });
    }

    return result;
  }, [year, month, dailyInfo, plannedByDay]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const goPrev = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">Training Calendar</h2>
          <span
            title="Color shows the sport trained that day (split by time on multi-sport days); opacity shows how much (duration)."
            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/30 text-[10px] text-white/50"
          >
            i
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10" aria-label="Previous month">
            ‹
          </button>
          <span className="w-32 text-center text-sm font-semibold text-white">{monthLabel}</span>
          <button onClick={goNext} className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10" aria-label="Next month">
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wide text-white/40">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) =>
          cell.day == null ? (
            <div key={`blank-${i}`} />
          ) : (
            <button
              type="button"
              key={cell.dateKey}
              onClick={() => setSelectedKey(cell.dateKey)}
              title={
                `${cell.dateKey}: ${
                  cell.info.segments.length
                    ? cell.info.segments.map((s) => `${SPORT_LABELS[s.sport]} ${formatDuration(s.seconds)}`).join(" + ")
                    : "Rest day"
                }` +
                cell.planned.map((w) => `\nPlanned: ${w.workoutType || "Workout"} (${plannedSummary(w)})`).join("")
              }
              className={`relative aspect-square rounded-md ${
                cell.dateKey === shownKey ? "ring-2 ring-tri-purple" : cell.dateKey === todayKey ? "ring-2 ring-white/60" : ""
              }`}
            >
              {/* Multi-sport days split the box by each sport's share of the day's duration. */}
              <span
                className="absolute inset-0 flex overflow-hidden rounded-md"
                style={{ backgroundColor: cell.info.segments.length ? undefined : REST_COLOR, opacity: dayOpacity(cell.info) }}
              >
                {cell.info.segments.map((segment) => (
                  <span
                    key={segment.sport}
                    className="h-full"
                    style={{ flexGrow: segment.seconds, flexBasis: 0, backgroundColor: SPORT_COLORS[segment.sport] }}
                  />
                ))}
              </span>
              {cell.planned.length > 0 && (
                <span
                  className="absolute inset-0 rounded-md border-2 border-dashed"
                  style={{ borderColor: plannedDayColor(cell.planned) }}
                />
              )}
              <span className="absolute left-1 top-0.5 text-[9px] text-white/60">{cell.day}</span>
            </button>
          )
        )}
      </div>

      {shownKey && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-tri-soft px-4 py-3">
          <p className="text-xs font-semibold text-white/70">
            {new Date(`${shownKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">Done</p>
          {shownDone.length === 0 ? (
            <p className="mt-1 text-sm text-white/50">{shownKey > todayKey ? "Not yet." : "Rest day."}</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {shownDone.map((activity) => (
                <li key={activity.id} className="flex gap-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: isTriSport(activity.sportType) ? SPORT_COLORS[activity.sportType] : REST_COLOR }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{activity.name}</p>
                    <p className="text-xs text-white/50">{activitySummary(activity)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Planned</p>
          {shownPlanned.length === 0 ? (
            <p className="mt-1 text-sm text-white/50">Nothing planned.</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {shownPlanned.map((workout) => (
                <li key={workout.id} className="flex gap-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: plannedSportColor(workout.sportType) }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{workout.workoutType || "Workout"}</p>
                    <p className="text-xs text-white/50">{plannedSummary(workout)}</p>
                    {workout.notes && <p className="mt-0.5 text-xs text-white/40">{workout.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SPORT_COLORS.swim }} />
          Swim
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SPORT_COLORS.bike }} />
          Bike
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SPORT_COLORS.run }} />
          Run
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-2.5 w-2.5 overflow-hidden rounded-sm">
            {SPORT_ORDER.map((sport) => (
              <span key={sport} className="h-full flex-1" style={{ backgroundColor: SPORT_COLORS[sport] }} />
            ))}
          </span>
          Multi-sport
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REST_COLOR }} />
          Rest
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-white/60" />
          Planned
        </span>
        <span className="text-white/30">|</span>
        <span>Opacity = duration intensity</span>
      </div>
    </section>
  );
}
