import type { RequestHandler } from './$types';
import {
	isDynamicClientRegistrationEnabled,
	isOAuthEnabled,
	oauthJsonResponse,
	registerDynamicClient,
	resolveOAuthServerConfig
} from '$lib/server/mcp/oauth';

export const POST: RequestHandler = async ({ request, url }) => {
	const config = resolveOAuthServerConfig(url);
	if (!isOAuthEnabled(config)) {
		return oauthJsonResponse(501, {
			error: 'server_error',
			error_description: 'OAuth is not configured on this server.'
		});
	}

	if (!isDynamicClientRegistrationEnabled(config)) {
		return oauthJsonResponse(404, {
			error: 'not_found',
			error_description: 'Dynamic Client Registration is not enabled.'
		});
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return oauthJsonResponse(400, {
			error: 'invalid_client_metadata',
			error_description: 'Request body must be valid JSON.'
		});
	}

	const result = registerDynamicClient(payload, config);
	if (!result.ok) {
		return oauthJsonResponse(result.status, {
			error: result.error,
			error_description: result.errorDescription
		});
	}

	return oauthJsonResponse(result.status, result.body);
};
