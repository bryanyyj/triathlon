import { useEffect, useState } from "react";
import {
  getTrainingWeek,
  saveTrainingWeek,
  type DetectedSession,
  type SessionIntensity,
  type TimeOfDay,
  type TrainingWeekDays,
  type TrainingWeekResponse,
  type WeekSession,
  type WeekSport,
} from "../lib/api";
import { SPORT_COLORS, SPORT_ICONS } from "../lib/sportColors";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SPORT_OPTIONS: { value: WeekSport; label: string; key: keyof typeof SPORT_COLORS }[] = [
  { value: "Swim", label: "Swim", key: "swim" },
  { value: "Ride", label: "Bike", key: "bike" },
  { value: "Run", label: "Run", key: "run" },
];
const SPORT_META = Object.fromEntries(SPORT_OPTIONS.map((s) => [s.value, s])) as Record<WeekSport, (typeof SPORT_OPTIONS)[number]>;

const INTENSITY_OPTIONS: { value: SessionIntensity; label: string }[] = [
  { value: "easy", label: "Easy / base (Z2)" },
  { value: "tempo", label: "Tempo (Z3)" },
  { value: "threshold", label: "Threshold (Z4)" },
  { value: "vo2", label: "VO2 / intervals (Z5)" },
  { value: "long", label: "Long endurance" },
];
const INTENSITY_LABEL = Object.fromEntries(INTENSITY_OPTIONS.map((o) => [o.value, o.label])) as Record<SessionIntensity, string>;

const TIME_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];

type Mode = "auto" | "rest" | "custom";

function modeOf(day: WeekSession[] | null): Mode {
  if (day === null) return "auto";
  return day.length ? "custom" : "rest";
}

function stripWeeks(sessions: DetectedSession[]): WeekSession[] {
  return sessions.map(({ sport, intensity, durationMin, timeOfDay }) => ({ sport, intensity, durationMin, timeOfDay }));
}

const NEW_SESSION: WeekSession = { sport: "Ride", intensity: "easy", durationMin: 60, timeOfDay: "any" };

function SessionChip({ session, weeksObserved }: { session: DetectedSession; weeksObserved: number }) {
  const meta = SPORT_META[session.sport];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      <span aria-hidden="true">{SPORT_ICONS[meta.key]}</span>
      <span style={{ color: SPORT_COLORS[meta.key] }}>{meta.label}</span>
      · {INTENSITY_LABEL[session.intensity]} · {session.durationMin} min
      {session.timeOfDay !== "any" && ` · ${session.timeOfDay}`}
      <span className="text-white/35">
        ({session.weeks}/{weeksObserved} wks)
      </span>
    </span>
  );
}

const selectClass =
  "rounded-lg border border-white/10 bg-tri-bg px-2 py-1.5 text-sm text-white outline-none focus:border-tri-purple";

function SessionEditor({ session, onChange, onRemove }: {
  session: WeekSession;
  onChange: (session: WeekSession) => void;
  onRemove: () => void;
}) {
  const meta = SPORT_META[session.sport];
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-tri-soft p-2.5"
      style={{ borderLeftColor: SPORT_COLORS[meta.key], borderLeftWidth: 3 }}
    >
      <select
        aria-label="Sport"
        value={session.sport}
        onChange={(e) => onChange({ ...session, sport: e.target.value as WeekSport })}
        className={selectClass}
      >
        {SPORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Intensity"
        value={session.intensity}
        onChange={(e) => onChange({ ...session, intensity: e.target.value as SessionIntensity })}
        className={selectClass}
      >
        {INTENSITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-white/60">
        <input
          type="number"
          aria-label="Duration in minutes"
          min={5}
          max={600}
          step={5}
          value={session.durationMin}
          onChange={(e) => onChange({ ...session, durationMin: Number(e.target.value) })}
          className={`${selectClass} w-20`}
        />
        min
      </label>
      <select
        aria-label="Time of day"
        value={session.timeOfDay}
        onChange={(e) => onChange({ ...session, timeOfDay: e.target.value as TimeOfDay })}
        className={selectClass}
      >
        {TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove session"
        className="ml-auto rounded-lg px-2 py-1 text-sm text-white/40 hover:bg-white/10 hover:text-white/80"
      >
        ✕
      </button>
    </div>
  );
}

export function TrainingWeek() {
  const [data, setData] = useState<TrainingWeekResponse | null>(null);
  const [days, setDays] = useState<TrainingWeekDays>(Array(7).fill(null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    getTrainingWeek()
      .then((response) => {
        setData(response);
        setDays(response.saved);
      })
      .catch((err) => setMessage({ text: (err as Error).message || "Could not load your training week.", error: true }));
  }, []);

  const update = (index: number, day: WeekSession[] | null) => {
    setDays((prev) => prev.map((d, i) => (i === index ? day : d)));
    setDirty(true);
    setMessage(null);
  };

  const setMode = (index: number, mode: Mode) => {
    if (mode === "auto") update(index, null);
    else if (mode === "rest") update(index, []);
    else {
      // Start from what history shows, so the athlete only tweaks it.
      const detected = data?.detected.days[index] ?? [];
      update(index, detected.length ? stripWeeks(detected) : [NEW_SESSION]);
    }
  };

  const useAllDetected = () => {
    if (!data) return;
    setDays(data.detected.days.map((d) => (d.length ? stripWeeks(d) : null)));
    setDirty(true);
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { saved } = await saveTrainingWeek(days);
      setDays(saved);
      setDirty(false);
      setMessage({ text: "Saved. The coach will plan around this week." });
    } catch (err) {
      setMessage({ text: (err as Error).message || "Could not save.", error: true });
    } finally {
      setSaving(false);
    }
  };

  const detected = data?.detected;

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-white">Training week</h2>
          <p className="mt-1 text-sm text-white/50">
            Your usual sessions for each weekday. The AI coach keeps these in place when it plans, and keeps each session's
            intensity and duration similar week to week (a 50 min tempo ride stays a ~50 min tempo ride).
          </p>
          {detected && (
            <p className="mt-1 text-xs text-white/35">
              Detected from your last {detected.weeksObserved} completed weeks ({detected.from} to {detected.through}). A
              session shows up when it happened on that weekday in at least half of them.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={useAllDetected}
            disabled={!data}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            Use detected for every day
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mb-4 text-sm ${message.error ? "text-red-300" : "text-tri-green"}`} role="status">
          {message.text}
        </p>
      )}

      {!data ? (
        !message?.error && <p className="text-sm text-white/50">Loading your training week…</p>
      ) : (
        <div className="divide-y divide-white/5">
          {WEEKDAYS.map((weekday, index) => {
            const day = days[index];
            const mode = modeOf(day);
            const found = detected!.days[index];

            return (
              <div key={weekday} className="flex flex-col gap-3 py-4 md:flex-row md:items-start">
                <div className="flex items-center justify-between gap-3 md:w-56 md:shrink-0 md:flex-col md:items-start">
                  <p className="text-base font-bold text-white">{weekday}</p>
                  <div className="flex rounded-lg bg-white/5 p-0.5 text-xs" role="radiogroup" aria-label={`${weekday} mode`}>
                    {(["auto", "rest", "custom"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setMode(index, m)}
                        className={`rounded-md px-3 py-1 font-semibold ${
                          mode === m ? "bg-tri-purple text-white" : "text-white/50 hover:text-white/80"
                        }`}
                      >
                        {m === "custom" ? "Set sessions" : m === "auto" ? "Auto" : "Rest"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {mode === "auto" &&
                    (found.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-white/40">Following detected:</span>
                        {found.map((s) => (
                          <SessionChip key={s.sport} session={s} weeksObserved={detected!.weeksObserved} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/40">No regular session detected. The coach decides this day.</p>
                    ))}

                  {mode === "rest" && <p className="text-sm text-white/50">Rest day. The coach won't schedule training here.</p>}

                  {mode === "custom" && (
                    <>
                      {day!.map((session, i) => (
                        <SessionEditor
                          key={i}
                          session={session}
                          onChange={(next) => update(index, day!.map((s, j) => (j === i ? next : s)))}
                          onRemove={() => update(index, day!.filter((_, j) => j !== i))}
                        />
                      ))}
                      <div className="flex flex-wrap items-center gap-3">
                        {day!.length < 4 && (
                          <button
                            type="button"
                            onClick={() => update(index, [...day!, NEW_SESSION])}
                            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
                          >
                            + Add session
                          </button>
                        )}
                        {found.length > 0 && (
                          <span className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                            Detected:
                            {found.map((s) => (
                              <SessionChip key={s.sport} session={s} weeksObserved={detected!.weeksObserved} />
                            ))}
                          </span>
                        )}
                      </div>
                    </>
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
