import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { queryActivities } from "../lib/activityStore.js";
import { config, hasOpenRouter, isFreeModel } from "../coach/config.ts";
import { buildContext, contextMessage, COACH_SYSTEM } from "../coach/coach.ts";
import { streamChat } from "../coach/openrouter.ts";
import { buildSchedule } from "../coach/schedule.ts";
import { datedWeekday, todayInZone, validTimeZone } from "../coach/dates.ts";
import { PLAN_PRINCIPLES, formatVolume, isPlanRequest, volumeBaseline } from "../coach/planning.ts";
import { PLAN_INSTRUCTION, PlanStripper, parsePlan } from "../coach/aiplan.ts";
import { detectTrainingWeek, formatTrainingWeek, parseTrainingWeek } from "../coach/trainingWeek.ts";

export const coachRouter = Router();

// The coach names sports the way Strava does; the dashboard uses its own keys.
const COACH_SPORT = { swim: "Swim", bike: "Ride", run: "Run" };
const DASHBOARD_SPORT = { Swim: "swim", Ride: "bike", Run: "run" };

const CALENDAR_RULES = `The CURRENT PLANNED WORKOUTS block is what is on the athlete's dashboard calendar right now.
Sessions you emit for a date replace everything planned on that date, so include every session that should stay on it. Emit a single rest entry to clear a date. Dates you leave out are not changed.`;

/** Dashboard activities in the shape the coach modules expect, dated in the athlete's timezone. */
function coachActivities(timeZone) {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localHour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
  return queryActivities({ limit: 5000 })
    .filter((a) => a.startDate && !Number.isNaN(Date.parse(a.startDate)))
    .map((a) => ({
      id: a.id,
      date: localDate.format(new Date(a.startDate)),
      startHour: Number(localHour.format(new Date(a.startDate))),
      type: COACH_SPORT[a.sportType] ?? a.sportType,
      name: a.name,
      durationMin: (a.movingTimeSeconds || 0) / 60,
      ...(a.distanceMeters ? { distanceKm: a.distanceMeters / 1000 } : {}),
      ...(a.averagePower ? { avgPower: a.averagePower } : {}),
      ...(a.averageHeartRate ? { avgHr: Math.round(a.averageHeartRate) } : {}),
      ...(a.maxHeartRate ? { maxHr: Math.round(a.maxHeartRate) } : {}),
      source: "strava",
    }));
}

function plannedBlock(today) {
  const rows = db
    .prepare(`SELECT * FROM planned_workouts WHERE date >= ? AND status = 'planned' ORDER BY date ASC LIMIT 60`)
    .all(today);
  if (!rows.length) return "CURRENT PLANNED WORKOUTS: none from today onward.";
  return [
    "CURRENT PLANNED WORKOUTS (from today onward):",
    ...rows.map((row) => {
      const details = [
        row.planned_duration_min ? `${row.planned_duration_min}min` : null,
        row.planned_distance_km ? `${row.planned_distance_km}km` : null,
        row.target_zone,
      ].filter(Boolean).join(", ");
      return `- ${datedWeekday(row.date)} ${COACH_SPORT[row.sport_type] ?? row.sport_type}: ${row.workout_type || "Workout"}${details ? ` (${details})` : ""}`;
    }),
  ].join("\n");
}

function racesBlock(today) {
  const rows = db
    .prepare(`SELECT * FROM races WHERE race_date >= ? ORDER BY race_date ASC LIMIT 5`)
    .all(today);
  if (!rows.length) return "UPCOMING RACES: none entered.";
  return [
    "UPCOMING RACES:",
    ...rows.map((row) => {
      const date = String(row.race_date).slice(0, 10);
      const daysOut = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
      const extras = [row.race_distance, row.priority ? `priority ${row.priority}` : null, row.target_goal ? `goal: ${row.target_goal}` : null]
        .filter(Boolean).join(", ");
      return `- ${date} (${daysOut} days out): ${row.race_name}, ${row.race_type}${extras ? `, ${extras}` : ""}`;
    }),
  ].join("\n");
}

const PLAN_SEPARATOR = "\u001e";
const TRAINING_WEEK_KEY = "training_week";
const AUTOMATIC_WEEK = Array(7).fill(null);

/** The athlete's saved training week (Monday first; null days are automatic). */
function loadTrainingWeek() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(TRAINING_WEEK_KEY);
  if (!row) return AUTOMATIC_WEEK;
  try {
    return parseTrainingWeek(JSON.parse(row.value));
  } catch {
    return AUTOMATIC_WEEK;
  }
}

function requestTimeZone(value) {
  return validTimeZone(value) ? value : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Sports per weekday for buildSchedule: saved days pin their sports, automatic days stay null. */
function scheduleDays(week) {
  return week.map((day) => (day === null ? null : [...new Set(day.map((s) => s.sport))]));
}

function buildMessages(ctx, activities, history, trainingWeekBlock) {
  // Planning rules + volume history are only sent when the recent user turns look like planning.
  const planning = history.filter((m) => m.role === "user").slice(-2).some((m) => isPlanRequest(m.content));
  const deload = ctx.readiness.recommendation === "REST" || (ctx.readiness.metrics.acwr ?? 0) >= 1.3;
  const guidance = planning ? `\n\n${PLAN_PRINCIPLES}\n\n${formatVolume(volumeBaseline(activities, ctx.date, deload))}` : "";
  return [
    {
      role: "system",
      content: `${COACH_SYSTEM}\n\n${PLAN_INSTRUCTION}\n${CALENDAR_RULES}${guidance}\n\n${contextMessage(ctx)}\n\n${trainingWeekBlock}\n\n${plannedBlock(ctx.date)}\n\n${racesBlock(ctx.date)}`,
    },
    ...history,
  ];
}

const insertPlanned = db.prepare(`
  INSERT INTO planned_workouts (id, date, sport_type, workout_type, planned_duration_min, target_zone, notes, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'planned')
`);
const clearPlannedDate = db.prepare(`DELETE FROM planned_workouts WHERE date = ? AND status = 'planned'`);

/** The coach's sessions replace whatever was still planned on the same dates. */
function savePlan(sessions) {
  db.exec("BEGIN");
  try {
    for (const date of new Set(sessions.map((s) => s.date))) clearPlannedDate.run(date);
    for (const s of sessions) {
      if (s.intensity === "rest") continue;
      insertPlanned.run(randomUUID(), s.date, DASHBOARD_SPORT[s.sport] ?? "other", s.title, s.durationMin, s.intensity, s.rationale);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

coachRouter.get("/api/coach/status", (req, res) => {
  res.json({
    configured: hasOpenRouter(),
    model: config.openRouter.model,
    free: isFreeModel(),
    // The cost guard refuses paid models unless OPENROUTER_ALLOW_PAID=true.
    blocked: config.openRouter.freeOnly && !isFreeModel(),
  });
});

// The saved week plus what history suggests, so the settings tab can offer "use detected".
coachRouter.get("/api/training-week", (req, res) => {
  try {
    const timeZone = requestTimeZone(req.query.timeZone);
    res.json({
      saved: loadTrainingWeek(),
      detected: detectTrainingWeek(coachActivities(timeZone), todayInZone(timeZone)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

coachRouter.put("/api/training-week", (req, res) => {
  let week;
  try {
    week = parseTrainingWeek(req.body?.days);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(TRAINING_WEEK_KEY, JSON.stringify(week));
  res.json({ saved: week });
});

coachRouter.post("/api/coach/chat", async (req, res) => {
  if (!hasOpenRouter()) {
    return res.status(400).json({ message: "The coach is not configured yet. Set OPENROUTER_API_KEY in backend/.env." });
  }

  const history = (Array.isArray(req.body?.messages) ? req.body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (!history.length) return res.status(400).json({ message: "Send at least one message." });

  try {
    const timeZone = requestTimeZone(req.body?.timeZone);
    const today = todayInZone(timeZone);
    const activities = coachActivities(timeZone);
    const savedWeek = loadTrainingWeek();
    const schedule = buildSchedule(activities, { timeZone, days: scheduleDays(savedWeek) }, today);
    const ctx = buildContext(activities, { date: today }, today, schedule);
    const trainingWeekBlock = formatTrainingWeek(savedWeek, detectTrainingWeek(activities, today));

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    const stripper = new PlanStripper();
    let wroteText = false;
    for await (const delta of streamChat(buildMessages(ctx, activities, history, trainingWeekBlock))) {
      const visible = stripper.feed(delta);
      if (visible) {
        res.write(visible);
        wroteText ||= visible.trim().length > 0;
      }
    }
    const { tail, json } = stripper.end();
    if (tail) res.write(tail);
    wroteText ||= Boolean(tail?.trim());
    // Reasoning models can spend the whole token budget thinking and return no text at all.
    if (!wroteText && !json) {
      res.write("The model finished without writing a reply (it may have used its whole budget thinking). Please try again, or ask a shorter question.");
    }

    const sessions = json ? parsePlan(json, ctx.date) : [];
    if (sessions.length) {
      try {
        savePlan(sessions);
        const n = sessions.filter((s) => s.intensity !== "rest").length;
        res.write(`\n\n✓ ${n ? `${n} workout${n === 1 ? "" : "s"} added to your calendar.` : "Calendar updated."}`);
      } catch (err) {
        res.write(`\n\n[The plan could not be saved to your calendar: ${err.message}]`);
      }
      // The chat renders these as workout cards. \u001e (record separator) never appears in
      // model text, so everything after it is the sessions' JSON.
      res.write(`${PLAN_SEPARATOR}${JSON.stringify(sessions)}`);
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The coaching model failed.";
    if (!res.headersSent) res.status(502).json({ message });
    else res.end(`\n\n[error: ${message}]`);
  }
});
