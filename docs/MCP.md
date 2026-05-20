# MCP Server (Read-Only Catalog)

JumpFlix now includes a remote Model Context Protocol (MCP) server for read-only catalog access.

This server is designed for LLM clients that need structured access to films, facets, feeds, people, songs, and spot chapters.

## Scope

- Read-only access only.
- No admin actions.
- No content mutation.
- No user-private data exposure.

## Transport

- Streamable HTTP (remote).
- Route default: `/mcp`.
- Clients should send `Accept: application/json` (or include `text/event-stream`) for protocol-compatible responses.

## Authentication

All requests require a bearer token:

`Authorization: Bearer <token>`

Set one of:

- `JUMPFLIX_MCP_BEARER_TOKEN` (preferred)
- `MCP_BEARER_TOKEN` (fallback)

If neither is set, the endpoint returns an authorization configuration error.

## Environment Variables

- `JUMPFLIX_MCP_BEARER_TOKEN` (preferred)
- `MCP_BEARER_TOKEN` (fallback)
- `JUMPFLIX_MCP_SESSION_MODE` (optional: `stateful` or `stateless`; default auto)
- `JUMPFLIX_MCP_MAX_STRUCTURED_CONTENT_CHARS` (optional, default `120000`)
- `JUMPFLIX_MCP_MAX_TEXT_CONTENT_CHARS` (optional, default `2000`)

Catalog and spot data still rely on existing project env vars like Supabase keys and (for spot canonicalization) `PARKOUR_SPOT_API_KEY`.

## Response Size Controls

The server now includes payload-size controls at two levels:

- Tool-level optional limits:
	- `catalog_get` supports `maxTracks` and `maxSeasons`.
	- `catalog_by_spot` supports `maxChaptersPerItem`.
	- `catalog_facets` supports `includeDescriptions`.
- Transport-level fallback:
	- If `structuredContent` is still too large, the server trims oversized sections and adds `transportLimit` metadata.
	- If needed, a compact fallback payload is returned so the response stays deliverable.

If tool-level truncation is applied, payloads may include `resultLimit` metadata for clarity.

## Run

Start the JumpFlix app server as normal:

```bash
npm run dev
```

The MCP endpoint is then available at:

```bash
http://localhost:5173/mcp
```

## Exposed Tools

- `catalog_search`
: Search by text, feed preset, type, and facet filters with pagination and sort.

- `catalog_get`
: Fetch one media item by `id` or `slug`.

- `catalog_by_person`
: Resolve creator/athlete matches and list related media.

- `catalog_by_spot`
: Resolve spot ID and return media linked by approved spot chapters.

- `catalog_facets`
: Return machine-readable facet taxonomy and content warning options.

- `catalog_feeds`
: Return feed presets and filter definitions.

## Notes

- Session lifecycle is handled through Streamable HTTP session IDs.
- Sessions can be terminated with `DELETE` to the MCP route with `mcp-session-id` header.
- Session mode defaults to `stateless` in production and `stateful` outside production. Override with `JUMPFLIX_MCP_SESSION_MODE`.
- In `stateful` mode, session state is in-process memory. In serverless or multi-instance deployments this is ephemeral unless sticky routing is guaranteed.
- The endpoint accepts `initialize` even if a stale `mcp-session-id` header is present, so clients can recover cleanly after session loss.
- For Netlify and other proxy/CDN setups, avoid response buffering and caching on `/mcp`, and ensure function timeout settings can support longer-lived streamable connections.
- The transport endpoint is implemented in `src/routes/mcp/+server.ts`.
- Tool registration is implemented in `src/lib/server/mcp/catalog-server.ts`.
