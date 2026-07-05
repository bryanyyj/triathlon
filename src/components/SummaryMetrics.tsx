import type { DashboardSummary } from "../types";
import { MetricCard } from "./MetricCard";

export function SummaryMetrics({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <MetricCard title="Total Workouts" value={String(summary.totalWorkouts)} subtitle="sessions" accent="from-tri-purple to-tri-pink" />
      <MetricCard title="Total Distance" value={summary.totalDistanceKm.toFixed(0)} subtitle="km" accent="from-tri-blue to-tri-purple" />
      <MetricCard title="Total Duration" value={`${summary.totalDurationHours.toFixed(1)}h`} subtitle="training time" accent="from-tri-green to-tri-blue" />
      <MetricCard title="Total TSS" value={String(Math.round(summary.totalTss ?? 0))} subtitle="training stress" accent="from-tri-orange to-tri-pink" />
      <MetricCard
        title="Swim"
        value={`${summary.bySport.swim.distanceKm.toFixed(1)} km`}
        subtitle={`${summary.bySport.swim.sessions} sessions`}
        accent="from-tri-blue to-tri-green"
      />
      <MetricCard
        title="Bike"
        value={`${summary.bySport.bike.distanceKm.toFixed(1)} km`}
        subtitle={`${summary.bySport.bike.sessions} sessions`}
        accent="from-tri-purple to-tri-blue"
      />
      <MetricCard
        title="Run"
        value={`${summary.bySport.run.distanceKm.toFixed(1)} km`}
        subtitle={`${summary.bySport.run.sessions} sessions`}
        accent="from-tri-pink to-tri-orange"
      />
    </section>
  );
}
