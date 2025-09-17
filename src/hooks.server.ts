import type { Handle, HandleServerError } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { dev } from '$app/environment';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

export const handle: Handle = handleParaglide;

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	
	// Log error details (in production, you might want to send to error tracking service)
	if (!dev) {
		console.error('Server Error:', {
			errorId,
			status,
			message,
			url: event.url.pathname,
			timestamp: new Date().toISOString(),
			userAgent: event.request.headers.get('user-agent'),
		});
	} else {
		console.error('Dev Server Error:', error);
	}

	// Return user-friendly error object
	return {
		message: getErrorMessage(status),
		errorId
	};
};

function getErrorMessage(status: number): string {
	switch (status) {
		case 400:
			return 'Bad request. Please check your input.';
		case 401:
			return 'Unauthorized. Please sign in.';
		case 403:
			return 'Access forbidden. You don\'t have permission to view this.';
		case 404:
			return 'error_server_404'; // Will be translated on client side
		case 429:
			return 'Too many requests. Please slow down and try again.';
		case 500:
			return 'Internal server error. Our servers are taking a breather.';
		case 502:
			return 'Bad gateway. Our servers are having connection issues.';
		case 503:
			return 'Service unavailable. We\'re performing maintenance.';
		default:
			return 'An unexpected error occurred. Please try again later.';
	}
}
