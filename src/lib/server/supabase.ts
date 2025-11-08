import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/supabase/types';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
	throw new Error(
		'Missing Supabase environment variables. Please set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your .env file.'
	);
}

export const handleSupabase: Handle = async ({ event, resolve }) => {
	/**
	 * Creates a Supabase client specific to this server request.
	 * The Supabase client is configured to use cookies for session management.
	 * This is crucial for PWAs and iOS where localStorage might not persist properly.
	 */
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => {
					return event.cookies.getAll();
				},
				setAll: (cookiesToSet) => {
					/**
					 * Set cookies with proper configuration for iOS PWAs:
					 * - SameSite=Lax (more permissive than Strict for better PWA compatibility)
					 * - Secure=true (required for PWAs)
					 * - Path=/ (available across the entire app)
					 * - MaxAge set by Supabase (typically 1 year for refresh tokens)
					 */
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, {
							...options,
							path: '/',
							// Ensure cookies work in PWA context
							sameSite: 'lax',
							secure: true,
							httpOnly: options?.httpOnly ?? true
						});
					});
				}
			}
		}
	);

	/**
	 * Unlike `supabase.auth.getSession()`, which returns the session _without_
	 * validating the JWT, this function also calls `getUser()` to validate the JWT
	 * before returning the session.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			// JWT validation failed
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			/**
			 * Supabase libraries use the `content-range` and `x-supabase-api-version`
			 * headers, so we need to tell SvelteKit to pass them through.
			 */
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
