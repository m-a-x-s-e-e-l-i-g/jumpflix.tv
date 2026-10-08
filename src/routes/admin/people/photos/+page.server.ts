import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { fetchPeopleCredits } from '$lib/server/content-service';
import {
	buildKnownPeopleMap,
	normalizeInstagramHandles,
	type PersonProfileRow
} from '$lib/server/person-profiles';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { photoUrl } from '$lib/server/person-photo-url';
import {
	importInstagramPhoto,
	instagramPhotosConfigured,
	MAX_PHOTO_BYTES,
	normalizePhoto,
	PhotoError,
	savePersonPhoto
} from '$lib/server/person-photos';

const config = () => ({
	token: env.INSTAGRAM_ACCESS_TOKEN,
	accountId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
	version: env.INSTAGRAM_GRAPH_API_VERSION
});

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);
	const supabase = createSupabaseServiceClient();
	const known = buildKnownPeopleMap(await fetchPeopleCredits());
	const profiles: PersonProfileRow[] = [];
	let migrationReady = true;
	for (let offset = 0; ; offset += 1000) {
		let { data, error } = await supabase
			.from('person_profiles')
			.select('slug, name, instagram_handles, profile_photo_path, profile_photo_source')
			.order('slug')
			.range(offset, offset + 999);
		if (error?.code === '42703' || error?.code === 'PGRST204') {
			migrationReady = false;
			const fallback = await supabase
				.from('person_profiles')
				.select('*')
				.order('slug')
				.range(offset, offset + 999);
			data = fallback.data as typeof data;
			error = fallback.error;
		}
		if (error) throw new Error('Could not load athlete profiles. Please try again.');
		profiles.push(...(data ?? []));
		if ((data?.length ?? 0) < 1000) break;
	}
	const bySlug = new Map(profiles.map((profile) => [profile.slug, profile]));
	return {
		migrationReady,
		instagramReady: instagramPhotosConfigured(config()),
		people: Array.from(known.values())
			.filter((person) => person.roles.athlete)
			.map((person) => {
				const profile = bySlug.get(person.slug);
				return {
					slug: person.slug,
					name: person.name,
					handles: normalizeInstagramHandles(profile?.instagram_handles),
					photo: photoUrl(supabase, profile?.profile_photo_path),
					source: profile?.profile_photo_source ?? null
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	};
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);
		const form = await request.formData();
		const slug = String(form.get('slug') ?? '');
		const person = buildKnownPeopleMap(await fetchPeopleCredits()).get(slug);
		if (!person?.roles.athlete)
			return fail(400, { slug, message: 'Choose an athlete from the list.' });
		const supabase = createSupabaseServiceClient();
		try {
			const { error: schemaError } = await supabase
				.from('person_profiles')
				.select('profile_photo_path')
				.eq('slug', slug)
				.maybeSingle();
			if (schemaError)
				throw new PhotoError(
					['42703', 'PGRST204'].includes(schemaError.code)
						? 'Profile photos need the database migration before saving.'
						: 'Could not load this profile. Please try again.',
					true
				);
			const method = form.get('method');
			let bytes: Buffer;
			let handle: string | null = null;
			if (method === 'instagram') {
				handle = String(form.get('handle') ?? '');
				const { data, error } = await supabase
					.from('person_profiles')
					.select('instagram_handles')
					.eq('slug', slug)
					.maybeSingle();
				if (error || !normalizeInstagramHandles(data?.instagram_handles).includes(handle))
					throw new PhotoError('Choose a saved Instagram handle.');
				bytes = await importInstagramPhoto(handle, config());
			} else if (method === 'upload') {
				const file = form.get('photo');
				if (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES)
					throw new PhotoError('Choose an image smaller than 5 MB.');
				bytes = await normalizePhoto(new Uint8Array(await file.arrayBuffer()));
			} else throw new PhotoError('Choose Instagram import or photo upload.');
			await savePersonPhoto(supabase, slug, person.name, bytes, method, handle);
			return { slug, success: true, message: `Photo saved for ${person.name}.` };
		} catch (error) {
			return fail(400, {
				slug,
				stopImport: error instanceof PhotoError ? error.stopImport : true,
				message:
					error instanceof PhotoError
						? error.message
						: 'Photo could not be imported. Try again or upload a photo.'
			});
		}
	}
};
