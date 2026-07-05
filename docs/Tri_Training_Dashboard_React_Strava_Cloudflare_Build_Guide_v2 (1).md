# Tri Training Dashboard App – Updated Build Guide v2

## New Requirement: Upcoming Races Area

Add a dedicated **Upcoming Races** section at the top of the dashboard.

This section should support:

- Running races
- Cycling events
- Swimming events
- Duathlon
- Triathlon
- Ironman / 70.3
- Custom endurance events

The purpose is to help the athlete connect training progress to real upcoming goals.

---

## 1. Dashboard Layout Update

Recommended top layout:

```text
[ Header / App Name / Connect Strava ]

[ Upcoming Races Section ]
  [ Race Card 1 ] [ Race Card 2 ] [ Race Card 3 ]

[ Filters ]
  Sport: All / Swim / Bike / Run
  Date Range
  Quick Filters

[ Summary Metric Cards ]
  Total Workouts
  Total Distance
  Total Duration
  Total TSS
  Swim
  Bike
  Run

[ Weekly Training Volume Chart ]

[ Sport Analytics ]

[ Fatigue / Readiness / AI Coach ]
```

---

## 2. Upcoming Races Section

### Purpose

Show the user's next important events and training progress toward each event.

### Race Card Fields

| Field | Example |
|---|---|
| Race Name | Standard Chartered Singapore Marathon |
| Race Type | Running |
| Race Distance | Marathon |
| Race Date | 2026-12-06 |
| Days To Go | 168 days |
| Priority | A Race |
| Target Goal | Sub 4 hours |
| Training Progress | 42% |
| Readiness Score | 68 / 100 |

---

## 3. Supported Race Types

```ts
type RaceType =
  | "running"
  | "cycling"
  | "swimming"
  | "duathlon"
  | "triathlon"
  | "ironman_70_3"
  | "ironman"
  | "custom";
```

---

## 4. Race Card UI Design

The card should be fun and colorful.

### Visual Style

- Rounded card
- Gradient top border
- Race icon
- Big countdown number
- Progress bar
- Sport-specific colors

### Suggested Icons

| Race Type | Icon |
|---|---|
| Running | 🏃 |
| Cycling | 🚴 |
| Swimming | 🏊 |
| Triathlon | 🏊🚴🏃 |
| Duathlon | 🏃🚴🏃 |
| Ironman | 🔥🏊🚴🏃 |

---

## 5. Example Race Cards

```text
🏃 Singapore Marathon
Marathon
168 days to go
Target: Sub 4h
Training progress: 42%

🚴 Round Island Ride
Cycling Event
35 days to go
Target: Complete 120km
Training progress: 61%

🏊🚴🏃 IRONMAN 70.3 Nice
70.3 Distance
138 days to go
Training progress: 58%
```

---

## 6. Database Schema: races

```sql
CREATE TABLE races (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
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

---

## 7. Database Schema: race_readiness

```sql
CREATE TABLE race_readiness (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  race_id TEXT NOT NULL,
  readiness_score REAL,
  training_progress REAL,
  longest_swim_km REAL,
  longest_bike_km REAL,
  longest_run_km REAL,
  weekly_consistency_score REAL,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Race Readiness Calculation

### Running Race

Inputs:

- Recent weekly running volume
- Longest recent run
- Run consistency
- Pace trend
- Missed workouts

Example:

```ts
runningReadiness =
  longRunScore * 0.35 +
  weeklyVolumeScore * 0.30 +
  consistencyScore * 0.25 +
  paceTrendScore * 0.10;
```

### Cycling Event

Inputs:

- Recent weekly cycling volume
- Longest recent ride
- Elevation readiness
- Power / HR endurance trend

Example:

```ts
cyclingReadiness =
  longRideScore * 0.40 +
  weeklyVolumeScore * 0.30 +
  intensityControlScore * 0.20 +
  elevationScore * 0.10;
```

### Triathlon / 70.3 / Ironman

Inputs:

- Swim readiness
- Bike readiness
- Run readiness
- Brick workout completion
- Overall consistency

Example:

```ts
triReadiness =
  swimReadiness * 0.25 +
  bikeReadiness * 0.30 +
  runReadiness * 0.30 +
  brickScore * 0.15;
```

---

## 9. React Component: UpcomingRaces

```tsx
type Race = {
  id: string;
  raceName: string;
  raceType: "running" | "cycling" | "swimming" | "duathlon" | "triathlon" | "ironman_70_3" | "ironman" | "custom";
  raceDistance?: string;
  raceDate: string;
  priority?: "A" | "B" | "C";
  targetGoal?: string;
  trainingProgress?: number;
  readinessScore?: number;
};

function getRaceIcon(type: Race["raceType"]) {
  switch (type) {
    case "running":
      return "🏃";
    case "cycling":
      return "🚴";
    case "swimming":
      return "🏊";
    case "duathlon":
      return "🏃🚴🏃";
    case "triathlon":
    case "ironman_70_3":
    case "ironman":
      return "🏊🚴🏃";
    default:
      return "⭐";
  }
}

function daysUntil(date: string) {
  const today = new Date();
  const raceDate = new Date(date);
  const diff = raceDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function UpcomingRaces({ races }: { races: Race[] }) {
  return (
    <section className="rounded-3xl bg-tri-card p-6 border border-white/10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Upcoming Races</h2>
          <p className="text-sm text-white/50">Train with your next goal in mind.</p>
        </div>

        <button className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white">
          + Add Race
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {races.map((race) => (
          <div
            key={race.id}
            className="rounded-2xl bg-tri-soft p-5 border border-white/10 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl">{getRaceIcon(race.raceType)}</p>
                <h3 className="mt-3 text-lg font-bold text-white">{race.raceName}</h3>
                <p className="text-sm text-white/50">{race.raceDistance}</p>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {race.priority || "B"} Race
              </span>
            </div>

            <div className="mt-5">
              <p className="text-5xl font-black text-white">{daysUntil(race.raceDate)}</p>
              <p className="text-sm text-white/50">days to go</p>
            </div>

            {race.targetGoal && (
              <p className="mt-4 text-sm text-white/70">
                Target: {race.targetGoal}
              </p>
            )}

            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs text-white/50">
                <span>Training Progress</span>
                <span>{race.trainingProgress || 0}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tri-purple to-tri-pink"
                  style={{ width: `${race.trainingProgress || 0}%` }}
                />
              </div>
            </div>

            {race.readinessScore !== undefined && (
              <div className="mt-4 rounded-xl bg-white/5 p-3">
                <p className="text-xs uppercase tracking-widest text-white/40">
                  Race Readiness
                </p>
                <p className="text-2xl font-bold text-white">
                  {race.readinessScore}/100
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## 10. Add Race Modal

Fields:

```text
Race Name
Race Type
Race Distance
Race Date
Priority
Target Goal
Swim Distance
Bike Distance
Run Distance
Notes
```

For race type, use a dropdown:

```text
Running
Cycling
Swimming
Duathlon
Triathlon
Ironman 70.3
Ironman
Custom
```

---

## 11. Example Mock Race Data

```ts
export const mockRaces = [
  {
    id: "1",
    raceName: "Singapore Marathon",
    raceType: "running",
    raceDistance: "Marathon",
    raceDate: "2026-12-06",
    priority: "A",
    targetGoal: "Sub 4 hours",
    trainingProgress: 42,
    readinessScore: 64
  },
  {
    id: "2",
    raceName: "Round Island Ride",
    raceType: "cycling",
    raceDistance: "120 km",
    raceDate: "2026-08-15",
    priority: "B",
    targetGoal: "Complete strong",
    trainingProgress: 61,
    readinessScore: 72
  },
  {
    id: "3",
    raceName: "IRONMAN 70.3 Nice",
    raceType: "ironman_70_3",
    raceDistance: "1.9km / 90km / 21.1km",
    raceDate: "2026-06-28",
    priority: "A",
    targetGoal: "Finish confidently",
    trainingProgress: 58,
    readinessScore: 67
  }
];
```

---

## 12. AI Coach Integration for Races

The AI coach should use upcoming race context.

Example prompt context:

```json
{
  "upcomingRaces": [
    {
      "raceName": "IRONMAN 70.3 Nice",
      "raceType": "ironman_70_3",
      "raceDate": "2026-06-28",
      "daysToGo": 138,
      "trainingProgress": 58,
      "readinessScore": 67
    }
  ],
  "recentTraining": "...",
  "fatigueScore": 74,
  "readinessScore": 48
}
```

Example AI output:

```text
Your next A race is IRONMAN 70.3 Nice in 138 days. Your bike volume is progressing well, but your longest run is still below the recommended range for a 70.3. Prioritize consistent easy runs and one weekly brick session.
```

---

## 13. Updated MVP Checklist

- [ ] Add Upcoming Races section
- [ ] Add race card component
- [ ] Add race creation modal
- [ ] Store races in database
- [ ] Calculate days to race
- [ ] Calculate training progress
- [ ] Calculate race readiness
- [ ] Include upcoming races in OpenRouter AI context
- [ ] Add race-specific AI tips
- [ ] Allow running-only, cycling-only, swimming-only, triathlon, and custom events
