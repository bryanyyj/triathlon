import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeeklyTssPoint } from "../lib/calculations";
import { WEEKLY_LOAD_CAP, WEEKLY_LOAD_TARGET_MAX, WEEKLY_LOAD_TARGET_MIN, intensityColor } from "../lib/intensityColor";

function formatWeek(week: string): string {
  const d = new Date(week);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const tss = payload[0].value as number;

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">Week of {formatWeek(label)}</p>
      <p className="text-xs font-semibold" style={{ color: intensityColor(tss / WEEKLY_LOAD_CAP) }}>
        {Math.round(tss)} TSS
      </p>
    </div>
  );
}

export function WeeklyTssChart({ data }: { data: WeeklyTssPoint[] }) {
  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Weekly Training Stress</h2>
        <p className="text-sm text-white/50">
          Duration × intensity relative to threshold · a typical week runs {WEEKLY_LOAD_TARGET_MIN}–{WEEKLY_LOAD_TARGET_MAX} TSS
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-white/50">No activity data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
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
              label={{ value: "TSS", angle: -90, position: "insideLeft", fill: "#898781", fontSize: 12 }}
            />
            <ReferenceLine y={WEEKLY_LOAD_TARGET_MIN} stroke="#c3c2b7" strokeDasharray="4 4" />
            <ReferenceLine y={WEEKLY_LOAD_TARGET_MAX} stroke="#c3c2b7" strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="tss" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((point) => (
                <Cell key={point.week} fill={intensityColor(point.tss / WEEKLY_LOAD_CAP)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-white/40">
        <span>Easy</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <span key={ratio} className="h-3 w-3 rounded-sm" style={{ backgroundColor: intensityColor(ratio) }} />
        ))}
        <span>Very tiring</span>
      </div>
    </section>
  );
}
