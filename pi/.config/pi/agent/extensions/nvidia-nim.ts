/**
 * nvidia-nim — registers NVIDIA NIM as a custom provider in Pi.
 *
 * Auth: set NVIDIA_NIM_API_KEY in ~/.config/zsh/local.zsh
 * Base URL: https://integrate.api.nvidia.com/v1
 *
 * All models use openai-completions with standard NIM compat flags.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const COMPAT = {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  maxTokensField: "max_tokens" as const,
};

export default function (pi: ExtensionAPI) {
  pi.registerProvider("nvidia-nim", {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: "NVIDIA_NIM_API_KEY",
    api: "openai-completions",
    authHeader: true,
    models: [
      {
        id: "meta/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 128000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "meta/llama-4-maverick-17b-128e-instruct",
        name: "Llama 4 Maverick 17Bx128E (NIM)",
        reasoning: false,
        input: ["text", "image"],
        contextWindow: 1000000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "nvidia/llama-3.3-nemotron-super-49b-v1",
        name: "Nemotron Super 49B (NIM)",
        reasoning: true,
        input: ["text"],
        contextWindow: 128000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "moonshotai/kimi-k2-instruct",
        name: "Kimi K2 Instruct (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "moonshotai/kimi-k2-thinking",
        name: "Kimi K2 Thinking (NIM)",
        reasoning: true,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "moonshotai/kimi-k2.5",
        name: "Kimi K2.5 (NIM) ⚠️ stalls",
        reasoning: true,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "mistralai/devstral-2-123b-instruct-2512",
        name: "Devstral 2 123B (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "mistralai/mistral-large-3-675b-instruct-2512",
        name: "Mistral Large 3 675B (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "qwen/qwen3-coder-480b-a35b-instruct",
        name: "Qwen3 Coder 480B (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 262144,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "qwen/qwen3.5-122b-a10b",
        name: "Qwen3.5 122B A10B (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "qwen/qwen3.5-397b-a17b",
        name: "Qwen3.5 397B A17B (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 131072,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "deepseek-ai/deepseek-v3.1-terminus",
        name: "DeepSeek V3.1 Terminus (NIM)",
        reasoning: false,
        input: ["text"],
        contextWindow: 128000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "deepseek-ai/deepseek-v4-flash",
        name: "DeepSeek V4 Flash (NIM) ⚠️",
        reasoning: false,
        input: ["text"],
        contextWindow: 1000000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
      {
        id: "deepseek-ai/deepseek-v4-pro",
        name: "DeepSeek V4 Pro (NIM) ⚠️",
        reasoning: false,
        input: ["text"],
        contextWindow: 1000000,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: COMPAT,
      },
    ],
  });
}
