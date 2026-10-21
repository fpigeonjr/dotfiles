/**
 * usai — registers USAi as a custom provider in Pi.
 *
 * Auth: set USAI_API_KEY in ~/.config/zsh/local.zsh
 * Alias: GSAI_API_KEY also works
 * Base URL: https://api.gsa.usai.gov/api/v1
 *
 * The API is OpenAI Chat Completions-compatible but uses /api/v1 paths.
 * On startup, if a key is present and Pi is online, the extension fetches
 * /models and registers the current chat-capable model list. If discovery
 * fails, it falls back to the last verified live USAi lineup.
 */

import {
  type Api,
  type AssistantMessageEventStream,
  type Context,
  type FetchFunction,
  type Model,
  type SimpleStreamOptions,
  streamSimpleOpenAICompletions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type RemoteModel = {
  id: string;
  created?: number;
  object?: string;
  owned_by?: string;
};

type ModelsResponse = {
  data?: RemoteModel[];
};

const PROVIDER = "usai";
const PROVIDER_NAME = "USAi";
const BASE_URL = "https://api.gsa.usai.gov/api/v1";
const PRIMARY_API_KEY_ENV = "USAI_API_KEY";
const API_KEY_ALIASES = [PRIMARY_API_KEY_ENV, "GSAI_API_KEY"] as const;

type ModelCost = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

type ModelMetadata = {
  contextWindow: number;
  maxTokens: number;
  cost?: Partial<ModelCost>;
};

const ZERO_COST: ModelCost = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// Metadata from GSA-TTS/agentic-coding-patterns' harness-neutral USAi catalog.
// Availability still comes from live /models: this table only enriches known IDs.
// New live models intentionally use conservative inferred defaults until the GSA
// catalog publishes limits and pricing for them.
const MODEL_METADATA: Record<string, ModelMetadata> = {
  claude_4_5_haiku: {
    contextWindow: 200_000,
    maxTokens: 64_000,
    cost: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  },
  claude_4_5_sonnet: {
    contextWindow: 200_000,
    maxTokens: 64_000,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  },
  claude_4_6_sonnet: {
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    cost: { input: 3.3, output: 16.5, cacheRead: 0.33, cacheWrite: 4.125 },
  },
  claude_4_7_opus: {
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  },
  claude_4_8_opus: {
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  },
  "claude-opus-5": {
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  },
  "claude-sonnet-5": {
    contextWindow: 1_000_000,
    maxTokens: 128_000,
    cost: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  gpt_5_2_default_v2: {
    contextWindow: 400_000,
    maxTokens: 128_000,
    cost: { input: 1.75, output: 14, cacheRead: 0.125 },
  },
  gpt_5_4_default_v2: {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 2.5, output: 15, cacheRead: 0.25 },
  },
  gpt_5_5_default_v2: {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 5, output: 30, cacheRead: 0.5 },
  },
  "gpt-5.6-luna": {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25 },
  },
  "gpt-5.6-terra": {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  "gpt-5.6-sol-latest-guardrails-defaultv2": {
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    cost: { input: 4, output: 20, cacheRead: 0.5, cacheWrite: 6.25 },
  },
  "gemini-2.5-flash": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 0.3, output: 2.5, cacheRead: 0.03 },
  },
  "gemini-2.5-flash-lite": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 0.1, output: 0.4, cacheRead: 0.01 },
  },
  "gemini-2.5-pro": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 1.25, output: 10, cacheRead: 0.125 },
  },
  "gemini-3-7-flash": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 0.75, output: 3.75, cacheRead: 0.075 },
  },
  "gemini-3.5-flash": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 1.5, output: 9, cacheRead: 0.15 },
  },
  "gemini-3.8-flash": {
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    cost: { input: 0.75, output: 3.75, cacheRead: 0.075 },
  },
  llama_4_maverick: {
    contextWindow: 1_000_000,
    maxTokens: 8_192,
    cost: { input: 0.24, output: 0.97 },
  },
};

const COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  supportsStrictMode: false,
  // USAi's OpenAPI marks max_tokens deprecated and accepts this replacement.
  maxTokensField: "max_completion_tokens" as const,
};

// Conservative fallback for this environment until /models can be queried.
// Trust live /models over fallback: availability is tenant/key specific.
const FALLBACK_MODELS: RemoteModel[] = [
  { id: "claude_4_5_haiku", owned_by: "Anthropic" },
  { id: "claude_4_5_sonnet", owned_by: "Anthropic" },
  { id: "claude_4_6_sonnet", owned_by: "Anthropic" },
  { id: "claude_4_7_opus", owned_by: "Anthropic" },
  { id: "claude_4_8_opus", owned_by: "Anthropic" },
  { id: "claude-opus-5", owned_by: "Anthropic" },
  { id: "claude-sonnet-5", owned_by: "Anthropic" },
  { id: "claude-sonnet-5.5", owned_by: "Anthropic" },
  { id: "gemini-2.5-flash", owned_by: "Google" },
  { id: "gemini-2.5-flash-lite", owned_by: "Google" },
  { id: "gemini-3-7-flash", owned_by: "Google" },
  { id: "gemini-3.5-flash", owned_by: "Google" },
  { id: "gemini-3.8-flash", owned_by: "Google" },
  { id: "gpt_5_2_default_v2", owned_by: "OpenAI" },
  { id: "gpt_5_4_default_v2", owned_by: "OpenAI" },
  { id: "gpt_5_5_default_v2", owned_by: "OpenAI" },
  { id: "gpt-5.6-luna", owned_by: "OpenAI" },
  { id: "gpt-5.6-terra", owned_by: "OpenAI" },
  { id: "gpt-5.6-sol-latest-guardrails-defaultv2", owned_by: "OpenAI" },
  { id: "gpt-6-astra", owned_by: "OpenAI" },
  { id: "llama_4_maverick", owned_by: "Meta" },
];

function resolveApiKey(): string | undefined {
  for (const envName of API_KEY_ALIASES) {
    const value = process.env[envName]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isOffline(): boolean {
  const value = process.env.PI_OFFLINE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function isEmbeddingModel(model: RemoteModel): boolean {
  const id = model.id.toLowerCase();
  const owner = model.owned_by?.toLowerCase() ?? "";
  return (
    id.includes("embed") ||
    id.includes("embedding") ||
    owner.includes("cohere") ||
    id.includes("cohere")
  );
}

function dedupeModels(models: RemoteModel[]): RemoteModel[] {
  const seen = new Set<string>();
  const deduped: RemoteModel[] = [];

  for (const model of models) {
    if (!model.id || seen.has(model.id)) continue;
    seen.add(model.id);
    deduped.push(model);
  }

  return deduped;
}

function inferInput(id: string): Array<"text" | "image"> {
  const lower = id.toLowerCase();

  // Verified against the live USAi gateway (64x64 PNG): Claude Sonnet 5/4.6/4.5,
  // Haiku 4.5, Opus 5/4.8/4.7, Llama 4 Maverick, GPT 5.x and Gemini all answer
  // image prompts correctly. The earlier text-only flags were a false negative:
  // USAi rejects very small images (1x1) for *every* model with
  // "Could not process image", which is a gateway size check, not a capability.
  if (
    lower.includes("gemini") ||
    lower.includes("sonnet") ||
    lower.includes("haiku") ||
    lower.includes("llama") ||
    lower.includes("opus") ||
    lower.includes("gpt") ||
    lower.includes("grok")
  ) {
    return ["text", "image"];
  }

  return ["text"];
}

function inferMetadata(id: string, owner: string | undefined): ModelMetadata {
  const lower = id.toLowerCase();
  const known = MODEL_METADATA[lower];
  if (known) return known;

  const vendor = owner?.toLowerCase() ?? "";
  if (lower.includes("gemini") || vendor.includes("google")) {
    return { contextWindow: 1_048_576, maxTokens: 65_536 };
  }
  if (
    lower.includes("claude-sonnet-5") ||
    lower.includes("claude-opus-5") ||
    lower.includes("claude_4_8") ||
    lower.includes("claude_4_7") ||
    lower.includes("claude_4_6")
  ) {
    return { contextWindow: 1_000_000, maxTokens: 128_000 };
  }
  if (lower.includes("claude") || vendor.includes("anthropic")) {
    return { contextWindow: 200_000, maxTokens: 64_000 };
  }
  if (lower.includes("gpt_5_2") || lower.includes("gpt-5.2")) {
    return { contextWindow: 400_000, maxTokens: 128_000 };
  }
  if (
    lower.includes("gpt_5_4") ||
    lower.includes("gpt_5_5") ||
    lower.includes("gpt-5")
  ) {
    return { contextWindow: 1_050_000, maxTokens: 128_000 };
  }
  if (lower.includes("grok")) {
    return { contextWindow: 256_000, maxTokens: 32_768 };
  }
  if (lower.includes("gpt")) {
    return { contextWindow: 128_000, maxTokens: 16_384 };
  }
  if (lower.includes("llama")) {
    return { contextWindow: 128_000, maxTokens: 16_384 };
  }
  return { contextWindow: 128_000, maxTokens: 16_384 };
}

const KNOWN_MODEL_NAMES: Record<string, string> = {
  "claude-haiku-4.5": "Claude Haiku 4.5 (USAi)",
  "claude-opus-4.5": "Claude Opus 4.5 (USAi)",
  "claude-opus-4.7": "Claude Opus 4.7 (USAi)",
  "claude-opus-4.8": "Claude Opus 4.8 (USAi)",
  "claude-opus-5": "Claude Opus 5 (USAi)",
  "claude-sonnet-4.5": "Claude Sonnet 4.5 (USAi)",
  "claude-sonnet-4.6": "Claude Sonnet 4.6 (USAi)",
  "claude-sonnet-5": "Claude Sonnet 5 (USAi)",
  "claude-sonnet-5.5": "Claude Sonnet 5.5 (USAi)",
  "gemini-2.5-flash": "Gemini 2.5 Flash (USAi)",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (USAi)",
  "gemini-2.5-pro": "Gemini 2.5 Pro (USAi)",
  "gemini-3-7-flash": "Gemini 3.7 Flash (USAi)",
  "gemini-3.5-flash": "Gemini 3.5 Flash (USAi)",
  "gemini-3.8-flash": "Gemini 3.8 Flash (USAi)",
  gpt_5_2_default_v2: "GPT 5.2 (USAi)",
  gpt_5_4_default_v2: "GPT 5.4 (USAi)",
  gpt_5_5_default_v2: "GPT 5.5 (USAi)",
  "gpt-5.6-luna": "GPT 5.6 Luna (USAi)",
  "gpt-5.6-terra": "GPT 5.6 Terra (USAi)",
  "gpt-5.6-sol-latest-guardrails-defaultv2": "GPT 5.6 Sol (USAi)",
  "gpt-6-astra": "GPT 6 Astra (USAi)",
  llama_4_maverick: "Llama 4 Maverick (USAi)",

  // Legacy aliases retained for old sessions and offline fallbacks.
  claude_4_8_opus: "Claude Opus 4.8 (USAi)",
  claude_4_7_opus: "Claude Opus 4.7 (USAi)",
  claude_4_5_opus: "Claude Opus 4.5 (USAi)",
  claude_4_6_sonnet: "Claude Sonnet 4.6 (USAi)",
  claude_4_5_sonnet: "Claude Sonnet 4.5 (USAi)",
  claude_4_5_haiku: "Claude Haiku 4.5 (USAi)",
  "gpt-5.5-latest-guardrails-defaultv2": "GPT 5.5 (USAi)",
  "gpt-5.4-latest-guardrails-defaultv2": "GPT 5.4 (USAi)",
  "gpt-5.2-latest-guardrails-defaultv2": "GPT 5.2 (USAi)",
  "grok-4": "Grok 4 (USAi)",
};

function prettyName(id: string, owner: string | undefined): string {
  const lower = id.toLowerCase();
  const knownName = KNOWN_MODEL_NAMES[lower];
  if (knownName) return knownName;

  const label = id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bLlama(\d)/g, "Llama $1")
    .replace(/\bOpenai\b/g, "OpenAI")
    .replace(/\bXaI\b/g, "xAI");

  const suffix = owner ? ` (${owner})` : "";
  return `${label}${suffix} [USAi]`;
}

export function toPiModel(model: RemoteModel) {
  const metadata = inferMetadata(model.id, model.owned_by);
  const cost: ModelCost = { ...ZERO_COST, ...metadata.cost };

  return {
    id: model.id,
    name: prettyName(model.id, model.owned_by),
    reasoning: false,
    input: inferInput(model.id),
    cost,
    contextWindow: metadata.contextWindow,
    maxTokens: metadata.maxTokens,
    compat: COMPAT,
  };
}

export async function fetchUsaiWithCorrection(
  input: RequestInfo | URL,
  init?: RequestInit,
  baseFetch: FetchFunction = globalThis.fetch,
): Promise<Response> {
  const response = await baseFetch(input, init);

  // USAi gateway bug workaround: when under high load or rate limit, USAi
  // sometimes returns HTTP 200 with content-type: text/event-stream, but the body
  // is raw JSON {"error": ...} or empty rather than valid SSE data: events.
  // This causes the SSE parser to yield 0 chunks and fail with
  // "Stream ended without finish_reason".
  // Intercept and convert to appropriate HTTP error status (e.g. 429 / 502).
  const contentType = response.headers.get("content-type") ?? "";
  if (
    response.ok &&
    contentType.includes("text/event-stream") &&
    response.body
  ) {
    const reader = response.body.getReader();
    const { value, done } = await reader.read();

    if (done || !value) {
      return new Response(
        JSON.stringify({
          error: {
            message: "USAi gateway closed stream without sending any events",
            type: "gateway_error",
          },
        }),
        {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "content-type": "application/json" },
        },
      );
    }

    const text = new TextDecoder().decode(value);
    const trimmed = text.trimStart();

    if (trimmed.startsWith("{")) {
      let fullText = text;
      while (fullText.length < 65536) {
        const { value: nextValue, done: nextDone } = await reader.read();
        if (nextDone) break;
        fullText += new TextDecoder().decode(nextValue);
      }

      try {
        const data = JSON.parse(fullText);
        if (data && typeof data === "object" && "error" in data) {
          const err = (data as { error?: { message?: string; type?: string } })
            .error;
          const isRateLimit =
            err?.type === "rate_limit" ||
            /rate[- ]limit|high volume|too many requests/i.test(
              err?.message ?? "",
            );
          const status = isRateLimit ? 429 : 502;
          return new Response(fullText, {
            status,
            statusText: isRateLimit ? "Too Many Requests" : "Bad Gateway",
            headers: {
              "content-type": "application/json",
              ...(isRateLimit ? { "retry-after": "5" } : {}),
            },
          });
        }
      } catch {
        // Fall through if not valid JSON
      }
    }

    // Normal valid SSE stream: reconstruct ReadableStream with the peeked first chunk
    const reconstructed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(value);
      },
      async pull(controller) {
        const { value: next, done: isDone } = await reader.read();
        if (isDone) {
          controller.close();
        } else {
          controller.enqueue(next);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });

    return new Response(reconstructed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
}

function streamUsai(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const baseFetch = options?.fetch ?? globalThis.fetch;
  const wrappedFetch: FetchFunction = (input, init) =>
    fetchUsaiWithCorrection(input, init, baseFetch);

  return streamSimpleOpenAICompletions(
    model as Model<"openai-completions">,
    context,
    {
      ...options,
      fetch: wrappedFetch,
      onPayload: options?.onPayload,
    },
  );
}

async function fetchRemoteModels(apiKey: string): Promise<RemoteModel[]> {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as ModelsResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

export default async function (pi: ExtensionAPI) {
  const resolvedApiKey = resolveApiKey();
  let discoveredModels: RemoteModel[] = [];

  if (resolvedApiKey && !isOffline()) {
    try {
      discoveredModels = await fetchRemoteModels(resolvedApiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[${PROVIDER}] failed to fetch ${BASE_URL}/models: ${message}; using fallback models`,
      );
    }
  }

  // Model availability is tenant/key specific. If /models succeeds, trust it.
  // Only fall back when discovery is unavailable.
  const sourceModels =
    discoveredModels.length > 0 ? discoveredModels : FALLBACK_MODELS;
  const chatModels = dedupeModels(
    sourceModels.filter((model) => !isEmbeddingModel(model)),
  );

  pi.registerProvider(PROVIDER, {
    name: PROVIDER_NAME,
    baseUrl: BASE_URL,
    apiKey: resolvedApiKey ?? PRIMARY_API_KEY_ENV,
    api: "openai-completions",
    authHeader: true,
    models: chatModels.map(toPiModel),
    streamSimple: streamUsai,
  });
}
