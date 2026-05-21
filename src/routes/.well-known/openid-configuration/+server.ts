import type { RequestHandler } from './$types';
import {
	buildAuthorizationServerMetadata,
	isOAuthEnabled,
	oauthJsonResponse,
	resolveOAuthServerConfig
} from '$lib/server/mcp/oauth';

export const GET: RequestHandler = async ({ url }) => {
	const config = resolveOAuthServerConfig(url);
	if (!isOAuthEnabled(config)) {
		return oauthJsonResponse(404, {
			error: 'not_found',
			error_description: 'OAuth metadata is not configured.'
		});
	}

	const metadata = buildAuthorizationServerMetadata(config);
	if (config.tokenEndpointAuthMethodsSupported.includes('private_key_jwt')) {
		metadata.token_endpoint_auth_signing_alg_values_supported = ['RS256'];
	}

	return oauthJsonResponse(200, metadata);
};