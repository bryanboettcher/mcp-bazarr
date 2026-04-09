/**
 * MCP-level integration tests for the Bazarr MCP server.
 *
 * Spawns the compiled server as a child process and communicates via the
 * MCP JSON-RPC protocol using StdioClientTransport. This exercises the
 * actual tool dispatch logic in src/index.ts.
 *
 * Requires a running Bazarr instance (see docker-compose.test.yml).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrap } from "./bootstrap.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Setup ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, "../dist/index.js");

let mcpClient: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  const ctx = await bootstrap();

  transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_ENTRY],
    env: {
      ...(process.env as Record<string, string>),
      BAZARR_URL: ctx.baseUrl,
      BAZARR_API_KEY: ctx.apiKey,
    },
    stderr: "pipe",
  });

  mcpClient = new Client(
    { name: "mcp-tools-test", version: "1.0.0" },
    { capabilities: {} },
  );

  await mcpClient.connect(transport);
}, 150_000);

afterAll(async () => {
  await mcpClient.close();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; isError: boolean }> {
  const result = await mcpClient.callTool({ name, arguments: args });
  const firstContent = result.content[0];
  if (firstContent.type !== "text") {
    throw new Error(`Expected text content, got ${firstContent.type}`);
  }
  const text = firstContent.text as string;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { data, isError: result.isError === true };
}

// ─── bazarr (discovery) ─────────────────────────────────────────────────────

describe("bazarr tool", () => {
  it("status returns version info", async () => {
    const { data, isError } = await callTool("bazarr", { action: "status" });
    expect(isError).toBe(false);
    const result = data as { data: Record<string, unknown> };
    expect(result.data).toBeDefined();
    expect(result.data.bazarr_version).toBeDefined();
  });

  it("health returns issues array", async () => {
    const { data, isError } = await callTool("bazarr", { action: "health" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("badges returns counts", async () => {
    const { data, isError } = await callTool("bazarr", { action: "badges" });
    expect(isError).toBe(false);
    const result = data as Record<string, unknown>;
    expect(typeof result.episodes).toBe("number");
    expect(typeof result.movies).toBe("number");
  });

  it("languages returns language list", async () => {
    const { data, isError } = await callTool("bazarr", { action: "languages" });
    expect(isError).toBe(false);
    const result = data as Array<{ name: string; code2: string }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("language_profiles returns profiles list", async () => {
    const { data, isError } = await callTool("bazarr", { action: "language_profiles" });
    expect(isError).toBe(false);
    expect(Array.isArray(data)).toBe(true);
  });

  it("search returns results array", async () => {
    const { data, isError } = await callTool("bazarr", {
      action: "search",
      params: { query: "nonexistent_xyz" },
    });
    expect(isError).toBe(false);
    expect(Array.isArray(data)).toBe(true);
  });
});

// ─── bazarr_system ──────────────────────────────────────────────────────────

describe("bazarr_system tool", () => {
  it("settings_get returns settings object", async () => {
    const { data, isError } = await callTool("bazarr_system", { action: "settings_get" });
    expect(isError).toBe(false);
    const result = data as Record<string, unknown>;
    expect(result.general).toBeDefined();
    expect(result.auth).toBeDefined();
  });

  it("tasks_list returns scheduled tasks", async () => {
    const { data, isError } = await callTool("bazarr_system", { action: "tasks_list" });
    expect(isError).toBe(false);
    const result = data as { data: Array<{ job_id: string; name: string }> };
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("logs returns log entries", async () => {
    const { data, isError } = await callTool("bazarr_system", { action: "logs" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("backups_list returns backups array", async () => {
    const { data, isError } = await callTool("bazarr_system", { action: "backups_list" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("announcements returns announcements array", async () => {
    const { data, isError } = await callTool("bazarr_system", { action: "announcements" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── bazarr_series ──────────────────────────────────────────────────────────

describe("bazarr_series tool", () => {
  it("list returns paginated series (empty without Sonarr)", async () => {
    const { data, isError } = await callTool("bazarr_series", { action: "list" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });
});

// ─── bazarr_episodes ────────────────────────────────────────────────────────

describe("bazarr_episodes tool", () => {
  it("wanted returns episodes with missing subtitles (empty without Sonarr)", async () => {
    const { data, isError } = await callTool("bazarr_episodes", { action: "wanted" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("history returns episode history (empty without data)", async () => {
    const { data, isError } = await callTool("bazarr_episodes", { action: "history" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("blacklist_list returns blacklist (empty without data)", async () => {
    const { data, isError } = await callTool("bazarr_episodes", { action: "blacklist_list" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── bazarr_movies ──────────────────────────────────────────────────────────

describe("bazarr_movies tool", () => {
  it("list returns paginated movies (empty without Radarr)", async () => {
    const { data, isError } = await callTool("bazarr_movies", { action: "list" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("wanted returns movies with missing subtitles (empty without Radarr)", async () => {
    const { data, isError } = await callTool("bazarr_movies", { action: "wanted" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("history returns movie history (empty without data)", async () => {
    const { data, isError } = await callTool("bazarr_movies", { action: "history" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[]; total: number };
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("blacklist_list returns blacklist (empty without data)", async () => {
    const { data, isError } = await callTool("bazarr_movies", { action: "blacklist_list" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── bazarr_providers ───────────────────────────────────────────────────────

describe("bazarr_providers tool", () => {
  it("status returns provider list", async () => {
    const { data, isError } = await callTool("bazarr_providers", { action: "status" });
    expect(isError).toBe(false);
    const result = data as { data: unknown[] };
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── bazarr_history ─────────────────────────────────────────────────────────

describe("bazarr_history tool", () => {
  it("stats returns series and movies history", async () => {
    const { data, isError } = await callTool("bazarr_history", { action: "stats" });
    expect(isError).toBe(false);
    const result = data as { series: unknown[]; movies: unknown[] };
    expect(Array.isArray(result.series)).toBe(true);
    expect(Array.isArray(result.movies)).toBe(true);
  });

  it("stats with timeFrame filter works", async () => {
    const { data, isError } = await callTool("bazarr_history", {
      action: "stats",
      params: { timeFrame: "week" },
    });
    expect(isError).toBe(false);
    const result = data as { series: unknown[]; movies: unknown[] };
    expect(Array.isArray(result.series)).toBe(true);
  });
});
