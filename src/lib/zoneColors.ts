import type { ZoneSeconds } from "../types";

// Validated 6-step HR zone ramp (see dataviz skill palette check) — single source
// of truth so the per-sport donuts and the cross-sport comparison bar match exactly.
export const ZONE_DEFS: { key: keyof ZoneSeconds; label: string; color: string }[] = [
  { key: "z1RecoverySec", label: "Z1 Recovery", color: "#5d6fae" },
  { key: "z2EnduranceSec", label: "Z2 Endurance", color: "#4a90d9" },
  { key: "z3TempoSec", label: "Z3 Tempo", color: "#2ea86e" },
  { key: "z4ThresholdSec", label: "Z4 Threshold", color: "#b8860a" },
  { key: "z5Vo2maxSec", label: "Z5 VO2max", color: "#c2611a" },
  { key: "z6AnaerobicSec", label: "Z6 Anaerobic", color: "#c94444" },
];
