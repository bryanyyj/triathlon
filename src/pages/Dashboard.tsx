import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { UpcomingRaces } from "../components/UpcomingRaces";
import { Filters, quickFilterToRange } from "../components/Filters";
import { SummaryMetrics } from "../components/SummaryMetrics";
import { WeeklyVolumeChart } from "../components/WeeklyVolumeChart";
import { WeeklyTssChart } from "../components/WeeklyTssChart";
import { TrainingCalendar } from "../components/TrainingCalendar";
import { HrZonesBySportChart } from "../components/HrZonesBySportChart";
import { SportAnalytics } from "../components/SportAnalytics";
import { PlannedWorkouts } from "../components/PlannedWorkouts";
import { FatigueReadinessCard } from "../components/FatigueReadinessCard";
import { AICoachPanel } from "../components/AICoachPanel";
import {
  connectStrava,
  createPlannedWorkout,
  createRace,
  getActivities,
  getFatigueReadiness,
  getHrZones,
  getPlannedWorkouts,
  getRaces,
  getStravaStatus,
  syncStrava,
} from "../lib/api";
import { buildDashboardSummary, buildWeeklyTss, buildWeeklyVolume } from "../lib/calculations";
import type { Activity, FatigueReadiness, HrZonesBySport, PlannedWorkout, QuickFilter, Race, SportFilter } from "../types";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>([]);
  const [fatigue, setFatigue] = useState<FatigueReadiness | null>(null);
  const [sport, setSport] = useState<SportFilter>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("90d");
  const [stravaConnected, setStravaConnected] = useState(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [zones, setZones] = useState<HrZonesBySport | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaResult = params.get("strava");

    if (stravaResult) {
      if (stravaResult === "error") {
        setError(params.get("message") || "Failed to connect to Strava.");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [activities, raceList, workouts, fatigueData, stravaStatus] = await Promise.all([
          getActivities(),
          getRaces(),
          getPlannedWorkouts(),
          getFatigueReadiness(),
          getStravaStatus(),
        ]);

        setAllActivities(activities);
        setRaces(raceList);
        setPlannedWorkouts(workouts);
        setFatigue(fatigueData);
        setStravaConnected(stravaStatus.connected);
        setAthleteName(stravaStatus.athleteName);
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

  const handleAddPlannedWorkout = async (workout: Partial<PlannedWorkout>) => {
    const created = await createPlannedWorkout(workout);
    setPlannedWorkouts((prev) => [...prev, created]);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const result = await syncStrava();
      const range = quickFilterToRange(quickFilter);
      const [activities, allActivitiesRefreshed, zonesBySport, stravaStatus] = await Promise.all([
        getActivities({ sport, ...range }),
        getActivities(),
        getHrZones(range),
        getStravaStatus(),
      ]);

      setFilteredActivities(activities);
      setAllActivities(allActivitiesRefreshed);
      setZones(zonesBySport);
      setStravaConnected(stravaStatus.connected);
      setAthleteName(stravaStatus.athleteName);
      setSyncMessage(
        `Synced ${result.synced} new activit${result.synced === 1 ? "y" : "ies"} · HR zones backfilled for ${result.zonesBackfilled} activit${result.zonesBackfilled === 1 ? "y" : "ies"}${result.zonesRateLimited ? " (Strava rate limit reached, click again later for more)" : ""}`
      );
    } catch (err) {
      setError((err as Error).message || "Failed to sync Strava data.");
    } finally {
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

  return (
    <div className="min-h-screen bg-tri-bg px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Header
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

        <UpcomingRaces races={races} onAddRace={handleAddRace} />

        <Filters sport={sport} onSportChange={setSport} quickFilter={quickFilter} onQuickFilterChange={setQuickFilter} />

        <SummaryMetrics summary={summary} />

        <WeeklyVolumeChart data={weeklyVolume} />

        <WeeklyTssChart data={weeklyTss} />

        <div className="grid gap-6 md:grid-cols-2">
          <TrainingCalendar activities={allActivities} />
          <HrZonesBySportChart zones={zones} />
        </div>

        <SportAnalytics activities={filteredActivities} zones={zones} />

        <PlannedWorkouts workouts={plannedWorkouts} activities={allActivities} onAdd={handleAddPlannedWorkout} />

        {fatigue && <FatigueReadinessCard data={fatigue} activities={allActivities} />}

        <AICoachPanel />
      </div>
    </div>
  );
}
