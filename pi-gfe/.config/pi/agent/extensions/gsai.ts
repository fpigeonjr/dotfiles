/**
 * gsai — registers GSA AI / USAi as a custom provider in Pi.
 *
 * Auth: set GSAI_API_KEY in ~/.config/zsh/local.zsh
 * Alias: USAI_API_KEY also works
 * Base URL: https://api.prod.gsai.mcaas.fcs.gsa.gov/api/v1
 *
 * The API is OpenAI Chat Completions-compatible but uses /api/v1 paths.
 * On startup, if a key is present and Pi is online, the extension fetches
 * /models and registers the current chat-capable model list. If discovery
 * fails, it falls back to the documented public model lineup.
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
// Trust live /models over docs: availability is tenant/key specific.
const FALLBACK_MODELS: RemoteModel[] = [
  { id: "claude_4_8_opus", owned_by: "Anthropic" },
  { id: "claude_4_7_opus", owned_by: "Anthropic" },
  { id: "claude_4_6_sonnet", owned_by: "Anthropic" },
  { id: "claude_4_5_sonnet", owned_by: "Anthropic" },
  { id: "claude_4_5_haiku", owned_by: "Anthropic" },
  { id: "claude_3_5_haiku", owned_by: "Anthropic" },
  { id: "llama_4_maverick", owned_by: "Meta" },
  { id: "gemini-2.5-flash", owned_by: "Google" },
  { id: "gemini-2.5-flash-lite", owned_by: "Google" },
  { id: "gemini-2.5-pro", owned_by: "Google" },
  { id: "gpt-5.5-latest-guardrails-defaultv2", owned_by: "Open AI" },
  { id: "gpt-5.4-latest-guardrails-defaultv2", owned_by: "Open AI" },
  { id: "gpt-5.2-latest-guardrails-defaultv2", owned_by: "Open AI" },
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

  if (lower.includes("llama")) {
    return ["text"];
  }

  // GSA AI Sonnet doesn't support vision; Haiku untested but likely also text-only
  if (lower.includes("sonnet") || lower.includes("haiku")) {
    return ["text"];
  }

  if (
    lower.includes("gemini") ||
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

  if (lower.includes("gemini") || vendor.includes("google")) return 1_048_576;
  // Claude 4.6+ has 1M context; earlier versions 200K
  if (lower.includes("claude_4_6") || lower.includes("claude_4_7") || lower.includes("claude_4_8")) return 1_000_000;
  if (lower.includes("claude") || vendor.includes("anthropic")) return 200_000;
  if (lower.includes("gpt-5")) return 1_050_000; // GPT-5.x have 1M+ context
  if (lower.includes("grok")) return 256_000; // Grok 4
  if (lower.includes("gpt") || lower.includes("llama")) return 128_000;
  return 128_000;
}

function inferMaxTokens(id: string, owner: string | undefined): number {
  const lower = id.toLowerCase();
  const vendor = owner?.toLowerCase() ?? "";

  if (lower.includes("gemini") || vendor.includes("google")) return 65_536;
  // Claude 4.6+ has 64K-128K output; Opus models support 128K
  if (lower.includes("claude_4_7") || lower.includes("claude_4_8")) return 128_000;
  if (lower.includes("claude_4_6")) return 64_000;
  if (lower.includes("claude_4_5")) return 64_000;
  if (lower.includes("claude") || vendor.includes("anthropic")) return 16_384;
  if (lower.includes("gpt-5")) return 128_000; // GPT-5.x support 128K output
  if (lower.includes("grok")) return 32_768; // Grok 4
  if (lower.includes("gpt")) return 16_384;
  if (lower.includes("llama")) return 16_384;
  return 16_384;
}

function prettyName(id: string, owner: string | undefined): string {
  const lower = id.toLowerCase();

  if (lower === "claude_4_8_opus") return "Claude Opus 4.8 (USAi)";
  if (lower === "claude_4_7_opus") return "Claude Opus 4.7 (USAi)";
  if (lower === "claude_4_5_opus") return "Claude Opus 4.5 (USAi)";
  if (lower === "claude_4_6_sonnet") return "Claude Sonnet 4.6 (USAi)";
  if (lower === "claude_4_5_sonnet") return "Claude Sonnet 4.5 (USAi)";
  if (lower === "claude_4_5_haiku") return "Claude Haiku 4.5 (USAi)";
  if (lower === "claude_3_5_haiku") return "Claude Haiku 3.5 (USAi)";
  if (lower === "gemini-2.5-flash") return "Gemini 2.5 Flash (USAi)";
  if (lower === "gemini-2.5-flash-lite") return "Gemini 2.5 Flash Lite (USAi)";
  if (lower === "gemini-2.5-pro") return "Gemini 2.5 Pro (USAi)";
  if (lower === "llama_4_maverick") return "Llama 4 Maverick (USAi)";
  if (lower === "gpt-5.5-latest-guardrails-defaultv2") return "GPT 5.5 (USAi)";
  if (lower === "gpt-5.4-latest-guardrails-defaultv2") return "GPT 5.4 (USAi)";
  if (lower === "gpt-5.2-latest-guardrails-defaultv2") return "GPT 5.2 (USAi)";
  if (lower === "grok-4") return "Grok 4 (USAi)";

  const label = id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bLlama(\d)/g, "Llama $1")
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
  return id.toLowerCase().startsWith("gpt-");
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
