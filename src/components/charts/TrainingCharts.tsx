import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Activity, HrZonesBySport } from "../../types";
import type { FitnessDay } from "../../lib/fitness";
import { buildWeeklyTss, buildWeeklyVolume } from "../../lib/calculations";
import { describeCorrelation } from "../../lib/metrics";
import { shortDate, toDateKey } from "../../lib/dates";
import { formatDuration } from "../../lib/format";
import { SPORT_COLORS, SPORT_LABELS } from "../../lib/sportColors";
import { ZONE_DEFS } from "../../lib/zoneColors";
import { GRID, SERIES, SURFACE, TooltipBox, X_DATE, Y_AXIS, dateTooltip } from "../ChartKit";
import { ChartPanel } from "../Layout";

const MARGIN = { top: 4, right: 0, left: 0, bottom: 0 };
const TSS_COLOR = "#f4f3ee";
export type TriSport = keyof typeof SPORT_COLORS;

export function FitnessFormChart({ data, className }: { data: FitnessDay[]; className?: string }) {
  return (
    <ChartPanel
      title="Fitness, fatigue & form"
      note="Form = fitness − fatigue"
      className={className}
      empty={!data.length}
      legend={[
        { color: SERIES.blue, label: "Fitness (CTL)" },
        { color: SERIES.orange, label: "Fatigue (ATL)" },
        { color: SERIES.green, label: "Form (TSB)" },
      ]}
    >
      <ComposedChart data={data} margin={{ ...MARGIN, right: 8 }}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} />
        {dateTooltip<FitnessDay>((p) => [
          { label: "Fitness", color: SERIES.blue, value: p.fitness.toFixed(0) },
          { label: "Fatigue", color: SERIES.orange, value: p.fatigue.toFixed(0) },
          { label: "Form", color: SERIES.green, value: p.form.toFixed(0) },
          { label: "Load that day", value: p.load.toFixed(0) },
        ])}
        <ReferenceLine y={0} stroke="#898781" />
        <Bar dataKey="form" fill={SERIES.green} isAnimationActive={false} />
        <Line dataKey="fitness" type="monotone" stroke={SERIES.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="fatigue" type="monotone" stroke={SERIES.orange} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartPanel>
  );
}

export function WeeklyLoadChart({ activities, className }: { activities: Activity[]; className?: string }) {
  const tss = new Map(buildWeeklyTss(activities).map((w) => [w.week, w.tss]));
  const data = buildWeeklyVolume(activities).map((w) => ({ ...w, date: w.week, tss: tss.get(w.week) }));
  const sports = Object.keys(SPORT_COLORS) as TriSport[];

  return (
    <ChartPanel
      title="Weekly hours & training stress"
      className={className}
      empty={!data.length}
      legend={[...sports.map((s) => ({ color: SPORT_COLORS[s], label: `${SPORT_LABELS[s]} (h)` })), { color: TSS_COLOR, label: "TSS (right)" }]}
    >
      <ComposedChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} yAxisId="hours" tickFormatter={(v: number) => `${v}h`} />
        <YAxis {...Y_AXIS} yAxisId="tss" orientation="right" />
        {dateTooltip<(typeof data)[number]>(
          (p) => [
            ...sports.map((s) => ({
              label: SPORT_LABELS[s],
              color: SPORT_COLORS[s],
              value: `${formatDuration(p[`${s}Hours`] * 3600)} · ${p[s].toFixed(1)} km`,
            })),
            { label: "TSS", color: TSS_COLOR, value: String(Math.round(p.tss || 0)) },
          ],
          (p) => `Week ending ${shortDate(p.date)}`
        )}
        {sports.map((s) => (
          <Bar key={s} yAxisId="hours" dataKey={`${s}Hours`} stackId="hours" fill={SPORT_COLORS[s]} stroke={SURFACE} strokeWidth={1} maxBarSize={36} isAnimationActive={false} />
        ))}
        <Line yAxisId="tss" dataKey="tss" stroke={TSS_COLOR} strokeWidth={2} dot={{ r: 3, fill: TSS_COLOR, strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ChartPanel>
  );
}

export function HrZonesChart({ zones, className }: { zones: HrZonesBySport | null; className?: string }) {
  const data = (Object.keys(SPORT_COLORS) as TriSport[]).map((sport) => {
    const seconds = zones?.[sport];
    const total = seconds ? Object.values(seconds).reduce((a, b) => a + b, 0) : 0;
    const share: Record<string, number> = {};
    for (const zone of ZONE_DEFS) share[zone.key] = total ? (seconds![zone.key] / total) * 100 : 0;
    return { sport: SPORT_LABELS[sport], total, seconds, ...share } as Record<string, any>;
  });

  return (
    <ChartPanel
      title="Heart-rate zones by sport"
      note="Share of time in each zone"
      className={className}
      empty={!data.some((d) => d.total)}
      emptyText="No zone data yet. Re-pull Strava data to fetch it."
      legend={ZONE_DEFS.map((z) => ({ color: z.color, label: z.label.split(" ")[0] }))}
    >
      <BarChart data={data} layout="vertical" margin={{ ...MARGIN, right: 12 }}>
        <XAxis type="number" domain={[0, 100]} allowDataOverflow tickFormatter={(v: number) => `${v}%`} tick={Y_AXIS.tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="sport" {...Y_AXIS} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            return (
              <TooltipBox
                title={row.sport}
                lines={ZONE_DEFS.filter((z) => row[z.key] > 0).map((z) => ({
                  label: z.label,
                  color: z.color,
                  value: `${row[z.key].toFixed(0)}% · ${formatDuration(row.seconds[z.key])}`,
                }))}
              />
            );
          }}
        />
        {ZONE_DEFS.map((zone) => (
          <Bar key={zone.key} dataKey={zone.key} stackId="zones" fill={zone.color} stroke={SURFACE} strokeWidth={1} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartPanel>
  );
}

// Bikes are read as speed; runs and swims as pace, where lower is faster.
export const PACE = {
  swim: { label: "Pace (min/100 m)", value: (m: number, s: number) => s / 60 / (m / 100) },
  bike: { label: "Speed (km/h)", value: (m: number, s: number) => m / 1000 / (s / 3600) },
  run: { label: "Pace (min/km)", value: (m: number, s: number) => s / 60 / (m / 1000) },
} as const;

export function formatPace(sport: TriSport, value: number): string {
  if (sport === "bike") return `${value.toFixed(1)} km/h`;
  const total = Math.round(value * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /${sport === "run" ? "km" : "100m"}`;
}

export function sessionPoints(activities: Activity[], sport: TriSport) {
  return activities
    .filter((a) => a.sportType === sport && a.distanceMeters > 0 && a.movingTimeSeconds > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((a) => ({
      date: toDateKey(new Date(a.startDate)),
      name: a.name,
      pace: PACE[sport].value(a.distanceMeters, a.movingTimeSeconds),
      hr: a.averageHeartRate ?? undefined,
      km: a.distanceMeters / 1000,
    }));
}

type SessionPoint = ReturnType<typeof sessionPoints>[number];

const paceTick = (sport: TriSport) => (value: number) => (sport === "bike" ? String(Math.round(value)) : formatPace(sport, value).split(" ")[0]);

export function PaceHeartChart({ points, sport, className }: { points: SessionPoint[]; sport: TriSport; className?: string }) {
  const color = SPORT_COLORS[sport];
  return (
    <ChartPanel
      title={`${SPORT_LABELS[sport]}: ${sport === "bike" ? "speed" : "pace"} & heart rate per session`}
      note={sport === "bike" ? undefined : "Higher on the left axis is faster"}
      className={className}
      empty={!points.length}
      emptyText="No sessions in this range."
      legend={[
        { color, label: `${PACE[sport].label} (left)` },
        { color: SERIES.red, label: "Average HR (right)" },
      ]}
    >
      <ComposedChart data={points} margin={MARGIN}>
        <CartesianGrid {...GRID} />
        <XAxis {...X_DATE} />
        <YAxis {...Y_AXIS} width={40} yAxisId="pace" domain={["auto", "auto"]} reversed={sport !== "bike"} tickFormatter={paceTick(sport)} />
        <YAxis {...Y_AXIS} yAxisId="hr" orientation="right" domain={["auto", "auto"]} />
        {dateTooltip<SessionPoint>(
          (p) => [
            { label: sport === "bike" ? "Speed" : "Pace", color, value: formatPace(sport, p.pace) },
            ...(p.hr != null ? [{ label: "Average HR", color: SERIES.red, value: `${Math.round(p.hr)} bpm` }] : []),
            { label: "Distance", value: `${p.km.toFixed(1)} km` },
          ],
          (p) => `${shortDate(p.date)} · ${p.name}`
        )}
        <Line yAxisId="pace" dataKey="pace" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        <Line yAxisId="hr" dataKey="hr" stroke={SERIES.red} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartPanel>
  );
}

export function PaceVsHeartChart({ points, sport }: { points: SessionPoint[]; sport: TriSport }) {
  const data = points.filter((p) => p.hr != null);
  return (
    <ChartPanel
      title={`${sport === "bike" ? "Speed" : "Pace"} vs heart rate`}
      note={describeCorrelation(data.map((p) => [p.hr!, p.pace])).replace("days", "sessions")}
      empty={!data.length}
      emptyText="No sessions with heart-rate data in this range."
    >
      <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 14 }}>
        <CartesianGrid {...GRID} vertical />
        <XAxis
          {...Y_AXIS}
          type="number"
          dataKey="hr"
          height={22}
          axisLine={{ stroke: "#383835" }}
          domain={["auto", "auto"]}
          label={{ value: "Average heart rate (bpm)", position: "insideBottom", offset: -12, fill: "#898781", fontSize: 11 }}
        />
        <YAxis {...Y_AXIS} width={40} type="number" dataKey="pace" domain={["auto", "auto"]} reversed={sport !== "bike"} tickFormatter={paceTick(sport)} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as SessionPoint;
            return (
              <TooltipBox
                title={`${shortDate(p.date)} · ${p.name}`}
                lines={[
                  { label: sport === "bike" ? "Speed" : "Pace", value: formatPace(sport, p.pace) },
                  { label: "Average HR", value: `${Math.round(p.hr!)} bpm` },
                ]}
              />
            );
          }}
        />
        <Scatter data={data} fill={SPORT_COLORS[sport]} fillOpacity={0.85} isAnimationActive={false} />
      </ScatterChart>
    </ChartPanel>
  );
}
