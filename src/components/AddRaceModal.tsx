import { useState } from "react";
import type { Race, RacePriority, RaceType } from "../types";

function parseGoalTime(goal?: string) {
  if (!goal) return { h: "", m: "", s: "" };
  const [h = "", m = "", s = ""] = goal.split(":");
  return { h, m, s };
}

const RACE_TYPES: { value: RaceType; label: string; icon: string }[] = [
  { value: "triathlon", label: "Triathlon", icon: "🏊‍♂️🚴‍♂️🏃‍♂️" },
  { value: "ironman", label: "Ironman", icon: "🔴" },
  { value: "ironman_70_3", label: "70.3", icon: "🟠" },
  { value: "running", label: "Running", icon: "🏃‍♂️" },
  { value: "cycling", label: "Cycling", icon: "🚴‍♂️" },
  { value: "swimming", label: "Swimming", icon: "🏊‍♂️" },
  { value: "duathlon", label: "Duathlon", icon: "🚴‍♂️🏃‍♂️" },
  { value: "custom", label: "Custom", icon: "⭐" },
];

const PRIORITY_OPTIONS = [
  {
    value: "A" as RacePriority,
    label: "A Race",
    sub: "Primary Goal",
    desc: "Full taper, peak performance",
    activeGradient: "from-tri-orange to-tri-pink",
    activeBorder: "border-tri-orange",
    activeBg: "bg-tri-orange/15",
    icon: "🏆",
  },
  {
    value: "B" as RacePriority,
    label: "B Race",
    sub: "Secondary Goal",
    desc: "Partial taper, strong effort",
    activeGradient: "from-tri-purple to-tri-pink",
    activeBorder: "border-tri-purple",
    activeBg: "bg-tri-purple/15",
    icon: "⭐",
  },
  {
    value: "C" as RacePriority,
    label: "C Race",
    sub: "Training Race",
    desc: "No taper, race fitness",
    activeGradient: "from-tri-blue to-tri-green",
    activeBorder: "border-tri-blue",
    activeBg: "bg-tri-blue/15",
    icon: "🚩",
  },
];

type AddRaceModalProps = {
  onClose: () => void;
  onSubmit: (race: Partial<Race>) => Promise<void>;
  initialRace?: Race;
};

function parsePaceMinPerKm(val: string): number | null {
  if (!val.trim()) return null;
  const parts = val.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m + s / 60;
  }
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function fmtMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  const s = Math.round((totalMin * 60) % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AddRaceModal({ onClose, onSubmit, initialRace }: AddRaceModalProps) {
  const parsedGoal = parseGoalTime(initialRace?.targetGoal);
  const [raceName, setRaceName] = useState(initialRace?.raceName ?? "");
  const [raceType, setRaceType] = useState<RaceType>(initialRace?.raceType ?? "triathlon");
  const [raceDate, setRaceDate] = useState(initialRace?.raceDate ?? "");
  const [priority, setPriority] = useState<RacePriority>(initialRace?.priority ?? "B");
  const [goalHours, setGoalHours] = useState(parsedGoal.h);
  const [goalMinutes, setGoalMinutes] = useState(parsedGoal.m);
  const [goalSeconds, setGoalSeconds] = useState(parsedGoal.s);
  const [swimDistanceKm, setSwimDistanceKm] = useState(initialRace?.swimDistanceKm?.toString() ?? "");
  const [bikeDistanceKm, setBikeDistanceKm] = useState(initialRace?.bikeDistanceKm?.toString() ?? "");
  const [runDistanceKm, setRunDistanceKm] = useState(initialRace?.runDistanceKm?.toString() ?? "");
  const [swimPace, setSwimPace] = useState("");
  const [bikePace, setBikePace] = useState("");
  const [runPace, setRunPace] = useState("");
  const [notes, setNotes] = useState(initialRace?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const swim = parseFloat(swimDistanceKm) || 0;
  const bike = parseFloat(bikeDistanceKm) || 0;
  const run = parseFloat(runDistanceKm) || 0;
  const totalKm = Math.round((swim + bike + run) * 1000) / 1000;
  const autoDistance = totalKm > 0 ? `${totalKm} km` : "";

  const swimPaceMin = parsePaceMinPerKm(swimPace);
  const bikeSpeedKmh = parseFloat(bikePace) || null;
  const runPaceMin = parsePaceMinPerKm(runPace);

  const swimOk = swim === 0 || swimPaceMin !== null;
  const bikeOk = bike === 0 || bikeSpeedKmh !== null;
  const runOk = run === 0 || runPaceMin !== null;
  const hasPace = !!(swimPace || bikePace || runPace);
  const estimatedTime =
    hasPace && swimOk && bikeOk && runOk
      ? fmtMinutes(
          (swim > 0 && swimPaceMin ? swim * swimPaceMin : 0) +
          (bike > 0 && bikeSpeedKmh ? (bike / bikeSpeedKmh) * 60 : 0) +
          (run > 0 && runPaceMin ? run * runPaceMin : 0)
        )
      : null;

  const goalTimeString = [goalHours, goalMinutes, goalSeconds].some(Boolean)
    ? `${goalHours || "0"}:${(goalMinutes || "0").padStart(2, "0")}:${(goalSeconds || "0").padStart(2, "0")}`
    : estimatedTime ?? undefined;

  const daysAway = raceDate
    ? Math.round((new Date(raceDate + "T00:00:00").getTime() - Date.now()) / 86_400_000)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceName || !raceDate) return;
    setSubmitting(true);
    try {
      await onSubmit({
        raceName,
        raceType,
        raceDistance: autoDistance || undefined,
        raceDate,
        priority,
        targetGoal: goalTimeString,
        swimDistanceKm: swim || undefined,
        bikeDistanceKm: bike || undefined,
        runDistanceKm: run || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activePriority = PRIORITY_OPTIONS.find((p) => p.value === priority)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl bg-tri-card border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-tri-card border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-white">{initialRace ? "Edit Race" : "Add Race"}</h3>
            <p className="text-xs text-white/40 mt-0.5">{initialRace ? initialRace.raceName : "Set your next goal"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Race Name */}
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">Race Name</label>
            <input
              required
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              className="input text-base font-semibold py-3"
              placeholder="e.g. Singapore Marathon"
            />
          </div>

          {/* Priority — card selector */}
          <div>
            <label className="mb-3 block text-xs uppercase tracking-widest text-white/40">Priority</label>
            <div className="grid grid-cols-3 gap-3">
              {PRIORITY_OPTIONS.map((opt) => {
                const active = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`relative rounded-2xl border p-4 text-left transition-all duration-150 ${
                      active
                        ? `${opt.activeBorder} ${opt.activeBg} shadow-lg`
                        : "border-white/10 bg-tri-soft hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    {active && (
                      <div className={`absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r ${opt.activeGradient}`} />
                    )}
                    <p className="text-xl mb-2">{opt.icon}</p>
                    <p className={`text-sm font-bold ${active ? "text-white" : "text-white/70"}`}>{opt.label}</p>
                    <p className={`text-xs mt-0.5 ${active ? "text-white/70" : "text-white/40"}`}>{opt.sub}</p>
                    <p className={`text-xs mt-2 leading-tight ${active ? "text-white/50" : "text-white/25"}`}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Race Date — prominent with live countdown */}
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">Race Date</label>
            <div className={`relative rounded-2xl border transition-colors ${raceDate ? activePriority.activeBorder : "border-white/10"} bg-tri-soft overflow-hidden`}>
              {raceDate && (
                <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${activePriority.activeGradient}`} />
              )}
              <div className="flex items-center gap-4 p-4">
                <span className="text-2xl select-none">📅</span>
                <div className="flex-1">
                  <input
                    required
                    type="date"
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    className="w-full bg-transparent text-base font-semibold text-white outline-none [color-scheme:dark]"
                  />
                  {daysAway !== null && (
                    <p className="text-xs mt-0.5 text-white/50">
                      {daysAway > 0
                        ? `${daysAway} days away`
                        : daysAway === 0
                        ? "Race day is today!"
                        : `${Math.abs(daysAway)} days ago`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Race Type — pill grid */}
          <div>
            <label className="mb-3 block text-xs uppercase tracking-widest text-white/40">Race Type</label>
            <div className="flex flex-wrap gap-2">
              {RACE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setRaceType(t.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                    raceType === t.value
                      ? "border-tri-purple bg-tri-purple/20 text-white"
                      : "border-white/10 bg-tri-soft text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Segment distances + pace + auto total */}
          <div>
            <label className="mb-3 block text-xs uppercase tracking-widest text-white/40">Distances & Pace</label>
            <div className="grid grid-cols-3 gap-3">
              {/* Distance row */}
              {[
                { label: "🏊 Swim", val: swimDistanceKm, set: setSwimDistanceKm },
                { label: "🚴 Bike", val: bikeDistanceKm, set: setBikeDistanceKm },
                { label: "🏃 Run", val: runDistanceKm, set: setRunDistanceKm },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <p className="mb-1.5 text-xs text-white/40">{label}</p>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="input text-center"
                    placeholder="km"
                  />
                </div>
              ))}

              {/* Pace row */}
              <div>
                <p className="mb-1.5 text-xs text-white/30">min/km</p>
                <input
                  type="text"
                  value={swimPace}
                  onChange={(e) => setSwimPace(e.target.value)}
                  className="input text-center"
                  placeholder="2:30"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-white/30">km/h</p>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={bikePace}
                  onChange={(e) => setBikePace(e.target.value)}
                  className="input text-center"
                  placeholder="35"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-white/30">min/km</p>
                <input
                  type="text"
                  value={runPace}
                  onChange={(e) => setRunPace(e.target.value)}
                  className="input text-center"
                  placeholder="5:30"
                />
              </div>
            </div>

            {/* Total + estimated time */}
            {(autoDistance || estimatedTime) && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-tri-soft px-4 py-2.5">
                {autoDistance && (
                  <>
                    <span className="text-white/40 text-xs uppercase tracking-widest">Total</span>
                    <span className="font-bold text-white">{autoDistance}</span>
                  </>
                )}
                {estimatedTime && (
                  <span className="ml-auto flex items-center gap-1.5 text-sm text-white/60">
                    <span className="text-white/30">Est.</span>
                    <span className="font-semibold text-white">{estimatedTime}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Target Time */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <label className="text-xs uppercase tracking-widest text-white/40">Target Time</label>
              {estimatedTime && !goalHours && !goalMinutes && !goalSeconds && (
                <span className="text-xs text-white/30">from pace</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {[
                { label: "hrs", val: goalHours, set: setGoalHours, max: 99, placeholder: estimatedTime?.split(":")[0] ?? "0" },
                { label: "min", val: goalMinutes, set: setGoalMinutes, max: 59, placeholder: estimatedTime?.split(":")[1] ?? "00" },
                { label: "sec", val: goalSeconds, set: setGoalSeconds, max: 59, placeholder: estimatedTime?.split(":")[2] ?? "00" },
              ].map(({ label, val, set, max, placeholder }, i) => (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/30 font-bold text-lg select-none">:</span>}
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={max}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      className="input w-16 text-center text-lg font-bold py-2.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder={placeholder}
                    />
                    <span className="text-xs text-white/30">{label}</span>
                  </div>
                </div>
              ))}
              {goalTimeString && (
                <span className="ml-auto text-sm font-semibold text-white/70">{goalTimeString}</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[72px] resize-none"
              placeholder="Course notes, logistics, goals..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-3xl border-t border-white/10 bg-tri-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !raceName || !raceDate}
            className={`rounded-xl bg-gradient-to-r ${activePriority.activeGradient} px-6 py-2 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-40`}
          >
            {submitting ? "Saving…" : initialRace ? "Update Race" : "Save Race"}
          </button>
        </div>
      </form>
    </div>
  );
}
