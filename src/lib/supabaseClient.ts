import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/supabase/types';
import { browser } from '$app/environment';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
	throw new Error('Missing Supabase environment variables. Please set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your .env file.');
}

/**
 * Creates a Supabase client for use in the browser.
 * This client automatically handles cookie-based session persistence,
 * which is crucial for PWAs on iOS where localStorage may not persist properly.
 * 
 * The session is synchronized between server and client via cookies,
 * ensuring users stay logged in even after closing and reopening the PWA.
 */
export const supabase = createBrowserClient<Database>(
	PUBLIC_SUPABASE_URL, 
	PUBLIC_SUPABASE_ANON_KEY,
	{
		cookies: {
			getAll() {
				// Only access document in browser context
				if (!browser) return [];
				
				// Parse all cookies from document.cookie
				return document.cookie
					.split('; ')
					.filter(Boolean)
					.map((cookie) => {
						const [name, ...rest] = cookie.split('=');
						return { name, value: rest.join('=') };
					});
			},
			setAll(cookiesToSet) {
				// Only set cookies in browser context
				if (!browser) return;
				
				// Set cookies in the browser
				cookiesToSet.forEach(({ name, value, options }) => {
					let cookie = `${name}=${value}`;
					if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
					if (options?.path) cookie += `; path=${options.path}`;
					if (options?.domain) cookie += `; domain=${options.domain}`;
					if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
					if (options?.secure) cookie += '; secure';
					document.cookie = cookie;
				});
			}
		}
	}
);
