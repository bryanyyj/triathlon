// @rot/engine — pure rest-or-train decision engine. See docs/02-behaviour-spec.md.

export const ENGINE_VERSION = "0.1.0";

export { recommend } from "./readiness.ts";
export { CONFIG } from "./config.ts";
export {
  computeLoad,
  computeAcwr,
  hrvBaseline,
  ewma,
  mean,
  stdDev,
  clamp,
} from "./trainingLoad.ts";
export type {
  ReadinessInput,
  ReadinessResult,
  Recommendation,
  Confidence,
  SubScores,
  LoadMetrics,
  Likert,
} from "./types.ts";
