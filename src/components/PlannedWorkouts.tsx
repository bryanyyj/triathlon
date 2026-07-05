import { useState } from "react";
import type { Activity, PlannedWorkout, SportType } from "../types";

const SPORT_ICON: Record<SportType, string> = { swim: "🏊", bike: "🚴", run: "🏃", other: "⭐" };

const STATUS_STYLE: Record<PlannedWorkout["status"], string> = {
  planned: "bg-white/10 text-white/70",
  completed: "bg-tri-green/20 text-tri-green",
  missed: "bg-tri-pink/20 text-tri-pink",
};

type PlannedWorkoutsProps = {
  workouts: PlannedWorkout[];
  activities: Activity[];
  onAdd: (workout: Partial<PlannedWorkout>) => Promise<void>;
};

export function PlannedWorkouts({ workouts, activities, onAdd }: PlannedWorkoutsProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState("");
  const [sportType, setSportType] = useState<SportType>("run");
  const [workoutType, setWorkoutType] = useState("");
  const [plannedDurationMin, setPlannedDurationMin] = useState("");
  const [plannedDistanceKm, setPlannedDistanceKm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  const matchedActivity = (workout: PlannedWorkout): Activity | undefined =>
    workout.matchedActivityId ? activities.find((a) => a.id === workout.matchedActivityId) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    try {
      await onAdd({
        date,
        sportType,
        workoutType: workoutType || undefined,
        plannedDurationMin: plannedDurationMin ? Number(plannedDurationMin) : undefined,
        plannedDistanceKm: plannedDistanceKm ? Number(plannedDistanceKm) : undefined,
        status: "planned",
      });
      setFormOpen(false);
      setDate("");
      setWorkoutType("");
      setPlannedDurationMin("");
      setPlannedDistanceKm("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Planned Workouts</h2>
          <p className="text-sm text-white/50">Compare planned training against actual activities</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white"
        >
          {formOpen ? "Close" : "+ Plan Workout"}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mb-5 grid gap-3 rounded-2xl bg-tri-soft border border-white/10 p-4 md:grid-cols-5">
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <select value={sportType} onChange={(e) => setSportType(e.target.value as SportType)} className="input">
            <option value="swim">Swim</option>
            <option value="bike">Bike</option>
            <option value="run">Run</option>
          </select>
          <input
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value)}
            placeholder="Workout type"
            className="input"
          />
          <input
            type="number"
            value={plannedDurationMin}
            onChange={(e) => setPlannedDurationMin(e.target.value)}
            placeholder="Duration (min)"
            className="input"
          />
          <input
            type="number"
            step="0.1"
            value={plannedDistanceKm}
            onChange={(e) => setPlannedDistanceKm(e.target.value)}
            placeholder="Distance (km)"
            className="input"
          />
          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-5 rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Planned Workout"}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-white/50">No planned workouts yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((workout) => {
            const activity = matchedActivity(workout);
            return (
              <div
                key={workout.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tri-soft border border-white/10 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{SPORT_ICON[workout.sportType]}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {workout.workoutType || "Workout"} · {workout.date}
                    </p>
                    <p className="text-xs text-white/50">
                      {workout.plannedDurationMin ? `${workout.plannedDurationMin} min` : ""}
                      {workout.plannedDistanceKm ? ` · ${workout.plannedDistanceKm} km` : ""}
                      {workout.targetZone ? ` · ${workout.targetZone}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {activity && (
                    <span className="text-xs text-white/50">
                      Actual: {(activity.distanceMeters / 1000).toFixed(1)} km /{" "}
                      {(activity.movingTimeSeconds / 60).toFixed(0)} min
                    </span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[workout.status]}`}>
                    {workout.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
