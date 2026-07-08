import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HrZonesBySport } from "../types";
import { ZONE_DEFS } from "../lib/zoneColors";
import { SPORT_LABELS } from "../lib/sportColors";
import { formatDuration } from "../lib/format";

type Row = { sport: string; totalSec: number; [zoneKey: string]: number | string };

function buildRows(zones: HrZonesBySport | null): Row[] {
  return (["swim", "bike", "run"] as const).map((key) => {
    const z = zones?.[key];
    const totalSec = z ? Object.values(z).reduce((sum, v) => sum + v, 0) : 0;
    const row: Row = { sport: SPORT_LABELS[key], totalSec };

    for (const zoneDef of ZONE_DEFS) {
      const sec = z ? z[zoneDef.key] : 0;
      row[zoneDef.key] = totalSec > 0 ? (sec / totalSec) * 100 : 0;
      row[`${zoneDef.key}_sec`] = sec;
    }

    return row;
  });
}

function ZoneTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((entry: any) => entry.value > 0);
  if (!visible.length) return <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 text-xs text-white/50 shadow-xl">No zone data yet</div>;

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">{label}</p>
      {visible.map((entry: any) => (
        <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(0)}% ({formatDuration(entry.payload[`${entry.dataKey}_sec`])})
        </p>
      ))}
    </div>
  );
}

export function HrZonesBySportChart({ zones }: { zones: HrZonesBySport | null }) {
  const rows = buildRows(zones);
  const hasData = rows.some((row) => row.totalSec > 0);

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">HR Zones by Sport</h2>
        <p className="text-sm text-white/50">Share of time in each zone, per discipline</p>
      </div>

      {!hasData ? (
        <p className="py-10 text-center text-sm text-white/40">
          No heart-rate zone data yet — click "Re-pull Strava Data" to fetch it.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${Math.round(v)}%`}
                stroke="#898781"
                tick={{ fill: "#898781", fontSize: 12 }}
                axisLine={{ stroke: "#383835" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="sport"
                stroke="#898781"
                tick={{ fill: "#c3c2b7", fontSize: 13, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<ZoneTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {ZONE_DEFS.map((zoneDef) => (
                <Bar
                  key={zoneDef.key}
                  dataKey={zoneDef.key}
                  name={zoneDef.label}
                  stackId="zones"
                  fill={zoneDef.color}
                  stroke="#14141f"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {ZONE_DEFS.map((zoneDef) => (
              <span key={zoneDef.key} className="flex items-center gap-1.5 text-[11px] text-white/60">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: zoneDef.color }} />
                {zoneDef.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
