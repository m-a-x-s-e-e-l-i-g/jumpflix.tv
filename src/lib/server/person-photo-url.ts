import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
const PHOTO_BUCKET = 'person-photos';

export function photoUrl(supabase: SupabaseClient<Database>, path: unknown): string | null {
	if (typeof path !== 'string' || !/^[0-9a-f-]{36}\.webp$/.test(path)) return null;
	return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
