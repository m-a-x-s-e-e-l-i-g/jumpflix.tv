import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { invalidateContentCache } from '$lib/server/content-service';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';

type AvailabilityStatus = 'available' | 'unavailable';

const ALLOWED_STATUSES = new Set<AvailabilityStatus>(['available', 'unavailable']);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const body = (await request.json().catch(() => null)) as {
		mediaId?: unknown;
		availabilityStatus?: unknown;
	} | null;

	const mediaId = Number(body?.mediaId);
	const rawAvailabilityStatus = String(body?.availabilityStatus ?? '').trim().toLowerCase();

	if (!Number.isInteger(mediaId) || mediaId <= 0) {
		return json({ message: 'Invalid mediaId' }, { status: 400 });
	}

	if (!ALLOWED_STATUSES.has(rawAvailabilityStatus as AvailabilityStatus)) {
		return json({ message: 'Invalid availabilityStatus' }, { status: 400 });
	}

	const availabilityStatus = rawAvailabilityStatus as AvailabilityStatus;

	const supabase = createSupabaseServiceClient();
	const { data, error } = await supabase
		.from('media_items')
		.update({ availability_status: availabilityStatus })
		.eq('id', mediaId)
		.select('id, availability_status')
		.maybeSingle();

	if (error) {
		return json({ message: error.message }, { status: 400 });
	}

	if (!data) {
		return json({ message: 'Content not found' }, { status: 404 });
	}

	await invalidateContentCache();

	return json({ ok: true, availabilityStatus: data.availability_status });
};
