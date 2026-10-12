import { env } from '$env/dynamic/public';
import { renderDiscoveryPage } from '$lib/server/discovery-page';
import { discoveryResponse } from '$lib/server/discovery-response';

// A complete public HTML document: no app shell, hydration, player or login.
// Serve the same content to people and crawlers, refreshed from the live catalog.
export const prerender = false;

export const GET = () =>
	discoveryResponse(
		env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv',
		'text/html',
		renderDiscoveryPage
	);
