import type { Activity, GarminDay, PlannedWorkout, SportType } from "../../types";
import { estimateActivityLoad } from "../../lib/calculations";
import { MULTI_SPORT_COLOR, SPORT_COLORS } from "../../lib/sportColors";

export const SPORT_STYLE: Record<SportType, { color: string; label: string }> = {
  run: { color: SPORT_COLORS.run, label: "Running" },
  bike: { color: SPORT_COLORS.bike, label: "Cycling" },
  swim: { color: SPORT_COLORS.swim, label: "Swimming" },
  other: { color: MULTI_SPORT_COLOR, label: "Workout" },
};

const SPORT_PATHS: Record<SportType, string> = {
  run: "M3 8c2 1 4 1 5-1l3 5c2 2 6 2 9 3 1 1 1 3-1 3-4 1-8 0-11-3L3 11zM12 11l2-2M14 13l2-2",
  bike: "M6 18a3.5 3.5 0 1 1 .1 0M18 18a3.5 3.5 0 1 1 .1 0M6 14.500l4-6h6l2 6M10 8.500l3 6H6M15 6h2",
  swim: "M3 7q2.3-2.500 4.500 0t4.500 0 4.500 0 4.500 0M3 12.500q2.3-2.500 4.500 0t4.500 0 4.500 0 4.500 0M3 18q2.3-2.500 4.500 0t4.500 0 4.500 0 4.500 0",
  other: "M12 4l2.500 5 5.500.8-4 3.900 1 5.500-5-2.600-5 2.600 1-5.500-4-3.900 5.500-.8z",
};

export function Icon({ path, className = "h-4 w-4", color }: { path: string; className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** h:mm:ss */
export function clockDuration(seconds: number): string {
  const total = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function distanceLabel(sport: SportType, meters: number): string {
  if (sport === "swim") return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km >= 10 ? km.toFixed(1) : km.toFixed(2)} km`;
}

const styleOf = (sport: SportType) => SPORT_STYLE[sport] ?? SPORT_STYLE.other;
const pathOf = (sport: SportType) => SPORT_PATHS[sport] ?? SPORT_PATHS.other;

type ChipProps = {
  sport: SportType;
  title: string;
  duration?: string;
  detail: string;
  tooltip: string;
  tone: "done" | "completed" | "planned" | "missed";
  dimmed: boolean;
  onClick: () => void;
};

const CHIP_TONE: Record<ChipProps["tone"], string> = {
  done: "border-white/10 bg-tri-soft",
  completed: "border-tri-green/60 bg-tri-soft",
  planned: "border-dashed border-white/30",
  missed: "border-tri-pink/60 bg-tri-pink/10",
};

/** Two-line workout entry that fits inside a month-view day. */
export function WorkoutChip({ sport, title, duration, detail, tooltip, tone, dimmed, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={`w-full shrink-0 rounded-lg border px-1.5 py-1 text-left hover:brightness-125 ${CHIP_TONE[tone]} ${dimmed ? "opacity-25" : ""}`}
      style={{ borderLeft: `3px solid ${styleOf(sport).color}` }}
    >
      <span className="flex items-center gap-1 text-[11px] leading-4 text-white">
        <Icon path={pathOf(sport)} className="h-3.5 w-3.5" color={styleOf(sport).color} />
        <span className="truncate font-semibold">{title}</span>
        {duration && <span className="ml-auto pl-1 tabular-nums text-white/70">{duration}</span>}
      </span>
      <span className="block truncate text-[10px] leading-[14px] text-white/50">{detail}</span>
    </button>
  );
}

/** One line of Garmin values at the top of a day. */
export function MetricsLine({ day, onClick }: { day: GarminDay; onClick: () => void }) {
  const sleep = day.sleepSec ? `Sleep ${(day.sleepSec / 3600).toFixed(1)}h` : null;
  const battery = day.bodyBatteryHigh != null ? `BB ${day.bodyBatteryLow}–${day.bodyBatteryHigh}` : null;
  if (!sleep && !battery && day.restingHr == null) return null;
  return (
    <button type="button" onClick={onClick} className="flex w-full shrink-0 flex-wrap gap-x-2 text-left text-[10px] leading-[14px] text-white/50 hover:text-white">
      {sleep && <span>{sleep}</span>}
      {battery && <span className="text-tri-blue">{battery}</span>}
      {!sleep && !battery && <span>Resting HR {day.restingHr}</span>}
    </button>
  );
}

function metricRows(day: GarminDay): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, value: number | string | undefined) => {
    if (value != null) rows.push([label, String(value)]);
  };
  add("Sleep Hours", day.sleepSec ? `${(day.sleepSec / 3600).toFixed(2)} hrs` : undefined);
  add("Body Battery", day.bodyBatteryHigh != null ? `Low ${day.bodyBatteryLow} High ${day.bodyBatteryHigh}` : undefined);
  add("Sleep Score", day.sleepScore);
  add("Resting HR", day.restingHr != null ? `${day.restingHr} bpm` : undefined);
  add("HRV", day.hrv != null ? `${day.hrv} ms` : undefined);
  add("Stress", day.avgStress);
  add("Steps", day.steps?.toLocaleString());
  add("Readiness", day.readiness);
  add("Calories", day.totalCalories?.toLocaleString());
  add("Intensity Minutes", day.intensityMinutes);
  return rows;
}

export function MetricsCard({ day }: { day: GarminDay }) {
  const rows = metricRows(day);
  if (!rows.length) return null;
  return (
    <article className="rounded-2xl border border-white/10 bg-tri-soft p-4">
      <h3 className="mb-2 text-sm font-bold text-white">Metrics</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-white/40">{label}</dt>
            <dd className="text-sm font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function DetailCard({ sport, title, subtitle, stats, action }: { sport: SportType; title: string; subtitle: string; stats: [string, string][]; action: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-tri-soft p-4" style={{ borderTop: `3px solid ${styleOf(sport).color}` }}>
      <div className="flex items-start gap-2">
        <Icon path={pathOf(sport)} className="h-5 w-5" color={styleOf(sport).color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        {action}
      </div>
      {stats.length > 0 && (
        <dl className="mt-3 grid grid-cols-4 gap-2">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-white/40">{label}</dt>
              <dd className="text-sm font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function WorkoutCard({ activity, plan }: { activity: Activity; plan?: PlannedWorkout }) {
  const stats: [string, string][] = [["Duration", clockDuration(activity.movingTimeSeconds)]];
  if (activity.distanceMeters > 0) stats.push(["Distance", distanceLabel(activity.sportType, activity.distanceMeters)]);
  stats.push(["TSS", String(Math.round(estimateActivityLoad(activity)))]);
  if (activity.averageHeartRate != null) stats.push(["Avg HR", `${Math.round(activity.averageHeartRate)} bpm`]);

  return (
    <DetailCard
      sport={activity.sportType}
      title={activity.name}
      subtitle={`${styleOf(activity.sportType).label}${plan ? " · completed as planned" : ""}`}
      stats={stats}
      action={
        <a href={`https://www.strava.com/activities/${activity.stravaActivityId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-tri-blue hover:underline">
          View on Strava
        </a>
      }
    />
  );
}

export function PlannedCard({ plan, onDelete }: { plan: PlannedWorkout; onDelete: () => void }) {
  const stats: [string, string][] = [];
  if (plan.plannedDurationMin) stats.push(["Duration", clockDuration(plan.plannedDurationMin * 60)]);
  if (plan.plannedDistanceKm) stats.push(["Distance", `${plan.plannedDistanceKm} km`]);
  if (plan.targetTss) stats.push(["TSS", String(Math.round(plan.targetTss))]);
  if (plan.targetZone) stats.push(["Zone", plan.targetZone]);

  return (
    <DetailCard
      sport={plan.sportType}
      title={plan.workoutType || styleOf(plan.sportType).label}
      subtitle={plan.status === "missed" ? "Missed" : "Planned"}
      stats={stats}
      action={
        <button type="button" onClick={onDelete} className="shrink-0 text-xs font-semibold text-tri-pink hover:underline">
          Delete
        </button>
      }
    />
  );
}
