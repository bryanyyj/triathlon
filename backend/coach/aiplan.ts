import type { Intensity, PlannedSession } from "./types.ts";
import { addDateDays } from "./dates.ts";
import { trainingSport } from "./schedule.ts";

const OPEN = "<plan>";
const CLOSE = "</plan>";
const INTENSITIES: Intensity[] = ["rest", "easy", "tempo", "threshold", "vo2", "long"];
const MAX_AHEAD_DAYS = 60;

/** Appended to the system prompt. Kept short: it is sent on every chat turn. */
export const PLAN_INSTRUCTION = `CALENDAR SYNC (hidden from the athlete): only when the athlete asks you to plan, schedule or change specific workouts, finish your reply with one machine-readable line and nothing after it:
<plan>[{"date":"YYYY-MM-DD","sport":"Swim|Ride|Run","title":"short","intensity":"easy|tempo|threshold|vo2|long|rest","durationMin":60,"note":"one short reason","blocks":[{"min":15,"zone":2},{"min":10,"zone":4},{"min":3,"zone":1},{"min":10,"zone":4},{"min":10,"zone":1}]}]</plan>
One object per session, using dates from the date reference. "blocks" is the workout structure in order (warm-up, every interval and recovery, cool-down) with HR zone 1–5; the minutes add up to durationMin.
The app shows each planned session as a card with its structure, duration and note, so when you include this line keep the visible reply to a short summary of the week's intent and any changes — do not list the sessions again. Never mention, explain or repeat this line. Otherwise omit it.`;

const MAX_BLOCKS = 40;

/** A plausible structure when the model gives none: warm-up, a main set shaped by intensity, cool-down. */
export function defaultBlocks(intensity: Intensity, durationMin: number): { min: number; zone: number }[] {
  if (intensity === "rest" || durationMin <= 0) return [];
  if (intensity === "easy" || intensity === "long" || durationMin < 30) return [{ min: durationMin, zone: 2 }];
  const warm = Math.min(15, Math.round(durationMin * 0.2));
  const cool = Math.min(10, Math.round(durationMin * 0.15));
  const main = durationMin - warm - cool;
  const blocks = [{ min: warm, zone: 2 }];
  if (intensity === "tempo") blocks.push({ min: main, zone: 3 });
  else {
    // Threshold: 10 on / 3 off. VO2: 3 on / 3 off. As many reps as fit the main set.
    const [on, off, zone] = intensity === "threshold" ? [10, 3, 4] : [3, 3, 5];
    const reps = Math.max(1, Math.floor((main + off) / (on + off)));
    for (let r = 0; r < reps; r++) {
      blocks.push({ min: on, zone });
      if (r < reps - 1) blocks.push({ min: off, zone: 1 });
    }
    const used = reps * on + (reps - 1) * off;
    if (main - used > 0) blocks.push({ min: main - used, zone: 2 });
  }
  blocks.push({ min: cool, zone: 1 });
  return blocks.filter((b) => b.min > 0);
}

function parseBlocks(value: unknown): { min: number; zone: number }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks = value.slice(0, MAX_BLOCKS).flatMap((b) => {
    const o = (b ?? {}) as Record<string, unknown>;
    const min = Number(o.min);
    const zone = Math.round(Number(o.zone));
    return Number.isFinite(min) && min > 0 && min <= 240 && zone >= 1 && zone <= 5 ? [{ min: Math.round(min * 10) / 10, zone }] : [];
  });
  return blocks.length ? blocks : undefined;
}

/**
 * Removes a trailing <plan>…</plan> block from a streamed reply so the athlete never sees it,
 * while still capturing its JSON. Text is held back only while it could be the start of the tag.
 */
export class PlanStripper {
  private pending = "";
  private inside = false;
  private raw = "";

  /** Returns the text that is safe to show now. */
  feed(delta: string): string {
    if (this.inside) { this.raw += delta; return ""; }
    this.pending += delta;
    const at = this.pending.indexOf(OPEN);
    if (at >= 0) {
      const visible = this.pending.slice(0, at);
      this.raw = this.pending.slice(at + OPEN.length);
      this.pending = "";
      this.inside = true;
      return visible;
    }
    // Keep the longest suffix that is a prefix of "<plan>".
    let hold = 0;
    for (let n = Math.min(OPEN.length - 1, this.pending.length); n > 0; n--) {
      if (OPEN.startsWith(this.pending.slice(-n))) { hold = n; break; }
    }
    const visible = this.pending.slice(0, this.pending.length - hold);
    this.pending = this.pending.slice(this.pending.length - hold);
    return visible;
  }

  /**
   * Flush at end of stream. `json` is the raw plan payload, if the model emitted one; `tail` is
   * any text after </plan> (some models put the plan first and their summary after it).
   */
  end(): { tail: string; json?: string } {
    if (!this.inside) { const tail = this.pending; this.pending = ""; return { tail }; }
    const close = this.raw.indexOf(CLOSE);
    if (close < 0) return { tail: "", json: this.raw.trim() };
    return { tail: this.raw.slice(close + CLOSE.length).trim(), json: this.raw.slice(0, close).trim() };
  }
}

/** Validate model output; silently drops anything malformed, past, or too far ahead. */
export function parsePlan(json: string, today: string): PlannedSession[] {
  let items: unknown;
  try { items = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(items)) return [];
  const last = addDateDays(today, MAX_AHEAD_DAYS);
  const counts = new Map<string, number>();
  const sessions: PlannedSession[] = [];
  for (const item of items.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < today || date > last) continue;
    const intensity = INTENSITIES.includes(o.intensity as Intensity) ? (o.intensity as Intensity) : "easy";
    const rawSport = typeof o.sport === "string" ? o.sport.trim().slice(0, 20) : "";
    const sport = trainingSport(rawSport) ?? (rawSport || "Workout");
    const minutes = Number(o.durationMin);
    const durationMin = intensity === "rest" ? 0 : Number.isFinite(minutes) ? Math.min(480, Math.max(10, Math.round(minutes))) : 45;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 60) : intensity === "rest" ? "Rest" : `${sport} session`;
    const note = typeof o.note === "string" ? o.note.trim().slice(0, 200) : "";
    const n = (counts.get(date) ?? 0) + 1;
    counts.set(date, n);
    sessions.push({
      id: `ai:${date}:${intensity === "rest" ? "rest" : sport}:${n}`, date, sport, title, intensity, durationMin,
      rationale: note || "Planned by your coach.",
      blocks: intensity === "rest" ? [] : parseBlocks(o.blocks) ?? defaultBlocks(intensity, durationMin),
    });
  }
  return sessions;
}

/** New sessions replace anything already stored on the same dates; past dates are dropped. */
export function mergeAiPlan(stored: PlannedSession[], incoming: PlannedSession[], today: string): PlannedSession[] {
  const replaced = new Set(incoming.map((s) => s.date));
  return [...stored.filter((s) => s.date >= today && !replaced.has(s.date)), ...incoming]
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Coach-planned sessions win on their dates; the deterministic week fills the rest. */
export function overlayAiPlan(base: PlannedSession[], ai: PlannedSession[], today: string): PlannedSession[] {
  const live = ai.filter((s) => s.date >= today);
  const covered = new Set(live.map((s) => s.date));
  return [...base.filter((s) => !covered.has(s.date)), ...live].sort((a, b) => a.date.localeCompare(b.date));
}
