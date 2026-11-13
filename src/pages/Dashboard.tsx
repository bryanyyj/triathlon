import { useEffect, useState } from "react";
import { Header, type DashboardTab } from "../components/Header";
import { TrainingWeek } from "./TrainingWeek";
import { UpcomingRaces } from "../components/UpcomingRaces";
import { Filters, quickFilterToDays, quickFilterToRange } from "../components/Filters";
import { SummaryMetrics } from "../components/SummaryMetrics";
import { WeeklyVolumeChart } from "../components/WeeklyVolumeChart";
import { WeeklyTssChart } from "../components/WeeklyTssChart";
import { TrainingCalendar } from "../components/TrainingCalendar";
import { ActivityHistory } from "../components/ActivityHistory";
import { SportAnalytics } from "../components/SportAnalytics";
import { PlannedWorkouts } from "../components/PlannedWorkouts";
import { WorkoutHistory } from "../components/WorkoutHistory";
import { FatigueReadinessCard } from "../components/FatigueReadinessCard";
import { GearCard } from "../components/GearCard";
import { AICoachPanel } from "../components/AICoachPanel";
import { CoachBubble } from "../components/CoachBubble";
import {
  connectStrava,
  createPlannedWorkout,
  createRace,
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
import { buildDashboardSummary, buildWeeklyTss, buildWeeklyVolume } from "../lib/calculations";
import { useCoachChat } from "../lib/coachChat";
import type { Activity, FatigueReadiness, Gear, HrZonesBySport, PlannedWorkout, QuickFilter, Race, SportFilter, ZoneSeconds } from "../types";

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
  // The tab lives in the URL hash so a refresh stays on it.
  const [tab, setTabState] = useState<DashboardTab>(() =>
    window.location.hash === "#training-week" ? "training-week" : "dashboard"
  );
  const setTab = (next: DashboardTab) => {
    setTabState(next);
    window.history.replaceState({}, "", next === "dashboard" ? window.location.pathname : `#${next}`);
  };

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
      window.history.replaceState({}, "", window.location.pathname);
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

  const summary = buildDashboardSummary(filteredActivities);
  const weeklyVolume = buildWeeklyVolume(filteredActivities);
  const weeklyTss = buildWeeklyTss(filteredActivities);
  const rangeDays = quickFilterToDays(quickFilter);

  return (
    <div className="min-h-screen bg-tri-bg px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Header
          tab={tab}
          onTabChange={setTab}
          stravaConnected={stravaConnected}
          athleteName={athleteName}
          onConnectStrava={connectStrava}
          onSync={handleSync}
          syncing={syncing}
          syncMessage={syncMessage}
        />

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {tab === "training-week" ? (
          <TrainingWeek />
        ) : (
          <>
            <UpcomingRaces races={races} onAddRace={handleAddRace} onEditRace={handleEditRace} onDeleteRace={handleDeleteRace} />

            <Filters sport={sport} onSportChange={setSport} quickFilter={quickFilter} onQuickFilterChange={setQuickFilter} />

            <SummaryMetrics summary={summary} />

            <WeeklyVolumeChart data={weeklyVolume} />

            <WeeklyTssChart data={weeklyTss} showValues={quickFilter === "7d" || quickFilter === "30d" || quickFilter === "90d"} />

            <div className="grid items-start gap-6 md:grid-cols-2">
              <TrainingCalendar activities={allActivities} plannedWorkouts={plannedWorkouts} />
              <ActivityHistory
                activities={allActivities}
                zones={activityZones}
                onReview={handleReviewActivity}
                reviewBusy={coachChat.busy}
              />
            </div>

            <SportAnalytics activities={filteredActivities} zones={zones} />

            <WorkoutHistory activities={filteredActivities} />

            <GearCard gear={gear} />

            <PlannedWorkouts workouts={plannedWorkouts} activities={allActivities} onAdd={handleAddPlannedWorkout} />

            {fatigue && <FatigueReadinessCard data={fatigue} activities={filteredActivities} rangeDays={rangeDays} />}

            <AICoachPanel />
          </>
        )}
      </div>

      <CoachBubble chat={coachChat} open={coachOpen} setOpen={setCoachOpen} onPlanChanged={reloadPlannedWorkouts} />
    </div>
  );
}
