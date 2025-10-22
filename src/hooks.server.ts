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
		message: 'Something went wrong on our end. Please try refreshing the page.',
		errorId
	};
};
