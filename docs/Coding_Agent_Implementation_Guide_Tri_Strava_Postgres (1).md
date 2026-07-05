# Coding Agent Implementation Guide
## Tri Training Dashboard – React App + Local Postgres API

## Objective

Implement the app so it retrieves existing Strava data from a PostgreSQL database instead of calling the Strava API directly.

The Strava ingestion is handled by another service. This app should only:

1. Connect to the provided PostgreSQL database through a backend API.
2. Read activity data from the database.
3. Display dashboard analytics in React.
4. Add planned workouts and upcoming races.
5. Compare planned training against actual Strava activities.
6. Add fatigue/readiness calculations.
7. Add OpenRouter AI coaching later.

---

# Important Architecture Decision

Do **not** connect the React frontend directly to PostgreSQL.

Use this architecture:

```text
React Frontend localhost:5173
   ↓
Local Backend API localhost:3001
   ↓
PostgreSQL 10.8.0.1:5432
```

For deployment later:

```text
Cloudflare Pages Frontend
   ↓
Backend API hosted on private server
   ↓
PostgreSQL database
```

Cloudflare Pages should not connect directly to the private database host.

---

# Database Access

Use environment variables.

Do not hardcode credentials in source code.

Create backend `.env`:

```env
DB_HOST=10.8.0.1
DB_PORT=5432
DB_NAME=strava_user1
DB_USER=strava_app
DB_PASSWORD=PUT_PASSWORD_HERE
```

The user will provide the actual password locally.

---

# Phase 1: Inspect Existing Database

Before implementing dashboard queries, inspect the existing schema.

## 1. Test Connection

```bash
psql -h 10.8.0.1 -p 5432 -U strava_app -d strava_user1
```

If ping fails, ignore it. ICMP may be blocked. Test port instead:

```powershell
Test-NetConnection 10.8.0.1 -Port 5432
```

## 2. List Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## 3. List Columns

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

## 4. Identify Activity Table

Look for tables likely named:

```text
activities
strava_activities
activity
athlete_activities
workouts
```

Then inspect sample rows:

```sql
SELECT *
FROM activities
LIMIT 5;
```

If the table name is different, update all SQL queries accordingly.

---

# Phase 2: Backend API Setup

Create a backend folder at project root:

```text
project-root/
├── frontend/
└── backend/
```

Or if the existing codebase is already React-only:

```text
project-root/
├── src/
├── backend/
├── package.json
└── vite.config.ts
```

## Install Backend Dependencies

```bash
cd backend
npm init -y
npm install express cors pg dotenv
npm install -D nodemon
```

Update `backend/package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

---

# Phase 3: Backend File Structure

Create:

```text
backend/
├── server.js
├── db.js
├── routes/
│   ├── health.js
│   ├── tables.js
│   ├── activities.js
│   ├── dashboard.js
│   ├── races.js
│   └── plannedWorkouts.js
├── lib/
│   ├── normalizeActivity.js
│   └── dashboardCalculations.js
└── .env
```

---

# Phase 4: Database Connection

Create `backend/db.js`:

```js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function testConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0];
}
```

---

# Phase 5: Express Server

Create `backend/server.js`:

```js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, testConnection } from "./db.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}));

app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const db = await testConnection();
    res.json({
      status: "ok",
      database: "connected",
      time: db.now
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

app.listen(3001, () => {
  console.log("Backend API running at http://localhost:3001");
});
```

Run:

```bash
npm run dev
```

Test:

```text
http://localhost:3001/api/health
```

---

# Phase 6: Table Inspection Endpoints

Add these endpoints first so the developer can see the real schema.

```js
app.get("/api/tables", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/columns", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

---

# Phase 7: Activity API

After confirming the real table and column names, implement `/api/activities`.

Assuming table is `activities`:

```js
app.get("/api/activities", async (req, res) => {
  try {
    const {
      sport,
      startDate,
      endDate,
      limit = 500
    } = req.query;

    const values = [];
    const filters = [];

    if (sport && sport !== "all") {
      values.push(sport);
      filters.push(`LOWER(sport_type) = LOWER($${values.length})`);
    }

    if (startDate) {
      values.push(startDate);
      filters.push(`start_date >= $${values.length}`);
    }

    if (endDate) {
      values.push(endDate);
      filters.push(`start_date <= $${values.length}`);
    }

    values.push(Number(limit));

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT *
      FROM activities
      ${whereClause}
      ORDER BY start_date DESC
      LIMIT $${values.length}
    `, values);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

If column names differ, create a normalizer layer.

---

# Phase 8: Activity Normalization

Create `backend/lib/normalizeActivity.js`:

```js
export function normalizeActivity(row) {
  return {
    id: String(row.id || row.strava_activity_id),
    stravaActivityId: String(row.strava_activity_id || row.id),
    name: row.name || row.activity_name || "Untitled Activity",
    sportType: normalizeSport(row.sport_type || row.type),
    distanceMeters: Number(row.distance_m || row.distance || 0),
    movingTimeSeconds: Number(row.moving_time_sec || row.moving_time || 0),
    elapsedTimeSeconds: Number(row.elapsed_time_sec || row.elapsed_time || 0),
    elevationGainMeters: Number(row.elevation_gain_m || row.total_elevation_gain || 0),
    averageHeartRate: row.average_hr ? Number(row.average_hr) : null,
    maxHeartRate: row.max_hr ? Number(row.max_hr) : null,
    averagePower: row.average_power ? Number(row.average_power) : null,
    weightedPower: row.weighted_power ? Number(row.weighted_power) : null,
    averageCadence: row.average_cadence ? Number(row.average_cadence) : null,
    startDate: row.start_date || row.start_date_local,
    raw: row
  };
}

function normalizeSport(sport) {
  const value = String(sport || "").toLowerCase();

  if (value.includes("swim")) return "swim";
  if (value.includes("bike") || value.includes("ride") || value.includes("cycling")) return "bike";
  if (value.includes("run")) return "run";

  return value || "other";
}
```

Use this in `/api/activities`:

```js
import { normalizeActivity } from "./lib/normalizeActivity.js";

res.json(result.rows.map(normalizeActivity));
```

---

# Phase 9: Dashboard Summary Endpoint

Create `/api/dashboard/summary`.

```js
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM activities
      ORDER BY start_date DESC
      LIMIT 5000
    `);

    const activities = result.rows.map(normalizeActivity);
    const summary = buildDashboardSummary(activities);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Create `backend/lib/dashboardCalculations.js`:

```js
export function buildDashboardSummary(activities) {
  const triSports = activities.filter(a =>
    ["swim", "bike", "run"].includes(a.sportType)
  );

  const totalWorkouts = triSports.length;
  const totalDistanceKm = sum(triSports.map(a => a.distanceMeters)) / 1000;
  const totalDurationHours = sum(triSports.map(a => a.movingTimeSeconds)) / 3600;

  const bySport = {
    swim: summarizeSport(triSports, "swim"),
    bike: summarizeSport(triSports, "bike"),
    run: summarizeSport(triSports, "run")
  };

  return {
    totalWorkouts,
    totalDistanceKm,
    totalDurationHours,
    bySport
  };
}

function summarizeSport(activities, sport) {
  const filtered = activities.filter(a => a.sportType === sport);

  return {
    sessions: filtered.length,
    distanceKm: sum(filtered.map(a => a.distanceMeters)) / 1000,
    durationHours: sum(filtered.map(a => a.movingTimeSeconds)) / 3600,
    averageHeartRate: average(filtered.map(a => a.averageHeartRate).filter(Boolean))
  };
}

function sum(values) {
  return values.reduce((a, b) => a + Number(b || 0), 0);
}

function average(values) {
  if (!values.length) return null;
  return sum(values) / values.length;
}
```

---

# Phase 10: Weekly Training Volume Endpoint

Create `/api/dashboard/weekly-volume`.

```js
app.get("/api/dashboard/weekly-volume", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM activities
      ORDER BY start_date ASC
      LIMIT 5000
    `);

    const activities = result.rows.map(normalizeActivity);
    const weekly = buildWeeklyVolume(activities);

    res.json(weekly);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Add calculation:

```js
export function buildWeeklyVolume(activities) {
  const map = new Map();

  for (const activity of activities) {
    if (!["swim", "bike", "run"].includes(activity.sportType)) continue;

    const week = getWeekKey(activity.startDate);

    if (!map.has(week)) {
      map.set(week, {
        week,
        swim: 0,
        bike: 0,
        run: 0,
        hours: 0
      });
    }

    const item = map.get(week);
    item[activity.sportType] += activity.distanceMeters / 1000;
    item.hours += activity.movingTimeSeconds / 3600;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.week.localeCompare(b.week)
  );
}

function getWeekKey(dateString) {
  const date = new Date(dateString);
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}
```

---

# Phase 11: React API Client

Create `src/lib/api.ts`:

```ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getDashboardSummary() {
  return apiGet("/api/dashboard/summary");
}

export async function getWeeklyVolume() {
  return apiGet("/api/dashboard/weekly-volume");
}

export async function getActivities() {
  return apiGet("/api/activities");
}
```

Frontend `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001
```

---

# Phase 12: React Dashboard Integration

In the dashboard page:

```tsx
import { useEffect, useState } from "react";
import { getDashboardSummary, getWeeklyVolume } from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { WeeklyVolumeChart } from "../components/WeeklyVolumeChart";

export function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [weeklyVolume, setWeeklyVolume] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [summaryData, weeklyData] = await Promise.all([
        getDashboardSummary(),
        getWeeklyVolume()
      ]);

      setSummary(summaryData);
      setWeeklyVolume(weeklyData);
      setLoading(false);
    }

    load().catch(console.error);
  }, []);

  if (loading) return <div className="text-white">Loading training data...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard title="Total Workouts" value={String(summary.totalWorkouts)} subtitle="sessions" />
        <MetricCard title="Total Distance" value={summary.totalDistanceKm.toFixed(0)} subtitle="km" />
        <MetricCard title="Total Duration" value={`${summary.totalDurationHours.toFixed(1)}h`} subtitle="training time" />
        <MetricCard title="Swim" value={`${summary.bySport.swim.distanceKm.toFixed(1)} km`} subtitle={`${summary.bySport.swim.sessions} sessions`} />
      </div>

      <WeeklyVolumeChart data={weeklyVolume} />
    </div>
  );
}
```

---

# Phase 13: Upcoming Races Feature

This app must support upcoming races such as:

- Running race
- Cycling event
- Swimming event
- Duathlon
- Triathlon
- Ironman 70.3
- Ironman
- Custom event

## Backend Table

Create table in the app database.

```sql
CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  race_name TEXT NOT NULL,
  race_type TEXT NOT NULL,
  race_distance TEXT,
  race_date TEXT NOT NULL,
  priority TEXT DEFAULT 'B',
  target_goal TEXT,
  swim_distance_km REAL,
  bike_distance_km REAL,
  run_distance_km REAL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Race Endpoints

```js
app.get("/api/races", async (req, res) => {
  const result = await pool.query(`
    SELECT *
    FROM races
    ORDER BY race_date ASC
  `);

  res.json(result.rows);
});

app.post("/api/races", async (req, res) => {
  const race = req.body;

  const result = await pool.query(`
    INSERT INTO races (
      id,
      race_name,
      race_type,
      race_distance,
      race_date,
      priority,
      target_goal,
      swim_distance_km,
      bike_distance_km,
      run_distance_km,
      notes
    )
    VALUES (
      gen_random_uuid()::text,
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    )
    RETURNING *
  `, [
    race.race_name,
    race.race_type,
    race.race_distance,
    race.race_date,
    race.priority,
    race.target_goal,
    race.swim_distance_km,
    race.bike_distance_km,
    race.run_distance_km,
    race.notes
  ]);

  res.json(result.rows[0]);
});
```

If `gen_random_uuid()` is unavailable, use UUID generation in Node instead.

---

# Phase 14: Planned Workouts Feature

## Backend Table

```sql
CREATE TABLE IF NOT EXISTS planned_workouts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  workout_type TEXT,
  planned_duration_min INTEGER,
  planned_distance_km REAL,
  target_zone TEXT,
  target_tss REAL,
  notes TEXT,
  matched_activity_id TEXT,
  status TEXT DEFAULT 'planned',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Matching Logic

Match a planned workout to an actual activity by:

1. Same date.
2. Same sport.
3. Closest duration or distance.

```js
function matchWorkout(planned, activities) {
  const sameDaySameSport = activities.filter(activity =>
    activity.sportType === planned.sport_type &&
    activity.startDate.slice(0, 10) === planned.date
  );

  if (!sameDaySameSport.length) return null;

  return sameDaySameSport.sort((a, b) => {
    const aDiff = Math.abs((a.movingTimeSeconds / 60) - planned.planned_duration_min);
    const bDiff = Math.abs((b.movingTimeSeconds / 60) - planned.planned_duration_min);
    return aDiff - bDiff;
  })[0];
}
```

---

# Phase 15: Fatigue / Readiness Engine

Create deterministic calculations in backend.

Do not ask AI to calculate fatigue scores directly.

Use AI only to explain the scores.

## MVP Formula

```js
function calculateFatigueScore(acuteLoad, chronicLoad) {
  const fatigue = 50 + ((acuteLoad - chronicLoad) * 1.5);
  return clamp(fatigue, 0, 100);
}

function calculateReadinessScore(fatigueScore) {
  return clamp(100 - fatigueScore, 0, 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
```

## Load Calculation

```js
function calculateTrainingLoad(activity) {
  const durationHours = activity.movingTimeSeconds / 3600;
  const intensityFactor = estimateIntensityFactor(activity);

  return durationHours * intensityFactor * 100;
}
```

Use average HR, pace, power, or default estimates where data is missing.

---

# Phase 16: OpenRouter AI Coach

Only implement after the dashboard, races, and planned workouts are working.

Backend-only endpoint:

```text
POST /api/ai/coach
```

Never expose OpenRouter API key to React.

Environment variable:

```env
OPENROUTER_API_KEY=PUT_KEY_HERE
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Prompt should include:

- Recent activities
- Weekly volume
- Upcoming races
- Planned workouts
- Fatigue score
- Readiness score

System prompt:

```text
You are a practical triathlon training assistant.
Explain the user's training data clearly.
Avoid medical diagnosis.
Do not claim the user is injured or overtrained.
Use cautious language such as "may indicate", "consider", and "could be useful".
```

---

# Phase 17: Development Order for Coding Agent

Implement in this exact order:

1. Create backend folder.
2. Add Express server.
3. Add PostgreSQL connection.
4. Add `/api/health`.
5. Add `/api/tables`.
6. Add `/api/columns`.
7. Inspect real database schema.
8. Confirm real activity table and column names.
9. Add activity normalization.
10. Add `/api/activities`.
11. Add `/api/dashboard/summary`.
12. Add `/api/dashboard/weekly-volume`.
13. Connect React dashboard to backend.
14. Replace mock data with real database data.
15. Add upcoming races table.
16. Add `/api/races`.
17. Add Upcoming Races UI component.
18. Add planned workouts table.
19. Add planned workouts UI.
20. Add planned vs actual matching.
21. Add fatigue/readiness calculations.
22. Add OpenRouter AI coach endpoint.
23. Add AI Coach UI.

Do not start with AI.
Do not start with Cloudflare deployment.
Do not call Strava API directly from this app.

---

# Phase 18: Local Run Commands

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
npm run dev
```

Expected URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
Health:   http://localhost:3001/api/health
Tables:   http://localhost:3001/api/tables
Columns:  http://localhost:3001/api/columns
```

---

# Phase 19: Deployment Notes

For production, do not deploy the backend to Cloudflare Pages if the database is only reachable by VPN/private network.

Recommended production setup:

```text
React frontend:
Cloudflare Pages

Backend API:
User's private server

Database:
PostgreSQL on 10.8.0.1
```

Then set frontend environment variable:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

The backend server must be reachable by the frontend user.

---

# Final Success Criteria

The implementation is successful when:

- Backend health check connects to PostgreSQL.
- `/api/tables` returns database tables.
- `/api/activities` returns normalized Strava activities.
- React dashboard displays real total workouts, distance, duration, and sport breakdown.
- Weekly volume chart displays real data.
- User can add upcoming races.
- Upcoming races appear as race cards.
- Planned workouts can be added.
- Planned workouts can be compared against actual Strava activities.
- Fatigue/readiness scores are calculated without AI.
- AI coach can explain the dashboard using OpenRouter.
