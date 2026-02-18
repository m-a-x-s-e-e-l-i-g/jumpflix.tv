import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	// Extract tokens from URL hash fragments
	// Supabase sends tokens like: /auth/callback#access_token=...&refresh_token=...
	// However, URL hash fragments are not sent to the server, so we need to handle this client-side
	// This endpoint serves as the redirect target and will be handled by the client

	// Check if there's an error parameter
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	if (error) {
		console.error('Auth callback error:', error, errorDescription);
		// Redirect to home with error
		throw redirect(303, `/?error=${encodeURIComponent(errorDescription || error)}`);
	}

	// For successful auth, redirect to home page
	// The client-side code in +page.svelte will handle the hash tokens
	throw redirect(303, '/');
};
