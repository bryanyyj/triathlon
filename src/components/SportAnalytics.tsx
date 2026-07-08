import { useMemo } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Activity, HrZonesBySport, SportType, ZoneSeconds } from "../types";
import { SPORT_COLORS, SPORT_ICONS, SPORT_LABELS } from "../lib/sportColors";
import { ZONE_DEFS } from "../lib/zoneColors";
import { formatDuration } from "../lib/format";
import { rollingAverage } from "../lib/rollingAverage";

const SPORTS: { key: keyof HrZonesBySport; label: string; icon: string; color: string }[] = (
  Object.keys(SPORT_COLORS) as (keyof HrZonesBySport)[]
).map((key) => ({ key, label: SPORT_LABELS[key], icon: SPORT_ICONS[key], color: SPORT_COLORS[key] }));

function formatClock(minutesDecimal: number): string {
  if (!Number.isFinite(minutesDecimal) || minutesDecimal <= 0) return "—";
  const min = Math.floor(minutesDecimal);
  const sec = Math.round((minutesDecimal - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function computePaceOrSpeed(sport: SportType, distanceMeters: number, movingTimeSeconds: number): number | null {
  if (!distanceMeters || !movingTimeSeconds) return null;
  const minutes = movingTimeSeconds / 60;
  const km = distanceMeters / 1000;

  if (sport === "bike") return km / (movingTimeSeconds / 3600); // km/h
  if (sport === "run") return minutes / km; // min/km
  return minutes / (km * 10); // min/100m
}

function formatPaceOrSpeed(sport: SportType, value: number | null): string {
  if (value == null) return "—";
  if (sport === "bike") return `${value.toFixed(1)} km/h`;
  if (sport === "run") return `${formatClock(value)} /km`;
  return `${formatClock(value)} /100m`;
}

function buildTrendData(sportActivities: Activity[], sport: SportType) {
  const sessions = sportActivities
    .map((a) => ({ date: a.startDate, value: computePaceOrSpeed(sport, a.distanceMeters, a.movingTimeSeconds) }))
    .filter((point): point is { date: string; value: number } => point.value != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const trend = rollingAverage(
    sessions.map((s) => s.value),
    5
  );

  return sessions.map((point, i) => ({ index: i, date: point.date, value: point.value, trend: trend[i] }));
}

function TrendTooltip({ active, payload, sport }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white/70">
        {new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>
      <p className="text-xs text-white/80">{formatPaceOrSpeed(sport, point.value)}</p>
    </div>
  );
}

function ZoneTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-xl border border-white/10 bg-tri-soft px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold" style={{ color: entry.payload.color }}>
        {entry.name}
      </p>
      <p className="text-xs text-white/70">{formatDuration(entry.value)}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

type SportColumnProps = {
  sportDef: (typeof SPORTS)[number];
  activities: Activity[];
  zones: ZoneSeconds | null;
};

function SportColumn({ sportDef, activities, zones }: SportColumnProps) {
  const { key: sport, label, icon, color } = sportDef;

  const sportActivities = useMemo(() => activities.filter((a) => a.sportType === sport), [activities, sport]);
  const trendData = useMemo(() => buildTrendData(sportActivities, sport), [sportActivities, sport]);

  const sessions = sportActivities.length;
  const distanceKm = sportActivities.reduce((sum, a) => sum + a.distanceMeters, 0) / 1000;
  const durationSeconds = sportActivities.reduce((sum, a) => sum + a.movingTimeSeconds, 0);
  const hrValues = sportActivities.map((a) => a.averageHeartRate).filter((v): v is number => v != null);
  const avgHr = hrValues.length ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null;

  const avgPaceValue = computePaceOrSpeed(sport, distanceKm * 1000, durationSeconds);
  const sessionPaces = trendData.map((point) => point.value);
  const bestPaceValue = sessionPaces.length
    ? sport === "bike"
      ? Math.max(...sessionPaces)
      : Math.min(...sessionPaces)
    : null;

  const zoneData = ZONE_DEFS.map((zoneDef) => ({
    name: zoneDef.label,
    value: zones ? zones[zoneDef.key] : 0,
    color: zoneDef.color,
  }));
  const hasZoneData = zoneData.some((z) => z.value > 0);

  const trendLabel =
    sport === "bike" ? "Speed Trend (km/h)" : sport === "run" ? "Pace Trend (min/km)" : "Pace Trend (min/100m)";

  return (
    <div className="rounded-2xl bg-tri-soft border border-white/10 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-base font-bold text-white">
          {icon} {label}
        </span>
        <span className="ml-auto text-xs text-white/40">{sessions} sessions</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label={sport === "bike" ? "Avg Speed" : "Avg Pace"} value={formatPaceOrSpeed(sport, avgPaceValue)} />
        <StatTile label={sport === "bike" ? "Top Speed" : "Fastest"} value={formatPaceOrSpeed(sport, bestPaceValue)} />
        <StatTile label="Distance" value={`${distanceKm.toFixed(0)} km`} />
        <StatTile label="Duration" value={formatDuration(durationSeconds)} />
        <StatTile label="Avg HR" value={avgHr ? `${Math.round(avgHr)} bpm` : "—"} />
        <StatTile label="Sessions" value={String(sessions)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{trendLabel}</p>
          {trendData.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-white/50">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {sport === "bike" ? "Speed" : "Pace"}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full border" style={{ borderColor: color }} />
                Trend (5-pt avg)
              </span>
            </div>
          )}
        </div>

        {trendData.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/40">No sessions yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
              <XAxis dataKey="index" hide />
              <YAxis
                reversed={sport !== "bike"}
                stroke="#898781"
                tick={{ fill: "#898781", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <Tooltip content={<TrendTooltip sport={sport} />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
              <Line type="monotone" dataKey="value" name="Pace" stroke={color} strokeWidth={1.5} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="trend" name="Trend" stroke={color} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">HR Zones</p>
        {!hasZoneData ? (
          <p className="py-6 text-center text-xs text-white/40">
            No heart-rate zone data yet — click "Re-pull Strava Data" to fetch it.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={104} height={104}>
              <PieChart>
                <Pie data={zoneData} dataKey="value" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {zoneData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ZoneTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {ZONE_DEFS.map((zoneDef) => (
                <div key={zoneDef.key} className="flex items-center gap-1.5 text-[10px] text-white/60">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: zoneDef.color }} />
                  {zoneDef.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SportAnalytics({ activities, zones }: { activities: Activity[]; zones: HrZonesBySport | null }) {
  return (
    <section className="rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">Sport Analytics</h2>
        <p className="text-sm text-white/50">Breakdown by discipline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SPORTS.map((sportDef) => (
          <SportColumn key={sportDef.key} sportDef={sportDef} activities={activities} zones={zones ? zones[sportDef.key] : null} />
        ))}
      </div>
    </section>
  );
}
