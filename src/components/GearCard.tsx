import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getGearAnalytics } from "../lib/api";
import type { Gear, GearAnalytics, GearType } from "../types";

const GEAR_ICON: Record<GearType, string> = { bike: "🚲", shoe: "👟", other: "🎽" };
const GEAR_ACCENT: Record<GearType, string> = { bike: "#3adf9b", shoe: "#ff9f43", other: "#a78bfa" };
const SHOE_MAX_KM = 800;

function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toLocaleString(undefined, { maximumFractionDigits: km >= 100 ? 0 : 1 })} km`;
}

function formatPace(minKm: number): string {
  const min = Math.floor(minKm);
  const sec = Math.round((minKm - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] rounded-xl bg-white/5 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ShoeLifeBar({ usedKm, maxKm }: { usedKm: number; maxKm: number }) {
  const pct = Math.min(usedKm / maxKm, 1);
  const color = pct < 0.6 ? "#3adf9b" : pct < 0.85 ? "#ff9f43" : "#ef4444";
  const remaining = Math.max(maxKm - usedKm, 0);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
        <span>Shoe life est. ({maxKm} km)</span>
        <span style={{ color }}>{remaining < 1 ? "Exceeded" : `~${Math.round(remaining)} km left`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function GearAnalyticsPanel({ gear, analytics }: { gear: Gear; analytics: GearAnalytics }) {
  const accent = GEAR_ACCENT[gear.type];
  const isShoe = gear.type === "shoe";
  const isBike = gear.type === "bike";

  const statBoxes = [
    { label: "Sessions", value: analytics.totalSessions.toString() },
    { label: "Avg distance", value: `${analytics.avgDistanceKm} km` },
    { label: "Avg duration", value: formatDuration(analytics.avgDurationMin) },
    isBike && analytics.avgSpeedKmh != null
      ? { label: "Avg speed", value: `${analytics.avgSpeedKmh} km/h` }
      : isShoe && analytics.avgPaceMinKm != null
      ? { label: "Avg pace", value: formatPace(analytics.avgPaceMinKm) }
      : null,
    analytics.avgHeartRate != null ? { label: "Avg heart rate", value: `${analytics.avgHeartRate} bpm` } : null,
    analytics.avgPower != null ? { label: "Avg power", value: `${analytics.avgPower} W` } : null,
    analytics.avgCadence != null ? { label: "Avg cadence", value: `${analytics.avgCadence} rpm` } : null,
    analytics.totalElevationM > 0
      ? { label: "Total elevation", value: `${analytics.totalElevationM.toLocaleString()} m` }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const monthlyData = analytics.monthlyBreakdown.map((m) => {
    const avgSpeed = m.durationMin > 0 ? Math.round((m.distanceKm / (m.durationMin / 60)) * 10) / 10 : null;
    const avgPace = m.distanceKm > 0 ? Math.round((m.durationMin / m.distanceKm) * 10) / 10 : null;
    return {
      ...m,
      label: formatMonth(m.month),
      avgSpeed,
      avgPace,
    };
  });

  const recentData = analytics.recentSessions
    .slice()
    .reverse()
    .map((s) => ({
      distanceKm: s.distanceKm,
      avgSpeed: s.avgSpeed,
      avgHr: s.avgHr,
      label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));

  const chartProps = {
    cartesian: { strokeDasharray: "3 3" as const, stroke: "rgba(255,255,255,0.06)", vertical: false },
    axis: { fill: "rgba(255,255,255,0.35)", fontSize: 10 },
    tooltip: { contentStyle: { background: "#1e2130", border: "none", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "rgba(255,255,255,0.6)" } },
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{GEAR_ICON[gear.type]}</span>
        <h3 className="text-sm font-semibold text-white">{gear.name}</h3>
        {gear.brand && <span className="text-xs text-white/40">{[gear.brand, gear.model].filter(Boolean).join(" ")}</span>}
      </div>

      {/* Stat chips — horizontal scroll on small screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statBoxes.map((s) => (
          <StatBox key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {isShoe && <ShoeLifeBar usedKm={gear.distanceMeters / 1000} maxKm={SHOE_MAX_KM} />}

      {/* 2×2 chart grid */}
      {monthlyData.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Monthly distance — line */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Monthly distance (km)</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthlyData}>
                <CartesianGrid {...chartProps.cartesian} />
                <XAxis dataKey="label" tick={chartProps.axis} axisLine={false} tickLine={false} />
                <YAxis tick={chartProps.axis} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...chartProps.tooltip} itemStyle={{ color: accent }} formatter={(v: number) => [`${v} km`, "Distance"]} />
                <Line type="monotone" dataKey="distanceKm" stroke={accent} strokeWidth={2} dot={{ r: 3, fill: accent }} activeDot={{ r: 5 }} name="Distance km" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sessions per month — line */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Sessions per month</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthlyData}>
                <CartesianGrid {...chartProps.cartesian} />
                <XAxis dataKey="label" tick={chartProps.axis} axisLine={false} tickLine={false} />
                <YAxis tick={chartProps.axis} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip {...chartProps.tooltip} itemStyle={{ color: "#60a5fa" }} formatter={(v: number) => [v, "Sessions"]} />
                <Line type="monotone" dataKey="sessions" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: "#60a5fa" }} activeDot={{ r: 5 }} name="Sessions" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent sessions — bar + HR line */}
          {recentData.length > 2 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">
                Recent sessions — {isBike ? "speed (km/h)" : "distance (km)"} &amp; HR
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={recentData}>
                  <CartesianGrid {...chartProps.cartesian} />
                  <XAxis dataKey="label" tick={chartProps.axis} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={chartProps.axis} axisLine={false} tickLine={false} width={30} domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" tick={chartProps.axis} axisLine={false} tickLine={false} width={34} domain={['auto', 'auto']} />
                  <Tooltip {...chartProps.tooltip} />
                  <Bar yAxisId="left" dataKey={isBike ? "avgSpeed" : "distanceKm"} fill={accent} radius={[3, 3, 0, 0]} barSize={10} name={isBike ? "Speed km/h" : "Distance km"} />
                  <Line yAxisId="right" type="monotone" dataKey="avgHr" stroke="#f87171" dot={false} strokeWidth={2} name="Avg HR" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly avg performance trend — line */}
          {monthlyData.some((m) => (isBike ? m.avgSpeed : m.avgPace) != null) && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">
                {isBike ? "Avg speed trend (km/h)" : isShoe ? "Avg pace trend (min/km)" : "Avg duration trend (min)"}
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={monthlyData}>
                  <CartesianGrid {...chartProps.cartesian} />
                  <XAxis dataKey="label" tick={chartProps.axis} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartProps.axis}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    reversed={isShoe}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    {...chartProps.tooltip}
                    itemStyle={{ color: "#e879f9" }}
                    formatter={(v: number) =>
                      isBike
                        ? [`${v} km/h`, "Avg speed"]
                        : isShoe
                        ? [formatPace(v), "Avg pace"]
                        : [`${v} min`, "Avg duration"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey={isBike ? "avgSpeed" : isShoe ? "avgPace" : "durationMin"}
                    stroke="#e879f9"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#e879f9" }}
                    activeDot={{ r: 5 }}
                    name={isBike ? "Avg speed" : isShoe ? "Avg pace" : "Avg duration"}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GearChip({ gear, selected, onSelect }: { gear: Gear; selected: boolean; onSelect: (id: string) => void }) {
  const accent = GEAR_ACCENT[gear.type];

  return (
    <button
      type="button"
      onClick={() => onSelect(gear.id)}
      className={`flex w-40 shrink-0 flex-col rounded-2xl border p-3.5 text-left transition-all duration-200 ${
        gear.retired ? "opacity-50" : ""
      } ${selected ? "bg-white/10" : "bg-tri-soft hover:bg-white/5"}`}
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.08)",
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xl">{GEAR_ICON[gear.type]}</span>
        {gear.primary && (
          <span className="rounded-full bg-tri-green/20 px-1.5 py-0.5 text-[9px] font-semibold text-tri-green">Primary</span>
        )}
      </div>

      <p className="w-full truncate text-xs font-semibold text-white" title={gear.name}>
        {gear.name}
      </p>

      {[gear.brand, gear.model].filter(Boolean).join(" ") && (
        <p className="mt-0.5 w-full truncate text-[10px] text-white/35">
          {[gear.brand, gear.model].filter(Boolean).join(" ")}
        </p>
      )}

      <p className="mt-2 text-base font-black leading-none" style={{ color: accent }}>
        {formatKm(gear.distanceMeters)}
      </p>

      <div className="mt-1.5 flex items-center justify-between">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
            gear.retired ? "bg-white/10 text-white/40" : "bg-tri-blue/20 text-tri-blue"
          }`}
        >
          {gear.retired ? "Retired" : "Active"}
        </span>
        {gear.activityCount > 0 && (
          <span className="text-[9px] text-white/30">{gear.activityCount} uses</span>
        )}
      </div>

      {/* Down-arrow indicator when selected */}
      {selected && (
        <div className="mt-2 flex justify-center">
          <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path d="M1 1L6 6L11 1" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

export function GearCard({ gear }: { gear: Gear[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<GearAnalytics | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setAnalytics(null);
      return;
    }
    setSelectedId(id);
    setAnalytics(null);
    setLoadingId(id);
    getGearAnalytics(id)
      .then((data) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingId(null));
  };

  const selectedGear = gear.find((g) => g.id === selectedId) ?? null;

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Gear</h2>
        <p className="text-sm text-white/50">Select a piece of gear to see detailed analytics</p>
      </div>

      {gear.length === 0 ? (
        <p className="text-sm text-white/50">
          No gear found yet. Connect Strava and sync — gear is pulled during each sync.
        </p>
      ) : (
        <>
          {/* Horizontal scrollable chip row */}
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            {gear.map((g) => (
              <GearChip key={g.id} gear={g} selected={g.id === selectedId} onSelect={handleSelect} />
            ))}
          </div>

          {/* Drop-down analytics panel */}
          {selectedGear && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              {loadingId === selectedGear.id ? (
                <p className="py-6 text-center text-sm text-white/40">Loading analytics…</p>
              ) : analytics ? (
                analytics.totalSessions === 0 ? (
                  <p className="py-6 text-center text-sm text-white/40">
                    No logged sessions for this gear yet. Sync more activities from Strava to populate analytics.
                  </p>
                ) : (
                  <GearAnalyticsPanel gear={selectedGear} analytics={analytics} />
                )
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
