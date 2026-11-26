import type { Activity, Race } from "../types";
import type { Garmin } from "../lib/useGarmin";
import { estimateActivityLoad } from "../lib/calculations";
import { addDays, lastDays, shortDate, startOfWeek, toDateKey } from "../lib/dates";
import type { FitnessDay } from "../lib/fitness";
import { buildDayRows } from "../lib/metrics";
import { formatDuration } from "../lib/format";
import { StatTile, TileRow } from "../components/ChartKit";
import { FIT_GRID } from "../components/Layout";
import { FitnessFormChart, WeeklyLoadChart } from "../components/charts/TrainingCharts";
import { SleepStagesScoreChart } from "../components/charts/RecoveryCharts";
import { PairChart } from "../components/charts/PairCharts";

export function OverviewPage({ activities, fitness, races, garmin }: { activities: Activity[]; fitness: FitnessDay[]; races: Race[]; garmin: Garmin }) {
  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = activities.filter((a) => new Date(a.startDate).getTime() >= weekStart);
  const now = fitness[fitness.length - 1];

  const rows = buildDayRows(lastDays(30), garmin.days, fitness);
  const latest = <K extends keyof (typeof rows)[number]>(key: K) => [...rows].reverse().find((d) => d[key] != null);
  const night = latest("sleepSec");
  const rhr = latest("restingHr");
  const battery = latest("bodyBatteryHigh");

  const today = toDateKey(new Date());
  const nextRace = [...races].filter((r) => r.raceDate.slice(0, 10) >= today).sort((a, b) => a.raceDate.localeCompare(b.raceDate))[0];

  // Twelve whole weeks, so the first bar isn't a part-week.
  const since = addDays(startOfWeek(new Date()), -7 * 11).getTime();
  const recent = activities.filter((a) => new Date(a.startDate).getTime() >= since);

  return (
    <>
      <TileRow>
        <StatTile
          label="Training this week"
          value={formatDuration(thisWeek.reduce((s, a) => s + a.movingTimeSeconds, 0))}
          note={`${thisWeek.length} workouts · ${Math.round(thisWeek.reduce((s, a) => s + estimateActivityLoad(a), 0))} TSS`}
        />
        <StatTile label="Form (TSB)" value={now ? now.form.toFixed(0) : "—"} note={now ? `Fitness ${now.fitness.toFixed(0)} · fatigue ${now.fatigue.toFixed(0)}` : undefined} />
        <StatTile label="Latest sleep" value={night ? formatDuration(night.sleepSec!) : "—"} note={night ? `${shortDate(night.date)}${night.sleepScore != null ? ` · score ${night.sleepScore}` : ""}` : "From Garmin"} />
        <StatTile label="Resting heart rate" value={rhr ? `${rhr.restingHr} bpm` : "—"} note={rhr ? shortDate(rhr.date) : "From Garmin"} />
        <StatTile label="Body Battery" value={battery ? `${battery.bodyBatteryLow}–${battery.bodyBatteryHigh}` : "—"} note={battery ? shortDate(battery.date) : "From Garmin"} />
        <StatTile label="Next race" value={nextRace ? shortDate(nextRace.raceDate) : "None"} note={nextRace ? nextRace.raceName : "Add one on the Plan page"} />
      </TileRow>

      <div className={FIT_GRID}>
        <FitnessFormChart data={fitness.slice(-90)} />
        <WeeklyLoadChart activities={recent} />
        <SleepStagesScoreChart rows={rows} />
        <PairChart title="Training load & next-morning readiness" rows={rows} left={{ key: "loadPrev", as: "bar" }} right={{ key: "readiness" }} />
      </div>
    </>
  );
}
