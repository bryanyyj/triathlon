import type { Activity, SportType } from "../../types";
import { estimateActivityLoad } from "../../lib/calculations";
import type { FitnessDay } from "../../lib/fitness";
import { SPORT_STYLE, clockDuration } from "./CalendarParts";

const SPORTS: { sport: SportType; label: string }[] = [
  { sport: "swim", label: "Swim" },
  { sport: "bike", label: "Bike" },
  { sport: "run", label: "Run" },
  { sport: "other", label: "Other" },
];

function total(activities: Activity[], value: (a: Activity) => number): number {
  return activities.reduce((sum, a) => sum + (value(a) || 0), 0);
}

const hoursMinutes = (seconds: number) => clockDuration(seconds).slice(0, -3);

/** The right-hand Summary cell. `fitness` is undefined for weeks that haven't started. */
export function WeekSummary({ activities, fitness }: { activities: Activity[]; fitness?: FitnessDay }) {
  const of = (sport: SportType) => activities.filter((a) => a.sportType === sport);
  const km = (list: Activity[]) => total(list, (a) => a.distanceMeters) / 1000;
  const work = total(of("bike"), (a) => ((a.averagePower || 0) * a.movingTimeSeconds) / 1000);
  const elevation = total(activities, (a) => a.elevationGainMeters);

  const totals: [string, string][] = activities.length
    ? [
        ["Time", hoursMinutes(total(activities, (a) => a.movingTimeSeconds))],
        ["TSS", String(Math.round(total(activities, estimateActivityLoad)))],
        ["Dist", `${km(activities).toFixed(km(activities) >= 100 ? 0 : 1)} km`],
      ]
    : [];
  if (elevation) totals.push(["Elev", `${Math.round(elevation)} m`]);
  if (work) totals.push(["Work", `${Math.round(work)} kJ`]);

  const scores = [
    { name: "Fitness (CTL)", short: "CTL", value: fitness?.fitness, color: "text-tri-blue" },
    { name: "Fatigue (ATL)", short: "ATL", value: fitness?.fatigue, color: "text-tri-pink" },
    { name: "Form (TSB)", short: "TSB", value: fitness?.form, color: "text-tri-orange" },
  ];

  return (
    <div className="space-y-1 p-2">
      <div className="grid grid-cols-3 text-center">
        {scores.map((s) => (
          <div key={s.short} title={s.name} className={s.color}>
            <p className="text-sm font-black leading-4">{s.value == null ? "–" : Math.round(s.value)}</p>
            <p className="text-[9px] leading-3 opacity-70">{s.short}</p>
          </div>
        ))}
      </div>

      {SPORTS.map(({ sport, label }) => {
        const list = of(sport);
        if (!list.length) return null;
        return (
          <p key={sport} className="flex items-center gap-1 text-[10px] leading-[14px] text-white/60">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: SPORT_STYLE[sport].color }} />
            {label}
            <b className="ml-auto text-white">{hoursMinutes(total(list, (a) => a.movingTimeSeconds))}</b>
            <span className="w-16 text-right">
              {sport === "swim" ? `${Math.round(km(list) * 1000)} m` : `${km(list).toFixed(km(list) >= 100 ? 0 : 1)} km`}
            </span>
          </p>
        );
      })}

      {totals.length > 0 && (
        <dl className="grid grid-cols-3 gap-x-3 border-t border-white/10 pt-1">
          {totals.map(([label, value]) => (
            <div key={label} className="flex justify-between text-[10px] leading-[14px]">
              <dt className="text-white/40">{label}</dt>
              <dd className="font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
