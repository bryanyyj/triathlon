import "dotenv/config";

/** Coach configuration from backend/.env (secrets stay server-side). */
export const config = {
  // Sent to OpenRouter as the referring app.
  webOrigin: (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173").split(",")[0]!.trim(),

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseUrl: "https://openrouter.ai/api/v1",
    // Any model from https://openrouter.ai/models. Slugs ending in ":free" are free-tier.
    model: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free",
    // Cost guard: only call $0 models unless explicitly allowed. Keeps spend at zero.
    freeOnly: process.env.OPENROUTER_ALLOW_PAID !== "true",
    // Defensive cap on output tokens (also limits any accidental spend). Reasoning models spend
    // part of this thinking before they write, and a 7-day plan plus its JSON needs room too.
    maxTokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 4000),
    // Hidden reasoning before the reply: "off" (default), "on", or a token cap like "1000".
    // Benchmarked on the coach prompt: Nemotron Ultra took ~42s to its first word with
    // reasoning on and ~2s with it off, with plans of similar quality.
    reasoning: (process.env.OPENROUTER_REASONING ?? "off").trim().toLowerCase(),
  },
};

/** OpenRouter's `reasoning` request field for the configured mode, or undefined to use the model default. */
export function reasoningParam(): { enabled: false } | { max_tokens: number } | undefined {
  const mode = config.openRouter.reasoning;
  if (mode === "off") return { enabled: false };
  const cap = Number(mode);
  return Number.isFinite(cap) && cap > 0 ? { max_tokens: Math.round(cap) } : undefined;
}

export const hasOpenRouter = () => config.openRouter.apiKey.length > 0;
export const isFreeModel = (model = config.openRouter.model) => model.trim().endsWith(":free");

/** Throws if the configured model could incur cost while free-only mode is on. */
export function assertNoCost(): void {
  if (config.openRouter.freeOnly && !isFreeModel()) {
    throw new Error(
      `Cost guard: "${config.openRouter.model}" is not a free model. ` +
        `Use a ":free" model, or set OPENROUTER_ALLOW_PAID=true to allow paid models.`,
    );
  }
}
