import type { Handle, HandleServerError } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { dev } from '$app/environment';
import { handleSupabase } from '$lib/server/supabase';
import { sequence } from '@sveltejs/kit/hooks';

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
];

const OAUTH_CSRF_EXEMPT_PATHS = new Set(['/oauth/token', '/oauth/register']);

function isFormSubmission(contentType: string | null): boolean {
	if (!contentType) return false;
	const normalized = contentType.toLowerCase();
	return FORM_CONTENT_TYPES.some((prefix) => normalized.startsWith(prefix));
}

const handleCsrf: Handle = async ({ event, resolve }) => {
	const method = event.request.method.toUpperCase();
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return resolve(event);
	}

	if (!isFormSubmission(event.request.headers.get('content-type'))) {
		return resolve(event);
	}

	if (OAUTH_CSRF_EXEMPT_PATHS.has(event.url.pathname)) {
		return resolve(event);
	}

	const origin = event.request.headers.get('origin');
	if (origin && origin !== event.url.origin) {
		return new Response('Cross-site POST form submissions are forbidden', { status: 403 });
	}

	return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

// Keep CSRF guard for site forms while allowing OAuth protocol endpoints.
export const handle: Handle = sequence(handleCsrf, handleSupabase, handleParaglide);

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
			userAgent: event.request.headers.get('user-agent')
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
