import { useMemo } from "react";
import type { Activity, FatigueReadiness } from "../types";
import { buildDailyLoad } from "../lib/calculations";
import { DAILY_LOAD_CAP, intensityColor } from "../lib/intensityColor";
import { buildFatigueExplanation, getAcwr, ZONE_META, type FatigueZone } from "../lib/fatigueExplanation";

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

const BANDS: { zone: FatigueZone; from: number; to: number }[] = [
  { zone: "tapering", from: 0, to: 0.8 },
  { zone: "optimal", from: 0.8, to: 1.3 },
  { zone: "caution", from: 1.3, to: 1.5 },
  { zone: "high-risk", from: 1.5, to: 2.0 },
];
const DOMAIN_MAX = 2.0;

function AcwrGauge({ acwr, zone }: { acwr: number; zone: FatigueZone }) {
  const markerPct = Math.min(100, (Math.min(acwr, DOMAIN_MAX) / DOMAIN_MAX) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/40">Acute:Chronic Load Ratio</span>
        <span className="text-sm font-semibold" style={{ color: ZONE_META[zone].color }}>
          {acwr.toFixed(2)} · {ZONE_META[zone].label}
        </span>
      </div>
      <div className="relative flex h-2.5 w-full overflow-hidden rounded-full">
        {BANDS.map((band) => (
          <div
            key={band.zone}
            style={{ width: `${((band.to - band.from) / DOMAIN_MAX) * 100}%`, backgroundColor: ZONE_META[band.zone].color, opacity: 0.55 }}
          />
        ))}
        <div
          className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${markerPct}% - 2px)` }}
        />
      </div>
    </div>
  );
}

function DailyLoadStrip({ activities }: { activities: Activity[] }) {
  const dailyLoad = useMemo(() => buildDailyLoad(activities), [activities]);

  const days = useMemo(() => {
    const result: { key: string; label: string; load: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ key, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), load: dailyLoad.get(key) || 0 });
    }
    return result;
  }, [dailyLoad]);

  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-widest text-white/40">Last 7 Days</p>
      <div className="flex gap-1.5">
        {days.map((day) => (
          <div key={day.key} className="flex-1 text-center">
            <div
              title={`${day.key}: ${day.load > 0 ? `${Math.round(day.load)} load` : "Rest day"}`}
              className="aspect-square rounded-md"
              style={{ backgroundColor: intensityColor(day.load / DAILY_LOAD_CAP) }}
            />
            <span className="mt-1 block text-[9px] text-white/30">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FatigueReadinessCard({ data, activities }: { data: FatigueReadiness; activities: Activity[] }) {
  const acwr = getAcwr(data);
  const explanation = buildFatigueExplanation(data);

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

      <div className="mt-4 rounded-2xl bg-tri-soft border border-white/10 p-4">
        <AcwrGauge acwr={acwr} zone={explanation.zone} />
        <p className="mt-3 text-sm text-white">{explanation.headline}</p>
        <p className="mt-1 text-xs text-white/40">{explanation.detail}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-tri-soft border border-white/10 p-4">
        <DailyLoadStrip activities={activities} />
      </div>
    </section>
  );
}
