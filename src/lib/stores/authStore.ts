import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Auth stores for managing user authentication state.
 * 
 * These stores are initialized in +layout.svelte with the session from the server,
 * ensuring that auth state is synchronized between server and client via cookies.
 * This is crucial for PWAs on iOS where localStorage may not persist properly.
 */
export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const loading = writable<boolean>(true);
