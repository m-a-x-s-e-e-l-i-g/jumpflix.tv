import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { fetchAllContent, invalidateContentCache } from '$lib/server/content-service';
import { movePersonProfile } from '$lib/server/person-profiles';

type MediaRow = {
	id: number;
	slug: string;
	title: string;
	type: string;
	creators: string[] | null;
	starring: string[] | null;
};

type PreviewItem = {
	id: number;
	slug: string;
	title: string;
	type: string;
	creatorsBefore?: string[];
	creatorsAfter?: string[];
	starringBefore?: string[];
	starringAfter?: string[];
};

function asTrimmedString(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseScope(form: FormData): { includeCreators: boolean; includeStarring: boolean } {
	const includeCreators = form.has('include_creators');
	const includeStarring = form.has('include_starring');
	return { includeCreators, includeStarring };
}

function normalizeList(list: unknown): string[] {
	return Array.isArray(list) ? (list.filter((v) => typeof v === 'string') as string[]) : [];
}

function dedupePreserveOrder(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const v of values) {
		const trimmed = v.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(trimmed);
	}
	return out;
}

function replaceAndDedupe(list: unknown, from: string, to: string): string[] {
	const src = normalizeList(list);
	const replaced = src.map((v) => (v === from ? to : v));
	return dedupePreserveOrder(replaced);
}

async function fetchAffectedRows(opts: {
	from: string;
	includeCreators: boolean;
	includeStarring: boolean;
	limit?: number;
}): Promise<{ rows: MediaRow[]; total: number }>{
	const { from, includeCreators, includeStarring } = opts;
	const pageSize = 1000;

	const supabase = createSupabaseServiceClient();
	const byId = new Map<number, MediaRow>();

	async function fetchByColumn(column: 'creators' | 'starring') {
		let offset = 0;
		while (true) {
			const { data, error } = await supabase
				.from('media_items')
				.select('id, slug, title, type, creators, starring')
				.contains(column, [from])
				.order('id', { ascending: true })
				.range(offset, offset + pageSize - 1);

			if (error) throw new Error(error.message);
			const rows = (data ?? []) as unknown as MediaRow[];
			for (const row of rows) byId.set(row.id, row);

			offset += rows.length;
			if (rows.length < pageSize) break;
			if (typeof opts.limit === 'number' && byId.size >= opts.limit) break;
		}
	}

	if (includeCreators) await fetchByColumn('creators');
	if (includeStarring) await fetchByColumn('starring');

	const all = Array.from(byId.values());
	const total = all.length;
	const limited = typeof opts.limit === 'number' ? all.slice(0, opts.limit) : all;
	return { rows: limited, total };
}

function buildPreview(opts: {
	rows: MediaRow[];
	from: string;
	to: string;
	includeCreators: boolean;
	includeStarring: boolean;
}): PreviewItem[] {
	const { rows, from, to, includeCreators, includeStarring } = opts;
	const items: PreviewItem[] = [];

	for (const row of rows) {
		const creatorsBefore = normalizeList(row.creators);
		const starringBefore = normalizeList(row.starring);

		const creatorsAfter = includeCreators
			? replaceAndDedupe(creatorsBefore, from, to)
			: creatorsBefore;
		const starringAfter = includeStarring
			? replaceAndDedupe(starringBefore, from, to)
			: starringBefore;

		const didChangeCreators = includeCreators && creatorsBefore.some((v) => v === from);
		const didChangeStarring = includeStarring && starringBefore.some((v) => v === from);
		if (!didChangeCreators && !didChangeStarring) continue;

		items.push({
			id: row.id,
			slug: row.slug,
			title: row.title,
			type: row.type,
			...(didChangeCreators ? { creatorsBefore, creatorsAfter } : {}),
			...(didChangeStarring ? { starringBefore, starringAfter } : {})
		});
	}

	return items;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const content = await fetchAllContent();

	const contributorsByKey = new Map<string, string>();
	const athletesByKey = new Map<string, string>();

	function addName(target: Map<string, string>, value: unknown) {
		if (typeof value !== 'string') return;
		const trimmed = value.trim();
		if (!trimmed) return;
		const key = trimmed.toLowerCase();
		if (target.has(key)) return;
		target.set(key, trimmed);
	}

	for (const item of content) {
		const creators = (item as any)?.creators;
		const starring = (item as any)?.starring;

		if (Array.isArray(creators)) {
			for (const c of creators) addName(contributorsByKey, c);
		}
		if (Array.isArray(starring)) {
			for (const s of starring) addName(athletesByKey, s);
		}
	}

	const contributors = Array.from(contributorsByKey.values()).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: 'base' })
	);
	const athletes = Array.from(athletesByKey.values()).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: 'base' })
	);

	return {
		people: {
			contributors,
			athletes
		}
	};
};

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const from = asTrimmedString(form.get('from'));
		const to = asTrimmedString(form.get('to'));
		const { includeCreators, includeStarring } = parseScope(form);

		if (!from) return fail(400, { message: 'From name is required.' });
		if (!to) return fail(400, { message: 'To name is required.' });
		if (from === to) return fail(400, { message: 'From and To must be different.' });
		if (!includeCreators && !includeStarring) {
			return fail(400, { message: 'Select at least one: Creators or Starring/Athletes.' });
		}

		const { rows, total } = await fetchAffectedRows({
			from,
			includeCreators,
			includeStarring,
			limit: 50
		});

		const previewItems = buildPreview({ rows, from, to, includeCreators, includeStarring });

		return {
			ok: true,
			from,
			to,
			includeCreators,
			includeStarring,
			preview: {
				total,
				shown: previewItems.length,
				items: previewItems
			}
		};
	},

	merge: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const from = asTrimmedString(form.get('from'));
		const to = asTrimmedString(form.get('to'));
		const { includeCreators, includeStarring } = parseScope(form);
		const confirmed = form.get('confirm') === 'yes';

		if (!from) return fail(400, { message: 'From name is required.' });
		if (!to) return fail(400, { message: 'To name is required.' });
		if (from === to) return fail(400, { message: 'From and To must be different.' });
		if (!includeCreators && !includeStarring) {
			return fail(400, { message: 'Select at least one: Creators or Starring/Athletes.' });
		}
		if (!confirmed) {
			return fail(400, { message: 'Please confirm before applying a bulk merge.' });
		}

		const supabase = createSupabaseServiceClient();
		const { rows, total } = await fetchAffectedRows({
			from,
			includeCreators,
			includeStarring
		});

		let updated = 0;
		for (const row of rows) {
			const updates: Partial<Pick<MediaRow, 'creators' | 'starring'>> = {};

			if (includeCreators) {
				const before = normalizeList(row.creators);
				if (before.some((v) => v === from)) {
					const after = replaceAndDedupe(before, from, to);
					updates.creators = after;
				}
			}

			if (includeStarring) {
				const before = normalizeList(row.starring);
				if (before.some((v) => v === from)) {
					const after = replaceAndDedupe(before, from, to);
					updates.starring = after;
				}
			}

			if (!('creators' in updates) && !('starring' in updates)) continue;

			const { error } = await supabase.from('media_items').update(updates).eq('id', row.id);
			if (error) return fail(400, { message: error.message });
			updated += 1;
		}

		try {
			await movePersonProfile(supabase as any, { fromName: from, toName: to });
		} catch (profileError) {
			return fail(400, {
				message:
					profileError instanceof Error
						? `Media merged, but Instagram profile metadata could not be moved: ${profileError.message}`
						: 'Media merged, but Instagram profile metadata could not be moved.'
			});
		}

		await invalidateContentCache();

		return {
			ok: true,
			from,
			to,
			includeCreators,
			includeStarring,
			result: {
				affected: total,
				updated
			}
		};
	}
};
