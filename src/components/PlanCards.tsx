import type { PlanSession } from "../lib/api";
import { SPORT_COLORS, SPORT_ICONS } from "../lib/sportColors";
import { ZONE_DEFS } from "../lib/zoneColors";
import { formatDuration } from "../lib/format";

// Coach sports are Strava-style names; map them onto the dashboard's sport keys.
const SPORT_KEY: Record<string, keyof typeof SPORT_COLORS> = { Swim: "swim", Ride: "bike", Run: "run" };
const SPORT_NAME: Record<keyof typeof SPORT_COLORS, string> = { swim: "Swim", bike: "Bike", run: "Run" };

const INTENSITY_LABEL: Record<PlanSession["intensity"], string> = {
  rest: "Rest",
  easy: "Easy / base",
  tempo: "Tempo",
  threshold: "Threshold",
  vo2: "VO2 / intervals",
  long: "Long endurance",
};

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// Workout structure like a device's workout preview: width = block length, height and color = HR zone.
function StructureBars({ blocks }: { blocks: NonNullable<PlanSession["blocks"]> }) {
  return (
    <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Workout structure by heart-rate zone">
      {blocks.map((block, i) => {
        const zone = ZONE_DEFS[Math.min(ZONE_DEFS.length, Math.max(1, block.zone)) - 1];
        return (
          <span
            key={i}
            title={`${zone.label}: ${block.min} min`}
            className="min-w-[3px] rounded-t-md"
            style={{ flexGrow: block.min, flexBasis: 0, height: `${18 + (block.zone - 1) * 20.5}%`, backgroundColor: zone.color }}
          />
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SessionCard({ session }: { session: PlanSession }) {
  const key = SPORT_KEY[session.sport];
  const color = key ? SPORT_COLORS[key] : "#a78bfa";
  // Time in the main set's hardest zone, so a threshold day shows e.g. "30 min Z4".
  const peak = session.blocks?.length ? Math.max(...session.blocks.map((b) => b.zone)) : null;
  const peakMin = peak ? session.blocks!.filter((b) => b.zone === peak).reduce((sum, b) => sum + b.min, 0) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-tri-soft p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden="true">{key ? SPORT_ICONS[key] : "⭐"}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color }}>
            {key ? SPORT_NAME[key] : session.sport}
          </p>
          <p className="text-xs text-white/50">{session.title}</p>
        </div>
      </div>

      {session.blocks?.length ? <StructureBars blocks={session.blocks} /> : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Metric label="Duration" value={formatDuration(session.durationMin * 60)} />
        <Metric label="Intensity" value={INTENSITY_LABEL[session.intensity]} />
        {peak != null && peak >= 3 && <Metric label="Main set" value={`${Math.round(peakMin)} min Z${peak}`} />}
      </div>
      {session.rationale && <p className="mt-2 text-xs text-white/45">{session.rationale}</p>}
    </div>
  );
}

/** The coach's planned sessions, grouped by day: "Monday, Nov 16 · 50 min run", then a card per session. */
export function PlanCards({ sessions }: { sessions: PlanSession[] }) {
  const days = new Map<string, PlanSession[]>();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    days.set(s.date, [...(days.get(s.date) || []), s]);
  }

  return (
    <div className="mt-3 space-y-4">
      {Array.from(days.entries()).map(([date, list]) => {
        const training = list.filter((s) => s.intensity !== "rest");
        const summary = training.length
          ? training.map((s) => `${s.durationMin} min ${(SPORT_KEY[s.sport] ? SPORT_NAME[SPORT_KEY[s.sport]] : s.sport).toLowerCase()}`).join(" + ")
          : "rest";
        return (
          <div key={date}>
            <p className="mb-1.5 text-xs font-semibold text-white/70">
              {dayLabel(date)} <span className="font-normal text-white/40">({summary})</span>
            </p>
            {training.length ? (
              <div className="space-y-2">
                {training.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/45">
                Rest day{list[0]?.rationale ? `: ${list[0].rationale}` : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
