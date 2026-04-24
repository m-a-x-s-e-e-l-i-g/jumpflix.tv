import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	if (error) {
		console.error('Auth callback error:', error, errorDescription);
		throw redirect(303, `/?error=${encodeURIComponent(errorDescription || error)}`);
	}

	// Exchange the OAuth/magic-link code for a session (PKCE flow)
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
	}

	throw redirect(303, '/');
};
