/**
 * gsai — registers GSA AI / USAi as a custom provider in Pi.
 *
 * Auth: set GSAI_API_KEY in ~/.config/zsh/local.zsh
 * Alias: USAI_API_KEY also works
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

const PROVIDER = "gsai";
const PROVIDER_NAME = "USAi";
const BASE_URL = "https://api.gsa.usai.gov/api/v1";
const PRIMARY_API_KEY_ENV = "GSAI_API_KEY";
const API_KEY_ALIASES = [PRIMARY_API_KEY_ENV, "USAI_API_KEY"] as const;

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  supportsStrictMode: false,
  maxTokensField: "max_tokens" as const,
};

// Conservative fallback for this environment until /models can be queried.
// Trust live /models over fallback: availability is tenant/key specific.
const FALLBACK_MODELS: RemoteModel[] = [
  { id: "claude-haiku-4.5", owned_by: "Anthropic" },
  { id: "claude-opus-4.5", owned_by: "Anthropic" },
  { id: "claude-opus-4.7", owned_by: "Anthropic" },
  { id: "claude-opus-4.8", owned_by: "Anthropic" },
  { id: "claude-opus-5", owned_by: "Anthropic" },
  { id: "claude-sonnet-4.5", owned_by: "Anthropic" },
  { id: "claude-sonnet-4.6", owned_by: "Anthropic" },
  { id: "claude-sonnet-5", owned_by: "Anthropic" },
  { id: "gemini-2.5-flash", owned_by: "Google" },
  { id: "gemini-2.5-flash-lite", owned_by: "Google" },
  { id: "gemini-2.5-pro", owned_by: "Google" },
  { id: "gemini-3-7-flash", owned_by: "Google" },
  { id: "gemini-3.5-flash", owned_by: "Google" },
  { id: "gpt_5_2_default_v2", owned_by: "OpenAI" },
  { id: "gpt_5_4_default_v2", owned_by: "OpenAI" },
  { id: "gpt_5_5_default_v2", owned_by: "OpenAI" },
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
  return id.includes("embed") || id.includes("embedding") || owner.includes("cohere") || id.includes("cohere");
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

function inferContextWindow(id: string, owner: string | undefined): number {
  const lower = id.toLowerCase();
  const vendor = owner?.toLowerCase() ?? "";

  if (lower === "gemini-3.5-flash") return 200_000;
  if (lower.includes("gemini") || vendor.includes("google")) return 1_048_576;
  // Claude 4.6+ and Claude 5 have 1M context; earlier Claude models are 200K.
  if (
    lower.includes("claude-sonnet-5") ||
    lower.includes("claude-opus-5") ||
    lower.includes("claude-opus-4.8") ||
    lower.includes("claude-opus-4.7") ||
    lower.includes("claude-sonnet-4.6") ||
    lower.includes("claude_4_8") ||
    lower.includes("claude_4_7") ||
    lower.includes("claude_4_6")
  ) {
    return 1_000_000;
  }
  if (lower.includes("claude") || vendor.includes("anthropic")) return 200_000;
  if (lower.includes("gpt_5_2") || lower.includes("gpt-5.2")) return 400_000;
  if (lower.includes("gpt_5_4") || lower.includes("gpt_5_5") || lower.includes("gpt-5")) return 1_050_000;
  if (lower.includes("grok")) return 256_000;
  if (lower.includes("gpt") || lower.includes("llama")) return 128_000;
  return 128_000;
}

function inferMaxTokens(id: string, owner: string | undefined): number {
  const lower = id.toLowerCase();
  const vendor = owner?.toLowerCase() ?? "";

  if (lower.includes("gemini") || vendor.includes("google")) return 64_000;
  if (lower.includes("claude-sonnet-5")) return 128_000;
  if (
    lower.includes("claude-opus-5") ||
    lower.includes("claude-opus-4.8") ||
    lower.includes("claude-haiku-4.5") ||
    lower === "claude_4_8_opus" ||
    lower === "claude_4_5_haiku"
  ) {
    return 64_000;
  }
  if (
    lower.includes("claude-opus-4.7") ||
    lower.includes("claude-opus-4.5") ||
    lower.includes("claude-sonnet-4.6") ||
    lower.includes("claude-sonnet-4.5") ||
    lower === "claude_4_7_opus" ||
    lower === "claude_4_5_opus" ||
    lower === "claude_4_6_sonnet" ||
    lower === "claude_4_5_sonnet"
  ) {
    return 32_000;
  }
  if (lower.includes("claude") || vendor.includes("anthropic")) return 16_384;
  if (lower.includes("gpt_5") || lower.includes("gpt-5")) return 128_000;
  if (lower.includes("grok")) return 32_768;
  if (lower.includes("gpt")) return 16_384;
  if (lower.includes("llama")) return 16_384;
  return 16_384;
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
  "gemini-2.5-flash": "Gemini 2.5 Flash (USAi)",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (USAi)",
  "gemini-2.5-pro": "Gemini 2.5 Pro (USAi)",
  "gemini-3-7-flash": "Gemini 3.7 Flash (USAi)",
  "gemini-3.5-flash": "Gemini 3.5 Flash (USAi)",
  "gpt_5_2_default_v2": "GPT 5.2 (USAi)",
  "gpt_5_4_default_v2": "GPT 5.4 (USAi)",
  "gpt_5_5_default_v2": "GPT 5.5 (USAi)",
  "llama_4_maverick": "Llama 4 Maverick (USAi)",

  // Legacy aliases retained for old sessions and offline fallbacks.
  "claude_4_8_opus": "Claude Opus 4.8 (USAi)",
  "claude_4_7_opus": "Claude Opus 4.7 (USAi)",
  "claude_4_5_opus": "Claude Opus 4.5 (USAi)",
  "claude_4_6_sonnet": "Claude Sonnet 4.6 (USAi)",
  "claude_4_5_sonnet": "Claude Sonnet 4.5 (USAi)",
  "claude_4_5_haiku": "Claude Haiku 4.5 (USAi)",
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

function toPiModel(model: RemoteModel) {
  return {
    id: model.id,
    name: prettyName(model.id, model.owned_by),
    reasoning: false,
    input: inferInput(model.id),
    cost: ZERO_COST,
    contextWindow: inferContextWindow(model.id, model.owned_by),
    maxTokens: inferMaxTokens(model.id, model.owned_by),
    compat: COMPAT,
  };
}

function isOpenAIModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.startsWith("gpt-") || lower.startsWith("gpt_");
}

function normalizeGsaiPayload(payload: unknown, model: Model<Api>): unknown {
  if (!payload || typeof payload !== "object") return payload;
  if (!isOpenAIModelId(model.id)) return payload;

  const next = { ...(payload as Record<string, unknown>) };

  // USAi's OpenAI-backed chat endpoint appears to reject explicit output-token
  // limits for GPT 5.x while other provider families work fine. The field is
  // optional in the public docs, so omit it for GSAI GPT models and let the
  // backend choose its default instead.
  delete next.max_tokens;
  delete next.max_completion_tokens;

  return next;
}

function streamGsai(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  return streamSimpleOpenAICompletions(model as Model<"openai-completions">, context, {
    ...options,
    onPayload: async (payload, nextModel) => {
      let nextPayload = normalizeGsaiPayload(payload, nextModel);
      if (options?.onPayload) {
        const overridden = await options.onPayload(nextPayload, nextModel);
        if (overridden !== undefined) nextPayload = overridden;
      }
      return nextPayload;
    },
  });
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
      console.warn(`[${PROVIDER}] failed to fetch ${BASE_URL}/models: ${message}; using fallback models`);
    }
  }

  // Model availability is tenant/key specific. If /models succeeds, trust it.
  // Only fall back when discovery is unavailable.
  const sourceModels = discoveredModels.length > 0 ? discoveredModels : FALLBACK_MODELS;
  const chatModels = dedupeModels(sourceModels.filter((model) => !isEmbeddingModel(model)));

  pi.registerProvider(PROVIDER, {
    name: PROVIDER_NAME,
    baseUrl: BASE_URL,
    apiKey: resolvedApiKey ?? PRIMARY_API_KEY_ENV,
    api: "openai-completions",
    authHeader: true,
    models: chatModels.map(toPiModel),
    streamSimple: streamGsai,
  });
}
