import { useEffect, useMemo, useState } from "react";
import type { Activity, PlannedWorkout, SportType } from "../types";
import type { Garmin } from "../lib/useGarmin";
import { addDays, fromDateKey, startOfWeek, toDateKey } from "../lib/dates";
import { buildFitnessSeries } from "../lib/fitness";
import { estimateActivityLoad } from "../lib/calculations";
import {
  Icon,
  MetricsCard,
  MetricsLine,
  PlannedCard,
  SPORT_STYLE,
  WorkoutCard,
  WorkoutChip,
  clockDuration,
  distanceLabel,
} from "../components/calendar/CalendarParts";
import { WeekSummary } from "../components/calendar/WeekSummary";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const ICONS = {
  download: "M12 15V4M7 9l5-5 5 5M4 15v5h16v-5",
  refresh: "M20 8a8 8 0 0 0-14-2L4 8M4 4v4h4M4 16a8 8 0 0 0 14 2l2-2M20 20v-4h-4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5",
  metrics: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M9 15h6",
};

function ToolButton({ label, icon, onClick, active, disabled }: { label: string; icon: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border border-white/10 p-2 hover:bg-white/10 disabled:opacity-40 ${active ? "bg-white/10 text-white" : "text-white/60"}`}
    >
      <Icon path={icon} className="h-5 w-5" />
    </button>
  );
}

function groupByDate<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) || []), item]);
  }
  return map;
}

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-3xl border border-white/10 bg-tri-card p-5 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

const longDate = (date: string) => fromDateKey(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function PlanDialog({ date, onClose, onSave }: { date: string; onClose: () => void; onSave: (workout: Partial<PlannedWorkout>) => Promise<void> }) {
  const [sportType, setSportType] = useState<SportType>("run");
  const [workoutType, setWorkoutType] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        date,
        sportType,
        workoutType: workoutType || undefined,
        plannedDurationMin: duration ? Number(duration) : undefined,
        plannedDistanceKm: distance ? Number(distance) : undefined,
        status: "planned",
      });
      onClose();
    } catch {
      setError("Couldn't save. Is the backend running?");
      setSaving(false);
    }
  };

  return (
    <Dialog label="Plan workout" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-white">Plan workout</h2>
          <p className="text-sm text-white/50">{longDate(date)}</p>
        </div>
        <select aria-label="Sport" value={sportType} onChange={(e) => setSportType(e.target.value as SportType)} className="input">
          <option value="swim">Swim</option>
          <option value="bike">Bike</option>
          <option value="run">Run</option>
        </select>
        <input autoFocus aria-label="Workout type" placeholder="Workout type" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className="input" />
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Duration in minutes" type="number" min="0" placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} className="input" />
          <input aria-label="Distance in kilometres" type="number" min="0" step="0.1" placeholder="Distance (km)" value={distance} onChange={(e) => setDistance(e.target.value)} className="input" />
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
        </div>
      </form>
    </Dialog>
  );
}

type CalendarPageProps = {
  activities: Activity[];
  plannedWorkouts: PlannedWorkout[];
  garmin: Garmin;
  syncing: boolean;
  message: string | null;
  onRefresh: () => void;
  onAddPlanned: (workout: Partial<PlannedWorkout>) => Promise<void>;
  onDeletePlanned: (id: string) => Promise<void>;
  onOpenCoach: () => void;
};

export function CalendarPage({ activities, plannedWorkouts, garmin, syncing, message, onRefresh, onAddPlanned, onDeletePlanned, onOpenCoach }: CalendarPageProps) {
  const today = toDateKey(new Date());
  const thisWeek = toDateKey(startOfWeek(new Date()));
  // Opens on whichever month it is now.
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [search, setSearch] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const activitiesByDate = useMemo(
    () => groupByDate([...activities].sort((a, b) => a.startDate.localeCompare(b.startDate)), (a) => toDateKey(new Date(a.startDate))),
    [activities]
  );
  const plansByDate = useMemo(() => groupByDate(plannedWorkouts, (w) => w.date.slice(0, 10)), [plannedWorkouts]);
  const metricsByDate = useMemo(() => new Map(garmin.days.map((d) => [d.date, d])), [garmin.days]);
  const fitnessByDate = useMemo(() => new Map(buildFitnessSeries(activities).map((d) => [d.date, d])), [activities]);

  // Every Monday-to-Sunday week that contains a day of the shown month.
  const weeks: string[] = [];
  const lastDay = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  for (let date = startOfWeek(month); toDateKey(date) <= lastDay; date = addDays(date, 7)) weeks.push(toDateKey(date));

  const showMonth = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  const showToday = () => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const exportMonth = () => {
    const prefix = toDateKey(month).slice(0, 7);
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      // Prefix formula-like text so a spreadsheet doesn't execute an activity name.
      return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
    };
    const lines = [["Date", "Sport", "Name", "Minutes", "Distance km", "TSS (estimated)"].map(cell).join(",")];
    for (const [date, list] of [...activitiesByDate].sort(([a], [b]) => a.localeCompare(b))) {
      if (!date.startsWith(prefix)) continue;
      for (const a of list) {
        lines.push([date, a.sportType, a.name, (a.movingTimeSeconds / 60).toFixed(1), (a.distanceMeters / 1000).toFixed(2), Math.round(estimateActivityLoad(a))].map(cell).join(","));
      }
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `training-${prefix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const query = search?.trim().toLowerCase() || "";
  const matches = (sport: SportType, name: string) => !query || `${name} ${SPORT_STYLE[sport]?.label} ${sport}`.toLowerCase().includes(query);

  const columns = { gridTemplateColumns: `repeat(7, minmax(105px, 1fr)) ${showSummary ? "minmax(230px, 1.6fr)" : "34px"}` };
  const garminBusy = garmin.status?.syncing;
  const monthIndex = month.getMonth();

  const dayData = (date: string) => {
    const done = activitiesByDate.get(date) || [];
    const plans = plansByDate.get(date) || [];
    // A completed plan shows on its activity rather than twice.
    const open = plans.filter((p) => !(p.status === "completed" && done.some((a) => a.id === p.matchedActivityId)));
    return { done, plans, open, metrics: metricsByDate.get(date) };
  };
  const selected = openDate ? dayData(openDate) : null;

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative cursor-pointer text-3xl font-black text-white">
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })} <span className="text-base text-tri-purple">▾</span>
          <input
            type="month"
            aria-label="Jump to month"
            value={toDateKey(month).slice(0, 7)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            onChange={(e) => e.target.value && setMonth(fromDateKey(`${e.target.value}-01`))}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
        </label>
        <button type="button" onClick={showToday} className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white">
          Today
        </button>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous month" onClick={() => showMonth(-1)} className="rounded-xl border border-white/10 px-3 py-1 text-xl text-white/70 hover:bg-white/10">‹</button>
          <button type="button" aria-label="Next month" onClick={() => showMonth(1)} className="rounded-xl border border-white/10 px-3 py-1 text-xl text-white/70 hover:bg-white/10">›</button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(message || garmin.status?.error) && <span className="text-xs text-white/50">{message || garmin.status?.error}</span>}
          {garmin.status && !garmin.status.signedIn && (
            <a href="#recovery" className="text-xs text-tri-blue hover:underline">Connect Garmin to see sleep &amp; Body Battery</a>
          )}
          {search !== null && (
            <input autoFocus aria-label="Search workouts" placeholder="Search workouts" value={search} onChange={(e) => setSearch(e.target.value)} className="input !w-44" />
          )}
          <ToolButton label="Download this month (CSV)" icon={ICONS.download} onClick={exportMonth} />
          <ToolButton label="Re-pull Strava and Garmin" icon={ICONS.refresh} onClick={onRefresh} disabled={syncing || garminBusy} />
          <ToolButton label="Search" icon={ICONS.search} onClick={() => setSearch((v) => (v === null ? "" : null))} active={search !== null} />
          <ToolButton label="Show daily metrics" icon={ICONS.metrics} onClick={() => setShowMetrics((v) => !v)} active={showMetrics} />
          <button type="button" onClick={onOpenCoach} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
            Coach
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/10 bg-tri-card">
        <div className="flex h-full flex-col" style={{ minWidth: showSummary ? 965 : 769 }}>
          <div className="grid border-b border-white/10 text-[11px] font-semibold text-white/40" style={columns}>
            {WEEKDAYS.map((day) => (
              <div key={day} className="border-r border-white/10 px-2 py-2">{day}</div>
            ))}
            <button type="button" aria-expanded={showSummary} aria-label="Toggle summary column" onClick={() => setShowSummary((v) => !v)} className="flex items-center justify-between px-2 py-2 hover:bg-white/5">
              <span>{showSummary ? "›" : "‹"}</span>
              {showSummary && <span className="flex-1 text-center">SUMMARY</span>}
            </button>
          </div>

          {/* The weeks share the height evenly, so the whole month is on screen. */}
          <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(96px, 1fr))` }}>
            {weeks.map((weekKey) => {
              const monday = fromDateKey(weekKey);
              const dates = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(monday, i)));
              const weekActivities = dates.flatMap((d) => activitiesByDate.get(d) || []);
              // Fitness as of Sunday, or today for the week in progress.
              const fitness = weekKey <= today ? fitnessByDate.get(weekKey === thisWeek ? today : dates[6]) : undefined;

              return (
                <div key={weekKey} data-week={weekKey} className="grid min-h-0 grid-rows-[minmax(0,1fr)] border-b border-white/10 last:border-b-0" style={columns}>
                  {dates.map((date) => {
                    const { done, plans, open, metrics } = dayData(date);
                    const isToday = date === today;
                    const outside = fromDateKey(date).getMonth() !== monthIndex;
                    const view = () => setOpenDate(date);

                    return (
                      <div
                        key={date}
                        data-date={date}
                        className={`group flex min-h-0 min-w-0 flex-col border-r border-white/10 ${isToday ? "bg-tri-purple/10 ring-1 ring-inset ring-tri-purple" : outside ? "bg-tri-bg/70" : ""}`}
                      >
                        <div className="flex items-center justify-between px-1.5 pt-1">
                          <button
                            type="button"
                            onClick={view}
                            aria-label={`View ${longDate(date)}`}
                            className={`rounded-md px-1.5 text-xs font-semibold leading-5 ${
                              isToday ? "bg-gradient-to-r from-tri-purple to-tri-pink text-white" : outside ? "text-white/25 hover:text-white" : "text-white/60 hover:text-white"
                            }`}
                          >
                            {isToday && "Today "}
                            {fromDateKey(date).getDate()}
                            {fromDateKey(date).getDate() === 1 && ` ${fromDateKey(date).toLocaleDateString("en-US", { month: "short" })}`}
                          </button>
                          <button
                            type="button"
                            aria-label={`Plan a workout on ${date}`}
                            onClick={() => setPlanDate(date)}
                            className="rounded-md px-1.5 text-base leading-5 text-white/60 opacity-0 hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100"
                          >
                            +
                          </button>
                        </div>
                        {/* A busy day scrolls inside its own cell. */}
                        <div className={`tri-scroll-y flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1 ${outside ? "opacity-50" : ""}`}>
                          {showMetrics && metrics && <MetricsLine day={metrics} onClick={view} />}
                          {done.map((activity) => {
                            const label = SPORT_STYLE[activity.sportType]?.label ?? SPORT_STYLE.other.label;
                            const detail = [
                              activity.distanceMeters > 0 ? distanceLabel(activity.sportType, activity.distanceMeters) : null,
                              `${Math.round(estimateActivityLoad(activity))} TSS`,
                            ].filter(Boolean).join(" · ");
                            return (
                              <WorkoutChip
                                key={activity.id}
                                sport={activity.sportType}
                                title={label}
                                duration={clockDuration(activity.movingTimeSeconds).slice(0, -3)}
                                detail={detail}
                                tooltip={activity.name}
                                tone={plans.some((p) => p.matchedActivityId === activity.id) ? "completed" : "done"}
                                dimmed={!matches(activity.sportType, activity.name)}
                                onClick={view}
                              />
                            );
                          })}
                          {open.map((plan) => {
                            const title = plan.workoutType || SPORT_STYLE[plan.sportType]?.label || SPORT_STYLE.other.label;
                            const state = plan.status === "missed" ? "Missed" : "Planned";
                            return (
                              <WorkoutChip
                                key={plan.id}
                                sport={plan.sportType}
                                title={title}
                                duration={plan.plannedDurationMin ? clockDuration(plan.plannedDurationMin * 60).slice(0, -3) : undefined}
                                detail={[state, plan.plannedDistanceKm ? `${plan.plannedDistanceKm} km` : null].filter(Boolean).join(" · ")}
                                tooltip={title}
                                tone={plan.status === "missed" ? "missed" : "planned"}
                                dimmed={!matches(plan.sportType, plan.workoutType || "")}
                                onClick={view}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="tri-scroll-y min-h-0 overflow-y-auto bg-tri-soft/40">
                    {showSummary && <WeekSummary activities={weekActivities} fitness={fitness} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openDate && selected && (
        <Dialog label={longDate(openDate)} onClose={() => setOpenDate(null)}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">{longDate(openDate)}</h2>
            <button type="button" aria-label="Close" onClick={() => setOpenDate(null)} className="rounded-lg px-2 text-xl text-white/60 hover:bg-white/10 hover:text-white">×</button>
          </div>
          {selected.metrics && <MetricsCard day={selected.metrics} />}
          {selected.done.map((activity) => (
            <WorkoutCard key={activity.id} activity={activity} plan={selected.plans.find((p) => p.matchedActivityId === activity.id)} />
          ))}
          {selected.open.map((plan) => (
            <PlannedCard key={plan.id} plan={plan} onDelete={() => void onDeletePlanned(plan.id)} />
          ))}
          {!selected.metrics && !selected.done.length && !selected.open.length && <p className="text-sm text-white/50">Nothing recorded or planned.</p>}
          <button
            type="button"
            onClick={() => {
              setPlanDate(openDate);
              setOpenDate(null);
            }}
            className="w-full rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white"
          >
            + Plan workout
          </button>
        </Dialog>
      )}
      {planDate && <PlanDialog date={planDate} onClose={() => setPlanDate(null)} onSave={onAddPlanned} />}
    </div>
  );
}
