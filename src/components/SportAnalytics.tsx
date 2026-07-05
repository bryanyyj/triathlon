import type { DashboardSummary, SportSummary } from "../types";

const SPORTS: { key: keyof DashboardSummary["bySport"]; label: string; icon: string; color: string }[] = [
  { key: "swim", label: "Swim", icon: "🏊", color: "#3ab7ff" },
  { key: "bike", label: "Bike", icon: "🚴", color: "#3adf9b" },
  { key: "run", label: "Run", icon: "🏃", color: "#ff9f43" },
];

function formatPace(sport: string, summary: SportSummary): string {
  if (!summary.sessions || summary.durationHours === 0) return "—";
  if (sport === "run") {
    const minPerKm = (summary.durationHours * 60) / (summary.distanceKm || 1);
    const min = Math.floor(minPerKm);
    const sec = Math.round((minPerKm - min) * 60);
    return `${min}:${String(sec).padStart(2, "0")} /km`;
  }
  if (sport === "bike") {
    const kph = summary.distanceKm / summary.durationHours;
    return `${kph.toFixed(1)} km/h`;
  }
  const minPer100 = (summary.durationHours * 60) / ((summary.distanceKm || 0.01) * 10);
  return `${minPer100.toFixed(1)} /100m`;
}

export function SportAnalytics({ summary }: { summary: DashboardSummary }) {
  const totalDistance = Math.max(
    1,
    summary.bySport.swim.distanceKm + summary.bySport.bike.distanceKm + summary.bySport.run.distanceKm
  );

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Sport Analytics</h2>
        <p className="text-sm text-white/50">Breakdown by discipline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SPORTS.map(({ key, label, icon, color }) => {
          const sportSummary = summary.bySport[key];
          const share = (sportSummary.distanceKm / totalDistance) * 100;

          return (
            <div key={key} className="rounded-2xl bg-tri-soft border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg">
                  {icon} {label}
                </span>
                <span className="text-xs text-white/40">{sportSummary.sessions} sessions</span>
              </div>

              <p className="mt-3 text-2xl font-bold text-white">{sportSummary.distanceKm.toFixed(1)} km</p>
              <p className="text-xs text-white/50">{sportSummary.durationHours.toFixed(1)}h total time</p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
              </div>

              <div className="mt-3 flex justify-between text-xs text-white/50">
                <span>Avg pace: {formatPace(key, sportSummary)}</span>
                <span>{sportSummary.averageHeartRate ? `${Math.round(sportSummary.averageHeartRate)} bpm` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
