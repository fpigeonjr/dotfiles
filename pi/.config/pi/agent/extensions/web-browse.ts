/**
 * web-browse — Pi extension for web browsing
 *
 * Registers two LLM-callable tools:
 *   web_fetch   — fetch any URL, return cleaned readable text
 *   web_search  — search via DuckDuckGo Lite, return results list
 *
 * No API keys required. No external npm deps.
 * Placed in ~/.config/pi/agent/extensions/ (auto-discovered).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@mariozechner/pi-tui";

const MAX_CHARS = 50_000;
const SEARCH_MAX_CHARS = 20_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ─── HTML → plain text ───────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    // Remove non-content blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Block-level elements → newlines
    .replace(/<\/?(br|p|div|li|tr|h[1-6]|blockquote|pre|hr|section|article|header|footer|nav|main|aside)[^>]*>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    // Normalise whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/ \n/g, "\n")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── web_fetch ──────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch a URL and return its readable text content. " +
      "Works for documentation sites, AWS news pages, GitHub raw files, " +
      "JSON APIs, RSS/Atom feeds, changelogs, and more. " +
      "For HTML pages the content is stripped to plain text. " +
      "JSON is pretty-printed. Plain text and Markdown are returned as-is.",
    promptSnippet: "Fetch a URL and return its readable text content",
    parameters: Type.Object({
      url: Type.String({ description: "The full URL to fetch (must start with http:// or https://)" }),
      maxChars: Type.Optional(
        Type.Number({ description: `Max characters to return (default ${MAX_CHARS}). Increase for large docs.` })
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const limit = params.maxChars ?? MAX_CHARS;

      const response = await fetch(params.url, {
        signal,
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/json,text/plain,text/xml,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${params.url}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const raw = await response.text();

      let content: string;
      if (contentType.includes("json")) {
        try {
          content = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          content = raw;
        }
      } else if (contentType.includes("html")) {
        content = htmlToText(raw);
      } else {
        // plain text, markdown, xml, etc.
        content = raw;
      }

      const truncated = content.length > limit;
      if (truncated) {
        content =
          content.slice(0, limit) +
          `\n\n[Content truncated at ${limit.toLocaleString()} chars — use a more specific URL, ` +
          `increase maxChars, or fetch a sub-page for more detail]`;
      }

      return {
        content: [{ type: "text", text: content }],
        details: { url: params.url, contentType, chars: content.length, truncated },
      };
    },

    renderCall(args, theme) {
      const t = new Text("", 0, 0);
      t.setText(theme.fg("toolTitle", theme.bold("web_fetch ")) + theme.fg("muted", args?.url ?? "…"));
      return t;
    },

    renderResult(result, { isPartial }, theme) {
      const t = new Text("", 0, 0);
      if (isPartial) {
        t.setText(theme.fg("warning", "Fetching…"));
      } else {
        const d = result.details as { chars?: number; truncated?: boolean } | undefined;
        const chars = (d?.chars ?? 0).toLocaleString();
        const suffix = d?.truncated ? theme.fg("warning", " (truncated)") : "";
        t.setText(theme.fg("success", `✓ ${chars} chars`) + suffix);
      }
      return t;
    },
  });

  // ── web_search ─────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web via DuckDuckGo and return a list of results with titles, URLs, and snippets. " +
      "Follow up with web_fetch to read specific pages in full. " +
      "Good for: finding official docs, discovering AWS announcements, " +
      "locating GitHub repos, checking Stack Overflow answers.",
    promptSnippet: "Search the web via DuckDuckGo and return result titles and URLs",
    parameters: Type.Object({
      query: Type.String({ description: "Search query, e.g. 'AWS Bedrock new models April 2026'" }),
    }),

    async execute(_toolCallId, params, signal) {
      const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(params.query)}`;

      const response = await fetch(searchUrl, {
        signal,
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
      }

      const html = await response.text();

      // DDG Lite is table-based with very clean HTML — stripping tags gives
      // readable result blocks the LLM can parse naturally.
      let text = htmlToText(html);

      // Remove DDG Lite boilerplate header/footer (everything before first result)
      const firstResult = text.indexOf("1.");
      if (firstResult > 0) text = text.slice(firstResult);

      if (text.length > SEARCH_MAX_CHARS) {
        text = text.slice(0, SEARCH_MAX_CHARS) + "\n\n[Truncated]";
      }

      const content =
        text.trim().length > 0
          ? text.trim()
          : `No results found for "${params.query}". Try rephrasing or use web_fetch with a direct URL.`;

      return {
        content: [{ type: "text", text: content }],
        details: { query: params.query, searchUrl },
      };
    },

    renderCall(args, theme) {
      const t = new Text("", 0, 0);
      t.setText(theme.fg("toolTitle", theme.bold("web_search ")) + theme.fg("muted", `"${args?.query ?? "…"}"`));
      return t;
    },

    renderResult(result, { isPartial }, theme) {
      const t = new Text("", 0, 0);
      if (isPartial) {
        t.setText(theme.fg("warning", "Searching…"));
      } else {
        const hasContent = (result.content?.[0] as { text?: string } | undefined)?.text?.length ?? 0;
        t.setText(hasContent > 0 ? theme.fg("success", "✓ Results ready") : theme.fg("warning", "No results"));
      }
      return t;
    },
  });
}
