import type { RequestHandler } from './$types';
import {
	exchangeAuthorizationCodeForAccessToken,
	isOAuthEnabled,
	normalizeAndValidateRedirectUriForClient,
	oauthJsonResponse,
	resolveOAuthServerConfig,
	resolveRequestedResource,
	validateTokenEndpointClient
} from '$lib/server/mcp/oauth';

export const POST: RequestHandler = async ({ request, url }) => {
	const config = resolveOAuthServerConfig(url);
	if (!isOAuthEnabled(config)) {
		return oauthJsonResponse(501, {
			error: 'server_error',
			error_description: 'OAuth is not configured on this server.'
		});
	}

	const body = await request.text();
	const params = new URLSearchParams(body);

	const grantType = params.get('grant_type')?.trim() || '';
	if (grantType !== 'authorization_code') {
		return oauthJsonResponse(400, {
			error: 'unsupported_grant_type',
			error_description: 'Only grant_type=authorization_code is supported.'
		});
	}

	const clientAuth = validateTokenEndpointClient(request, params, config);
	if (!clientAuth.ok) {
		const response = oauthJsonResponse(clientAuth.status, {
			error: clientAuth.error,
			error_description: clientAuth.errorDescription
		});
		if (config.clientSecret) {
			response.headers.set('WWW-Authenticate', 'Basic realm="jumpflix-mcp-oauth"');
		}
		return response;
	}

	const code = params.get('code')?.trim() || '';
	const redirectUri = params.get('redirect_uri')?.trim() || '';
	const codeVerifier = params.get('code_verifier')?.trim() || '';

	if (!code || !redirectUri || !codeVerifier) {
		return oauthJsonResponse(400, {
			error: 'invalid_request',
			error_description: 'Missing code, redirect_uri, or code_verifier.'
		});
	}

	const normalizedRedirectUri = normalizeAndValidateRedirectUriForClient(
		redirectUri,
		clientAuth.clientId,
		config
	);
	if (!normalizedRedirectUri) {
		return oauthJsonResponse(400, {
			error: 'invalid_request',
			error_description: 'Invalid or unregistered redirect_uri.'
		});
	}

	const requestedResource = resolveRequestedResource(params.get('resource'), config);
	if (!requestedResource) {
		return oauthJsonResponse(400, {
			error: 'invalid_target',
			error_description: 'The requested resource does not match this MCP server.'
		});
	}

	const result = exchangeAuthorizationCodeForAccessToken(
		{
			code,
			clientId: clientAuth.clientId,
			redirectUri: normalizedRedirectUri,
			codeVerifier,
			resource: requestedResource
		},
		config
	);

	if (!result.ok) {
		return oauthJsonResponse(result.status, {
			error: result.error,
			error_description: result.errorDescription
		});
	}

	return oauthJsonResponse(200, {
		access_token: result.accessToken,
		token_type: 'Bearer',
		expires_in: result.expiresIn,
		scope: result.scope
	});
};
