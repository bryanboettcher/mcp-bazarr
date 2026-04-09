#!/usr/bin/env node

/**
 * MCP Server for Bazarr v1.5.x
 *
 * Consolidated domain tools for subtitle management via Bazarr API.
 * 8 tools covering system, series, episodes, movies, providers,
 * subtitles, and history domains.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BazarrClient } from "./client.js";

const BAZARR_URL = process.env.BAZARR_URL ?? "http://localhost:6767";
const BAZARR_API_KEY = process.env.BAZARR_API_KEY ?? "";

if (!BAZARR_API_KEY) {
  console.error("Set BAZARR_API_KEY environment variable");
  process.exit(1);
}

const client = new BazarrClient({
  baseUrl: BAZARR_URL,
  apiKey: BAZARR_API_KEY,
});

const server = new McpServer({
  name: "bazarr",
  version: "1.0.0",
});

type Result = { content: Array<{ type: "text"; text: string }>; isError?: true };

function ok(data: unknown): Result {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown): Result {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = Record<string, any>;

// ─── Discovery & Status ─────────────────────────────────────────────

server.tool(
  "bazarr",
  `Bazarr subtitle management system. Discover status, health, and configuration.
Actions: status, health, badges, languages, language_profiles, search`,
  {
    action: z.enum(["status", "health", "badges", "languages", "language_profiles", "search"]).describe(
      "status: environment/version info | health: system issues | badges: wanted/provider counts | languages: available languages | language_profiles: configured profiles | search: find series/movies by name"
    ),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- status, health, badges, language_profiles: {} (no params)
- languages: {history?: boolean} — true to get languages used in history
- search: {query: string} — search series and movies by name`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "status": return ok(await client.get("system/status"));
        case "health": return ok(await client.get("system/health"));
        case "badges": return ok(await client.get("badges"));
        case "languages": return ok(await client.get("system/languages", v.history ? { history: "true" } : undefined));
        case "language_profiles": return ok(await client.get("system/languages/profiles"));
        case "search": return ok(await client.get("system/searches", { query: v.query }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── System Administration ──────────────────────────────────────────

server.tool(
  "bazarr_system",
  `Bazarr system administration: settings, tasks, logs, backups, announcements.
Actions: settings_get, tasks_list, task_run, logs, logs_rotate, backups_list, backup_create, backup_restore, backup_delete, announcements, dismiss_announcement, releases, restart, shutdown`,
  {
    action: z.enum([
      "settings_get", "tasks_list", "task_run",
      "logs", "logs_rotate",
      "backups_list", "backup_create", "backup_restore", "backup_delete",
      "announcements", "dismiss_announcement",
      "releases", "restart", "shutdown",
    ]).describe("Operation to perform"),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- settings_get, tasks_list, logs, backups_list, announcements, releases: {} (no params)
- task_run: {taskid: string} — run a scheduled task immediately
- logs_rotate: {} — force log rotation
- backup_create: {} — create new backup
- backup_restore: {filename: string} — restore from backup
- backup_delete: {filename: string} — delete backup file
- dismiss_announcement: {hash: string} — dismiss announcement by hash
- restart: {} — restart Bazarr
- shutdown: {} — shutdown Bazarr`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "settings_get": return ok(await client.get("system/settings"));
        case "tasks_list": return ok(await client.get("system/tasks"));
        case "task_run": return ok(await client.post("system/tasks", { taskid: v.taskid }));
        case "logs": return ok(await client.get("system/logs"));
        case "logs_rotate": return ok(await client.delete("system/logs"));
        case "backups_list": return ok(await client.get("system/backups"));
        case "backup_create": return ok(await client.post("system/backups"));
        case "backup_restore": return ok(await client.patch("system/backups", { filename: v.filename }));
        case "backup_delete": return ok(await client.delete("system/backups", { filename: v.filename }));
        case "announcements": return ok(await client.get("system/announcements"));
        case "dismiss_announcement": return ok(await client.post("system/announcements", { hash: v.hash }));
        case "releases": return ok(await client.get("system/releases"));
        case "restart": return ok(await client.post("system", { action: "restart" }));
        case "shutdown": return ok(await client.post("system", { action: "shutdown" }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Series ─────────────────────────────────────────────────────────

server.tool(
  "bazarr_series",
  `Manage TV series in Bazarr (synced from Sonarr). View metadata, update language profiles, trigger actions.
Actions: list, get, update_profile, scan_disk, search_missing, search_wanted, sync`,
  {
    action: z.enum(["list", "get", "update_profile", "scan_disk", "search_missing", "search_wanted", "sync"]).describe(
      "list: paginated series list | get: specific series by ID(s) | update_profile: change language profile | scan_disk/search_missing/search_wanted/sync: trigger actions"
    ),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- list: {start?: number, length?: number} — paginated list (default: all)
- get: {seriesid: number[]} — get specific series by Sonarr IDs
- update_profile: {seriesid: number[], profileid: string[]} — set language profiles (parallel arrays, use "none" to clear)
- scan_disk: {seriesid: number} — rescan subtitle files on disk
- search_missing: {seriesid: number} — search for missing subtitles
- search_wanted: {} — search all wanted series subtitles
- sync: {seriesid: number} — sync series metadata from Sonarr`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "list": return ok(await client.get("series", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "get": return ok(await client.get("series", { "seriesid[]": v.seriesid }));
        case "update_profile": return ok(await client.post("series", { seriesid: v.seriesid, profileid: v.profileid }));
        case "scan_disk": return ok(await client.patch("series", { seriesid: v.seriesid, action: "scan-disk" }));
        case "search_missing": return ok(await client.patch("series", { seriesid: v.seriesid, action: "search-missing" }));
        case "search_wanted": return ok(await client.patch("series", { action: "search-wanted" }));
        case "sync": return ok(await client.patch("series", { seriesid: v.seriesid, action: "sync" }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Episodes ───────────────────────────────────────────────────────

server.tool(
  "bazarr_episodes",
  `Manage TV episode subtitles. List episodes, view wanted/missing, check history, manage blacklist, download/delete subtitles.
Actions: list_by_series, list_by_episode, wanted, history, blacklist_list, blacklist_add, blacklist_remove, subtitle_download, subtitle_delete`,
  {
    action: z.enum([
      "list_by_series", "list_by_episode", "wanted", "history",
      "blacklist_list", "blacklist_add", "blacklist_remove",
      "subtitle_download", "subtitle_delete",
    ]).describe("Operation to perform"),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- list_by_series: {seriesid: number[]} — episodes for series
- list_by_episode: {episodeid: number[]} — specific episodes
- wanted: {start?: number, length?: number} — episodes with missing subtitles
- history: {start?: number, length?: number, episodeid?: number} — subtitle search history
- blacklist_list: {start?: number, length?: number}
- blacklist_add: {seriesid: number, episodeid: number, provider: string, subs_id: string, language: string, subtitles_path: string}
- blacklist_remove: {provider: string, subs_id: string} or {all: "true"} to clear all
- subtitle_download: {seriesid: number, episodeid: number, language: string, hi: string, forced: string} — auto-download subtitles (hi/forced: "True"/"False")
- subtitle_delete: {seriesid: number, episodeid: number, language: string, hi: string, forced: string, path: string}`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "list_by_series": return ok(await client.get("episodes", { "seriesid[]": v.seriesid }));
        case "list_by_episode": return ok(await client.get("episodes", { "episodeid[]": v.episodeid }));
        case "wanted": return ok(await client.get("episodes/wanted", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "history": return ok(await client.get("episodes/history", {
          start: v.start ?? 0, length: v.length ?? -1, ...(v.episodeid !== undefined ? { episodeid: v.episodeid } : {}),
        }));
        case "blacklist_list": return ok(await client.get("episodes/blacklist", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "blacklist_add": return ok(await client.post("episodes/blacklist", {
          seriesid: v.seriesid, episodeid: v.episodeid, provider: v.provider,
          subs_id: v.subs_id, language: v.language, subtitles_path: v.subtitles_path,
        }));
        case "blacklist_remove": {
          if (v.all === "true") return ok(await client.delete("episodes/blacklist", { all: "true" }));
          return ok(await client.delete("episodes/blacklist", { provider: v.provider, subs_id: v.subs_id }));
        }
        case "subtitle_download": return ok(await client.patch("episodes/subtitles", {
          seriesid: v.seriesid, episodeid: v.episodeid, language: v.language,
          hi: v.hi ?? "False", forced: v.forced ?? "False",
        }));
        case "subtitle_delete": return ok(await client.delete("episodes/subtitles", {
          seriesid: v.seriesid, episodeid: v.episodeid, language: v.language,
          hi: v.hi ?? "False", forced: v.forced ?? "False", path: v.path,
        }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Movies ─────────────────────────────────────────────────────────

server.tool(
  "bazarr_movies",
  `Manage movie subtitles in Bazarr (synced from Radarr). View metadata, update profiles, trigger actions, manage wanted/history/blacklist.
Actions: list, get, update_profile, scan_disk, search_missing, search_wanted, sync, wanted, history, blacklist_list, blacklist_add, blacklist_remove, subtitle_download, subtitle_delete`,
  {
    action: z.enum([
      "list", "get", "update_profile",
      "scan_disk", "search_missing", "search_wanted", "sync",
      "wanted", "history",
      "blacklist_list", "blacklist_add", "blacklist_remove",
      "subtitle_download", "subtitle_delete",
    ]).describe("Operation to perform"),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- list: {start?: number, length?: number} — paginated movie list
- get: {radarrid: number[]} — specific movies by Radarr IDs
- update_profile: {radarrid: number[], profileid: string[]} — set language profiles (parallel arrays)
- scan_disk: {radarrid: number} — rescan subtitle files
- search_missing: {radarrid: number} — search for missing subtitles
- search_wanted: {} — search all wanted movie subtitles
- sync: {radarrid: number} — sync from Radarr
- wanted: {start?: number, length?: number} — movies with missing subtitles
- history: {start?: number, length?: number, radarrid?: number} — subtitle search history
- blacklist_list: {start?: number, length?: number}
- blacklist_add: {radarrid: number, provider: string, subs_id: string, language: string, subtitles_path: string}
- blacklist_remove: {provider: string, subs_id: string} or {all: "true"}
- subtitle_download: {radarrid: number, language: string, hi: string, forced: string}
- subtitle_delete: {radarrid: number, language: string, hi: string, forced: string, path: string}`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "list": return ok(await client.get("movies", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "get": return ok(await client.get("movies", { "radarrid[]": v.radarrid }));
        case "update_profile": return ok(await client.post("movies", { radarrid: v.radarrid, profileid: v.profileid }));
        case "scan_disk": return ok(await client.patch("movies", { radarrid: v.radarrid, action: "scan-disk" }));
        case "search_missing": return ok(await client.patch("movies", { radarrid: v.radarrid, action: "search-missing" }));
        case "search_wanted": return ok(await client.patch("movies", { action: "search-wanted" }));
        case "sync": return ok(await client.patch("movies", { radarrid: v.radarrid, action: "sync" }));
        case "wanted": return ok(await client.get("movies/wanted", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "history": return ok(await client.get("movies/history", {
          start: v.start ?? 0, length: v.length ?? -1, ...(v.radarrid !== undefined ? { radarrid: v.radarrid } : {}),
        }));
        case "blacklist_list": return ok(await client.get("movies/blacklist", { start: v.start ?? 0, length: v.length ?? -1 }));
        case "blacklist_add": return ok(await client.post("movies/blacklist", {
          radarrid: v.radarrid, provider: v.provider,
          subs_id: v.subs_id, language: v.language, subtitles_path: v.subtitles_path,
        }));
        case "blacklist_remove": {
          if (v.all === "true") return ok(await client.delete("movies/blacklist", { all: "true" }));
          return ok(await client.delete("movies/blacklist", { provider: v.provider, subs_id: v.subs_id }));
        }
        case "subtitle_download": return ok(await client.patch("movies/subtitles", {
          radarrid: v.radarrid, language: v.language,
          hi: v.hi ?? "False", forced: v.forced ?? "False",
        }));
        case "subtitle_delete": return ok(await client.delete("movies/subtitles", {
          radarrid: v.radarrid, language: v.language,
          hi: v.hi ?? "False", forced: v.forced ?? "False", path: v.path,
        }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Providers ──────────────────────────────────────────────────────

server.tool(
  "bazarr_providers",
  `Manage subtitle providers and manually search/download subtitles.
Actions: status, reset, search_episode, download_episode, search_movie, download_movie`,
  {
    action: z.enum(["status", "reset", "search_episode", "download_episode", "search_movie", "download_movie"]).describe(
      "status: provider throttle status | reset: reset all providers | search_episode/movie: manual subtitle search | download_episode/movie: download specific subtitle from provider"
    ),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- status: {history?: boolean} — true for providers used in history
- reset: {} — reset all throttled providers
- search_episode: {episodeid: number} — manual subtitle search for episode
- download_episode: {seriesid: number, episodeid: number, provider: string, subtitle: string, hi: string, forced: string, original_format: string} — download specific result (subtitle is the pickled subtitle string from search results)
- search_movie: {radarrid: number} — manual subtitle search for movie
- download_movie: {radarrid: number, provider: string, subtitle: string, hi: string, forced: string, original_format: string}`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "status": return ok(await client.get("providers", v.history ? { history: "true" } : undefined));
        case "reset": return ok(await client.post("providers", { action: "reset" }));
        case "search_episode": return ok(await client.get("providers/episodes", { episodeid: v.episodeid }));
        case "download_episode": return ok(await client.post("providers/episodes", {
          seriesid: v.seriesid, episodeid: v.episodeid, provider: v.provider,
          subtitle: v.subtitle, hi: v.hi ?? "False", forced: v.forced ?? "False",
          original_format: v.original_format ?? "False",
        }));
        case "search_movie": return ok(await client.get("providers/movies", { radarrid: v.radarrid }));
        case "download_movie": return ok(await client.post("providers/movies", {
          radarrid: v.radarrid, provider: v.provider,
          subtitle: v.subtitle, hi: v.hi ?? "False", forced: v.forced ?? "False",
          original_format: v.original_format ?? "False",
        }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Subtitles Tools ────────────────────────────────────────────────

server.tool(
  "bazarr_subtitles",
  `Subtitle file tools: get info about subtitle files and apply modifications (sync, translate, etc.).
Actions: info, get_tracks`,
  {
    action: z.enum(["info", "get_tracks"]).describe(
      "info: parse subtitle filename for language/season/episode | get_tracks: get audio/subtitle tracks for a media file"
    ),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- info: {subtitlesPath: string} — parse subtitle filename using GuessIt
- get_tracks: {subtitlesPath: string, sonarrEpisodeId?: number, radarrMovieId?: number} — get embedded and external tracks`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "info": return ok(await client.get("subtitles/info", { subtitlesPath: v.subtitlesPath }));
        case "get_tracks": return ok(await client.get("subtitles", {
          subtitlesPath: v.subtitlesPath,
          ...(v.sonarrEpisodeId !== undefined ? { sonarrEpisodeId: v.sonarrEpisodeId } : {}),
          ...(v.radarrMovieId !== undefined ? { radarrMovieId: v.radarrMovieId } : {}),
        }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── History ────────────────────────────────────────────────────────

server.tool(
  "bazarr_history",
  `View subtitle download history and statistics.
Actions: stats`,
  {
    action: z.enum(["stats"]).describe("stats: history statistics over time"),
    params: z.record(z.string(), z.any()).optional().describe(
      `Action parameters:
- stats: {timeFrame?: string, action?: string, provider?: string, language?: string}
  timeFrame: "week" | "month" | "trimester" | "year" (default: "month")
  action/provider/language: "All" or specific filter value`
    ),
  },
  async ({ action, params: p }) => {
    const v: P = p ?? {};
    try {
      switch (action) {
        case "stats": return ok(await client.get("history/stats", {
          timeFrame: v.timeFrame ?? "month",
          action: v.action ?? "All",
          provider: v.provider ?? "All",
          language: v.language ?? "All",
        }));
        default: return err(`Unknown action: ${action}`);
      }
    } catch (e) { return err(e); }
  }
);

// ─── Start Server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Bazarr MCP server running (${BAZARR_URL})`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
