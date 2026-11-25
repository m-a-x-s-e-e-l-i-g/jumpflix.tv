import * as env from '$app/env/public';
import { renderCatalogText } from '$lib/server/discovery-catalog';
import { discoveryResponse } from '$lib/server/discovery-response';

export const prerender = false;

export const GET = () =>
	discoveryResponse(
		env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv',
		'text/plain',
		renderCatalogText
	);
