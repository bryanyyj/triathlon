import type {
  Activity,
  DashboardSummary,
  FatigueReadiness,
  Gear,
  GarminDay,
  GarminStatus,
  GearAnalytics,
  HrZonesBySport,
  PlannedWorkout,
  Race,
  WeeklyVolumePoint,
  ZoneSeconds,
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
  syncing: boolean;
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
};

// Pulls new activities and returns as soon as they're saved. HR-zone backfill and
// gear sync continue on the backend afterwards — poll getStravaStatus().syncing to
// know when that background work has finished.
export async function syncStrava(): Promise<SyncResult> {
  const response = await fetch(`${API_BASE_URL}/api/strava/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Full re-pull so renamed/updated activities and their gear IDs are refreshed,
    // not just brand-new activities.
    body: JSON.stringify({ full: true }),
    signal: AbortSignal.timeout(60000),
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

export async function getGear(): Promise<Gear[]> {
  const { gear } = await apiGet<{ gear: Gear[] }>("/api/strava/gear");
  return gear;
}

export async function getGearAnalytics(gearId: string): Promise<GearAnalytics> {
  return apiGet<GearAnalytics>(`/api/strava/gear/${encodeURIComponent(gearId)}/analytics`);
}

export async function getRaces(): Promise<Race[]> {
  return apiGet<Race[]>("/api/races");
}

export async function createRace(race: Partial<Race>): Promise<Race> {
  return apiPost<Race>("/api/races", race);
}

export async function updateRace(id: string, race: Partial<Race>): Promise<Race> {
  return apiPut<Race>(`/api/races/${id}`, race);
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

export async function getGarminStatus(): Promise<GarminStatus> {
  return apiGet<GarminStatus>("/api/garmin/status");
}

export async function syncGarmin(days: number): Promise<GarminStatus> {
  return apiPost<GarminStatus>("/api/garmin/sync", { days });
}

export async function getGarminDays(): Promise<GarminDay[]> {
  return apiGet<GarminDay[]>("/api/garmin/daily");
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

export type CoachStatus = {
  configured: boolean;
  model: string;
  free: boolean;
  // True when the configured model is paid and the backend's cost guard will refuse it.
  blocked: boolean;
};

export async function getCoachStatus(): Promise<CoachStatus> {
  return apiGet<CoachStatus>("/api/coach/status");
}

export type CoachMessage = {
  role: "user" | "assistant";
  content: string;
  // Shown in the chat instead of content, e.g. a short "Review …" line for a detailed prompt.
  display?: string;
  // Sessions the coach planned in this reply, rendered as workout cards.
  sessions?: PlanSession[];
};

// A coach-planned session (backend/coach/aiplan.ts). blocks: structure in order, HR zone 1–5.
export type PlanSession = {
  id: string;
  date: string;
  sport: string;
  title: string;
  intensity: "rest" | "easy" | "tempo" | "threshold" | "vo2" | "long";
  durationMin: number;
  rationale: string;
  blocks?: { min: number; zone: number }[];
};

// The backend appends planned sessions as JSON after this record-separator character.
export const PLAN_SEPARATOR = "\u001e";

// Downsampled effort over an activity: values drive bar height, zones (0–5, or null
// without HR) drive bar color.
export type ActivityProfile = {
  metric: "watts" | "velocity_smooth" | "heartrate";
  values: number[];
  zones: (number | null)[];
};

export type ActivityProfilesResponse = {
  profiles: Record<string, ActivityProfile | null>;
  pending: string[];
  rateLimited: boolean;
};

// Uncached profiles are fetched from Strava one by one, so allow far longer than apiGet's 5s.
export async function getActivityProfiles(ids: string[]): Promise<ActivityProfilesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/activities/profiles?ids=${ids.map(encodeURIComponent).join(",")}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// The athlete's standing week (backend/coach/trainingWeek.ts). Sports use the coach's names.
export type WeekSport = "Swim" | "Ride" | "Run";
export type SessionIntensity = "easy" | "tempo" | "threshold" | "vo2" | "long";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";
export type WeekSession = { sport: WeekSport; intensity: SessionIntensity; durationMin: number; timeOfDay: TimeOfDay };
// Monday first. null = automatic (follow detected), [] = rest day.
export type TrainingWeekDays = (WeekSession[] | null)[];
export type DetectedSession = WeekSession & { weeks: number };
export type TrainingWeekResponse = {
  saved: TrainingWeekDays;
  detected: { days: DetectedSession[][]; weeksObserved: number; from: string; through: string };
};

export async function getTrainingWeek(): Promise<TrainingWeekResponse> {
  const timeZone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return apiGet<TrainingWeekResponse>(`/api/training-week?timeZone=${timeZone}`);
}

export async function saveTrainingWeek(days: TrainingWeekDays): Promise<{ saved: TrainingWeekDays }> {
  const response = await fetch(`${API_BASE_URL}/api/training-week`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `API error: ${response.status}`);
  return body;
}

export async function getActivityZones(): Promise<Record<string, ZoneSeconds>> {
  return apiGet<Record<string, ZoneSeconds>>("/api/activities/zones");
}

// Sends the chat history and streams the coach's reply through onDelta as it is written.
export async function streamCoachChat(messages: CoachMessage[], onDelta: (text: string) => void): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/coach/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages
        .filter((m) => m.content.trim() || m.sessions?.length)
        .map(({ role, content, sessions }) => ({
          role,
          // A plan-only reply has little text; give the model a compact record of what it planned.
          content: sessions?.length
            ? `${content}\n\n(Planned: ${sessions.map((s) => `${s.date} ${s.sport} ${s.title} ${s.durationMin}min ${s.intensity}`).join("; ")})`.trim()
            : content,
        })),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `API error: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}
