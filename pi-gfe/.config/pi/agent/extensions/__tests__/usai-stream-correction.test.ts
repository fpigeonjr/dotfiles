import { describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-ai", () => ({
  streamSimpleOpenAICompletions: vi.fn(),
}));

import { fetchUsaiWithCorrection, resolveBaseUrl, toPiModel } from "../usai.ts";

describe("USAi model metadata", () => {
  it("uses official GSA catalog metadata for known models", () => {
    const gemini = toPiModel({ id: "gemini-3.5-flash", owned_by: "Google" });
    expect(gemini.contextWindow).toBe(1_048_576);
    expect(gemini.maxTokens).toBe(65_536);
    expect(gemini.cost).toMatchObject({
      input: 1.5,
      output: 9,
      cacheRead: 0.15,
    });

    const llama = toPiModel({ id: "llama_4_maverick", owned_by: "Meta" });
    expect(llama.contextWindow).toBe(1_000_000);
    expect(llama.maxTokens).toBe(8_192);
  });

  it("uses conservative inferred metadata for live models newer than the GSA catalog", () => {
    const astra = toPiModel({ id: "gpt-6-astra", owned_by: "OpenAI" });
    expect(astra.contextWindow).toBe(128_000);
    expect(astra.maxTokens).toBe(16_384);
    expect(astra.cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(astra.compat.maxTokensField).toBe("max_completion_tokens");
  });
});

describe("fetchUsaiWithCorrection", () => {
  it("passes normal SSE streams through unchanged", async () => {
    const sseBody =
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n';
    const mockFetch = async () =>
      new Response(sseBody, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });

    const res = await fetchUsaiWithCorrection(
      "https://usai.test/api/v1/chat/completions",
      undefined,
      mockFetch,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toBe(sseBody);
  });

  it("converts HTTP 200 raw-JSON rate limit errors to HTTP 429", async () => {
    const errorJson = JSON.stringify({
      error: {
        message:
          "I'm receiving a high volume of requests right now, so I couldn't complete your request.",
        type: "rate_limit",
      },
    });

    const mockFetch = async () =>
      new Response(errorJson, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });

    const res = await fetchUsaiWithCorrection(
      "https://usai.test/api/v1/chat/completions",
      undefined,
      mockFetch,
    );
    expect(res.status).toBe(429);
    expect(res.statusText).toBe("Too Many Requests");
    expect(res.headers.get("content-type")).toBe("application/json");

    const data = await res.json();
    expect(data.error.type).toBe("rate_limit");
    expect(data.error.message).toContain("high volume of requests");
  });

  it("converts HTTP 200 raw-JSON gateway errors to HTTP 502", async () => {
    const errorJson = JSON.stringify({
      error: {
        message: "Internal model invocation failure",
        type: "server_error",
      },
    });

    const mockFetch = async () =>
      new Response(errorJson, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });

    const res = await fetchUsaiWithCorrection(
      "https://usai.test/api/v1/chat/completions",
      undefined,
      mockFetch,
    );
    expect(res.status).toBe(502);
    expect(res.statusText).toBe("Bad Gateway");
    expect(res.headers.get("content-type")).toBe("application/json");

    const data = await res.json();
    expect(data.error.message).toBe("Internal model invocation failure");
  });

  it("converts empty HTTP 200 SSE streams to HTTP 502", async () => {
    const emptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    const mockFetch = async () =>
      new Response(emptyStream, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });

    const res = await fetchUsaiWithCorrection(
      "https://usai.test/api/v1/chat/completions",
      undefined,
      mockFetch,
    );
    expect(res.status).toBe(502);
    expect(res.statusText).toBe("Bad Gateway");

    const data = await res.json();
    expect(data.error.message).toContain(
      "closed stream without sending any events",
    );
  });

  it("leaves standard JSON responses untouched", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const res = await fetchUsaiWithCorrection(
      "https://usai.test/api/v1/models",
      undefined,
      mockFetch,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});

describe("resolveBaseUrl", () => {
  it("returns undefined when unset, empty, or whitespace", () => {
    expect(resolveBaseUrl({})).toBeUndefined();
    expect(resolveBaseUrl({ USAI_BASE_URL: "" })).toBeUndefined();
    expect(resolveBaseUrl({ USAI_BASE_URL: "   " })).toBeUndefined();
    expect(resolveBaseUrl({ USAI_BASE_URL: "/" })).toBeUndefined();
  });

  it("appends /api/v1 to a bare host", () => {
    expect(resolveBaseUrl({ USAI_BASE_URL: "https://usai.test" })).toBe(
      "https://usai.test/api/v1",
    );
  });

  it("preserves an explicit versioned path", () => {
    expect(resolveBaseUrl({ USAI_BASE_URL: "https://usai.test/api/v1" })).toBe(
      "https://usai.test/api/v1",
    );
    expect(resolveBaseUrl({ USAI_BASE_URL: "https://usai.test/api/v2" })).toBe(
      "https://usai.test/api/v2",
    );
  });

  it("tolerates trailing slashes and surrounding whitespace", () => {
    expect(resolveBaseUrl({ USAI_BASE_URL: "  https://usai.test/api/v1/  " })).toBe(
      "https://usai.test/api/v1",
    );
    expect(resolveBaseUrl({ USAI_BASE_URL: "https://usai.test///" })).toBe(
      "https://usai.test/api/v1",
    );
  });
});
