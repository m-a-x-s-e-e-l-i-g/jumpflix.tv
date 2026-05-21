import { createHash, createHmac, createPublicKey, createVerify, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

const DEFAULT_SCOPE = 'jumpflix.read';
const DEFAULT_CLIENT_ID = 'jumpflix-chatgpt';
const DEFAULT_CODE_TTL_SECONDS = 300;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
const DEFAULT_SUBJECT = 'jumpflix-connector-user';
const DEFAULT_DCR_CLIENT_TTL_SECONDS = 31_536_000;
const DEFAULT_CIMD_CACHE_TTL_SECONDS = 300;
const DEFAULT_CIMD_FETCH_TIMEOUT_MS = 3000;
const DEFAULT_JWKS_CACHE_TTL_SECONDS = 300;
const CLIENT_ASSERTION_TYPE_JWT_BEARER = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const CLIENT_ASSERTION_CLOCK_SKEW_SECONDS = 60;

const ALL_TOKEN_ENDPOINT_AUTH_METHODS: TokenEndpointAuthMethod[] = [
	'none',
	'client_secret_post',
	'client_secret_basic'
];

const DEFAULT_ALLOWED_REDIRECT_ORIGINS = [
	'https://chatgpt.com',
	'https://chat.openai.com',
	'http://localhost',
	'http://127.0.0.1'
];

const usedAuthorizationCodes = new Map<string, number>();
const cimdClientCache = new Map<string, { client: CimdClientMetadata; expiresAt: number }>();
const jwksCache = new Map<string, { keys: JwkKey[]; expiresAt: number }>();

type JwtPayload = Record<string, unknown>;

export type TokenEndpointAuthMethod =
	| 'none'
	| 'client_secret_post'
	| 'client_secret_basic'
	| 'private_key_jwt';

export type OAuthServerConfig = {
	enabled: boolean;
	issuer: string;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	registrationEndpoint: string;
	resourceMetadataUrl: string;
	mcpResource: string;
	scopesSupported: string[];
	requiredScopes: string[];
	clientId: string;
	clientSecret: string;
	tokenEndpointAuthMethodsSupported: TokenEndpointAuthMethod[];
	dcrEnabled: boolean;
	dcrAuthMethodsSupported: TokenEndpointAuthMethod[];
	dcrClientTtlSeconds: number;
	cimdEnabled: boolean;
	cimdCacheTtlSeconds: number;
	cimdAllowedHosts: Set<string>;
	cimdFetchTimeoutMs: number;
	jwksCacheTtlSeconds: number;
	allowedRedirectUris: Set<string>;
	allowedRedirectOrigins: Set<string>;
	requireUserSession: boolean;
	defaultSubject: string;
	codeTtlSeconds: number;
	accessTokenTtlSeconds: number;
	jwtSecret: string;
};

export type AccessTokenValidationResult =
	| {
			ok: true;
			subject: string;
			scopes: string[];
		}
	| {
			ok: false;
			status: 401 | 403;
			error: 'invalid_token' | 'insufficient_scope';
			errorDescription: string;
			requiredScope: string;
		};

type AuthCodePayload = {
	typ: 'jumpflix_mcp_auth_code';
	iss: string;
	aud: string;
	sub: string;
	redirect_uri: string;
	code_challenge: string;
	code_challenge_method: 'S256';
	scope: string;
	resource: string;
	jti: string;
	iat: number;
	exp: number;
};

type AccessTokenPayload = {
	typ: 'jumpflix_mcp_access_token';
	iss: string;
	aud: string;
	sub: string;
	scope: string;
	client_id: string;
	iat: number;
	exp: number;
};

type DynamicClientPayload = {
	typ: 'jumpflix_mcp_dynamic_client';
	iss: string;
	client_id: string;
	client_name?: string;
	redirect_uris: string[];
	token_endpoint_auth_method: TokenEndpointAuthMethod;
	client_secret_hash?: string;
	client_secret_expires_at: number;
	grant_types: ['authorization_code'];
	response_types: ['code'];
	iat: number;
	exp: number;
	jti: string;
};

type DynamicClientMetadata = {
	clientId: string;
	clientName: string | null;
	redirectUris: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	clientSecretHash: string | null;
	clientSecretExpiresAt: number;
	grantTypes: ['authorization_code'];
	responseTypes: ['code'];
	issuedAt: number;
	expiresAt: number;
};

type CimdClientMetadata = {
	clientId: string;
	clientName: string | null;
	redirectUris: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	tokenEndpointAuthSigningAlg: 'RS256' | null;
	jwksUri: string | null;
	grantTypes: ['authorization_code'];
	responseTypes: ['code'];
	issuedAt: number;
	expiresAt: number;
};

type ResolvedOAuthClient = {
	clientId: string;
	clientName: string | null;
	redirectUris: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	clientSecretHash: string | null;
	clientSecretExpiresAt: number;
	tokenEndpointAuthSigningAlg: 'RS256' | null;
	jwksUri: string | null;
	kind: 'static' | 'dynamic' | 'cimd';
};

type JwkKey = {
	kty: string;
	use?: string;
	key_ops?: string[];
	alg?: string;
	kid?: string;
	n?: string;
	e?: string;
	[k: string]: unknown;
};

export type DynamicClientRegistrationResult =
	| {
			ok: true;
			status: 201;
			body: Record<string, unknown>;
		}
	| {
			ok: false;
			status: 400;
			error: 'invalid_client_metadata' | 'invalid_redirect_uri';
			errorDescription: string;
		};

type AuthorizationCodeExchangeResult =
	| {
			ok: true;
			accessToken: string;
			expiresIn: number;
			scope: string;
		}
	| {
			ok: false;
			status: 400 | 401;
			error: 'invalid_request' | 'invalid_grant' | 'invalid_client' | 'invalid_scope' | 'invalid_target';
			errorDescription: string;
		};

export function resolveOAuthServerConfig(requestUrl: URL): OAuthServerConfig {
	const issuer = resolveIssuer(requestUrl);
	const mcpResource = resolveMcpResource(issuer);
	const scopesSupported = parseScopeList(env.JUMPFLIX_MCP_OAUTH_SCOPES);
	if (scopesSupported.length === 0) scopesSupported.push(DEFAULT_SCOPE);

	const requiredScopes = parseScopeList(env.JUMPFLIX_MCP_OAUTH_REQUIRED_SCOPES);
	const normalizedRequiredScopes =
		requiredScopes.length > 0
			? Array.from(new Set(requiredScopes))
			: [scopesSupported[0]];

	const clientSecret = env.JUMPFLIX_MCP_OAUTH_CLIENT_SECRET?.trim() || '';
	const staticClientAuthMethods: TokenEndpointAuthMethod[] = clientSecret
		? ['client_secret_post', 'client_secret_basic']
		: ['none'];

	const dcrEnabled = parseBoolean(env.JUMPFLIX_MCP_OAUTH_ENABLE_DCR, true);
	const configuredDcrAuthMethods = parseTokenEndpointAuthMethods(env.JUMPFLIX_MCP_OAUTH_DCR_AUTH_METHODS);
	const dcrAuthMethodsSupported =
		configuredDcrAuthMethods.length > 0 ? configuredDcrAuthMethods : ALL_TOKEN_ENDPOINT_AUTH_METHODS;

	const cimdEnabled = parseBoolean(env.JUMPFLIX_MCP_OAUTH_ENABLE_CIMD, true);
	const cimdAllowedHosts = new Set(parseHostList(env.JUMPFLIX_MCP_OAUTH_CIMD_ALLOWED_HOSTS));

	const tokenEndpointAuthMethodsSupported = Array.from(
		new Set([
			...staticClientAuthMethods,
			...(dcrEnabled ? dcrAuthMethodsSupported : []),
			...(cimdEnabled ? (['none', 'private_key_jwt'] as TokenEndpointAuthMethod[]) : [])
		])
	);

	const allowedRedirectUris = new Set(
		parseUriList(env.JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_URIS)
			.map((value) => normalizeRedirectUri(value))
			.filter((value): value is string => value !== null)
	);

	const configuredOrigins = parseUriList(env.JUMPFLIX_MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS)
		.map((value) => normalizeOrigin(value))
		.filter((value): value is string => value !== null);

	const allowedRedirectOrigins = new Set(
		(configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_REDIRECT_ORIGINS)
			.map((value) => normalizeOrigin(value))
			.filter((value): value is string => value !== null)
	);

	const jwtSecret = env.JUMPFLIX_MCP_OAUTH_SIGNING_SECRET?.trim() || '';
	const clientId = env.JUMPFLIX_MCP_OAUTH_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID;

	return {
		enabled: Boolean(jwtSecret),
		issuer,
		authorizationEndpoint: `${issuer}/oauth/authorize`,
		tokenEndpoint: `${issuer}/oauth/token`,
		registrationEndpoint: `${issuer}/oauth/register`,
		resourceMetadataUrl: `${issuer}/.well-known/oauth-protected-resource/mcp`,
		mcpResource,
		scopesSupported,
		requiredScopes: normalizedRequiredScopes,
		clientId,
		clientSecret,
		tokenEndpointAuthMethodsSupported,
		dcrEnabled,
		dcrAuthMethodsSupported,
		dcrClientTtlSeconds: clampInt(
			env.JUMPFLIX_MCP_OAUTH_DCR_CLIENT_TTL_SECONDS,
			DEFAULT_DCR_CLIENT_TTL_SECONDS,
			86_400,
			157_680_000
		),
		cimdEnabled,
		cimdCacheTtlSeconds: clampInt(
			env.JUMPFLIX_MCP_OAUTH_CIMD_CACHE_TTL_SECONDS,
			DEFAULT_CIMD_CACHE_TTL_SECONDS,
			10,
			3_600
		),
		cimdAllowedHosts,
		cimdFetchTimeoutMs: clampInt(
			env.JUMPFLIX_MCP_OAUTH_CIMD_FETCH_TIMEOUT_MS,
			DEFAULT_CIMD_FETCH_TIMEOUT_MS,
			500,
			10_000
		),
		jwksCacheTtlSeconds: clampInt(
			env.JUMPFLIX_MCP_OAUTH_JWKS_CACHE_TTL_SECONDS,
			DEFAULT_JWKS_CACHE_TTL_SECONDS,
			10,
			3_600
		),
		allowedRedirectUris,
		allowedRedirectOrigins,
		requireUserSession: parseBoolean(env.JUMPFLIX_MCP_OAUTH_REQUIRE_USER_SESSION, false),
		defaultSubject: env.JUMPFLIX_MCP_OAUTH_DEFAULT_SUBJECT?.trim() || DEFAULT_SUBJECT,
		codeTtlSeconds: clampInt(env.JUMPFLIX_MCP_OAUTH_CODE_TTL_SECONDS, DEFAULT_CODE_TTL_SECONDS, 60, 900),
		accessTokenTtlSeconds: clampInt(
			env.JUMPFLIX_MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
			DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
			300,
			86_400
		),
		jwtSecret
	};
}

export function isOAuthEnabled(config: OAuthServerConfig): boolean {
	return config.enabled;
}

export function isDynamicClientRegistrationEnabled(config: OAuthServerConfig): boolean {
	return config.enabled && config.dcrEnabled;
}

export function requiredScopeString(config: OAuthServerConfig): string {
	return config.requiredScopes.join(' ');
}

export function buildProtectedResourceMetadata(config: OAuthServerConfig): Record<string, unknown> {
	return {
		resource: config.mcpResource,
		authorization_servers: [config.issuer],
		scopes_supported: config.scopesSupported,
		bearer_methods_supported: ['header']
	};
}

export function buildAuthorizationServerMetadata(config: OAuthServerConfig): Record<string, unknown> {
	const metadata: Record<string, unknown> = {
		issuer: config.issuer,
		authorization_endpoint: config.authorizationEndpoint,
		token_endpoint: config.tokenEndpoint,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: config.tokenEndpointAuthMethodsSupported,
		scopes_supported: config.scopesSupported,
		client_id_metadata_document_supported: config.cimdEnabled
	};

	if (config.dcrEnabled) {
		metadata.registration_endpoint = config.registrationEndpoint;
	}

	return metadata;
}

export function buildWwwAuthenticateHeader(
	config: OAuthServerConfig,
	options?: {
		error?: 'invalid_token' | 'insufficient_scope';
		errorDescription?: string;
		scope?: string;
	}
): string {
	const parts = [`Bearer resource_metadata="${config.resourceMetadataUrl}"`];
	const scope = options?.scope || requiredScopeString(config);
	if (scope) {
		parts.push(`scope="${escapeHeaderValue(scope)}"`);
	}
	if (options?.error) {
		parts.push(`error="${options.error}"`);
	}
	if (options?.errorDescription) {
		parts.push(`error_description="${escapeHeaderValue(options.errorDescription)}"`);
	}

	return parts.join(', ');
}

export function normalizeAndValidateRedirectUri(
	rawRedirectUri: string,
	config: OAuthServerConfig
): string | null {
	return normalizeAndValidateRedirectUriForPolicy(rawRedirectUri, config);
}

export async function normalizeAndValidateRedirectUriForClient(
	rawRedirectUri: string,
	clientId: string,
	config: OAuthServerConfig
): Promise<string | null> {
	if (clientId === config.clientId) {
		return normalizeAndValidateRedirectUriForPolicy(rawRedirectUri, config);
	}

	const resolvedClient = await resolveOAuthClient(clientId, config);
	if (!resolvedClient) return null;
	if (resolvedClient.kind === 'static') {
		return normalizeAndValidateRedirectUriForPolicy(rawRedirectUri, config);
	}

	const normalized = normalizeRedirectUri(rawRedirectUri);
	if (!normalized) return null;
	return resolvedClient.redirectUris.includes(normalized) ? normalized : null;
}

export async function resolveOAuthClient(
	clientId: string,
	config: OAuthServerConfig
): Promise<ResolvedOAuthClient | null> {
	if (!clientId) return null;

	if (clientId === config.clientId) {
		return {
			clientId,
			clientName: 'JumpFlix MCP Static Client',
			redirectUris: [],
			tokenEndpointAuthMethod: config.clientSecret ? 'client_secret_post' : 'none',
			clientSecretHash: config.clientSecret ? hashClientSecret(config.clientSecret) : null,
			clientSecretExpiresAt: 0,
			tokenEndpointAuthSigningAlg: null,
			jwksUri: null,
			kind: 'static'
		};
	}

	const dynamicClient = resolveDynamicClient(clientId, config);
	if (dynamicClient) {
		return {
			clientId: dynamicClient.clientId,
			clientName: dynamicClient.clientName,
			redirectUris: dynamicClient.redirectUris,
			tokenEndpointAuthMethod: dynamicClient.tokenEndpointAuthMethod,
			clientSecretHash: dynamicClient.clientSecretHash,
			clientSecretExpiresAt: dynamicClient.clientSecretExpiresAt,
			tokenEndpointAuthSigningAlg: null,
			jwksUri: null,
			kind: 'dynamic'
		};
	}

	const cimdClient = await resolveCimdClient(clientId, config);
	if (cimdClient) {
		return {
			clientId: cimdClient.clientId,
			clientName: cimdClient.clientName,
			redirectUris: cimdClient.redirectUris,
			tokenEndpointAuthMethod: cimdClient.tokenEndpointAuthMethod,
			clientSecretHash: null,
			clientSecretExpiresAt: 0,
			tokenEndpointAuthSigningAlg: cimdClient.tokenEndpointAuthSigningAlg,
			jwksUri: cimdClient.jwksUri,
			kind: 'cimd'
		};
	}

	return null;
}

export function registerDynamicClient(
	input: unknown,
	config: OAuthServerConfig
): DynamicClientRegistrationResult {
	if (!config.dcrEnabled) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: 'Dynamic Client Registration is disabled.'
		};
	}

	if (!isRecord(input)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: 'Request body must be a JSON object.'
		};
	}

	const redirectUrisRaw = input.redirect_uris;
	if (!Array.isArray(redirectUrisRaw) || redirectUrisRaw.length === 0) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_redirect_uri',
			errorDescription: 'redirect_uris must be a non-empty array.'
		};
	}

	const normalizedRedirectUris = Array.from(
		new Set(
			redirectUrisRaw
				.filter((entry): entry is string => typeof entry === 'string')
				.map((entry) => normalizeAndValidateRedirectUriForPolicy(entry, config))
				.filter((entry): entry is string => Boolean(entry))
		)
	);

	if (normalizedRedirectUris.length === 0 || normalizedRedirectUris.length !== redirectUrisRaw.length) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_redirect_uri',
			errorDescription: 'One or more redirect_uris are invalid or not allowed.'
		};
	}

	const tokenEndpointAuthMethodRaw =
		typeof input.token_endpoint_auth_method === 'string'
			? input.token_endpoint_auth_method.trim()
			: '';
	const tokenEndpointAuthMethod: TokenEndpointAuthMethod = isTokenEndpointAuthMethod(
		tokenEndpointAuthMethodRaw
	)
		? tokenEndpointAuthMethodRaw
		: 'none';

	if (!config.dcrAuthMethodsSupported.includes(tokenEndpointAuthMethod)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: `Unsupported token_endpoint_auth_method: ${tokenEndpointAuthMethod}`
		};
	}

	if (tokenEndpointAuthMethod === 'private_key_jwt') {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: 'private_key_jwt is not supported for DCR clients on this server.'
		};
	}

	if (input.grant_types !== undefined && !isAuthorizationCodeGrantOnly(input.grant_types)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: 'Only grant_types=["authorization_code"] is supported.'
		};
	}

	if (input.response_types !== undefined && !isCodeResponseTypeOnly(input.response_types)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_client_metadata',
			errorDescription: 'Only response_types=["code"] is supported.'
		};
	}

	const clientName =
		typeof input.client_name === 'string' && input.client_name.trim().length > 0
			? input.client_name.trim().slice(0, 120)
			: null;

	const now = nowInSeconds();
	const generatedClientId = `dcr_${randomUUID()}`;
	const clientSecret =
		tokenEndpointAuthMethod === 'none'
			? null
			: `${randomUUID()}${randomUUID().replace(/-/g, '')}`;

	const payload: DynamicClientPayload = {
		typ: 'jumpflix_mcp_dynamic_client',
		iss: config.issuer,
		client_id: generatedClientId,
		client_name: clientName || undefined,
		redirect_uris: normalizedRedirectUris,
		token_endpoint_auth_method: tokenEndpointAuthMethod,
		client_secret_hash: clientSecret ? hashClientSecret(clientSecret) : undefined,
		client_secret_expires_at: 0,
		grant_types: ['authorization_code'],
		response_types: ['code'],
		iat: now,
		exp: now + config.dcrClientTtlSeconds,
		jti: randomUUID()
	};

	const signedClientId = `dcr_${signJwt(payload, config.jwtSecret)}`;
	const responseBody: Record<string, unknown> = {
		client_id: signedClientId,
		client_id_issued_at: now,
		redirect_uris: normalizedRedirectUris,
		grant_types: ['authorization_code'],
		response_types: ['code'],
		token_endpoint_auth_method: tokenEndpointAuthMethod,
		scope: config.scopesSupported.join(' ')
	};

	if (clientName) {
		responseBody.client_name = clientName;
	}

	if (clientSecret) {
		responseBody.client_secret = clientSecret;
		responseBody.client_secret_expires_at = 0;
	}

	return {
		ok: true,
		status: 201,
		body: responseBody
	};
}

function normalizeAndValidateRedirectUriForPolicy(
	rawRedirectUri: string,
	config: OAuthServerConfig
): string | null {
	const normalized = normalizeRedirectUri(rawRedirectUri);
	if (!normalized) return null;

	const redirectUrl = new URL(normalized);
	const isLoopback = isLoopbackHost(redirectUrl.hostname);
	if (!isLoopback && redirectUrl.protocol !== 'https:') return null;

	if (config.allowedRedirectUris.size > 0) {
		return config.allowedRedirectUris.has(normalized) ? normalized : null;
	}

	if (isLoopback) return normalized;

	const origin = `${redirectUrl.protocol}//${redirectUrl.host}`;
	if (!config.allowedRedirectOrigins.has(origin)) return null;

	if ((origin === 'https://chatgpt.com' || origin === 'https://chat.openai.com') && !redirectUrl.pathname.startsWith('/connector/oauth/')) {
		return null;
	}

	return normalized;
}

export async function ensureClientAndRedirect(
	clientId: string,
	redirectUri: string,
	config: OAuthServerConfig
): Promise<{ ok: true; redirectUri: string } | { ok: false; error: string; errorDescription: string }> {
	if (!clientId) {
		return {
			ok: false,
			error: 'unauthorized_client',
			errorDescription: 'Unknown OAuth client_id.'
		};
	}

	const resolvedClient = await resolveOAuthClient(clientId, config);
	if (!resolvedClient) {
		return {
			ok: false,
			error: 'unauthorized_client',
			errorDescription: 'Unknown OAuth client_id.'
		};
	}

	const normalizedRedirectUri = await normalizeAndValidateRedirectUriForClient(
		redirectUri,
		clientId,
		config
	);
	if (!normalizedRedirectUri) {
		return {
			ok: false,
			error: 'invalid_request',
			errorDescription: 'Invalid or unregistered redirect_uri.'
		};
	}

	return { ok: true, redirectUri: normalizedRedirectUri };
}

export function resolveRequestedScopes(
	rawScope: string | null,
	config: OAuthServerConfig
): { ok: true; scopes: string[] } | { ok: false; errorDescription: string } {
	if (!rawScope?.trim()) {
		return { ok: true, scopes: config.requiredScopes };
	}

	const requested = parseScopeList(rawScope);
	if (requested.length === 0) {
		return { ok: true, scopes: config.requiredScopes };
	}

	const supported = new Set(config.scopesSupported);
	for (const scope of requested) {
		if (!supported.has(scope)) {
			return {
				ok: false,
				errorDescription: `Unsupported scope: ${scope}`
			};
		}
	}

	return { ok: true, scopes: requested };
}

export function resolveRequestedResource(rawResource: string | null, config: OAuthServerConfig): string | null {
	if (!rawResource?.trim()) return config.mcpResource;
	const canonical = canonicalizeResourceUri(rawResource);
	if (!canonical) return null;
	return resourcesMatch(canonical, config.mcpResource) ? config.mcpResource : null;
}

export function createAuthorizationCode(
	params: {
		clientId: string;
		redirectUri: string;
		codeChallenge: string;
		scopes: string[];
		resource: string;
		subject: string;
	},
	config: OAuthServerConfig
): string {
	const now = nowInSeconds();
	const payload: AuthCodePayload = {
		typ: 'jumpflix_mcp_auth_code',
		iss: config.issuer,
		aud: params.clientId,
		sub: params.subject,
		redirect_uri: params.redirectUri,
		code_challenge: params.codeChallenge,
		code_challenge_method: 'S256',
		scope: params.scopes.join(' '),
		resource: params.resource,
		jti: randomUUID(),
		iat: now,
		exp: now + config.codeTtlSeconds
	};

	return signJwt(payload, config.jwtSecret);
}

export function exchangeAuthorizationCodeForAccessToken(
	params: {
		code: string;
		clientId: string;
		redirectUri: string;
		codeVerifier: string;
		resource: string;
	},
	config: OAuthServerConfig
): AuthorizationCodeExchangeResult {
	const decoded = verifyJwt(params.code, config.jwtSecret);
	if (!decoded) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'Invalid authorization code.'
		};
	}

	if (decoded.typ !== 'jumpflix_mcp_auth_code') {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'Authorization code type is invalid.'
		};
	}

	const payload = decoded as AuthCodePayload;
	if (payload.iss !== config.issuer) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'Authorization code issuer mismatch.'
		};
	}

	if (payload.aud !== params.clientId) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Client does not match authorization code audience.'
		};
	}

	if (payload.redirect_uri !== params.redirectUri) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'redirect_uri does not match authorization code.'
		};
	}

	if (!resourcesMatch(payload.resource, params.resource)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_target',
			errorDescription: 'resource does not match authorization code.'
		};
	}

	if (!params.codeVerifier) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_request',
			errorDescription: 'Missing code_verifier.'
		};
	}

	const expectedChallenge = createHash('sha256').update(params.codeVerifier).digest('base64url');
	if (expectedChallenge !== payload.code_challenge) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'code_verifier is invalid.'
		};
	}

	if (isAuthorizationCodeUsed(payload.jti)) {
		return {
			ok: false,
			status: 400,
			error: 'invalid_grant',
			errorDescription: 'Authorization code already used.'
		};
	}

	markAuthorizationCodeUsed(payload.jti, payload.exp);

	const now = nowInSeconds();
	const tokenPayload: AccessTokenPayload = {
		typ: 'jumpflix_mcp_access_token',
		iss: config.issuer,
		aud: params.resource,
		sub: payload.sub,
		scope: payload.scope,
		client_id: params.clientId,
		iat: now,
		exp: now + config.accessTokenTtlSeconds
	};

	return {
		ok: true,
		accessToken: signJwt(tokenPayload, config.jwtSecret),
		expiresIn: config.accessTokenTtlSeconds,
		scope: payload.scope
	};
}

export function validateAccessToken(token: string, config: OAuthServerConfig): AccessTokenValidationResult {
	const decoded = verifyJwt(token, config.jwtSecret);
	if (!decoded) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_token',
			errorDescription: 'Access token is invalid or expired.',
			requiredScope: requiredScopeString(config)
		};
	}

	if (decoded.typ !== 'jumpflix_mcp_access_token') {
		return {
			ok: false,
			status: 401,
			error: 'invalid_token',
			errorDescription: 'Access token type is invalid.',
			requiredScope: requiredScopeString(config)
		};
	}

	const payload = decoded as AccessTokenPayload;
	if (payload.iss !== config.issuer) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_token',
			errorDescription: 'Access token issuer mismatch.',
			requiredScope: requiredScopeString(config)
		};
	}

	if (!resourcesMatch(payload.aud, config.mcpResource)) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_token',
			errorDescription: 'Access token audience mismatch.',
			requiredScope: requiredScopeString(config)
		};
	}

	const scopes = parseScopeList(payload.scope);
	const scopeSet = new Set(scopes);
	for (const requiredScope of config.requiredScopes) {
		if (!scopeSet.has(requiredScope)) {
			return {
				ok: false,
				status: 403,
				error: 'insufficient_scope',
				errorDescription: 'Access token does not include required scope.',
				requiredScope: requiredScopeString(config)
			};
		}
	}

	return {
		ok: true,
		subject: payload.sub,
		scopes
	};
}

export async function validateTokenEndpointClient(
	request: Request,
	params: URLSearchParams,
	config: OAuthServerConfig
): Promise<{ ok: true; clientId: string } | { ok: false; status: 401; error: string; errorDescription: string }> {
	const parsedBasic = parseBasicAuthHeader(request.headers.get('authorization'));
	const bodyClientId = params.get('client_id')?.trim() || '';
	const basicClientId = parsedBasic?.clientId || '';
	const clientId = bodyClientId || basicClientId;

	if (!clientId) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Unknown OAuth client_id.'
		};
	}

	if (parsedBasic && bodyClientId && parsedBasic.clientId !== bodyClientId) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Basic auth client_id does not match body client_id.'
		};
	}

	const resolvedClient = await resolveOAuthClient(clientId, config);
	if (!resolvedClient) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Unknown OAuth client_id.'
		};
	}

	if (
		resolvedClient.clientSecretExpiresAt > 0 &&
		resolvedClient.clientSecretExpiresAt <= nowInSeconds()
	) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Client credentials expired.'
		};
	}

	if (resolvedClient.kind === 'static') {
		if (config.clientSecret) {
			const providedSecret = parsedBasic?.clientSecret || params.get('client_secret')?.trim() || '';
			if (!providedSecret || !constantTimeEqual(providedSecret, config.clientSecret)) {
				return {
					ok: false,
					status: 401,
					error: 'invalid_client',
					errorDescription: 'Invalid client credentials.'
				};
			}
		}

		return { ok: true, clientId };
	}

	if (resolvedClient.tokenEndpointAuthMethod === 'none') {

		return { ok: true, clientId };
	}

	if (resolvedClient.tokenEndpointAuthMethod === 'private_key_jwt') {
		const assertionValidation = await validatePrivateKeyJwtClientAssertion(
			params,
			resolvedClient,
			config
		);
		if (!assertionValidation.ok) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: assertionValidation.errorDescription
			};
		}

		return { ok: true, clientId };
	}

	if (resolvedClient.kind === 'cimd') {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription:
				'Unsupported CIMD token_endpoint_auth_method for this server.'
		};
	}

	if (!resolvedClient.clientSecretHash) {
		return {
			ok: false,
			status: 401,
			error: 'invalid_client',
			errorDescription: 'Client is missing secret metadata.'
		};
	}

	if (resolvedClient.tokenEndpointAuthMethod === 'client_secret_basic') {
		if (!parsedBasic || parsedBasic.clientId !== clientId) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: 'client_secret_basic authentication is required.'
			};
		}

		if (!constantTimeEqual(hashClientSecret(parsedBasic.clientSecret), resolvedClient.clientSecretHash)) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: 'Invalid client credentials.'
			};
		}

		return { ok: true, clientId };
	}

	if (resolvedClient.tokenEndpointAuthMethod === 'client_secret_post') {
		if (parsedBasic) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: 'Use client_secret_post instead of Basic authentication.'
			};
		}

		const postedClientSecret = params.get('client_secret')?.trim() || '';
		if (!postedClientSecret) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: 'Missing client_secret for client_secret_post.'
			};
		}

		if (!constantTimeEqual(hashClientSecret(postedClientSecret), resolvedClient.clientSecretHash)) {
			return {
				ok: false,
				status: 401,
				error: 'invalid_client',
				errorDescription: 'Invalid client credentials.'
			};
		}

		return { ok: true, clientId };
	}

	return {
		ok: false,
		status: 401,
		error: 'invalid_client',
		errorDescription: 'Unsupported token endpoint auth method.'
	};
}

export function oauthJsonResponse(status: number, body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
			Pragma: 'no-cache'
		}
	});
}

function resolveIssuer(requestUrl: URL): string {
	const configured = env.JUMPFLIX_MCP_OAUTH_ISSUER?.trim();
	if (configured) {
		try {
			const parsed = new URL(configured);
			return `${parsed.protocol}//${parsed.host}`;
		} catch {
			// fall back to request origin when configured issuer is invalid
		}
	}
	return `${requestUrl.protocol}//${requestUrl.host}`;
}

function resolveMcpResource(issuer: string): string {
	const configured = env.JUMPFLIX_MCP_OAUTH_RESOURCE?.trim();
	if (configured) {
		const canonical = canonicalizeResourceUri(configured);
		if (canonical) return canonical;
	}
	return `${issuer}/mcp`;
}

function parseScopeList(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return Array.from(new Set(raw.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean)));
}

function parseUriList(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(/[\n,]/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseHostList(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return Array.from(
		new Set(
			raw
				.split(/[\s,]+/)
				.map((entry) => entry.trim().toLowerCase())
				.filter(Boolean)
		)
	);
}

function parseTokenEndpointAuthMethods(raw: string | null | undefined): TokenEndpointAuthMethod[] {
	if (!raw) return [];
	const methods = Array.from(
		new Set(
			raw
				.split(/[\s,]+/)
				.map((entry) => entry.trim())
				.filter((entry): entry is TokenEndpointAuthMethod => isTokenEndpointAuthMethod(entry))
		)
	);
	return methods;
}

function isTokenEndpointAuthMethod(value: string): value is TokenEndpointAuthMethod {
	return (
		value === 'none' ||
		value === 'client_secret_post' ||
		value === 'client_secret_basic' ||
		value === 'private_key_jwt'
	);
}

function isAuthorizationCodeGrantOnly(value: unknown): boolean {
	if (!Array.isArray(value) || value.length === 0) return false;
	return value.every((item) => item === 'authorization_code');
}

function includesAuthorizationCodeGrant(value: unknown): boolean {
	if (!Array.isArray(value) || value.length === 0) return false;
	const normalized = value.filter((item): item is string => typeof item === 'string');
	if (normalized.length !== value.length) return false;
	return normalized.includes('authorization_code');
}

function isCodeResponseTypeOnly(value: unknown): boolean {
	if (!Array.isArray(value) || value.length === 0) return false;
	return value.every((item) => item === 'code');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpsUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

function resolveDynamicClient(clientId: string, config: OAuthServerConfig): DynamicClientMetadata | null {
	if (!config.dcrEnabled) return null;
	if (!clientId.startsWith('dcr_')) return null;

	const signedPayload = clientId.slice(4).trim();
	if (!signedPayload) return null;

	const decoded = verifyJwt(signedPayload, config.jwtSecret);
	if (!decoded || decoded.typ !== 'jumpflix_mcp_dynamic_client') return null;

	const payload = decoded as DynamicClientPayload;
	if (payload.iss !== config.issuer) return null;
	if (!payload.client_id || typeof payload.client_id !== 'string') return null;
	if (!Array.isArray(payload.redirect_uris) || payload.redirect_uris.length === 0) return null;
	if (!isTokenEndpointAuthMethod(payload.token_endpoint_auth_method)) return null;
	if (!config.dcrAuthMethodsSupported.includes(payload.token_endpoint_auth_method)) return null;

	const redirectUris = payload.redirect_uris
		.map((uri) => normalizeRedirectUri(uri))
		.filter((uri): uri is string => Boolean(uri));

	if (redirectUris.length !== payload.redirect_uris.length) return null;

	if (
		payload.client_secret_hash !== undefined &&
		(typeof payload.client_secret_hash !== 'string' || payload.client_secret_hash.length < 16)
	) {
		return null;
	}

	if (
		typeof payload.client_secret_expires_at !== 'number' ||
		!Number.isFinite(payload.client_secret_expires_at)
	) {
		return null;
	}

	return {
		clientId,
		clientName: typeof payload.client_name === 'string' ? payload.client_name : null,
		redirectUris,
		tokenEndpointAuthMethod: payload.token_endpoint_auth_method,
		clientSecretHash: typeof payload.client_secret_hash === 'string' ? payload.client_secret_hash : null,
		clientSecretExpiresAt: payload.client_secret_expires_at,
		grantTypes: ['authorization_code'],
		responseTypes: ['code'],
		issuedAt: typeof payload.iat === 'number' ? payload.iat : nowInSeconds(),
		expiresAt: typeof payload.exp === 'number' ? payload.exp : nowInSeconds()
	};
}

function hashClientSecret(secret: string): string {
	return createHash('sha256').update(secret).digest('base64url');
}

async function resolveCimdClient(
	clientId: string,
	config: OAuthServerConfig
): Promise<CimdClientMetadata | null> {
	if (!config.cimdEnabled) return null;

	const clientIdUrl = parseClientIdMetadataUrl(clientId, config);
	if (!clientIdUrl) return null;

	pruneCimdClientCache();
	const cached = cimdClientCache.get(clientId);
	if (cached && cached.expiresAt > nowInSeconds()) {
		return cached.client;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.cimdFetchTimeoutMs);

	try {
		const response = await fetch(clientIdUrl.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			},
			redirect: 'follow',
			signal: controller.signal
		});

		if (!response.ok) return null;

		const payload = (await response.json()) as unknown;
		const parsed = parseCimdClientMetadata(payload, clientIdUrl.toString(), config);
		if (!parsed) return null;

		const now = nowInSeconds();
		const cacheTtl = Math.max(
			1,
			Math.min(config.cimdCacheTtlSeconds, parseHttpMaxAge(response.headers.get('cache-control')))
		);

		cimdClientCache.set(clientIdUrl.toString(), {
			client: parsed,
			expiresAt: now + cacheTtl
		});

		return parsed;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function parseClientIdMetadataUrl(clientId: string, config: OAuthServerConfig): URL | null {
	try {
		const parsed = new URL(clientId);
		if (parsed.protocol !== 'https:') return null;
		if (!parsed.pathname || parsed.pathname === '/') return null;
		if (parsed.hash) return null;

		const host = parsed.hostname.toLowerCase();
		if (config.cimdAllowedHosts.size > 0 && !config.cimdAllowedHosts.has(host)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

function parseCimdClientMetadata(
	payload: unknown,
	clientId: string,
	config: OAuthServerConfig
): CimdClientMetadata | null {
	if (!isRecord(payload)) return null;
	if (payload.client_id !== clientId) return null;

	const redirectUrisRaw = payload.redirect_uris;
	if (!Array.isArray(redirectUrisRaw) || redirectUrisRaw.length === 0) return null;

	const redirectUris = Array.from(
		new Set(
			redirectUrisRaw
				.filter((entry): entry is string => typeof entry === 'string')
				.map((entry) => normalizeAndValidateRedirectUriForPolicy(entry, config))
				.filter((entry): entry is string => Boolean(entry))
		)
	);

	if (redirectUris.length !== redirectUrisRaw.length) return null;

	const tokenEndpointAuthMethod =
		typeof payload.token_endpoint_auth_method === 'string' &&
		isTokenEndpointAuthMethod(payload.token_endpoint_auth_method)
			? payload.token_endpoint_auth_method
			: 'none';

	if (tokenEndpointAuthMethod !== 'none' && tokenEndpointAuthMethod !== 'private_key_jwt') {
		return null;
	}

	const tokenEndpointAuthSigningAlg =
		typeof payload.token_endpoint_auth_signing_alg === 'string'
			? payload.token_endpoint_auth_signing_alg
			: null;

	const jwksUri = typeof payload.jwks_uri === 'string' ? payload.jwks_uri : null;

	if (tokenEndpointAuthMethod === 'private_key_jwt') {
		if (tokenEndpointAuthSigningAlg !== 'RS256') return null;
		if (!jwksUri) return null;
		if (!isHttpsUrl(jwksUri)) return null;
	}

	if (payload.grant_types !== undefined && !includesAuthorizationCodeGrant(payload.grant_types)) {
		return null;
	}

	if (payload.response_types !== undefined && !isCodeResponseTypeOnly(payload.response_types)) {
		return null;
	}

	const now = nowInSeconds();
	return {
		clientId,
		clientName: typeof payload.client_name === 'string' ? payload.client_name.slice(0, 120) : null,
		redirectUris,
		tokenEndpointAuthMethod,
		tokenEndpointAuthSigningAlg: tokenEndpointAuthMethod === 'private_key_jwt' ? 'RS256' : null,
		jwksUri: tokenEndpointAuthMethod === 'private_key_jwt' ? jwksUri : null,
		grantTypes: ['authorization_code'],
		responseTypes: ['code'],
		issuedAt: now,
		expiresAt: now + config.cimdCacheTtlSeconds
	};
}

async function validatePrivateKeyJwtClientAssertion(
	params: URLSearchParams,
	client: ResolvedOAuthClient,
	config: OAuthServerConfig
): Promise<{ ok: true } | { ok: false; errorDescription: string }> {
	if (client.kind !== 'cimd') {
		return {
			ok: false,
			errorDescription: 'private_key_jwt is only supported for CIMD clients.'
		};
	}

	if (!client.jwksUri || client.tokenEndpointAuthSigningAlg !== 'RS256') {
		return {
			ok: false,
			errorDescription: 'CIMD client is missing private_key_jwt signing metadata.'
		};
	}

	const assertionType = params.get('client_assertion_type')?.trim() || '';
	const assertion = params.get('client_assertion')?.trim() || '';

	if (assertionType !== CLIENT_ASSERTION_TYPE_JWT_BEARER) {
		return {
			ok: false,
			errorDescription: 'Invalid client_assertion_type for private_key_jwt.'
		};
	}

	if (!assertion) {
		return {
			ok: false,
			errorDescription: 'Missing client_assertion for private_key_jwt.'
		};
	}

	const parsedAssertion = parseJwtWithoutVerification(assertion);
	if (!parsedAssertion) {
		return {
			ok: false,
			errorDescription: 'Malformed client_assertion JWT.'
		};
	}

	if (parsedAssertion.header.alg !== 'RS256') {
		return {
			ok: false,
			errorDescription: 'client_assertion must use RS256.'
		};
	}

	const payload = parsedAssertion.payload;
	if (payload.iss !== client.clientId || payload.sub !== client.clientId) {
		return {
			ok: false,
			errorDescription: 'client_assertion iss/sub must match client_id.'
		};
	}

	if (!audienceMatches(payload.aud, config.tokenEndpoint, config.issuer)) {
		return {
			ok: false,
			errorDescription: 'client_assertion aud is invalid for this token endpoint.'
		};
	}

	const now = nowInSeconds();
	if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
		return {
			ok: false,
			errorDescription: 'client_assertion exp claim is required.'
		};
	}

	if (payload.exp <= now - CLIENT_ASSERTION_CLOCK_SKEW_SECONDS) {
		return {
			ok: false,
			errorDescription: 'client_assertion has expired.'
		};
	}

	if (
		typeof payload.nbf === 'number' &&
		Number.isFinite(payload.nbf) &&
		payload.nbf > now + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS
	) {
		return {
			ok: false,
			errorDescription: 'client_assertion is not valid yet.'
		};
	}

	if (
		typeof payload.iat === 'number' &&
		Number.isFinite(payload.iat) &&
		payload.iat > now + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS
	) {
		return {
			ok: false,
			errorDescription: 'client_assertion iat is in the future.'
		};
	}

	const keys = await fetchJwksKeys(client.jwksUri, config);
	if (!keys || keys.length === 0) {
		return {
			ok: false,
			errorDescription: 'Unable to load client JWKS for private_key_jwt.'
		};
	}

	const candidateKeys = selectJwkCandidates(keys, parsedAssertion.header.kid);
	if (candidateKeys.length === 0) {
		return {
			ok: false,
			errorDescription: 'No compatible JWK found for client_assertion.'
		};
	}

	const isValidSignature = candidateKeys.some((key) =>
		verifyRs256JwtSignature(parsedAssertion.signingInput, parsedAssertion.signature, key)
	);

	if (!isValidSignature) {
		return {
			ok: false,
			errorDescription: 'Invalid client_assertion signature.'
		};
	}

	return { ok: true };
}

async function fetchJwksKeys(jwksUri: string, config: OAuthServerConfig): Promise<JwkKey[] | null> {
	pruneJwksCache();
	const cached = jwksCache.get(jwksUri);
	if (cached && cached.expiresAt > nowInSeconds()) {
		return cached.keys;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.cimdFetchTimeoutMs);

	try {
		const response = await fetch(jwksUri, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			},
			redirect: 'follow',
			signal: controller.signal
		});

		if (!response.ok) return null;

		const payload = (await response.json()) as unknown;
		if (!isRecord(payload) || !Array.isArray(payload.keys)) {
			return null;
		}

		const keys = payload.keys
			.filter((entry): entry is JwkKey => isRecord(entry))
			.filter((entry) => entry.kty === 'RSA' && typeof entry.n === 'string' && typeof entry.e === 'string');

		if (keys.length === 0) {
			return null;
		}

		const now = nowInSeconds();
		const cacheTtl = Math.max(
			1,
			Math.min(config.jwksCacheTtlSeconds, parseHttpMaxAge(response.headers.get('cache-control')))
		);

		jwksCache.set(jwksUri, {
			keys,
			expiresAt: now + cacheTtl
		});

		return keys;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function selectJwkCandidates(keys: JwkKey[], kid: string | null): JwkKey[] {
	const compatible = keys.filter((key) => {
		if (key.use && key.use !== 'sig') return false;
		if (Array.isArray(key.key_ops) && key.key_ops.length > 0 && !key.key_ops.includes('verify')) {
			return false;
		}
		if (key.alg && key.alg !== 'RS256') return false;
		return true;
	});

	if (kid) {
		const byKid = compatible.filter((key) => key.kid === kid);
		if (byKid.length > 0) return byKid;
	}

	return compatible;
}

function verifyRs256JwtSignature(signingInput: string, signature: Buffer, jwk: JwkKey): boolean {
	try {
		const keyObject = createPublicKey({
			key: jwk as any,
			format: 'jwk'
		});
		const verifier = createVerify('RSA-SHA256');
		verifier.update(signingInput);
		verifier.end();
		return verifier.verify(keyObject, signature);
	} catch {
		return false;
	}
}

function parseJwtWithoutVerification(token: string): {
	header: { alg?: string; kid: string | null };
	payload: Record<string, unknown>;
	signingInput: string;
	signature: Buffer;
} | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

	try {
		const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as Record<
			string,
			unknown
		>;
		const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<
			string,
			unknown
		>;
		const signature = Buffer.from(encodedSignature, 'base64url');

		if (!isRecord(payload)) return null;

		return {
			header: {
				alg: typeof header.alg === 'string' ? header.alg : undefined,
				kid: typeof header.kid === 'string' ? header.kid : null
			},
			payload,
			signingInput: `${encodedHeader}.${encodedPayload}`,
			signature
		};
	} catch {
		return null;
	}
}

function audienceMatches(audClaim: unknown, tokenEndpoint: string, issuer: string): boolean {
	if (typeof audClaim === 'string') {
		return audClaim === tokenEndpoint || audClaim === issuer;
	}

	if (Array.isArray(audClaim)) {
		const values = audClaim.filter((entry): entry is string => typeof entry === 'string');
		return values.includes(tokenEndpoint) || values.includes(issuer);
	}

	return false;
}

function parseHttpMaxAge(cacheControl: string | null): number {
	if (!cacheControl) return Number.MAX_SAFE_INTEGER;
	const match = cacheControl.match(/max-age=(\d+)/i);
	if (!match) return Number.MAX_SAFE_INTEGER;
	const parsed = Number(match[1]);
	if (!Number.isFinite(parsed) || parsed < 0) return Number.MAX_SAFE_INTEGER;
	return Math.floor(parsed);
}

function pruneCimdClientCache(): void {
	const now = nowInSeconds();
	for (const [clientId, cached] of cimdClientCache.entries()) {
		if (cached.expiresAt <= now) {
			cimdClientCache.delete(clientId);
		}
	}
}

function pruneJwksCache(): void {
	const now = nowInSeconds();
	for (const [jwksUri, cached] of jwksCache.entries()) {
		if (cached.expiresAt <= now) {
			jwksCache.delete(jwksUri);
		}
	}
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
	if (!raw) return fallback;
	const normalized = raw.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return fallback;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return fallback;
	const integer = Math.floor(parsed);
	if (integer < min) return min;
	if (integer > max) return max;
	return integer;
}

function normalizeRedirectUri(value: string): string | null {
	try {
		const parsed = new URL(value);
		if (!parsed.protocol || !parsed.host) return null;
		parsed.hash = '';
		return parsed.toString();
	} catch {
		return null;
	}
}

function normalizeOrigin(value: string): string | null {
	try {
		const parsed = new URL(value);
		if (!parsed.protocol || !parsed.host) return null;
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return null;
	}
}

function canonicalizeResourceUri(value: string): string | null {
	try {
		const parsed = new URL(value);
		if (!parsed.protocol || !parsed.host || parsed.hash) return null;
		const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
		return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${pathname}`;
	} catch {
		return null;
	}
}

function resourcesMatch(left: string, right: string): boolean {
	const leftCanonical = canonicalizeResourceUri(left);
	const rightCanonical = canonicalizeResourceUri(right);
	if (!leftCanonical || !rightCanonical) return false;
	return leftCanonical === rightCanonical;
}

function nowInSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function signJwt(payload: JwtPayload, secret: string): string {
	const header = { alg: 'HS256', typ: 'JWT' };
	const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
	const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const signature = createHmac('sha256', secret)
		.update(`${encodedHeader}.${encodedPayload}`)
		.digest('base64url');
	return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token: string, secret: string): JwtPayload | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

	const expectedSignature = createHmac('sha256', secret)
		.update(`${encodedHeader}.${encodedPayload}`)
		.digest('base64url');

	if (!constantTimeEqual(encodedSignature, expectedSignature)) return null;

	try {
		const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as Record<string, unknown>;
		if (header.alg !== 'HS256') return null;

		const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as JwtPayload;
		const exp = typeof payload.exp === 'number' ? payload.exp : NaN;
		if (!Number.isFinite(exp) || exp <= nowInSeconds()) return null;
		return payload;
	} catch {
		return null;
	}
}

function parseBasicAuthHeader(headerValue: string | null): { clientId: string; clientSecret: string } | null {
	if (!headerValue) return null;
	if (!/^Basic\s+/i.test(headerValue)) return null;
	const encoded = headerValue.replace(/^Basic\s+/i, '').trim();
	if (!encoded) return null;

	try {
		const decoded = Buffer.from(encoded, 'base64').toString('utf8');
		const separatorIndex = decoded.indexOf(':');
		if (separatorIndex < 0) return null;
		return {
			clientId: decoded.slice(0, separatorIndex),
			clientSecret: decoded.slice(separatorIndex + 1)
		};
	} catch {
		return null;
	}
}

function constantTimeEqual(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left, 'utf8');
	const rightBuffer = Buffer.from(right, 'utf8');
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
}

function isLoopbackHost(hostname: string): boolean {
	const normalized = hostname.trim().toLowerCase();
	return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
}

function escapeHeaderValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isAuthorizationCodeUsed(jti: string): boolean {
	pruneUsedAuthorizationCodes();
	return usedAuthorizationCodes.has(jti);
}

function markAuthorizationCodeUsed(jti: string, expiresAt: number): void {
	usedAuthorizationCodes.set(jti, expiresAt);
	pruneUsedAuthorizationCodes();
}

function pruneUsedAuthorizationCodes(): void {
	const now = nowInSeconds();
	for (const [jti, exp] of usedAuthorizationCodes.entries()) {
		if (exp <= now) usedAuthorizationCodes.delete(jti);
	}
}