import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeeklyVolumePoint } from "../types";
import { SPORT_COLORS, SPORT_LABELS } from "../lib/sportColors";
import { rollingAverage } from "../lib/rollingAverage";

const SERIES = (["swim", "bike", "run"] as const).map((key) => ({
  key,
  label: SPORT_LABELS[key],
  color: SPORT_COLORS[key],
}));

const TREND_WINDOW = 4;
const TREND_COLOR = "#e5e4df";

type ChartPoint = WeeklyVolumePoint & { trend: number };

function formatWeek(week: string): string {
  const d = new Date(week);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildChartData(data: WeeklyVolumePoint[]): ChartPoint[] {
  const totals = data.map((point) => point.swim + point.bike + point.run);
  const trend = rollingAverage(totals, TREND_WINDOW);
  return data.map((point, i) => ({ ...point, trend: trend[i] }));
}

function InfoPanel({ point, isHovering }: { point: ChartPoint; isHovering: boolean }) {
  const totalDistance = point.swim + point.bike + point.run;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-tri-soft/60 px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-semibold text-white">Week ending {formatWeek(point.week)}</p>
        <p className="text-xs text-white/40">{isHovering ? "" : "Hover a bar for details"}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {SERIES.map((s) => (
          <div key={s.key}>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-xs font-medium text-white/60">{s.label}</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-white">{point[s.key].toFixed(1)} km</p>
            <p className="text-xs text-white/40">{formatDuration(point[`${s.key}Hours`])}</p>
          </div>
        ))}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-white/50" />
            <span className="text-xs font-medium text-white/60">Total</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-white">{totalDistance.toFixed(1)} km</p>
          <p className="text-xs text-white/40">{formatDuration(point.hours)}</p>
        </div>
      </div>
    </div>
  );
}

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
  const chartData = buildChartData(data);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasData = chartData.length > 0;
  const isHovering = activeIndex !== null;
  const displayIndex = isHovering ? activeIndex! : chartData.length - 1;
  const displayPoint = hasData ? chartData[displayIndex] : null;

  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Weekly Training Volume</h2>
        <p className="text-sm text-white/50">Distance per sport, by week (Monday–Sunday, labeled by week-ending Sunday)</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-white/50">No activity data yet.</p>
      ) : (
        <>
          <InfoPanel point={displayPoint!} isHovering={isHovering} />
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onMouseMove={(state: any) => {
                const idx = state?.activeTooltipIndex;
                setActiveIndex(typeof idx === "number" ? idx : null);
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
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
              <Tooltip content={() => null} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="volume" fill={s.color} radius={[0, 0, 0, 0]} />
              ))}
              <Line
                dataKey="trend"
                name={`${TREND_WINDOW}-Week Trend`}
                stroke={TREND_COLOR}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 2.5, fill: TREND_COLOR, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}
