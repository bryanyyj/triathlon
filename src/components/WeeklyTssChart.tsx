import { CartesianGrid, LabelList, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeeklyTssPoint } from "../lib/calculations";
import { WEEKLY_LOAD_CAP, WEEKLY_LOAD_TARGET_MAX, WEEKLY_LOAD_TARGET_MIN, intensityColor } from "../lib/intensityColor";
import { formatDuration } from "../lib/format";

// Brand purple, lifted for contrast on the dark card; pink is the intensity ramp and
// blue/green/orange are the sports, so duration gets its own hue.
const DURATION_COLOR = "#9d85ff";

// Week keys are local "YYYY-MM-DD" dates; parse them as local so labels don't shift a day.
function formatWeek(week: string): string {
  const [y, m, d] = week.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { tss, hours } = payload[0].payload as WeeklyTssPoint;

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">Week ending {formatWeek(label)}</p>
      <p className="text-xs font-semibold" style={{ color: intensityColor(tss / WEEKLY_LOAD_CAP) }}>
        {Math.round(tss)} TSS
      </p>
      <p className="text-xs font-semibold" style={{ color: DURATION_COLOR }}>
        {formatDuration(hours * 3600)} training
      </p>
    </div>
  );
}

function IntensityDot({ cx, cy, payload, active }: any) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 9 : 7}
      fill={intensityColor(payload.tss / WEEKLY_LOAD_CAP)}
      // Light ring keeps the darkest (easiest) weeks visible against the dark card.
      stroke="rgba(255,255,255,0.35)"
      strokeWidth={1.5}
    />
  );
}

// showValues prints each week's TSS above its dot; only readable on shorter ranges.
export function WeeklyTssChart({ data, showValues }: { data: WeeklyTssPoint[]; showValues: boolean }) {
  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Weekly Training Stress</h2>
        <p className="text-sm text-white/50">
          TSS (left) vs. training time (right) · shaded band is a typical week ({WEEKLY_LOAD_TARGET_MIN}–{WEEKLY_LOAD_TARGET_MAX} TSS)
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-white/50">No activity data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: showValues ? 24 : 12, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
            <ReferenceArea yAxisId="tss" y1={WEEKLY_LOAD_TARGET_MIN} y2={WEEKLY_LOAD_TARGET_MAX} fill="#c3c2b7" fillOpacity={0.06} stroke="none" />
            <XAxis
              dataKey="week"
              tickFormatter={formatWeek}
              stroke="#898781"
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              yAxisId="tss"
              stroke="#898781"
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              label={{ value: "TSS", angle: -90, position: "insideLeft", fill: "#898781", fontSize: 12 }}
            />
            <YAxis
              yAxisId="hours"
              orientation="right"
              stroke={DURATION_COLOR}
              tick={{ fill: DURATION_COLOR, fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              tickFormatter={(value: number) => `${value}h`}
              label={{ value: "Duration", angle: 90, position: "insideRight", fill: DURATION_COLOR, fontSize: 12 }}
            />
            <Line
              yAxisId="hours"
              type="monotone"
              dataKey="hours"
              stroke={DURATION_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, fill: DURATION_COLOR, stroke: "none" }}
              isAnimationActive={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
            <Line
              yAxisId="tss"
              type="monotone"
              dataKey="tss"
              stroke="#898781"
              strokeWidth={2}
              dot={<IntensityDot />}
              activeDot={<IntensityDot active />}
              isAnimationActive={false}
            >
              {showValues && (
                <LabelList
                  dataKey="tss"
                  position="top"
                  offset={12}
                  fill="#c3c2b7"
                  fontSize={11}
                  formatter={(value: number) => (value > 0 ? Math.round(value) : "")}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[10px] text-white/40">
        <span className="mr-3 flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" stroke={DURATION_COLOR} strokeWidth="2" strokeDasharray="5 3" />
          </svg>
          Duration
        </span>
        <span>TSS: Easy</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <span key={ratio} className="h-3 w-3 rounded-full" style={{ backgroundColor: intensityColor(ratio) }} />
        ))}
        <span>Very tiring</span>
      </div>
    </section>
  );
}
