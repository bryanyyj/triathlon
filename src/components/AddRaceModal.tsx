import { useState } from "react";
import type { Race, RacePriority, RaceType } from "../types";

const RACE_TYPES: { value: RaceType; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
  { value: "duathlon", label: "Duathlon" },
  { value: "triathlon", label: "Triathlon" },
  { value: "ironman_70_3", label: "Ironman 70.3" },
  { value: "ironman", label: "Ironman" },
  { value: "custom", label: "Custom" },
];

type AddRaceModalProps = {
  onClose: () => void;
  onSubmit: (race: Partial<Race>) => Promise<void>;
};

export function AddRaceModal({ onClose, onSubmit }: AddRaceModalProps) {
  const [raceName, setRaceName] = useState("");
  const [raceType, setRaceType] = useState<RaceType>("running");
  const [raceDistance, setRaceDistance] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [priority, setPriority] = useState<RacePriority>("B");
  const [targetGoal, setTargetGoal] = useState("");
  const [swimDistanceKm, setSwimDistanceKm] = useState("");
  const [bikeDistanceKm, setBikeDistanceKm] = useState("");
  const [runDistanceKm, setRunDistanceKm] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceName || !raceDate) return;

    setSubmitting(true);
    try {
      await onSubmit({
        raceName,
        raceType,
        raceDistance: raceDistance || undefined,
        raceDate,
        priority,
        targetGoal: targetGoal || undefined,
        swimDistanceKm: swimDistanceKm ? Number(swimDistanceKm) : undefined,
        bikeDistanceKm: bikeDistanceKm ? Number(bikeDistanceKm) : undefined,
        runDistanceKm: runDistanceKm ? Number(runDistanceKm) : undefined,
        notes: notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl bg-tri-card border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Add Race</h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Race Name">
            <input
              required
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              className="input"
              placeholder="Singapore Marathon"
            />
          </Field>

          <Field label="Race Type">
            <select value={raceType} onChange={(e) => setRaceType(e.target.value as RaceType)} className="input">
              {RACE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Race Distance">
            <input
              value={raceDistance}
              onChange={(e) => setRaceDistance(e.target.value)}
              className="input"
              placeholder="Marathon / 120 km / 70.3"
            />
          </Field>

          <Field label="Race Date">
            <input required type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} className="input" />
          </Field>

          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as RacePriority)} className="input">
              <option value="A">A Race</option>
              <option value="B">B Race</option>
              <option value="C">C Race</option>
            </select>
          </Field>

          <Field label="Target Goal">
            <input
              value={targetGoal}
              onChange={(e) => setTargetGoal(e.target.value)}
              className="input"
              placeholder="Sub 4 hours"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Swim (km)">
              <input
                type="number"
                step="0.1"
                value={swimDistanceKm}
                onChange={(e) => setSwimDistanceKm(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Bike (km)">
              <input
                type="number"
                step="0.1"
                value={bikeDistanceKm}
                onChange={(e) => setBikeDistanceKm(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Run (km)">
              <input
                type="number"
                step="0.1"
                value={runDistanceKm}
                onChange={(e) => setRunDistanceKm(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[80px]" />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Race"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-white/40">{label}</span>
      {children}
    </label>
  );
}
