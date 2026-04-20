import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { invalidateContentCache } from '$lib/server/content-service';
import {
	MANUAL_FACET_CONFIGS,
	getManualFacetLabel,
	isManualFacetKey,
	isManualFacetValue,
	type ManualFacetKey
} from '$lib/tv/facet-options';

type MissingFacetItem = {
	id: number;
	slug: string;
	title: string;
	type: 'movie' | 'series';
	description: string | null;
	year: string | null;
	duration: string | null;
	thumbnail: string | null;
	updated_at: string;
	creators: string[] | null;
	starring: string[] | null;
};

function asTrimmedString(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

function getFacetKey(value: string): ManualFacetKey {
	return isManualFacetKey(value) ? value : 'type';
}

function hasFacetValue(mode: 'single' | 'multiple', value: unknown): boolean {
	if (mode === 'multiple') {
		return Array.isArray(value) && value.length > 0;
	}

	return typeof value === 'string' && value.trim().length > 0;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);
	const activeFacetKey = getFacetKey(asTrimmedString(url.searchParams.get('facet')));
	const facet = MANUAL_FACET_CONFIGS[activeFacetKey];

	const supabase = createSupabaseServiceClient();
	let query = supabase
		.from('media_items')
		.select(
			'id, slug, title, type, description, year, duration, thumbnail, updated_at, creators, starring'
		)
		.order('updated_at', { ascending: false });

	if (facet.mode === 'multiple') {
		query = query.or(`${facet.dbColumn}.is.null,${facet.dbColumn}.eq.{}`);
	} else {
		query = query.is(facet.dbColumn, null);
	}

	const { data, error } = await query;

	if (error) {
		return {
			activeFacetKey,
			items: [] as MissingFacetItem[],
			error: error.message
		};
	}

	return {
		activeFacetKey,
		items: (data ?? []) as MissingFacetItem[],
		error: null
	};
};

export const actions: Actions = {
	assign: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		const facetKey = getFacetKey(asTrimmedString(form.get('facetKey')));
		const facetValue = asTrimmedString(form.get('facetValue'));
		const facet = MANUAL_FACET_CONFIGS[facetKey];

		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid media id.' });
		if (!isManualFacetValue(facetKey, facetValue)) {
			return fail(400, { message: `Choose a valid ${facet.singularLabel}.` });
		}

		const supabase = createSupabaseServiceClient();
		const { data: media, error: fetchError } = await supabase
			.from('media_items')
			.select(`id, title, ${facet.dbColumn}`)
			.eq('id', id)
			.maybeSingle();

		if (fetchError) return fail(400, { message: fetchError.message });
		if (!media) return fail(404, { message: 'Media item not found.' });

		const currentValue = (media as Record<string, unknown>)[facet.dbColumn];
		if (hasFacetValue(facet.mode, currentValue)) {
			return fail(409, {
				message:
					facet.mode === 'multiple'
						? `This item already has at least one ${facet.singularLabel}.`
						: `This item already has a ${facet.singularLabel}.`
			});
		}

		const nextValue = facet.mode === 'multiple' ? [facetValue] : facetValue;

		const { error: updateError } = await supabase
			.from('media_items')
			.update({ [facet.dbColumn]: nextValue })
			.eq('id', id);

		if (updateError) return fail(400, { message: updateError.message });

		await invalidateContentCache();

		return {
			ok: true,
			success: `${media.title} tagged as ${getManualFacetLabel(facetKey, facetValue)}.`
		};
	}
};