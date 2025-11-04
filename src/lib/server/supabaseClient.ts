import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

const supabaseUrl = SUPABASE_URL?.trim?.();
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY?.trim?.() || SUPABASE_ANON_KEY?.trim?.();

export function createSupabaseClient() {
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('Supabase environment variables are missing. Please set SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
	}

	return createClient<Database>(supabaseUrl, supabaseKey, {
		auth: { persistSession: false }
	});
}
