import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeeklyVolumePoint } from "../types";

const SERIES = [
  { key: "swim", label: "Swim", color: "#3ab7ff" },
  { key: "bike", label: "Bike", color: "#3adf9b" },
  { key: "run", label: "Run", color: "#ff9f43" },
] as const;

function formatWeek(week: string): string {
  const d = new Date(week);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">{formatWeek(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(1)} km
        </p>
      ))}
    </div>
  );
}

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Weekly Training Volume</h2>
        <p className="text-sm text-white/50">Distance per sport, by week</p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-white/50">No activity data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
            <XAxis
              dataKey="week"
              tickFormatter={formatWeek}
              stroke="#898781"
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
            />
            <YAxis
              stroke="#898781"
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              label={{ value: "km", angle: -90, position: "insideLeft", fill: "#898781", fontSize: 12 }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="volume" fill={s.color} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
