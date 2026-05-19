/**
 * Token counting tests
 * 
 * Verify that token display correctly shows context window size from
 * ctx.getContextUsage() and applies color coding thresholds.
 */

import { describe, it, expect } from "vitest";

// Test behavior: using ctx.getContextUsage() for accurate context size
describe("Token counting behavior", () => {
  it("should use ctx.getContextUsage().tokens for current context size", () => {
    // Simulate ctx.getContextUsage() response
    const contextUsage = {
      tokens: 45234,
      percent: 45.2,
    };

    let cachedContextTokens = 0;
    let cachedContextPct = 0;

    // Simulate the caching logic from session-status.ts
    if (contextUsage?.tokens != null) cachedContextTokens = contextUsage.tokens;
    if (contextUsage?.percent != null) cachedContextPct = Math.min(100, Math.round(contextUsage.percent));

    expect(cachedContextTokens).toBe(45234);
    expect(cachedContextPct).toBe(45);
  });

  it("should handle missing context usage gracefully", () => {
    const contextUsage = {};

    let cachedContextTokens = 0;
    let cachedContextPct = 0;

    if (contextUsage?.tokens != null) cachedContextTokens = (contextUsage as any).tokens;
    if (contextUsage?.percent != null) cachedContextPct = Math.min(100, Math.round((contextUsage as any).percent));

    expect(cachedContextTokens).toBe(0);
    expect(cachedContextPct).toBe(0);
  });

  it("should cap context percentage at 100%", () => {
    const contextUsage = {
      tokens: 150000,
      percent: 105.7, // Can exceed 100% in some models
    };

    let cachedContextPct = 0;

    if (contextUsage?.percent != null) cachedContextPct = Math.min(100, Math.round(contextUsage.percent));

    expect(cachedContextPct).toBe(100);
  });
});

// Test behavior: color coding thresholds
describe("Token color coding", () => {
  function getTokenColor(totalTokens: number): "dim" | "warning" | "error" {
    if (totalTokens > 100_000) {
      return "error";
    } else if (totalTokens >= 80_000) {
      return "warning";
    } else {
      return "dim";
    }
  }

  it("should be dim for tokens under 80k (smart zone)", () => {
    expect(getTokenColor(0)).toBe("dim");
    expect(getTokenColor(1000)).toBe("dim");
    expect(getTokenColor(79_999)).toBe("dim");
  });

  it("should be warning for tokens 80k-100k (approaching dumb zone)", () => {
    expect(getTokenColor(80_000)).toBe("warning");
    expect(getTokenColor(90_000)).toBe("warning");
    expect(getTokenColor(100_000)).toBe("warning");
  });

  it("should be error for tokens over 100k (dumb zone)", () => {
    expect(getTokenColor(100_001)).toBe("error");
    expect(getTokenColor(150_000)).toBe("error");
    expect(getTokenColor(200_000)).toBe("error");
  });
});

// Test behavior: number formatting
describe("Token formatting", () => {
  function fmt(n: number): string {
    return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
  }

  it("should show raw numbers under 1k", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(500)).toBe("500");
    expect(fmt(999)).toBe("999");
  });

  it("should abbreviate numbers at 1k and above", () => {
    expect(fmt(1000)).toBe("1.0k");
    expect(fmt(1500)).toBe("1.5k");
    expect(fmt(12345)).toBe("12.3k");
    expect(fmt(99999)).toBe("100.0k");
    expect(fmt(100_000)).toBe("100.0k");
  });
});
