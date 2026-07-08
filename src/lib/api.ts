import type {
  Activity,
  DashboardSummary,
  FatigueReadiness,
  HrZonesBySport,
  PlannedWorkout,
  Race,
  WeeklyVolumePoint,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
}

export async function checkHealth(): Promise<boolean> {
  try {
    await apiGet("/api/health");
    return true;
  } catch {
    return false;
  }
}

export type StravaStatus = {
  connected: boolean;
  athleteName: string | null;
};

export async function getStravaStatus(): Promise<StravaStatus> {
  return apiGet<StravaStatus>("/api/strava/status");
}

export function connectStrava(): void {
  window.location.href = `${API_BASE_URL}/api/strava/connect`;
}

export type ZonesBackfillProgress = {
  total: number;
  withZones: number;
  missing: number;
};

export async function getZonesStatus(): Promise<ZonesBackfillProgress> {
  return apiGet<ZonesBackfillProgress>("/api/strava/zones-status");
}

export type SyncResult = {
  synced: number;
  zonesBackfilled: number;
  zonesRateLimited: boolean;
};

// Manual re-pull only — no polling. Zone backfill fetches one stream request per
// activity, so this can take a while; give it a generous timeout.
export async function syncStrava(): Promise<SyncResult> {
  const response = await fetch(`${API_BASE_URL}/api/strava/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function getHrZones(params?: { startDate?: string; endDate?: string }): Promise<HrZonesBySport> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return apiGet<HrZonesBySport>(`/api/dashboard/hr-zones${qs ? `?${qs}` : ""}`);
}

export async function getActivities(params?: {
  sport?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Activity[]> {
  const query = new URLSearchParams();
  if (params?.sport && params.sport !== "all") query.set("sport", params.sport);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return apiGet<Activity[]>(`/api/activities${qs ? `?${qs}` : ""}`);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/api/dashboard/summary");
}

export async function getWeeklyVolume(): Promise<WeeklyVolumePoint[]> {
  return apiGet<WeeklyVolumePoint[]>("/api/dashboard/weekly-volume");
}

export async function getFatigueReadiness(): Promise<FatigueReadiness> {
  return apiGet<FatigueReadiness>("/api/dashboard/fatigue");
}

export async function getRaces(): Promise<Race[]> {
  return apiGet<Race[]>("/api/races");
}

export async function createRace(race: Partial<Race>): Promise<Race> {
  return apiPost<Race>("/api/races", race);
}

export async function deleteRace(id: string): Promise<void> {
  return apiDelete(`/api/races/${id}`);
}

export async function getPlannedWorkouts(): Promise<PlannedWorkout[]> {
  return apiGet<PlannedWorkout[]>("/api/planned-workouts");
}

export async function createPlannedWorkout(workout: Partial<PlannedWorkout>): Promise<PlannedWorkout> {
  return apiPost<PlannedWorkout>("/api/planned-workouts", workout);
}

export async function updatePlannedWorkout(id: string, updates: Partial<PlannedWorkout>): Promise<PlannedWorkout> {
  return apiPut<PlannedWorkout>(`/api/planned-workouts/${id}`, updates);
}

export async function deletePlannedWorkout(id: string): Promise<void> {
  return apiDelete(`/api/planned-workouts/${id}`);
}

export type AiCoachResponse = {
  configured: boolean;
  message: string;
};

export async function askAiCoach(): Promise<AiCoachResponse> {
  try {
    return await apiPost<AiCoachResponse>("/api/ai/coach", {});
  } catch (error) {
    return {
      configured: false,
      message:
        "AI Coach is unavailable right now (backend unreachable or OPENROUTER_API_KEY not configured).",
    };
  }
}
