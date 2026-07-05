import type { Race, RaceType } from "../types";

export function getRaceIcon(type: RaceType): string {
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
      return "🏊🚴🏃";
    case "ironman":
      return "🔥🏊🚴🏃";
    default:
      return "⭐";
  }
}

export function raceTypeLabel(type: RaceType): string {
  switch (type) {
    case "running":
      return "Running";
    case "cycling":
      return "Cycling";
    case "swimming":
      return "Swimming";
    case "duathlon":
      return "Duathlon";
    case "triathlon":
      return "Triathlon";
    case "ironman_70_3":
      return "Ironman 70.3";
    case "ironman":
      return "Ironman";
    default:
      return "Custom";
  }
}

export function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const raceDate = new Date(date);
  raceDate.setHours(0, 0, 0, 0);
  const diff = raceDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function sortRacesByDate(races: Race[]): Race[] {
  return [...races].sort((a, b) => a.raceDate.localeCompare(b.raceDate));
}
