import { useState } from "react";
import type { Garmin } from "../lib/useGarmin";
import type { FitnessDay } from "../lib/fitness";
import { lastDays, shortDate } from "../lib/dates";
import { buildDayRows, metric, type DayRow, type MetricKey } from "../lib/metrics";
import { formatDuration } from "../lib/format";
import { StatTile, TileRow } from "../components/ChartKit";
import { FILL_ROW, FIT_GRID, ScrollArea } from "../components/Layout";
import { GarminPanel } from "../components/GarminPanel";
import { BatteryStressChart, BedtimeChart, SleepStagesScoreChart, clockLabel, sleepWindows } from "../components/charts/RecoveryCharts";
import { MetricSelect, PairChart, RelationshipChart } from "../components/charts/PairCharts";

export const RECOVERY_TABS = [
  { value: "sleep", label: "Sleep" },
  { value: "body", label: "Body" },
  { value: "compare", label: "Compare" },
  { value: "table", label: "Table" },
] as const;

export type RecoveryTab = (typeof RECOVERY_TABS)[number]["value"];

function mean(values: (number | undefined)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

const latest = (rows: DayRow[], key: keyof DayRow) => [...rows].reverse().find((d) => d[key] != null);

function SleepView({ rows }: { rows: DayRow[] }) {
  const nights = rows.filter((d) => d.sleepSec);
  const last = nights[nights.length - 1];
  const windows = sleepWindows(rows);
  const bed = mean(windows.map((w) => w.window?.[0]));
  const wake = mean(windows.map((w) => w.window?.[1]));
  const average = mean(nights.map((d) => d.sleepSec));
  const score = mean(nights.map((d) => d.sleepScore));
  const deep = mean(nights.map((d) => d.deepSec));
  const [outcome, setOutcome] = useState<MetricKey>("bodyBatteryHigh");

  return (
    <>
      <TileRow>
        <StatTile label="Latest night" value={last ? formatDuration(last.sleepSec!) : "—"} note={last ? `Woke ${shortDate(last.date)}` : undefined} />
        <StatTile label="Average sleep" value={average ? formatDuration(average) : "—"} note={`${nights.length} of ${rows.length} nights recorded`} />
        <StatTile label="Average score" value={score ? score.toFixed(0) : "—"} note="Garmin, out of 100" />
        <StatTile label="Average deep sleep" value={deep ? formatDuration(deep) : "—"} />
        <StatTile label="Typical bedtime" value={bed != null ? clockLabel(bed) : "—"} />
        <StatTile label="Typical wake time" value={wake != null ? clockLabel(wake) : "—"} />
      </TileRow>
      <div className={FIT_GRID}>
        <SleepStagesScoreChart rows={rows} className="lg:col-span-2" />
        <BedtimeChart rows={rows} />
        <RelationshipChart
          title="Does more sleep help?"
          rows={rows}
          x="sleepHours"
          y={outcome}
          extra={<MetricSelect label="vs" value={outcome} onChange={setOutcome} />}
        />
      </div>
    </>
  );
}

function BodyView({ rows }: { rows: DayRow[] }) {
  const rhr = latest(rows, "restingHr");
  const hrv = latest(rows, "hrv");
  const battery = latest(rows, "bodyBatteryHigh");
  const ready = latest(rows, "readiness");
  const stress = mean(rows.map((d) => d.avgStress));
  const steps = mean(rows.map((d) => d.steps));

  return (
    <>
      <TileRow>
        <StatTile label="Resting heart rate" value={rhr ? `${rhr.restingHr} bpm` : "—"} note={rhr ? shortDate(rhr.date) : undefined} />
        <StatTile label="Overnight HRV" value={hrv ? `${hrv.hrv} ms` : "—"} note={hrv ? `${shortDate(hrv.date)}${hrv.hrvStatus ? ` · ${hrv.hrvStatus.toLowerCase()}` : ""}` : undefined} />
        <StatTile label="Body Battery" value={battery ? `${battery.bodyBatteryLow}–${battery.bodyBatteryHigh}` : "—"} note={battery ? shortDate(battery.date) : undefined} />
        <StatTile label="Readiness" value={ready ? String(ready.readiness) : "—"} note={ready?.readinessLevel?.toLowerCase()} />
        <StatTile label="Average stress" value={stress != null ? stress.toFixed(0) : "—"} note="This range" />
        <StatTile label="Average steps" value={steps != null ? Math.round(steps).toLocaleString() : "—"} note="This range" />
      </TileRow>
      <div className={FIT_GRID}>
        <PairChart title="HRV & resting heart rate" rows={rows} left={{ key: "hrv" }} right={{ key: "restingHr" }} band />
        <BatteryStressChart rows={rows} />
        <PairChart title="Training load & next-morning readiness" rows={rows} left={{ key: "loadPrev", as: "bar" }} right={{ key: "readiness" }} />
        <PairChart title="Steps & intensity minutes" rows={rows} left={{ key: "steps", as: "bar" }} right={{ key: "intensityMinutes" }} />
      </div>
    </>
  );
}

function CompareView({ rows }: { rows: DayRow[] }) {
  const [first, setFirst] = useState<MetricKey>("loadPrev");
  const [second, setSecond] = useState<MetricKey>("restingHr");
  const title = `${metric(first).label} & ${metric(second).label}`;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <MetricSelect label="Compare" value={first} onChange={setFirst} />
        <MetricSelect label="with" value={second} onChange={setSecond} />
        <p className="text-xs text-white/40">Two metrics moving together doesn't show that one causes the other.</p>
      </div>
      <div className={FILL_ROW}>
        <PairChart title={title} note="Over time, each on its own scale" rows={rows} left={{ key: first, as: first.startsWith("load") || first === "steps" ? "bar" : "line" }} right={{ key: second }} />
        <RelationshipChart title="Day by day" rows={rows} x={first} y={second} />
      </div>
    </>
  );
}

function TableView({ rows }: { rows: DayRow[] }) {
  const time = (seconds?: number) => (seconds == null ? "—" : formatDuration(seconds));
  const columns: [string, (d: DayRow) => string | number][] = [
    ["Date", (d) => d.date],
    ["Asleep", (d) => time(d.sleepSec)],
    ["Deep", (d) => time(d.deepSec)],
    ["REM", (d) => time(d.remSec)],
    ["Score", (d) => d.sleepScore ?? "—"],
    ["HRV", (d) => d.hrv ?? "—"],
    ["Resting HR", (d) => d.restingHr ?? "—"],
    ["Body Battery", (d) => (d.bodyBatteryHigh != null ? `${d.bodyBatteryLow}–${d.bodyBatteryHigh}` : "—")],
    ["Stress", (d) => d.avgStress ?? "—"],
    ["Readiness", (d) => d.readiness ?? "—"],
    ["Steps", (d) => d.steps?.toLocaleString() ?? "—"],
    ["Load", (d) => (d.load != null ? Math.round(d.load) : "—")],
  ];

  return (
    <ScrollArea className="overflow-x-auto rounded-2xl border border-white/10 bg-tri-card lg:flex-1">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="sticky top-0 bg-tri-soft text-xs text-white/50">
          <tr>
            {columns.map(([name]) => (
              <th key={name} className="px-3 py-2 font-semibold">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums text-white/80">
          {[...rows].reverse().map((d) => (
            <tr key={d.date} className="border-t border-white/5">
              {columns.map(([name, value]) => (
                <td key={name} className="px-3 py-1.5">{value(d)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

export function RecoveryPage({ garmin, fitness, tab, range }: { garmin: Garmin; fitness: FitnessDay[]; tab: RecoveryTab; range: number }) {
  const rows = buildDayRows(lastDays(range), garmin.days, fitness);
  const status = garmin.status;
  // Sign-in steps only take space until Garmin is connected.
  const needsSetup = status && (!status.installed || !status.signedIn || status.errorCode != null);

  return (
    <>
      {needsSetup && (
        <div className="shrink-0">
          <GarminPanel garmin={garmin} />
        </div>
      )}
      {tab === "sleep" && <SleepView rows={rows} />}
      {tab === "body" && <BodyView rows={rows} />}
      {tab === "compare" && <CompareView rows={rows} />}
      {tab === "table" && <TableView rows={rows} />}
    </>
  );
}
