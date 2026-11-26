import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import type { DayRow } from "../../lib/metrics";
import { formatDuration } from "../../lib/format";
import { GRID, SERIES, SLEEP_STAGES, SURFACE, X_DATE, Y_AXIS, dateTooltip } from "../ChartKit";
import { ChartPanel } from "../Layout";

const MARGIN = { top: 4, right: 0, left: 0, bottom: 0 };
const SCORE_COLOR = "#f4f3ee";

export function SleepStagesScoreChart({ rows, className }: { rows: DayRow[]; className?: string }) {
  return (
    <ChartPanel
      title="Sleep stages & score"
      className={className}
      empty={!rows.some((d) => d.sleepSec)}
      emptyText="No sleep recorded in this range."
      legend={[...SLEEP_STAGES.map((s) => ({ ...s, label: `${s.label} (h)` })), { color: SCORE_COLOR, label: "Score (right)" }]}
    >
      <ComposedChart data={rows} margin={MARGIN}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} yAxisId="hours" tickFormatter={(v: number) => `${v}h`} />
        <YAxis {...Y_AXIS} yAxisId="score" orientation="right" domain={[0, 100]} />
        {dateTooltip<DayRow>((p) =>
          p.sleepSec
            ? [
                { label: "Asleep", value: formatDuration(p.sleepSec) },
                ...SLEEP_STAGES.map((s) => ({ label: s.label, color: s.color, value: formatDuration((p[s.key] || 0) * 3600) })),
                ...(p.sleepScore != null ? [{ label: "Score", color: SCORE_COLOR, value: String(p.sleepScore) }] : []),
              ]
            : []
        )}
        <ReferenceLine yAxisId="hours" y={8} stroke="#898781" strokeDasharray="5 4" />
        {SLEEP_STAGES.map((stage) => (
          <Bar key={stage.key} yAxisId="hours" dataKey={stage.key} stackId="sleep" fill={stage.color} stroke={SURFACE} strokeWidth={1} maxBarSize={24} isAnimationActive={false} />
        ))}
        <Line yAxisId="score" dataKey="sleepScore" stroke={SCORE_COLOR} strokeWidth={2} dot={{ r: 2.5, fill: SCORE_COLOR, strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ChartPanel>
  );
}

/** Hours from midnight of the wake-up date: 23:00 the evening before is -1. */
function hoursFromMidnight(stamp: string, date: string): number {
  const [day, time] = stamp.split("T");
  const [h, m] = time.split(":").map(Number);
  return h + m / 60 - (day < date ? 24 : 0);
}

export function clockLabel(hours: number): string {
  const total = ((Math.round(hours * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function sleepWindows(rows: DayRow[]) {
  return rows.map((d) => ({
    date: d.date,
    window:
      d.sleepStart && d.sleepEnd
        ? ([hoursFromMidnight(d.sleepStart, d.date), hoursFromMidnight(d.sleepEnd, d.date)] as [number, number])
        : undefined,
  }));
}

export function BedtimeChart({ rows }: { rows: DayRow[] }) {
  const data = sleepWindows(rows);
  // Gridlines on even clock hours, wide enough to hold every night.
  const edges = data.flatMap((t) => t.window ?? []);
  const start = 2 * Math.floor(Math.min(...edges) / 2);
  const end = 2 * Math.ceil(Math.max(...edges) / 2);
  const ticks = edges.length ? Array.from({ length: (end - start) / 2 + 1 }, (_, i) => start + i * 2) : [];

  return (
    <ChartPanel title="Bedtime & wake time" note="Each bar runs from falling asleep to waking" empty={!edges.length} emptyText="No sleep recorded in this range.">
      <BarChart data={data} margin={{ ...MARGIN, right: 8 }}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} width={42} reversed domain={[start, end]} ticks={ticks} tickFormatter={clockLabel} />
        {dateTooltip<(typeof data)[number]>((p) =>
          p.window
            ? [
                { label: "Asleep", value: clockLabel(p.window[0]) },
                { label: "Awake", value: clockLabel(p.window[1]) },
              ]
            : []
        )}
        <Bar dataKey="window" fill={SERIES.blue} radius={3} maxBarSize={12} isAnimationActive={false} />
      </BarChart>
    </ChartPanel>
  );
}

export function BatteryStressChart({ rows }: { rows: DayRow[] }) {
  const data = rows.map((d) => ({
    ...d,
    span: d.bodyBatteryLow != null && d.bodyBatteryHigh != null ? [d.bodyBatteryLow, d.bodyBatteryHigh] : undefined,
  }));

  return (
    <ChartPanel
      title="Body Battery & stress"
      note="Same 0–100 scale"
      empty={!rows.some((d) => d.bodyBatteryHigh != null || d.avgStress != null)}
      legend={[
        { color: SERIES.blue, label: "Body Battery low–high" },
        { color: SERIES.orange, label: "Average stress" },
      ]}
    >
      <ComposedChart data={data} margin={{ ...MARGIN, right: 8 }}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} domain={[0, 100]} />
        {dateTooltip<(typeof data)[number]>((p) => [
          ...(p.span ? [{ label: "Body Battery", color: SERIES.blue, value: `${p.bodyBatteryLow}–${p.bodyBatteryHigh}` }] : []),
          ...(p.avgStress != null ? [{ label: "Stress", color: SERIES.orange, value: String(p.avgStress) }] : []),
        ])}
        <Bar dataKey="span" fill={SERIES.blue} fillOpacity={0.75} radius={3} maxBarSize={12} isAnimationActive={false} />
        <Line dataKey="avgStress" stroke={SERIES.orange} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartPanel>
  );
}
