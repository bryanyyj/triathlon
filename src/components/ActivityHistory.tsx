import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Activity, ZoneSeconds } from "../types";
import { getActivityProfiles, type ActivityProfile } from "../lib/api";
import { SPORT_COLORS, SPORT_ICONS } from "../lib/sportColors";
import { ZONE_DEFS } from "../lib/zoneColors";
import { formatDuration } from "../lib/format";
import { estimateActivityLoad } from "../lib/calculations";

const WEEKS_PER_PAGE = 8;

const SPORT_NAMES: Record<Activity["sportType"], string> = { swim: "Swimming", bike: "Cycling", run: "Running", other: "Workout" };
const SPORT_ACCENT: Record<Activity["sportType"], string> = { ...SPORT_COLORS, other: "#a78bfa" };
const SPORT_ICON: Record<Activity["sportType"], string> = { ...SPORT_ICONS, other: "⭐" };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Weeks run Monday–Sunday, matching the training calendar.
function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDistance(activity: Activity): string | null {
  if (!activity.distanceMeters) return null;
  return activity.sportType === "swim"
    ? `${Math.round(activity.distanceMeters)}m`
    : `${(activity.distanceMeters / 1000).toFixed(1)}km`;
}

function formatPace(secondsPerUnit: number): string {
  const total = Math.round(secondsPerUnit);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

// The sport's headline intensity number: power for rides, pace for runs and swims.
function intensityMetric(activity: Activity): { label: string; value: string } | null {
  const { sportType, distanceMeters, movingTimeSeconds } = activity;
  if (sportType === "bike") {
    if (activity.averagePower) return { label: "Power", value: `${Math.round(activity.averagePower)}W` };
    if (distanceMeters) return { label: "Speed", value: `${((distanceMeters / movingTimeSeconds) * 3.6).toFixed(1)}km/h` };
  }
  if (sportType === "run" && distanceMeters) {
    return { label: "Pace", value: `${formatPace(movingTimeSeconds / (distanceMeters / 1000))}/km` };
  }
  if (sportType === "swim" && distanceMeters) {
    return { label: "Pace", value: `${formatPace(movingTimeSeconds / (distanceMeters / 100))}/100m` };
  }
  return null;
}

/** The full prompt sent to the coach; the chat shows only the short display line. */
function reviewPrompt(activity: Activity, zones: ZoneSeconds | undefined): { text: string; display: string } {
  const start = new Date(activity.startDate);
  const when = start.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const metric = intensityMetric(activity);
  const zoneTotal = zones ? ZONE_DEFS.reduce((sum, z) => sum + zones[z.key], 0) : 0;

  const details = [
    `Sport: ${SPORT_NAMES[activity.sportType]}`,
    `Name: ${activity.name}`,
    `When: ${when}`,
    `Moving time: ${formatDuration(activity.movingTimeSeconds)} (elapsed ${formatDuration(activity.elapsedTimeSeconds)})`,
    formatDistance(activity) && `Distance: ${formatDistance(activity)}`,
    metric && `${metric.label}: ${metric.value}`,
    activity.weightedPower && `Weighted power: ${Math.round(activity.weightedPower)}W`,
    activity.averageHeartRate && `Average HR: ${Math.round(activity.averageHeartRate)} bpm`,
    activity.maxHeartRate && `Max HR: ${Math.round(activity.maxHeartRate)} bpm`,
    activity.averageCadence && `Average cadence: ${Math.round(activity.averageCadence)}`,
    activity.elevationGainMeters > 0 && `Elevation gain: ${Math.round(activity.elevationGainMeters)}m`,
    `Estimated load: ${Math.round(estimateActivityLoad(activity))} TSS`,
    zoneTotal > 0 &&
      `Time in HR zones: ${ZONE_DEFS.map((z) => `${z.label} ${Math.round((zones![z.key] / zoneTotal) * 100)}%`).join(", ")}`,
  ].filter(Boolean);

  return {
    text:
      `Please review this workout. How did it go, what was the training effect, how does it fit with my recent training, ` +
      `and is there anything I should change next time?\n\n${details.join("\n")}`,
    display: `Review my ${SPORT_NAMES[activity.sportType].toLowerCase()} on ${shortDate(start)}: ${activity.name}`,
  };
}

function ZoneStrip({ zones }: { zones: ZoneSeconds | undefined }) {
  const total = zones ? ZONE_DEFS.reduce((sum, z) => sum + zones[z.key], 0) : 0;
  if (!zones || total === 0) {
    return <div className="h-2.5 rounded-full bg-white/5" title="No heart-rate data" />;
  }
  return (
    <div className="flex h-2.5 gap-px overflow-hidden rounded-full" aria-label="Time in heart-rate zones">
      {ZONE_DEFS.filter((z) => zones[z.key] > 0).map((z) => (
        <span
          key={z.key}
          title={`${z.label}: ${formatDuration(zones[z.key])} (${Math.round((zones[z.key] / total) * 100)}%)`}
          style={{ flexGrow: zones[z.key], flexBasis: 0, backgroundColor: z.color }}
        />
      ))}
    </div>
  );
}

const EFFORT_LABEL: Record<ActivityProfile["metric"], string> = { watts: "power", velocity_smooth: "speed", heartrate: "heart rate" };

// Bar height = effort (power / speed / HR over the activity); color = HR zone at that point.
function EffortBars({ profile, accent }: { profile: ActivityProfile; accent: string }) {
  // Scale between a low floor and the 95th percentile, not 0..max: steady efforts otherwise
  // all look the same height, and one GPS/power spike flattens the rest of the chart.
  const moving = profile.values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!moving.length) return null;
  const peak = moving[Math.min(moving.length - 1, Math.floor(moving.length * 0.95))];
  const floor = moving[Math.floor(moving.length * 0.05)] * 0.7;
  const span = Math.max(peak - floor, peak * 0.05);

  return (
    <div
      className="flex h-20 items-end gap-px"
      role="img"
      aria-label={`${EFFORT_LABEL[profile.metric]} over the activity, colored by heart-rate zone`}
    >
      {profile.values.map((value, i) => {
        const zone = profile.zones[i];
        return (
          <span
            key={i}
            className="min-w-0 flex-1 rounded-t-sm"
            style={{
              // A small floor keeps stops and coasting visible as a sliver rather than a gap.
              height: `${Math.min(100, Math.max(4, ((value - floor) / span) * 100))}%`,
              backgroundColor: zone == null ? accent : ZONE_DEFS[zone].color,
            }}
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

function ActivityCard({ activity, zones, profile, onReview, reviewDisabled }: {
  activity: Activity;
  zones: ZoneSeconds | undefined;
  // undefined = still loading, null = Strava had no usable streams.
  profile: ActivityProfile | null | undefined;
  onReview: () => void;
  reviewDisabled: boolean;
}) {
  const metric = intensityMetric(activity);
  const distance = formatDistance(activity);

  return (
    <div className="rounded-2xl border border-white/10 bg-tri-soft p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden="true">{SPORT_ICON[activity.sportType]}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: SPORT_ACCENT[activity.sportType] }}>
            {SPORT_NAMES[activity.sportType]}
          </p>
          <p className="truncate text-xs text-white/50" title={activity.name}>{activity.name}</p>
        </div>
      </div>

      {profile === undefined ? (
        <div className="h-20 animate-pulse rounded-lg bg-white/5" aria-label="Loading activity chart" />
      ) : profile ? (
        <EffortBars profile={profile} accent={SPORT_ACCENT[activity.sportType]} />
      ) : null}
      <div className={profile === undefined || profile ? "mt-2" : ""}>
        <ZoneStrip zones={zones} />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Metric label="Duration" value={formatDuration(activity.movingTimeSeconds)} />
          {distance && <Metric label="Distance" value={distance} />}
          {metric && <Metric label={metric.label} value={metric.value} />}
          <Metric label="Load" value={String(Math.round(estimateActivityLoad(activity)))} />
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={reviewDisabled}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-tri-bg hover:bg-white/85 disabled:opacity-40"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3.5V17H4A1.5 1.5 0 0 1 2.5 15.5V7A1.5 1.5 0 0 1 4 5.5Z" />
            <path d="M12 8v5M9.5 10.5h5" />
          </svg>
          Review
        </button>
      </div>
    </div>
  );
}

type Week = { key: string; monday: Date; activities: Activity[]; seconds: number; load: number };

type ActivityHistoryProps = {
  activities: Activity[];
  zones: Record<string, ZoneSeconds>;
  onReview: (text: string, display: string) => void;
  reviewBusy: boolean;
};

export function ActivityHistory({ activities, zones, onReview, reviewBusy }: ActivityHistoryProps) {
  const [visibleWeeks, setVisibleWeeks] = useState(WEEKS_PER_PAGE);
  // null = nothing toggled yet, so the most recent week starts expanded.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ActivityProfile | null>>({});
  const requested = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  // Scroll height before "Show older weeks", so prepending doesn't jump the view.
  const heightBeforeOlder = useRef<number | null>(null);

  const weeks = useMemo(() => {
    const byWeek = new Map<string, Week>();
    for (const activity of activities) {
      const monday = mondayOf(new Date(activity.startDate));
      const key = localDateKey(monday);
      if (!byWeek.has(key)) byWeek.set(key, { key, monday, activities: [], seconds: 0, load: 0 });
      const week = byWeek.get(key)!;
      week.activities.push(activity);
      week.seconds += activity.movingTimeSeconds;
      week.load += estimateActivityLoad(activity);
    }
    // Oldest first, so the latest week sits at the bottom like a feed.
    const result = Array.from(byWeek.values()).sort((a, b) => a.key.localeCompare(b.key));
    for (const week of result) week.activities.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return result;
  }, [activities]);

  const latestKey = weeks[weeks.length - 1]?.key;
  const openWeeks = useMemo(() => expanded ?? new Set(latestKey ? [latestKey] : []), [expanded, latestKey]);
  const shownWeeks = weeks.slice(Math.max(0, weeks.length - visibleWeeks));

  // Start at the bottom (latest week) once data arrives.
  const hasWeeks = weeks.length > 0;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hasWeeks]);

  // After older weeks are prepended, keep the same content in view.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && heightBeforeOlder.current != null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    }
  }, [visibleWeeks]);

  // Load effort charts for the activities in open weeks. The backend caches them, so
  // each activity costs one Strava request ever; it fetches at most ~20 per call.
  useEffect(() => {
    const ids = weeks
      .filter((week) => openWeeks.has(week.key))
      .flatMap((week) => week.activities.map((a) => a.id))
      .filter((id) => !requested.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => requested.current.add(id));

    // Not cancelled on re-run: these ids are marked requested, so their results must land.
    const load = async (batch: string[]) => {
      try {
        const result = await getActivityProfiles(batch);
        setProfiles((prev) => ({ ...prev, ...result.profiles }));
        const fetched = batch.length - result.pending.length;
        // Keep going while the backend is making progress; on rate limit, retry on next open.
        if (result.pending.length && fetched > 0 && !result.rateLimited) await load(result.pending);
        else result.pending.forEach((id) => requested.current.delete(id));
      } catch {
        // Drop the loading placeholder; reopening the week retries.
        batch.forEach((id) => requested.current.delete(id));
        setProfiles((prev) => ({ ...Object.fromEntries(batch.map((id) => [id, null])), ...prev }));
      }
    };
    void load(ids);
  }, [weeks, openWeeks]);

  const toggle = (key: string) => {
    const next = new Set(openWeeks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  return (
    <section className="flex flex-col rounded-3xl bg-tri-card border border-white/10 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">History</h2>
        <p className="text-sm text-white/50">Every workout, week by week · bar height is effort (power, or speed), color is HR zone</p>
      </div>

      {weeks.length === 0 ? (
        <p className="text-sm text-white/50">No activities yet.</p>
      ) : (
        <div ref={scrollRef} className="tri-scroll -mr-2 max-h-[34rem] space-y-1 overflow-y-auto pr-2">
          {visibleWeeks < weeks.length && (
            <button
              type="button"
              onClick={() => {
                heightBeforeOlder.current = scrollRef.current?.scrollHeight ?? null;
                setVisibleWeeks((n) => n + WEEKS_PER_PAGE);
              }}
              className="mb-2 w-full rounded-xl bg-white/5 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Show older weeks
            </button>
          )}
          {shownWeeks.map((week) => {
            const sunday = new Date(week.monday);
            sunday.setDate(sunday.getDate() + 6);
            const isOpen = openWeeks.has(week.key);

            // Group the week's activities by day for the left-hand day column.
            const days = new Map<string, Activity[]>();
            for (const activity of week.activities) {
              const day = localDateKey(new Date(activity.startDate));
              days.set(day, [...(days.get(day) || []), activity]);
            }

            return (
              <div key={week.key}>
                <button
                  type="button"
                  onClick={() => toggle(week.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between rounded-xl px-2 py-2.5 text-left hover:bg-white/5"
                >
                  <div>
                    <p className="text-base font-bold text-white">
                      {shortDate(week.monday)} – {shortDate(sunday)}
                    </p>
                    <p className="text-sm text-white/50">
                      {formatDuration(week.seconds)} <span className="ml-2">{Math.round(week.load)} Load</span>
                    </p>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="space-y-3 pb-3 pt-1">
                    {Array.from(days.entries()).map(([day, dayActivities]) => {
                      const date = new Date(dayActivities[0].startDate);
                      return (
                        <div key={day} className="flex gap-3">
                          <div className="w-9 shrink-0 pt-1 text-center">
                            <p className="text-xs text-white/50">{date.toLocaleDateString(undefined, { weekday: "short" })}</p>
                            <p className="text-lg font-bold text-white">{date.getDate()}</p>
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            {dayActivities.map((activity) => (
                              <ActivityCard
                                key={activity.id}
                                activity={activity}
                                zones={zones[activity.id]}
                                profile={profiles[activity.id]}
                                reviewDisabled={reviewBusy}
                                onReview={() => {
                                  const { text, display } = reviewPrompt(activity, zones[activity.id]);
                                  onReview(text, display);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </section>
  );
}
