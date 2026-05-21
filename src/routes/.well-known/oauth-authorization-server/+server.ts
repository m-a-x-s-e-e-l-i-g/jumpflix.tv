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

	return oauthJsonResponse(200, buildAuthorizationServerMetadata(config));
};
