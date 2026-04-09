# claude-bazarr

MCP server for Bazarr subtitle management (v1.5.x API).

## Architecture

- `src/client.ts` — BazarrClient: REST API client with X-API-KEY auth, form-encoded mutations
- `src/index.ts` — MCP server with 8 domain-grouped tools (bazarr, bazarr_system, bazarr_series, bazarr_episodes, bazarr_movies, bazarr_providers, bazarr_subtitles, bazarr_history)
- Pattern: consolidated tools with action enum + params record (same as claude-homarr)

## Build & Run

```bash
npm run build    # tsc
npm start        # node dist/index.js
```

## Environment Variables

- `BAZARR_URL` — Base URL (default: http://localhost:6767)
- `BAZARR_API_KEY` — Required. From Bazarr Settings > General > Security

## API Reference

Bazarr repo cloned to ~/src/repos/bazarr/ for API inspection.
API routes in `bazarr/api/` organized by domain (series, movies, episodes, providers, system, etc.).
Auth via `X-API-KEY` header. All mutations use form-urlencoded POST/PATCH/DELETE.
