import { Area, Bar, CartesianGrid, ComposedChart, Line, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { METRICS, describeCorrelation, formatMetric, metric, type DayRow, type MetricKey } from "../../lib/metrics";
import { shortDate } from "../../lib/dates";
import { GRID, SERIES, TooltipBox, X_DATE, Y_AXIS, dateTooltip } from "../ChartKit";
import { ChartPanel } from "../Layout";

type Side = { key: MetricKey; as?: "line" | "bar" };

const tick = (value: number) => (Math.abs(value) >= 10000 ? `${Math.round(value / 1000)}k` : String(Math.round(value * 10) / 10));
// Bars start at zero; lines zoom to their own range so changes are visible.
const domain = (side: Side): [number | "auto", "auto"] => (side.as === "bar" ? [0, "auto"] : ["auto", "auto"]);

/**
 * Two daily metrics on one chart, each against its own axis. The scales are
 * independent, so where the two series cross carries no meaning.
 */
export function PairChart({ title, note, rows, left, right, band, className }: {
  title: string;
  note?: string;
  rows: DayRow[];
  left: Side;
  right: Side;
  band?: boolean; // shade the HRV balanced range behind the left series
  className?: string;
}) {
  const sides = [
    { ...left, id: "left" as const, color: SERIES.blue },
    { ...right, id: "right" as const, color: SERIES.orange },
  ];
  const data = rows.map((d) => ({
    ...d,
    baseline: band && d.hrvBaselineLow != null && d.hrvBaselineHigh != null ? [d.hrvBaselineLow, d.hrvBaselineHigh] : undefined,
  }));

  // Dots on short ranges, and whenever gaps would leave lone days invisible.
  const showDots = (key: MetricKey) => rows.length <= 60 || rows.filter((d) => d[key] != null).length < rows.length * 0.75;

  return (
    <ChartPanel
      title={title}
      note={note}
      className={className}
      empty={!rows.some((d) => d[left.key] != null || d[right.key] != null)}
      legend={[
        ...sides.map((s) => ({ color: s.color, label: `${metric(s.key).label} (${s.id})` })),
        ...(band ? [{ color: "#3a3a46", label: "Balanced HRV" }] : []),
      ]}
    >
      <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        {sides.map((s) => (
          <YAxis key={s.id} {...Y_AXIS} yAxisId={s.id} orientation={s.id} domain={domain(s)} tickFormatter={tick} />
        ))}
        {dateTooltip<DayRow>((p) =>
          sides.filter((s) => p[s.key] != null).map((s) => ({ label: metric(s.key).label, color: s.color, value: formatMetric(s.key, p[s.key]!) }))
        )}
        {band && <Area yAxisId="left" dataKey="baseline" fill="#c3c2b7" fillOpacity={0.14} stroke="none" isAnimationActive={false} />}
        {/* Bars first so lines stay on top. */}
        {[...sides]
          .sort((a) => (a.as === "bar" ? -1 : 1))
          .map((s) =>
            s.as === "bar" ? (
              <Bar key={s.id} yAxisId={s.id} dataKey={s.key} fill={s.color} fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            ) : (
              <Line key={s.id} yAxisId={s.id} dataKey={s.key} stroke={s.color} strokeWidth={2} dot={showDots(s.key) ? { r: 2.5, fill: s.color, strokeWidth: 0 } : false} isAnimationActive={false} />
            )
          )}
      </ComposedChart>
    </ChartPanel>
  );
}

/** One dot per day, to show whether two metrics move together. */
export function RelationshipChart({ title, rows, x, y, extra, className }: {
  title: string;
  rows: DayRow[];
  x: MetricKey;
  y: MetricKey;
  extra?: React.ReactNode;
  className?: string;
}) {
  const points = rows.filter((d) => d[x] != null && d[y] != null).map((d) => ({ date: d.date, x: d[x]!, y: d[y]! }));

  return (
    <ChartPanel
      title={title}
      note={describeCorrelation(points.map((p) => [p.x, p.y]))}
      extra={extra}
      className={className}
      empty={!points.length}
      emptyText="No days with both values in this range."
    >
      <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 14 }}>
        <CartesianGrid {...GRID} vertical />
        <XAxis
          {...Y_AXIS}
          type="number"
          dataKey="x"
          height={22}
          axisLine={{ stroke: "#383835" }}
          domain={["auto", "auto"]}
          tickFormatter={tick}
          label={{ value: axisName(x), position: "insideBottom", offset: -12, fill: "#898781", fontSize: 11 }}
        />
        <YAxis {...Y_AXIS} type="number" dataKey="y" domain={["auto", "auto"]} tickFormatter={tick} />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.15)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof points)[number];
            return (
              <TooltipBox
                title={shortDate(p.date)}
                lines={[
                  { label: metric(x).label, value: formatMetric(x, p.x) },
                  { label: metric(y).label, value: formatMetric(y, p.y) },
                ]}
              />
            );
          }}
        />
        <Scatter data={points} fill={SERIES.violet} fillOpacity={0.85} isAnimationActive={false} />
      </ScatterChart>
    </ChartPanel>
  );
}

const axisName = (key: MetricKey) => (metric(key).unit ? `${metric(key).label} (${metric(key).unit})` : metric(key).label);

export function MetricSelect({ label, value, onChange }: { label: string; value: MetricKey; onChange: (key: MetricKey) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-white/50">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as MetricKey)} className="input !w-auto !py-1 !text-xs">
        {METRICS.map((m) => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </select>
    </label>
  );
}

