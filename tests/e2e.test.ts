/**
 * E2E test suite for the Bazarr MCP server.
 *
 * Requires a running Bazarr instance at BAZARR_TEST_URL (default: http://localhost:16767).
 * The docker-compose.test.yml file spins one up for CI.
 *
 * Run: vitest run
 */

import { describe, it, expect, beforeAll } from "vitest";
import { bootstrap } from "./bootstrap.js";
import { BazarrClient } from "../src/client.js";

// ─── Setup ──────────────────────────────────────────────────────────────────

let client: BazarrClient;

beforeAll(async () => {
  const ctx = await bootstrap();
  client = new BazarrClient({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey });
}, 150_000);

// ─── System Status & Health ─────────────────────────────────────────────────

describe("system", () => {
  it("status returns version and environment info", async () => {
    const result = (await client.get("system/status")) as { data: Record<string, unknown> };

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.bazarr_version).toBeDefined();
    expect(result.data.python_version).toBeDefined();
    expect(result.data.operating_system).toBeDefined();
  });

  it("health returns issues array", async () => {
    const result = (await client.get("system/health")) as { data: unknown[] };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("ping returns 200 (unauthenticated)", async () => {
    // Ping doesn't need the client — it's unauthenticated
    const res = await fetch(`${(await bootstrap()).baseUrl}/api/system/ping`);
    expect(res.ok).toBe(true);
  });
});

// ─── Badges ─────────────────────────────────────────────────────────────────

describe("badges", () => {
  it("returns badge counts", async () => {
    const result = (await client.get("badges")) as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(typeof result.episodes).toBe("number");
    expect(typeof result.movies).toBe("number");
    expect(typeof result.providers).toBe("number");
  });
});

// ─── Languages ──────────────────────────────────────────────────────────────

describe("languages", () => {
  it("list returns languages array", async () => {
    const result = (await client.get("system/languages")) as Array<{
      name: string;
      code2: string;
      code3: string;
    }>;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const english = result.find((l) => l.code2 === "en");
    expect(english).toBeDefined();
    expect(english!.name).toBe("English");
  });

  it("language profiles returns list", async () => {
    const result = await client.get("system/languages/profiles");

    // May be empty array if no profiles configured, or array of profiles
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Settings ───────────────────────────────────────────────────────────────

describe("settings", () => {
  it("get returns settings object", async () => {
    const result = (await client.get("system/settings")) as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result.general).toBeDefined();
    expect(result.auth).toBeDefined();
  });
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

describe("tasks", () => {
  it("list returns scheduled tasks", async () => {
    const result = (await client.get("system/tasks")) as { data: Array<{ job_id: string; name: string }> };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    // Bazarr always has some scheduled tasks
    expect(result.data.length).toBeGreaterThan(0);

    const task = result.data[0];
    expect(task.job_id).toBeDefined();
    expect(task.name).toBeDefined();
  });
});

// ─── Logs ───────────────────────────────────────────────────────────────────

describe("logs", () => {
  it("list returns log entries", async () => {
    const result = (await client.get("system/logs")) as { data: Array<{ timestamp: string; type: string; message: string }> };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── Providers ──────────────────────────────────────────────────────────────

describe("providers", () => {
  it("status returns provider list", async () => {
    const result = (await client.get("providers")) as { data: Array<{ name: string; status: string }> };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── Series (no Sonarr configured) ──────────────────────────────────────────

describe("series (no Sonarr)", () => {
  it("list returns empty data when Sonarr is not configured", async () => {
    const result = (await client.get("series")) as { data: unknown[]; total: number };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("episodes wanted returns empty list", async () => {
    const result = (await client.get("episodes/wanted")) as { data: unknown[]; total: number };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });
});

// ─── Movies (no Radarr configured) ──────────────────────────────────────────

describe("movies (no Radarr)", () => {
  it("list returns empty data when Radarr is not configured", async () => {
    const result = (await client.get("movies")) as { data: unknown[]; total: number };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });

  it("movies wanted returns empty list", async () => {
    const result = (await client.get("movies/wanted")) as { data: unknown[]; total: number };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(0);
  });
});

// ─── History ────────────────────────────────────────────────────────────────

describe("history", () => {
  it("stats returns series and movies history", async () => {
    const result = (await client.get("history/stats")) as {
      series: Array<{ date: string; count: number }>;
      movies: Array<{ date: string; count: number }>;
    };

    expect(result).toBeDefined();
    expect(Array.isArray(result.series)).toBe(true);
    expect(Array.isArray(result.movies)).toBe(true);
  });
});

// ─── Announcements ──────────────────────────────────────────────────────────

describe("announcements", () => {
  it("list returns announcements array", async () => {
    const result = (await client.get("system/announcements")) as { data: unknown[] };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── Backups ────────────────────────────────────────────────────────────────

describe("backups", () => {
  it("list returns backups array", async () => {
    const result = (await client.get("system/backups")) as { data: unknown[] };

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ─── Search ─────────────────────────────────────────────────────────────────

describe("search", () => {
  it("search with empty query returns empty results", async () => {
    const result = (await client.get("system/searches", { query: "nonexistent_test_query_xyz" })) as unknown[];

    // Returns array directly (no envelope)
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── Auth Failure ───────────────────────────────────────────────────────────

describe("authentication", () => {
  it("rejects requests with bad API key", async () => {
    const badClient = new BazarrClient({
      baseUrl: (await bootstrap()).baseUrl,
      apiKey: "invalid-key-12345",
    });

    await expect(badClient.get("system/status")).rejects.toThrow(/401/);
  });
});
