import type { FatigueReadiness } from "../types";

function scoreColor(score: number, invert = false): string {
  const good = invert ? score < 40 : score > 60;
  const bad = invert ? score > 70 : score < 40;
  if (good) return "#3adf9b";
  if (bad) return "#ff5ca8";
  return "#ff9f43";
}

function Gauge({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const color = scoreColor(value, invert);
  return (
    <div className="rounded-2xl bg-tri-soft border border-white/10 p-4">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-4xl font-black" style={{ color }}>
        {Math.round(value)}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function FatigueReadinessCard({ data }: { data: FatigueReadiness }) {
  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Fatigue &amp; Readiness</h2>
        <p className="text-sm text-white/50">Based on acute vs. chronic training load</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Gauge label="Fatigue Score" value={data.fatigueScore} invert />
        <Gauge label="Readiness Score" value={data.readinessScore} />
      </div>

      <div className="mt-4 flex justify-between text-xs text-white/50">
        <span>7-day load: {Math.round(data.acuteLoad)}</span>
        <span>28-day avg load: {Math.round(data.chronicLoad)}</span>
      </div>
    </section>
  );
}
