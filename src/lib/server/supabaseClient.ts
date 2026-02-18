import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

const supabaseUrl = PUBLIC_SUPABASE_URL?.trim?.();
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY?.trim?.() || PUBLIC_SUPABASE_ANON_KEY?.trim?.();

export function createSupabaseClient() {
	if (!supabaseUrl || !supabaseKey) {
		throw new Error(
			'Supabase environment variables are missing. Please set PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or PUBLIC_SUPABASE_ANON_KEY.'
		);
	}

	return createClient<Database>(supabaseUrl, supabaseKey, {
		auth: { persistSession: false }
	});
}

export function createSupabaseServiceClient() {
	const serviceKey = SUPABASE_SERVICE_ROLE_KEY?.trim?.();
	if (!supabaseUrl || !serviceKey) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this operation.');
	}

	return createClient<Database>(supabaseUrl, serviceKey, {
		auth: { persistSession: false }
	});
}
