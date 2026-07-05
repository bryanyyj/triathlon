# Tri Training Dashboard

A training dashboard that reads existing Strava activity data from a PostgreSQL
database (ingested by a separate service), and adds upcoming races, planned
workouts, fatigue/readiness scoring, and an AI coach on top.

Architecture:

```text
React frontend (Vite, :5173)
   -> Backend API (Express, :3001)
   -> PostgreSQL (10.8.0.1:5432)
```

The frontend never talks to Postgres directly, and falls back to sample data
whenever the backend is unreachable (banner shown in the header when this
happens).

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

- `DB_PASSWORD` — ask whoever manages the Strava ingestion service for the
  real password.
- `ACTIVITIES_TABLE` — after connecting, hit `GET /api/tables` and
  `GET /api/columns` to see the real schema, and update this if the table
  storing activities isn't literally named `activities`.
- `OPENROUTER_API_KEY` — optional. Leave blank to keep the AI Coach disabled
  (it will show a clear "not configured" message instead of erroring).

Run it:

```bash
npm run dev
```

- Health check: http://localhost:3001/api/health
- Schema inspection: http://localhost:3001/api/tables, /api/columns

On first successful DB connection, the backend auto-creates its own tables
(`races`, `race_readiness`, `planned_workouts`) — it never modifies the
existing Strava activity tables.

### Frontend

```bash
npm install
npm run dev
```

Open http://localhost:5173. `.env.local` already points at
`http://localhost:3001`; change `VITE_API_BASE_URL` there if the backend runs
elsewhere.

## What's implemented

- Upcoming races section (race cards, add-race modal, running/cycling/
  swimming/duathlon/triathlon/70.3/Ironman/custom types, per-race training
  progress + readiness score computed from activity history)
- Sport/date filters, summary metric cards, weekly volume chart, sport
  analytics
- Planned workouts (create + auto-match against actual activities by date/
  sport/duration)
- Deterministic fatigue/readiness scoring (acute vs. chronic load)
- AI Coach panel — calls OpenRouter when `OPENROUTER_API_KEY` is set,
  otherwise reports it's not configured

## Known gaps / next steps

- The real activities table/column names haven't been verified yet — inspect
  via `/api/tables` and `/api/columns` once `DB_PASSWORD` is set, and adjust
  `ACTIVITIES_TABLE` in `backend/.env` if needed.
- Race readiness formulas are a reasonable first pass per the build guide;
  revisit the weekly-volume/long-effort targets once real training history is
  available.
