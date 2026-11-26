import { useEffect, useState } from "react";
import { HeaderActions } from "../components/Header";
import { PAGES, Sidebar, type PageId } from "../components/Sidebar";
import { PageShell, Segmented } from "../components/Layout";
import { CalendarPage } from "./CalendarPage";
import { OverviewPage } from "./OverviewPage";
import { HistoryView, LoadView, PerformanceView } from "./TrainingPage";
import { RECOVERY_TABS, RecoveryPage, type RecoveryTab } from "./RecoveryPage";
import { PLAN_TABS, PlanPage, type PlanTab } from "./PlanPage";
import { QUICK_FILTERS, SPORTS, quickFilterToRange } from "../components/Filters";
import { ActivityHistory } from "../components/ActivityHistory";
import { CoachBubble } from "../components/CoachBubble";
import { useGarmin } from "../lib/useGarmin";
import { buildFitnessSeries } from "../lib/fitness";
import type { TriSport } from "../components/charts/TrainingCharts";
import {
  connectStrava,
  createPlannedWorkout,
  createRace,
  deletePlannedWorkout,
  deleteRace,
  updateRace,
  getActivities,
  getActivityZones,
  getFatigueReadiness,
  getGear,
  getHrZones,
  getPlannedWorkouts,
  getRaces,
  getStravaStatus,
  syncStrava,
} from "../lib/api";
import { useCoachChat } from "../lib/coachChat";
import type { Activity, FatigueReadiness, Gear, HrZonesBySport, PlannedWorkout, QuickFilter, Race, SportFilter, ZoneSeconds } from "../types";

const TRAINING_TABS = [
  { value: "load", label: "Load" },
  { value: "performance", label: "Performance" },
  { value: "history", label: "History" },
] as const;

const RECOVERY_RANGES = [7, 30, 90, 180].map((days) => ({ value: days, label: `${days} days` }));
const SPORT_TABS: { value: TriSport; label: string }[] = [
  { value: "run", label: "Run" },
  { value: "bike", label: "Bike" },
  { value: "swim", label: "Swim" },
];

const TABS: Partial<Record<PageId, readonly { value: string }[]>> = { training: TRAINING_TABS, recovery: RECOVERY_TABS, plan: PLAN_TABS };

// Addresses of pages that have since been combined, so old bookmarks still land.
const MOVED: Record<string, string> = {
  fitness: "training/load",
  activities: "training/history",
  sleep: "recovery/sleep",
  health: "recovery/body",
  races: "plan/races",
  gear: "plan/gear",
  "training-week": "plan/week",
};

type Route = { page: PageId; tab: string };

// The page and tab live in the URL hash so a refresh (and the back button) stays put.
function routeFromHash(): Route {
  const raw = window.location.hash.slice(1);
  const [id, wanted] = (MOVED[raw] ?? raw).split("/");
  const page = PAGES.find((p) => p.id === id)?.id ?? "overview";
  const tabs = TABS[page];
  const tab = tabs?.find((t) => t.value === wanted)?.value ?? tabs?.[0].value ?? "";
  return { page, tab };
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>([]);
  const [fatigue, setFatigue] = useState<FatigueReadiness | null>(null);
  const [gear, setGear] = useState<Gear[]>([]);
  const [sport, setSport] = useState<SportFilter>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("90d");
  const [stravaConnected, setStravaConnected] = useState(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [zones, setZones] = useState<HrZonesBySport | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [activityZones, setActivityZones] = useState<Record<string, ZoneSeconds>>({});
  const coachChat = useCoachChat();
  const [coachOpen, setCoachOpen] = useState(false);
  const [{ page, tab }, setRoute] = useState<Route>(routeFromHash);
  const [recoveryRange, setRecoveryRange] = useState(30);
  const [performanceSport, setPerformanceSport] = useState<TriSport>("run");
  const garmin = useGarmin();

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaResult = params.get("strava");

    if (stravaResult) {
      if (stravaResult === "error") {
        setError(params.get("message") || "Failed to connect to Strava.");
      } else if (stravaResult === "connected" && params.get("syncing") === "true") {
        setSyncing(true);
        setSyncMessage("Syncing your Strava activities in the background…");
        const poll = setInterval(async () => {
          try {
            const status = await getStravaStatus();
            if (!status.syncing) {
              clearInterval(poll);
              setSyncing(false);
              setSyncMessage(null);
              // Reload all data now that sync is complete
              const range = quickFilterToRange(quickFilter);
              const [acts, allActs, zonesBySport, gearList] = await Promise.all([
                getActivities({ sport, ...range }),
                getActivities(),
                getHrZones(range),
                getGear().catch(() => []),
              ]);
              setFilteredActivities(acts);
              setAllActivities(allActs);
              setZones(zonesBySport);
              setGear(gearList);
              setSyncMessage("Sync complete — your latest activities are loaded.");
              setTimeout(() => setSyncMessage(null), 4000);
            }
          } catch {
            clearInterval(poll);
            setSyncing(false);
          }
        }, 3000);
      }
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [activities, raceList, workouts, fatigueData, stravaStatus, gearList] = await Promise.all([
          getActivities(),
          getRaces(),
          getPlannedWorkouts(),
          getFatigueReadiness(),
          getStravaStatus(),
          getGear().catch(() => []),
        ]);
        // Zone bars are decoration for History; don't fail the dashboard over them.
        getActivityZones().then(setActivityZones).catch(() => {});

        setAllActivities(activities);
        setRaces(raceList);
        setPlannedWorkouts(workouts);
        setFatigue(fatigueData);
        setStravaConnected(stravaStatus.connected);
        setAthleteName(stravaStatus.athleteName);
        setGear(gearList);
      } catch (err) {
        setError((err as Error).message || "Failed to load training data from the backend.");
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  useEffect(() => {
    async function loadFiltered() {
      try {
        const range = quickFilterToRange(quickFilter);
        const [activities, zonesBySport] = await Promise.all([
          getActivities({ sport, ...range }),
          getHrZones(range),
        ]);
        setFilteredActivities(activities);
        setZones(zonesBySport);
      } catch (err) {
        setError((err as Error).message || "Failed to load activities from the backend.");
      }
    }

    loadFiltered();
  }, [sport, quickFilter]);

  const handleAddRace = async (race: Partial<Race>) => {
    const created = await createRace(race);
    setRaces((prev) => [...prev, created]);
  };

  const handleEditRace = async (id: string, race: Partial<Race>) => {
    const updated = await updateRace(id, race);
    setRaces((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
  };

  const handleDeleteRace = async (id: string) => {
    await deleteRace(id);
    setRaces((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddPlannedWorkout = async (workout: Partial<PlannedWorkout>) => {
    const created = await createPlannedWorkout(workout);
    setPlannedWorkouts((prev) => [...prev, created]);
  };

  const handleDeletePlannedWorkout = async (id: string) => {
    try {
      await deletePlannedWorkout(id);
      setPlannedWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError("Failed to delete the planned workout.");
    }
  };

  // The coach writes planned workouts on the backend, so re-read them after it replies.
  const reloadPlannedWorkouts = async () => {
    try {
      setPlannedWorkouts(await getPlannedWorkouts());
    } catch {
      // Keep showing the current list; the next load will catch up.
    }
  };

  // History's Review button: open the coach and send the activity's details.
  const handleReviewActivity = async (text: string, display: string) => {
    setCoachOpen(true);
    await coachChat.send(text, display);
    reloadPlannedWorkouts();
  };

  // Poll the backend until the background HR-zone + gear work finishes, then
  // refresh the pieces that work produced.
  const pollBackgroundSync = (range: { startDate?: string; endDate?: string }) => {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts += 1;
      try {
        const status = await getStravaStatus();
        if (!status.syncing || attempts > 45) {
          clearInterval(poll);
          const [zonesBySport, gearList, zoneMap] = await Promise.all([
            getHrZones(range),
            getGear().catch(() => []),
            getActivityZones().catch(() => null),
          ]);
          setZones(zonesBySport);
          setGear(gearList);
          if (zoneMap) setActivityZones(zoneMap);
          setSyncMessage("Sync complete — HR zones and gear are up to date.");
          setTimeout(() => setSyncMessage(null), 4000);
        }
      } catch {
        clearInterval(poll);
      }
    }, 4000);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const result = await syncStrava();
      const range = quickFilterToRange(quickFilter);

      // Activities are ready as soon as syncStrava resolves — reflect them now.
      const [activities, allActivitiesRefreshed, stravaStatus] = await Promise.all([
        getActivities({ sport, ...range }),
        getActivities(),
        getStravaStatus(),
      ]);

      setFilteredActivities(activities);
      setAllActivities(allActivitiesRefreshed);
      setStravaConnected(stravaStatus.connected);
      setAthleteName(stravaStatus.athleteName);
      setSyncMessage(
        `Synced ${result.synced} new activit${result.synced === 1 ? "y" : "ies"} · finishing HR zones & gear in the background…`
      );

      // Free the button immediately; the slow work continues on the backend.
      setSyncing(false);
      pollBackgroundSync(range);
    } catch (err) {
      setError((err as Error).message || "Failed to sync Strava data.");
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-white/60">Loading training data...</p>
      </div>
    );
  }

  const isCalendar = page === "calendar";
  const title = PAGES.find((p) => p.id === page)!.label;
  const fitness = buildFitnessSeries(allActivities);
  const errorBanner = error && (
    <div className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>
  );

  const refreshAll = () => {
    if (stravaConnected) void handleSync();
    if (garmin.status?.signedIn) void garmin.sync(30);
  };

  const openTab = (next: string) => {
    window.location.hash = `${page}/${next}`;
  };
  const tabs = TABS[page] && <Segmented label={`${title} sections`} options={TABS[page] as readonly { value: string; label: string }[]} value={tab} onChange={openTab} />;
  const range = <Segmented label="Date range" options={QUICK_FILTERS} value={quickFilter} onChange={setQuickFilter} />;

  const controls =
    page === "training" && tab !== "history" ? (
      <>
        {tab === "load" ? (
          <Segmented label="Sport" options={SPORTS} value={sport} onChange={setSport} />
        ) : (
          <Segmented label="Sport" options={SPORT_TABS} value={performanceSport} onChange={setPerformanceSport} />
        )}
        {range}
      </>
    ) : page === "recovery" ? (
      <>
        <Segmented label="Date range" options={RECOVERY_RANGES} value={recoveryRange} onChange={setRecoveryRange} />
        {garmin.status?.signedIn && (
          <button
            type="button"
            onClick={() => void garmin.sync(Math.max(30, recoveryRange))}
            disabled={garmin.status.syncing}
            className="whitespace-nowrap rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {garmin.status.syncing ? `Syncing ${garmin.status.done}/${garmin.status.total}…` : "↻ Garmin"}
          </button>
        )}
      </>
    ) : null;

  return (
    <div className="flex h-screen flex-col bg-tri-bg md:flex-row">
      <Sidebar page={page} />

      <main key={page} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {isCalendar ? (
          <div className="flex h-full flex-col">
            {error && <div className="px-4 pt-4 md:px-6">{errorBanner}</div>}
            <div className="min-h-0 flex-1">
              <CalendarPage
                activities={allActivities}
                plannedWorkouts={plannedWorkouts}
                garmin={garmin}
                syncing={syncing}
                message={syncMessage}
                onRefresh={refreshAll}
                onAddPlanned={async (workout) => {
                  await handleAddPlannedWorkout(workout);
                  // Re-read so a plan for a day already trained shows as completed.
                  await reloadPlannedWorkouts();
                }}
                onDeletePlanned={handleDeletePlannedWorkout}
                onOpenCoach={() => setCoachOpen(true)}
              />
            </div>
          </div>
        ) : (
          <PageShell
            title={title}
            tabs={tabs}
            controls={controls}
            status={syncMessage}
            actions={
              <HeaderActions
                stravaConnected={stravaConnected}
                athleteName={athleteName}
                onConnectStrava={connectStrava}
                onSync={handleSync}
                syncing={syncing}
                onOpenCoach={() => setCoachOpen(true)}
              />
            }
          >
            {errorBanner}

            {page === "overview" && <OverviewPage activities={allActivities} fitness={fitness} races={races} garmin={garmin} />}

            {page === "training" && tab === "load" && (
              <LoadView activities={filteredActivities} fitness={fitness} fatigue={fatigue} zones={zones} range={quickFilter} />
            )}
            {page === "training" && tab === "performance" && (
              <PerformanceView activities={allActivities} zones={zones} range={quickFilter} sport={performanceSport} />
            )}
            {page === "training" && tab === "history" && (
              <HistoryView>
                <ActivityHistory activities={allActivities} zones={activityZones} onReview={handleReviewActivity} reviewBusy={coachChat.busy} />
              </HistoryView>
            )}

            {page === "recovery" && <RecoveryPage garmin={garmin} fitness={fitness} tab={tab as RecoveryTab} range={recoveryRange} />}

            {page === "plan" && (
              <PlanPage
                tab={tab as PlanTab}
                races={races}
                workouts={plannedWorkouts}
                activities={allActivities}
                gear={gear}
                onAddRace={handleAddRace}
                onEditRace={handleEditRace}
                onDeleteRace={handleDeleteRace}
                onAddWorkout={handleAddPlannedWorkout}
              />
            )}
          </PageShell>
        )}
      </main>

      {/* Opened from each page's header; a floating button would cover a chart. */}
      <CoachBubble chat={coachChat} open={coachOpen} setOpen={setCoachOpen} onPlanChanged={reloadPlannedWorkouts} hideLauncher />
    </div>
  );
}
