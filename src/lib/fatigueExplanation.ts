import type { FatigueReadiness } from "../types";

export type FatigueZone = "tapering" | "optimal" | "caution" | "high-risk";

export const ZONE_META: Record<FatigueZone, { label: string; color: string }> = {
  tapering: { label: "Tapering", color: "#3ab7ff" },
  optimal: { label: "Optimal", color: "#3adf9b" },
  caution: { label: "Caution", color: "#ff9f43" },
  "high-risk": { label: "High Risk", color: "#ff5ca8" },
};

// Acute:Chronic Workload Ratio (last 7 days vs. trailing 4-week average) — a
// standard sports-science proxy for "is my recent load a sudden spike or a
// steady pattern." Bands follow the commonly cited Gabbett thresholds.
export function getAcwr(data: FatigueReadiness): number {
  if (data.chronicLoad <= 0) return data.acuteLoad > 0 ? 2 : 1;
  return data.acuteLoad / data.chronicLoad;
}

export function classifyAcwr(acwr: number): FatigueZone {
  if (acwr < 0.8) return "tapering";
  if (acwr <= 1.3) return "optimal";
  if (acwr <= 1.5) return "caution";
  return "high-risk";
}

export function buildFatigueExplanation(data: FatigueReadiness): { zone: FatigueZone; headline: string; detail: string } {
  const acwr = getAcwr(data);
  const zone = classifyAcwr(acwr);
  const pctChange = data.chronicLoad > 0 ? Math.round((data.acuteLoad / data.chronicLoad - 1) * 100) : null;

  const headline =
    zone === "tapering"
      ? `You've trained ${pctChange != null ? `${Math.abs(pctChange)}% less` : "much less"} than your last 4 weeks' average — fitness stimulus is easing off, but so is injury risk.`
      : zone === "optimal"
        ? "This week's load is well matched to your last 4 weeks — a sustainable, balanced pattern."
        : zone === "caution"
          ? `This week's load is running ${pctChange}% above your last 4 weeks' average — a ramp worth keeping an eye on.`
          : `This week's load has spiked ${pctChange}% above your last 4 weeks' average — sharp jumps like this are linked to higher injury and overtraining risk.`;

  const detail = `Last 7 days: ${Math.round(data.acuteLoad)} load · 4-week average: ${Math.round(data.chronicLoad)} load/week · ratio ${acwr.toFixed(2)}`;

  return { zone, headline, detail };
}
