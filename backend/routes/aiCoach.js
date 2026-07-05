import { Router } from "express";
import { db } from "../db.js";
import { fetchNormalizedActivities } from "./activities.js";
import { buildDashboardSummary, buildWeeklyVolume, calculateFatigueReadiness } from "../lib/dashboardCalculations.js";
import { calculateRaceReadiness } from "../lib/raceReadiness.js";

export const aiCoachRouter = Router();

const SYSTEM_PROMPT = `You are a practical triathlon training assistant.
Explain the user's training data clearly.
Avoid medical diagnosis.
Do not claim the user is injured or overtrained.
Use cautious language such as "may indicate", "consider", and "could be useful".`;

async function buildCoachContext() {
  const activities = await fetchNormalizedActivities({ limit: 5000 });
  const raceRows = db.prepare(`SELECT * FROM races ORDER BY race_date ASC LIMIT 5`).all();

  const upcomingRaces = raceRows.map((row) => {
    const race = {
      raceName: row.race_name,
      raceType: row.race_type,
      raceDate: row.race_date,
    };
    const readiness = calculateRaceReadiness({ raceType: row.race_type, runDistanceKm: row.run_distance_km, bikeDistanceKm: row.bike_distance_km }, activities);
    return { ...race, ...readiness };
  });

  return {
    upcomingRaces,
    summary: buildDashboardSummary(activities),
    weeklyVolume: buildWeeklyVolume(activities).slice(-4),
    fatigue: calculateFatigueReadiness(activities),
  };
}

aiCoachRouter.post("/api/ai/coach", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.json({
      configured: false,
      message: "AI Coach is not configured yet. Set OPENROUTER_API_KEY in backend/.env to enable it.",
    });
  }

  try {
    const context = await buildCoachContext();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Here is my current training context as JSON:\n${JSON.stringify(context)}` },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "No response from AI coach.";

    res.json({ configured: true, message });
  } catch (error) {
    res.status(500).json({ configured: true, message: `AI Coach request failed: ${error.message}` });
  }
});
