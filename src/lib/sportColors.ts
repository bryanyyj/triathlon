// Single source of truth for sport identity colors — reused by every chart/calendar
// in the dashboard so a sport always reads as the same color everywhere.
export const SPORT_COLORS = {
  swim: "#3ab7ff",
  bike: "#3adf9b",
  run: "#ff9f43",
} as const;

export const SPORT_ICONS = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
} as const;

export const SPORT_LABELS = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
} as const;

export const MULTI_SPORT_COLOR = "#a78bfa";
export const REST_COLOR = "#2a2a35";
