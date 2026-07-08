// Single shared "how tiring" ramp — one hue (matches tri-pink), light→dark by magnitude.
// Reused by the training calendar and the weekly training-stress chart so load is
// always the same color everywhere in the dashboard.
const HUE = 336;
const MIN_SAT = 22;
const MAX_SAT = 92;
const MIN_LIGHT = 15;
const MAX_LIGHT = 66;

export function intensityColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const sat = MIN_SAT + (MAX_SAT - MIN_SAT) * clamped;
  const light = MIN_LIGHT + (MAX_LIGHT - MIN_LIGHT) * clamped;
  return `hsl(${HUE}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}

// Reference points for estimateActivityLoad()'s units (a TSS-like proxy).
export const DAILY_LOAD_CAP = 200;
export const WEEKLY_LOAD_CAP = 700;
export const WEEKLY_LOAD_TARGET_MIN = 300;
export const WEEKLY_LOAD_TARGET_MAX = 500;
