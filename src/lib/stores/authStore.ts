import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import { browser } from '$app/environment';

// Store for the current user
export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const loading = writable<boolean>(true);

// Initialize auth state listener
if (browser) {
	if (supabase) {
		// Get initial session
		supabase.auth.getSession().then(({ data }) => {
			session.set(data.session);
			user.set(data.session?.user ?? null);
			loading.set(false);
		});

		// Listen for auth changes
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			session.set(newSession);
			user.set(newSession?.user ?? null);
			loading.set(false);
		});

		// Cleanup subscription on page unload
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => {
				subscription.unsubscribe();
			});
		}
	} else {
		// Supabase not configured - set loading to false immediately
		loading.set(false);
	}
}
