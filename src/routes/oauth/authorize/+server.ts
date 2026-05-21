import type { RequestHandler } from './$types';
import {
	createAuthorizationCode,
	ensureClientAndRedirect,
	isOAuthEnabled,
	oauthJsonResponse,
	resolveOAuthServerConfig,
	resolveRequestedResource,
	resolveRequestedScopes
} from '$lib/server/mcp/oauth';

function oauthRedirect(url: string): Response {
	return new Response(null, {
		status: 302,
		headers: {
			Location: url,
			'Cache-Control': 'no-store',
			Pragma: 'no-cache'
		}
	});
}

function oauthRedirectError(
	redirectUri: string,
	error: string,
	errorDescription: string,
	state: string | null
): Response {
	const target = new URL(redirectUri);
	target.searchParams.set('error', error);
	target.searchParams.set('error_description', errorDescription);
	if (state) {
		target.searchParams.set('state', state);
	}
	return oauthRedirect(target.toString());
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const config = resolveOAuthServerConfig(url);
	if (!isOAuthEnabled(config)) {
		return oauthJsonResponse(501, {
			error: 'server_error',
			error_description: 'OAuth is not configured on this server.'
		});
	}

	const state = url.searchParams.get('state');
	const responseType = url.searchParams.get('response_type') || '';
	const clientId = url.searchParams.get('client_id')?.trim() || '';
	const redirectUri = url.searchParams.get('redirect_uri')?.trim() || '';
	const codeChallenge = url.searchParams.get('code_challenge')?.trim() || '';
	const codeChallengeMethod = url.searchParams.get('code_challenge_method')?.trim() || '';

	if (!clientId || !redirectUri) {
		return oauthJsonResponse(400, {
			error: 'invalid_request',
			error_description: 'Missing client_id or redirect_uri.'
		});
	}

	const clientAndRedirect = await ensureClientAndRedirect(clientId, redirectUri, config);
	if (!clientAndRedirect.ok) {
		return oauthJsonResponse(400, {
			error: clientAndRedirect.error,
			error_description: clientAndRedirect.errorDescription
		});
	}

	if (responseType !== 'code') {
		return oauthRedirectError(
			clientAndRedirect.redirectUri,
			'unsupported_response_type',
			'Only response_type=code is supported.',
			state
		);
	}

	if (!codeChallenge || codeChallengeMethod !== 'S256') {
		return oauthRedirectError(
			clientAndRedirect.redirectUri,
			'invalid_request',
			'PKCE with code_challenge_method=S256 is required.',
			state
		);
	}

	const requestedScopes = resolveRequestedScopes(url.searchParams.get('scope'), config);
	if (!requestedScopes.ok) {
		return oauthRedirectError(
			clientAndRedirect.redirectUri,
			'invalid_scope',
			requestedScopes.errorDescription,
			state
		);
	}

	const requestedResource = resolveRequestedResource(url.searchParams.get('resource'), config);
	if (!requestedResource) {
		return oauthRedirectError(
			clientAndRedirect.redirectUri,
			'invalid_target',
			'The requested resource does not match this MCP server.',
			state
		);
	}

	let subject = config.defaultSubject;
	if (config.requireUserSession) {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return oauthRedirectError(
				clientAndRedirect.redirectUri,
				'access_denied',
				'A signed-in user session is required.',
				state
			);
		}
		subject = user.id;
	}

	const authorizationCode = createAuthorizationCode(
		{
			clientId,
			redirectUri: clientAndRedirect.redirectUri,
			codeChallenge,
			scopes: requestedScopes.scopes,
			resource: requestedResource,
			subject
		},
		config
	);

	const callbackUrl = new URL(clientAndRedirect.redirectUri);
	callbackUrl.searchParams.set('code', authorizationCode);
	if (state) {
		callbackUrl.searchParams.set('state', state);
	}
	callbackUrl.searchParams.set('iss', config.issuer);

	return oauthRedirect(callbackUrl.toString());
};
