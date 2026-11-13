import OpenAI from "openai";
import { config, assertNoCost, reasoningParam } from "./config.ts";

/** OpenAI-compatible client pointed at OpenRouter. */
export function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: config.openRouter.apiKey,
    baseURL: config.openRouter.baseUrl,
    defaultHeaders: {
      "HTTP-Referer": config.webOrigin,
      "X-Title": "ReadyOrRest",
    },
  });
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Free models sometimes sit in a provider queue; give up if nothing arrives for this long.
const STALL_MS = 90_000;

/** Stream a completion, yielding text deltas. Throws on API error or a stalled stream. */
export async function* streamChat(messages: LlmMessage[]): AsyncGenerator<string> {
  assertNoCost();
  const client = makeClient();
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), STALL_MS);
  // Any chunk (reasoning included) proves the model is alive, so it resets the clock.
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), STALL_MS);
  };
  try {
    const stream = await client.chat.completions.create(
      {
        model: config.openRouter.model,
        messages,
        stream: true,
        temperature: 0.4,
        max_tokens: config.openRouter.maxTokens,
        // OpenRouter extension (not in the OpenAI types): controls hidden reasoning.
        ...(reasoningParam() ? { reasoning: reasoningParam() } : {}),
      } as OpenAI.ChatCompletionCreateParamsStreaming,
      { signal: controller.signal },
    );
    for await (const chunk of stream) {
      alive();
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`The model didn't respond for ${STALL_MS / 1000}s (the free tier may be busy). Please try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Non-streaming completion (used for the weekly plan). */
export async function completeChat(messages: LlmMessage[]): Promise<string> {
  assertNoCost();
  const client = makeClient();
  const res = await client.chat.completions.create({
    model: config.openRouter.model,
    messages,
    temperature: 0.4,
    max_tokens: config.openRouter.maxTokens,
    ...(reasoningParam() ? { reasoning: reasoningParam() } : {}),
  } as OpenAI.ChatCompletionCreateParamsNonStreaming);
  return res.choices[0]?.message?.content ?? "";
}
