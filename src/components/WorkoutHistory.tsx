import type { Activity, SportType } from "../types";

const SPORT_ICON: Record<SportType, string> = { swim: "🏊", bike: "🚴", run: "🏃", other: "⭐" };
const SPORT_ACCENT: Record<SportType, string> = {
  swim: "#3ab7ff",
  bike: "#3adf9b",
  run: "#ff9f43",
  other: "#a78bfa",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function WorkoutHistory({ activities }: { activities: Activity[] }) {
  // Most recent first — the date range is already applied upstream by the filter.
  const sorted = [...activities].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">History of Workouts</h2>
        <p className="text-sm text-white/50">
          {sorted.length > 0
            ? `Your completed activities for the selected range — scroll sideways for more (${sorted.length} total)`
            : "Your completed activities for the selected range"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-white/50">No activities in this range.</p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 tri-scroll">
          {sorted.map((activity) => {
            const accent = SPORT_ACCENT[activity.sportType];
            return (
              <div
                key={activity.id}
                className="flex w-52 shrink-0 flex-col rounded-2xl bg-tri-soft border border-white/10 p-4"
                style={{ borderTopColor: accent, borderTopWidth: 3 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xl">{SPORT_ICON[activity.sportType]}</span>
                  <span className="text-xs text-white/40">{formatDate(activity.startDate)}</span>
                </div>
                <p className="mb-3 line-clamp-2 text-sm font-semibold text-white" title={activity.name}>
                  {activity.name}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-white/40">Distance</p>
                    <p className="font-semibold text-white">{(activity.distanceMeters / 1000).toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-white/40">Time</p>
                    <p className="font-semibold text-white">{formatDuration(activity.movingTimeSeconds)}</p>
                  </div>
                  {activity.averageHeartRate != null && (
                    <div>
                      <p className="text-white/40">Avg HR</p>
                      <p className="font-semibold text-white">{Math.round(activity.averageHeartRate)} bpm</p>
                    </div>
                  )}
                  {activity.elevationGainMeters > 0 && (
                    <div>
                      <p className="text-white/40">Elev</p>
                      <p className="font-semibold text-white">{Math.round(activity.elevationGainMeters)} m</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
