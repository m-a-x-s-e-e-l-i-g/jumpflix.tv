import { deLocalizeUrl } from '$lib/paraglide/runtime';
import type { HandleClientError } from '@sveltejs/kit';

export const reroute = (request) => deLocalizeUrl(request.url).pathname;

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();

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
