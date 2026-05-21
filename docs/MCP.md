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

The MCP endpoint accepts bearer tokens in two modes:

1. OAuth 2.1 access tokens (recommended for ChatGPT connectors).
2. Static bearer token fallback (legacy/manual clients).

Every MCP request still uses:

`Authorization: Bearer <token>`

### OAuth Mode (recommended)

Enable OAuth by setting:

- `JUMPFLIX_MCP_OAUTH_SIGNING_SECRET` (required to enable OAuth)
- `JUMPFLIX_MCP_OAUTH_CLIENT_ID` (optional, default `jumpflix-chatgpt`)

Optional OAuth settings:

- `JUMPFLIX_MCP_OAUTH_CLIENT_SECRET` (if set, token endpoint requires client secret auth)
- `JUMPFLIX_MCP_OAUTH_ISSUER` (optional issuer base URL; defaults to request origin)
- `JUMPFLIX_MCP_OAUTH_RESOURCE` (optional resource URI; defaults to `<issuer>/mcp`)
- `JUMPFLIX_MCP_OAUTH_ENABLE_DCR` (optional, default `true`)
- `JUMPFLIX_MCP_OAUTH_DCR_AUTH_METHODS` (optional; defaults to `none,client_secret_post,client_secret_basic`)
- `JUMPFLIX_MCP_OAUTH_DCR_CLIENT_TTL_SECONDS` (optional; defaults to `31536000`)
- `JUMPFLIX_MCP_OAUTH_ENABLE_CIMD` (optional, default `true`)
- `JUMPFLIX_MCP_OAUTH_CIMD_ALLOWED_HOSTS` (optional host allowlist for `client_id` metadata URLs)
- `JUMPFLIX_MCP_OAUTH_CIMD_CACHE_TTL_SECONDS` (optional; defaults to `300`)
- `JUMPFLIX_MCP_OAUTH_CIMD_FETCH_TIMEOUT_MS` (optional; defaults to `3000`)
- `JUMPFLIX_MCP_OAUTH_JWKS_CACHE_TTL_SECONDS` (optional; defaults to `300`)
- `JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_URIS` (comma/newline list, exact match)
- `JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS` (comma/newline list, origin allowlist fallback)
- `JUMPFLIX_MCP_OAUTH_SCOPES` (supported scopes, default `jumpflix.read`)
- `JUMPFLIX_MCP_OAUTH_REQUIRED_SCOPES` (required scopes for MCP access, default first supported scope)
- `JUMPFLIX_MCP_OAUTH_REQUIRE_USER_SESSION` (`true/false`, default `false`)
- `JUMPFLIX_MCP_OAUTH_DEFAULT_SUBJECT` (default subject claim when session is not required)
- `JUMPFLIX_MCP_OAUTH_CODE_TTL_SECONDS` (default `300`)
- `JUMPFLIX_MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS` (default `3600`)

OAuth discovery endpoints:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration` (compatibility alias for OAuth discovery clients)
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/register` (Dynamic Client Registration; advertised through authorization server metadata)

The MCP route returns `WWW-Authenticate: Bearer ... resource_metadata="..."` challenges when OAuth is enabled, so clients can discover authorization metadata automatically.

### Static Bearer Fallback

Set one of:

- `JUMPFLIX_MCP_BEARER_TOKEN` (preferred)
- `MCP_BEARER_TOKEN` (fallback)

If OAuth is disabled and no static token is configured, the endpoint returns an authorization configuration error.

## Environment Variables

- `JUMPFLIX_MCP_OAUTH_SIGNING_SECRET` (required for OAuth mode)
- `JUMPFLIX_MCP_OAUTH_CLIENT_ID` (optional, default `jumpflix-chatgpt`)
- `JUMPFLIX_MCP_OAUTH_CLIENT_SECRET` (optional)
- `JUMPFLIX_MCP_OAUTH_ISSUER` (optional)
- `JUMPFLIX_MCP_OAUTH_RESOURCE` (optional)
- `JUMPFLIX_MCP_OAUTH_ENABLE_DCR` (optional)
- `JUMPFLIX_MCP_OAUTH_DCR_AUTH_METHODS` (optional)
- `JUMPFLIX_MCP_OAUTH_DCR_CLIENT_TTL_SECONDS` (optional)
- `JUMPFLIX_MCP_OAUTH_ENABLE_CIMD` (optional)
- `JUMPFLIX_MCP_OAUTH_CIMD_ALLOWED_HOSTS` (optional)
- `JUMPFLIX_MCP_OAUTH_CIMD_CACHE_TTL_SECONDS` (optional)
- `JUMPFLIX_MCP_OAUTH_CIMD_FETCH_TIMEOUT_MS` (optional)
- `JUMPFLIX_MCP_OAUTH_JWKS_CACHE_TTL_SECONDS` (optional)
- `JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_URIS` (optional)
- `JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS` (optional)
- `JUMPFLIX_MCP_OAUTH_SCOPES` (optional, default `jumpflix.read`)
- `JUMPFLIX_MCP_OAUTH_REQUIRED_SCOPES` (optional)
- `JUMPFLIX_MCP_OAUTH_REQUIRE_USER_SESSION` (optional)
- `JUMPFLIX_MCP_OAUTH_DEFAULT_SUBJECT` (optional)
- `JUMPFLIX_MCP_OAUTH_CODE_TTL_SECONDS` (optional)
- `JUMPFLIX_MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS` (optional)
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

### ChatGPT Connector Notes

For ChatGPT App connectors:

- MCP Server URL: `https://www.jumpflix.tv/mcp`
- Auth URL: `https://www.jumpflix.tv/oauth/authorize`
- Token URL: `https://www.jumpflix.tv/oauth/token`
- Authorization server base: `https://www.jumpflix.tv`
- Resource: `https://www.jumpflix.tv/mcp`
- Base/default scope: `jumpflix.read`

Client setup method:

- Prefer `Dynamic Client Registration (DCR)` when available.
- `Client Identifier Metadata Document (CIMD)` is also supported and advertised as `client_id_metadata_document_supported: true`.
- `User-Defined OAuth Client` also works.
- OAuth Client ID must match `JUMPFLIX_MCP_OAUTH_CLIENT_ID`.
- OAuth Client Secret is optional. If provided, it must match `JUMPFLIX_MCP_OAUTH_CLIENT_SECRET`.
- If no client secret is configured, use token endpoint auth method `none`.
- If a client secret is configured, use `client_secret_post` or `client_secret_basic`.

DCR notes:

- DCR is advertised via `registration_endpoint` in `/.well-known/oauth-authorization-server`.
- Registered DCR clients are stateless signed client IDs (no server-side DB needed).
- For ChatGPT connector callbacks, allow `https://chatgpt.com` (and/or `https://chat.openai.com`) via redirect policy settings.

CIMD notes:

- CIMD clients must use HTTPS `client_id` URLs with a path component that returns a JSON metadata document.
- This server accepts CIMD clients with `token_endpoint_auth_method=none` and `token_endpoint_auth_method=private_key_jwt` (`RS256` + `jwks_uri`).
- If you set `JUMPFLIX_MCP_OAUTH_CIMD_ALLOWED_HOSTS`, only those metadata document hosts are accepted.

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
