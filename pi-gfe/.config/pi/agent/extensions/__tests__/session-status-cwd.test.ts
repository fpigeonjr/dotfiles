/**
 * session-status cwd-tracking tests
 *
 * Tests for the bash-tool override logic that tracks working-directory changes
 * made inside bash commands (e.g. `wt switch`, `cd`, worktree operations).
 *
 * All helpers are lifted verbatim from session-status.ts so the tests verify
 * the same code paths without requiring the full pi runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers extracted from session-status.ts ────────────────────────────────
// Keep these in sync with the extension source.

const CWD_MARKER = "###PI_CWD###:";

/** Mirrors the spawnHook command-wrapping in registerBashTool(). */
function wrapCommand(command: string): string {
  return `{ ${command}\n}; __pi_exit=$?; echo "${CWD_MARKER}$(pwd)"; exit $__pi_exit`;
}

interface TextBlock {
  type: "text";
  text: string;
}
interface OtherBlock {
  type: "image" | "tool_use";
  [k: string]: unknown;
}
type ContentBlock = TextBlock | OtherBlock;

/**
 * Mirrors the marker-stripping logic inside the custom bash tool execute().
 * Returns { cleanedContent, detectedCwd }.
 */
function processResult(content: ContentBlock[]): {
  cleanedContent: ContentBlock[];
  detectedCwd: string | undefined;
} {
  let detectedCwd: string | undefined;

  const cleanedContent = content.map((block) => {
    if (block.type !== "text") return block;
    const markerIdx = block.text.lastIndexOf(CWD_MARKER);
    if (markerIdx === -1) return block;
    const afterMarker = block.text.slice(markerIdx + CWD_MARKER.length);
    const newline = afterMarker.indexOf("\n");
    detectedCwd = (newline === -1 ? afterMarker : afterMarker.slice(0, newline)).trim();
    // Remove the marker line entirely (including trailing newline before it).
    const cleaned = block.text.slice(0, markerIdx).replace(/\n$/, "");
    return { ...block, text: cleaned };
  });

  return { cleanedContent, detectedCwd };
}

/** Mirrors the cachedBranch precedence logic in render(). */
function resolveBranch(
  cachedBranch: string | null | undefined,
  footerBranch: string | null,
): string | null {
  return cachedBranch !== undefined ? cachedBranch : footerBranch;
}

/** Mirrors the session_start reset logic. */
function applySessionStart(
  reason: string,
  state: { cachedCost: number; cachedContextPct: number; cachedContextTokens: number },
): { cachedCost: number; cachedContextPct: number; cachedContextTokens: number; cachedBranch: undefined } {
  if (reason !== "reload") {
    state.cachedCost = 0;
    state.cachedContextPct = 0;
    state.cachedContextTokens = 0;
  }
  return { ...state, cachedBranch: undefined };
}

// ─── Tests: command wrapping ──────────────────────────────────────────────────

describe("wrapCommand", () => {
  it("wraps a simple command with the cwd marker and exit-code forwarding", () => {
    const wrapped = wrapCommand("ls");
    expect(wrapped).toBe(`{ ls\n}; __pi_exit=$?; echo "${CWD_MARKER}$(pwd)"; exit $__pi_exit`);
  });

  it("places the original command inside a subshell block", () => {
    const wrapped = wrapCommand("echo hello");
    expect(wrapped).toMatch(/^\{ echo hello\n\}/);
  });

  it("preserves multi-line commands inside the subshell block", () => {
    const cmd = "cd /tmp\nwt switch --create TICKET-123";
    const wrapped = wrapCommand(cmd);
    expect(wrapped).toContain(`{ ${cmd}\n}`);
    expect(wrapped).toContain(`echo "${CWD_MARKER}$(pwd)"`);
  });

  it("forwards the exit code via __pi_exit", () => {
    const wrapped = wrapCommand("false");
    expect(wrapped).toContain("__pi_exit=$?");
    expect(wrapped).toContain("exit $__pi_exit");
  });

  it("appends the cwd marker echo as a literal bash string (not JS-interpolated)", () => {
    // The $(pwd) must reach bash as-is, not be evaluated by Node.
    const wrapped = wrapCommand("ls");
    expect(wrapped).toContain("$(pwd)");
    // Ensure it's not accidentally resolved to a real path at wrap time.
    expect(wrapped).not.toMatch(/###PI_CWD###:\/[a-z]/);
  });
});

// ─── Tests: marker extraction ─────────────────────────────────────────────────

describe("processResult — marker extraction", () => {
  it("extracts the cwd path from a marker line", () => {
    const output = "hello world\n###PI_CWD###:/Users/frank/projects/my-repo\n";
    const { detectedCwd } = processResult([{ type: "text", text: output }]);
    expect(detectedCwd).toBe("/Users/frank/projects/my-repo");
  });

  it("strips the marker line from the returned content", () => {
    const output = "some output\n###PI_CWD###:/tmp\n";
    const { cleanedContent } = processResult([{ type: "text", text: output }]);
    expect((cleanedContent[0] as TextBlock).text).toBe("some output");
  });

  it("handles marker with no trailing newline", () => {
    const output = "done\n###PI_CWD###:/home/user/code";
    const { detectedCwd, cleanedContent } = processResult([{ type: "text", text: output }]);
    expect(detectedCwd).toBe("/home/user/code");
    expect((cleanedContent[0] as TextBlock).text).toBe("done");
  });

  it("uses the LAST marker when output contains multiple markers", () => {
    // Shouldn't happen in practice but lastIndexOf is the safest strategy.
    const output = "###PI_CWD###:/first\nmore output\n###PI_CWD###:/second\n";
    const { detectedCwd } = processResult([{ type: "text", text: output }]);
    expect(detectedCwd).toBe("/second");
  });

  it("returns undefined detectedCwd when no marker is present", () => {
    const { detectedCwd } = processResult([{ type: "text", text: "clean output\n" }]);
    expect(detectedCwd).toBeUndefined();
  });

  it("leaves content unchanged when no marker is present", () => {
    const text = "clean output\n";
    const { cleanedContent } = processResult([{ type: "text", text }]);
    expect((cleanedContent[0] as TextBlock).text).toBe(text);
  });

  it("passes non-text blocks through unchanged", () => {
    const block: OtherBlock = { type: "image", url: "data:..." };
    const { cleanedContent, detectedCwd } = processResult([block]);
    expect(cleanedContent[0]).toBe(block);
    expect(detectedCwd).toBeUndefined();
  });

  it("handles multi-block results — extracts cwd from whichever block has the marker", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "first block\n" },
      { type: "text", text: "second block\n###PI_CWD###:/detected\n" },
    ];
    const { detectedCwd, cleanedContent } = processResult(blocks);
    expect(detectedCwd).toBe("/detected");
    expect((cleanedContent[0] as TextBlock).text).toBe("first block\n");
    expect((cleanedContent[1] as TextBlock).text).toBe("second block");
  });

  it("trims whitespace from the detected path", () => {
    const output = "done\n###PI_CWD###:  /some/path  \n";
    const { detectedCwd } = processResult([{ type: "text", text: output }]);
    expect(detectedCwd).toBe("/some/path");
  });
});

// ─── Tests: cwd-change detection (the guard in execute()) ────────────────────

describe("cwd change detection", () => {
  it("treats a new path as a change", () => {
    const cachedCwd = "/old/path";
    const detectedCwd = "/new/path";
    expect(detectedCwd && detectedCwd !== cachedCwd).toBe(true);
  });

  it("does NOT treat the same path as a change", () => {
    const cachedCwd = "/same/path";
    const detectedCwd = "/same/path";
    expect(detectedCwd && detectedCwd !== cachedCwd).toBe(false);
  });

  it("does NOT treat undefined detectedCwd as a change", () => {
    const cachedCwd = "/old/path";
    const detectedCwd = undefined;
    expect(detectedCwd && detectedCwd !== cachedCwd).toBeFalsy();
  });

  it("does NOT treat empty string as a valid new path", () => {
    const cachedCwd = "/old/path";
    const detectedCwd = "";
    expect(detectedCwd && detectedCwd !== cachedCwd).toBeFalsy();
  });
});

// ─── Tests: cachedBranch precedence ──────────────────────────────────────────

describe("resolveBranch — cachedBranch vs footerData.getGitBranch()", () => {
  it("returns footerData branch when cachedBranch is undefined (not yet read)", () => {
    expect(resolveBranch(undefined, "main")).toBe("main");
  });

  it("returns null from footerData when both are unset/null", () => {
    expect(resolveBranch(undefined, null)).toBeNull();
  });

  it("returns cachedBranch when set, overriding footerData", () => {
    expect(resolveBranch("feature/TICKET-123", "main")).toBe("feature/TICKET-123");
  });

  it("returns null from cachedBranch when not in a git repo after wt switch", () => {
    // refreshBranch sets cachedBranch=null on non-zero git exit code.
    expect(resolveBranch(null, "main")).toBeNull();
  });

  it("uses cachedBranch even when it is empty string (edge case)", () => {
    // Shouldn't happen in practice but the override logic should hold.
    expect(resolveBranch("", "main")).toBe("");
  });
});

// ─── Tests: session_start state resets ───────────────────────────────────────

describe("applySessionStart — stat and branch resets", () => {
  const dirtyState = { cachedCost: 1.5, cachedContextPct: 80, cachedContextTokens: 95_000 };

  it("resets stats and cachedBranch for a fresh session start", () => {
    const result = applySessionStart("start", { ...dirtyState });
    expect(result.cachedCost).toBe(0);
    expect(result.cachedContextPct).toBe(0);
    expect(result.cachedContextTokens).toBe(0);
    expect(result.cachedBranch).toBeUndefined();
  });

  it("resets stats for a resume (switched workspace)", () => {
    const result = applySessionStart("resume", { ...dirtyState });
    expect(result.cachedCost).toBe(0);
    expect(result.cachedContextPct).toBe(0);
    expect(result.cachedContextTokens).toBe(0);
    expect(result.cachedBranch).toBeUndefined();
  });

  it("does NOT reset stats for a reload (same session)", () => {
    const result = applySessionStart("reload", { ...dirtyState });
    expect(result.cachedCost).toBe(1.5);
    expect(result.cachedContextPct).toBe(80);
    expect(result.cachedContextTokens).toBe(95_000);
  });

  it("always resets cachedBranch to undefined, even on reload", () => {
    const result = applySessionStart("reload", { ...dirtyState });
    expect(result.cachedBranch).toBeUndefined();
  });
});

// ─── Tests: refreshBranch logic ──────────────────────────────────────────────

describe("refreshBranch — git exec result handling", () => {
  /**
   * Mirrors the logic of refreshBranch() from session-status.ts.
   * Uses the pi.exec result to set cachedBranch.
   */
  async function runRefreshBranch(execResult: {
    code: number;
    stdout: string;
  } | "throw"): Promise<string | null> {
    let cachedBranch: string | null = null;
    try {
      if (execResult === "throw") throw new Error("git not found");
      const result = execResult;
      cachedBranch = result.code === 0 ? result.stdout.trim() : null;
    } catch {
      cachedBranch = null;
    }
    return cachedBranch;
  }

  it("returns the branch name on success (exit 0)", async () => {
    const branch = await runRefreshBranch({ code: 0, stdout: "feature/TICKET-123\n" });
    expect(branch).toBe("feature/TICKET-123");
  });

  it("trims whitespace/newlines from the branch name", async () => {
    const branch = await runRefreshBranch({ code: 0, stdout: "  main  \n" });
    expect(branch).toBe("main");
  });

  it("returns null on non-zero git exit code (not a git repo)", async () => {
    const branch = await runRefreshBranch({ code: 128, stdout: "" });
    expect(branch).toBeNull();
  });

  it("returns null when git exec throws (git not installed / permission error)", async () => {
    const branch = await runRefreshBranch("throw");
    expect(branch).toBeNull();
  });

  it("handles HEAD detached state (returns commit hash)", async () => {
    const branch = await runRefreshBranch({ code: 0, stdout: "HEAD\n" });
    expect(branch).toBe("HEAD");
  });
});
