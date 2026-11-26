import type { ReactNode } from "react";
import type { Activity, FatigueReadiness, HrZonesBySport, QuickFilter } from "../types";
import type { FitnessDay } from "../lib/fitness";
import { buildDashboardSummary } from "../lib/calculations";
import { formatDuration } from "../lib/format";
import { quickFilterToDays, quickFilterToRange } from "../components/Filters";
import { StatTile, TileRow } from "../components/ChartKit";
import { FIT_GRID } from "../components/Layout";
import {
  FitnessFormChart,
  HrZonesChart,
  PaceHeartChart,
  PaceVsHeartChart,
  WeeklyLoadChart,
  formatPace,
  PACE,
  sessionPoints,
  type TriSport,
} from "../components/charts/TrainingCharts";

type LoadProps = {
  activities: Activity[]; // already filtered by sport and date range
  fitness: FitnessDay[];
  fatigue: FatigueReadiness | null;
  zones: HrZonesBySport | null;
  range: QuickFilter;
};

export function LoadView({ activities, fitness, fatigue, zones, range }: LoadProps) {
  const summary = buildDashboardSummary(activities);
  const now = fitness[fitness.length - 1];
  const days = quickFilterToDays(range) ?? fitness.length;
  const ratio = fatigue && fatigue.chronicLoad > 0 ? fatigue.acuteLoad / fatigue.chronicLoad : null;

  return (
    <>
      <TileRow>
        <StatTile label="Workouts" value={String(summary.totalWorkouts)} note="Swim, bike and run" />
        <StatTile label="Distance" value={`${summary.totalDistanceKm.toFixed(0)} km`} />
        <StatTile label="Time" value={formatDuration(summary.totalDurationHours * 3600)} />
        <StatTile label="Training stress" value={`${Math.round(summary.totalTss || 0)}`} note="Estimated TSS" />
        <StatTile label="Form (TSB)" value={now ? now.form.toFixed(0) : "—"} note={now ? `Fitness ${now.fitness.toFixed(0)} · fatigue ${now.fatigue.toFixed(0)}` : undefined} />
        <StatTile label="Acute : chronic load" value={ratio == null ? "—" : ratio.toFixed(2)} note="Last 7 days vs 4-week average" />
      </TileRow>

      <div className={FIT_GRID}>
        <FitnessFormChart data={fitness.slice(-days)} className="lg:col-span-2" />
        <WeeklyLoadChart activities={activities} />
        <HrZonesChart zones={zones} />
      </div>
    </>
  );
}

export function PerformanceView({ activities, zones, range, sport }: { activities: Activity[]; zones: HrZonesBySport | null; range: QuickFilter; sport: TriSport }) {
  const { startDate } = quickFilterToRange(range);
  const inRange = startDate ? activities.filter((a) => a.startDate >= startDate) : activities;
  const points = sessionPoints(inRange, sport);
  const ofSport = inRange.filter((a) => a.sportType === sport);

  const meters = ofSport.reduce((s, a) => s + a.distanceMeters, 0);
  const seconds = ofSport.reduce((s, a) => s + a.movingTimeSeconds, 0);
  const heart = ofSport.map((a) => a.averageHeartRate).filter((v): v is number => v != null);
  const paces = points.map((p) => p.pace);
  const fastest = paces.length ? (sport === "bike" ? Math.max(...paces) : Math.min(...paces)) : null;
  const word = sport === "bike" ? "speed" : "pace";

  return (
    <>
      <TileRow>
        <StatTile label="Sessions" value={String(ofSport.length)} />
        <StatTile label="Distance" value={`${(meters / 1000).toFixed(meters >= 100000 ? 0 : 1)} km`} />
        <StatTile label="Time" value={formatDuration(seconds)} />
        <StatTile label={`Average ${word}`} value={meters && seconds ? formatPace(sport, PACE[sport].value(meters, seconds)) : "—"} />
        <StatTile label={sport === "bike" ? "Fastest ride average" : "Fastest session average"} value={fastest == null ? "—" : formatPace(sport, fastest)} />
        <StatTile label="Average heart rate" value={heart.length ? `${Math.round(heart.reduce((a, b) => a + b, 0) / heart.length)} bpm` : "—"} />
      </TileRow>

      <div className={FIT_GRID}>
        <PaceHeartChart points={points} sport={sport} className="lg:col-span-2" />
        <PaceVsHeartChart points={points} sport={sport} />
        <HrZonesChart zones={zones} />
      </div>
    </>
  );
}

export function HistoryView({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl lg:min-h-0 lg:flex-1">{children}</div>;
}
