import { useMemo, useState } from "react";
import type { Activity } from "../types";
import { MULTI_SPORT_COLOR, REST_COLOR, SPORT_COLORS } from "../lib/sportColors";

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

type DayInfo = { sport: TriSport | "multi" | "rest"; hours: number };

function dayColor(sport: DayInfo["sport"]): string {
  if (sport === "rest") return REST_COLOR;
  if (sport === "multi") return MULTI_SPORT_COLOR;
  return SPORT_COLORS[sport];
}

function dayOpacity(info: DayInfo): number {
  if (info.sport === "rest") return 1;
  return Math.min(1, MIN_ACTIVE_OPACITY + (1 - MIN_ACTIVE_OPACITY) * (info.hours / DURATION_FULL_HOURS));
}

export function TrainingCalendar({ activities }: { activities: Activity[] }) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dailyInfo = useMemo(() => {
    const bySportPerDay = new Map<string, Map<TriSport, number>>();

    for (const activity of activities) {
      if (activity.sportType !== "swim" && activity.sportType !== "bike" && activity.sportType !== "run") continue;
      const day = activity.startDate.slice(0, 10);
      if (!bySportPerDay.has(day)) bySportPerDay.set(day, new Map());
      const sports = bySportPerDay.get(day)!;
      sports.set(activity.sportType, (sports.get(activity.sportType) || 0) + activity.movingTimeSeconds);
    }

    const result = new Map<string, DayInfo>();
    for (const [day, sports] of bySportPerDay) {
      const totalSeconds = Array.from(sports.values()).reduce((a, b) => a + b, 0);
      const sport: DayInfo["sport"] = sports.size > 1 ? "multi" : Array.from(sports.keys())[0];
      result.set(day, { sport, hours: totalSeconds / 3600 });
    }

    return result;
  }, [activities]);

  const cells = useMemo(() => {
    const total = daysInMonth(year, month);
    const leadingBlanks = mondayIndex(new Date(year, month, 1));
    const result: { day: number | null; dateKey: string | null; info: DayInfo }[] = [];

    for (let i = 0; i < leadingBlanks; i += 1) result.push({ day: null, dateKey: null, info: { sport: "rest", hours: 0 } });

    for (let day = 1; day <= total; day += 1) {
      const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      result.push({ day, dateKey, info: dailyInfo.get(dateKey) || { sport: "rest", hours: 0 } });
    }

    return result;
  }, [year, month, dailyInfo]);

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
            title="Color shows the sport trained that day; opacity shows how much (duration)."
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
            <div
              key={cell.dateKey}
              title={`${cell.dateKey}: ${cell.info.sport === "rest" ? "Rest day" : `${cell.info.sport} · ${cell.info.hours.toFixed(1)}h`}`}
              className={`relative aspect-square rounded-md ${cell.dateKey === todayKey ? "ring-2 ring-white/60" : ""}`}
              style={{ backgroundColor: dayColor(cell.info.sport), opacity: dayOpacity(cell.info) }}
            >
              <span className="absolute left-1 top-0.5 text-[9px] text-white/60 mix-blend-luminosity">{cell.day}</span>
            </div>
          )
        )}
      </div>

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
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MULTI_SPORT_COLOR }} />
          Multi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REST_COLOR }} />
          Rest
        </span>
        <span className="text-white/30">|</span>
        <span>Opacity = duration intensity</span>
      </div>
    </section>
  );
}
