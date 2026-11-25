import { deLocalizeUrl } from '$lib/paraglide/runtime';
import type { HandleClientError, Reroute } from '@sveltejs/kit/hooks';

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;

export const handleError: HandleClientError = async ({ kind, error, event }) => {
	if (kind === 'app') return;
	const errorId = crypto.randomUUID();
	const { status, message } = kind === 'unknown' ? { status: 500, message: 'Internal Error' } : error;

	// Log client-side errors for debugging
	console.error('Client Error:', {
		errorId,
		status,
		message,
		url: event.url.pathname,
		timestamp: new Date().toISOString(),
		error
	});

	// In production, you might want to send to error tracking service
	// Example: sendErrorToService({ errorId, status, message, url: event.url.pathname });

	return {
		message: 'Something went wrong on our end. Please try refreshing the page.',
		errorId
	};
};
