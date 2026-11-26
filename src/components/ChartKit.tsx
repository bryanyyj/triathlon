import { Tooltip } from "recharts";
import { shortDate } from "../lib/dates";

// Validated together on the dark card for colour-blind separation (in stack order).
export const SLEEP_STAGES = [
  { key: "deep", label: "Deep", color: "#3987e5" },
  { key: "light", label: "Light", color: "#199e70" },
  { key: "rem", label: "REM", color: "#9085e9" },
  { key: "awake", label: "Awake", color: "#c98500" },
] as const;

export const SERIES = { blue: "#3987e5", orange: "#d95926", green: "#199e70", violet: "#9085e9", red: "#e66767", amber: "#c98500" };

export const SURFACE = "#14141f";
export const GRID = { stroke: "#2c2c2a", strokeDasharray: "3 3", vertical: false };

export const X_DATE = {
  dataKey: "date",
  tickFormatter: shortDate,
  tick: { fill: "#898781", fontSize: 11 },
  axisLine: { stroke: "#383835" },
  tickLine: false,
  minTickGap: 24,
};

export const Y_AXIS = {
  tick: { fill: "#898781", fontSize: 11 },
  axisLine: false,
  tickLine: false,
  width: 36,
};

export type TooltipRow = { label: string; value: string; color?: string };

export function TooltipBox({ title, lines }: { title: string; lines: TooltipRow[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">{title}</p>
      {lines.length === 0 && <p className="text-xs text-white/50">No data</p>}
      {lines.map((line) => (
        <p key={line.label} className="flex items-center gap-1.5 text-xs text-white">
          {line.color && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: line.color }} />}
          <span className="text-white/60">{line.label}</span>
          <span className="ml-auto pl-3 font-semibold">{line.value}</span>
        </p>
      ))}
    </div>
  );
}

/** `rows` builds the tooltip lines from the hovered data point. */
export function dateTooltip<T extends { date: string }>(rows: (point: T) => TooltipRow[], title: (point: T) => string = (p) => shortDate(p.date)) {
  return (
    <Tooltip
      cursor={{ stroke: "rgba(255,255,255,0.15)", fill: "rgba(255,255,255,0.05)" }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const point = payload[0].payload as T;
        return <TooltipBox title={title(point)} lines={rows(point)} />;
      }}
    />
  );
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-tri-card px-4 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className="truncate text-xl font-black leading-7 text-white">{value}</p>
      <p className="truncate text-[11px] leading-4 text-white/50">{note || " "}</p>
    </div>
  );
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}
