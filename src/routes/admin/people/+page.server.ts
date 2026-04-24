import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { fetchAllContent, invalidateContentCache } from '$lib/server/content-service';
import { findPersonMatchCandidates, movePersonProfile } from '$lib/server/person-profiles';
import { slugify } from '$lib/tv/slug';

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

async function applySingleMerge(opts: {
	supabase: ReturnType<typeof createSupabaseServiceClient>;
	from: string;
	to: string;
	includeCreators: boolean;
	includeStarring: boolean;
}): Promise<{ affected: number; updated: number }> {
	const { supabase, from, to, includeCreators, includeStarring } = opts;
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
		if (error) throw new Error(error.message);
		updated += 1;
	}

	return { affected: total, updated };
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

	type PersonAggregate = {
		slug: string;
		roles: {
			creator: boolean;
			athlete: boolean;
		};
		mentions: number;
		variantCounts: Map<string, number>;
	};

	const peopleBySlug = new Map<string, PersonAggregate>();

	function addName(value: unknown, role: 'creator' | 'athlete') {
		if (typeof value !== 'string') return;
		const trimmed = value.trim();
		if (!trimmed) return;

		const slug = slugify(trimmed);
		if (!slug) return;

		const existing = peopleBySlug.get(slug);
		if (existing) {
			existing.roles[role] = true;
			existing.mentions += 1;
			existing.variantCounts.set(trimmed, (existing.variantCounts.get(trimmed) ?? 0) + 1);
			return;
		}

		peopleBySlug.set(slug, {
			slug,
			roles: {
				creator: role === 'creator',
				athlete: role === 'athlete'
			},
			mentions: 1,
			variantCounts: new Map([[trimmed, 1]])
		});
	}

	for (const item of content) {
		const creators = (item as any)?.creators;
		const starring = (item as any)?.starring;

		if (Array.isArray(creators)) {
			for (const c of creators) addName(c, 'creator');
		}
		if (Array.isArray(starring)) {
			for (const s of starring) addName(s, 'athlete');
		}
	}

	const all = Array.from(peopleBySlug.values())
		.map((person) => {
			const variants = Array.from(person.variantCounts.entries())
				.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
				.map(([name]) => name);

			return {
				slug: person.slug,
				name: variants[0] ?? person.slug,
				variants,
				roles: person.roles,
				mentions: person.mentions
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

	const potentialMatches = all
		.filter((person) => person.variants.length > 1)
		.map((person) => ({
			slug: person.slug,
			names: person.variants,
			roles: person.roles,
			mentions: person.mentions
		}))
		.sort((a, b) => {
			if (b.names.length !== a.names.length) return b.names.length - a.names.length;
			if (b.mentions !== a.mentions) return b.mentions - a.mentions;
			return a.names[0].localeCompare(b.names[0], undefined, { sensitivity: 'base' });
		});

	const knownPeople = all.map((person) => ({
		slug: person.slug,
		name: person.name,
		roles: person.roles
	}));

	const peopleBySlugLookup = new Map(knownPeople.map((person) => [person.slug, person]));
	const lookAlikeByPair = new Map<
		string,
		{
			left: { slug: string; name: string; roles: { creator: boolean; athlete: boolean } };
			right: { slug: string; name: string; roles: { creator: boolean; athlete: boolean } };
			score: number;
			reason: 'exact' | 'strong' | 'possible';
		}
	>();

	for (const person of knownPeople) {
		const candidates = findPersonMatchCandidates(
			person.name,
			knownPeople.filter((candidate) => candidate.slug !== person.slug),
			6
		);

		for (const candidate of candidates) {
			const other = peopleBySlugLookup.get(candidate.slug);
			if (!other) continue;

			const leftSlug = person.slug.localeCompare(other.slug) <= 0 ? person.slug : other.slug;
			const rightSlug = leftSlug === person.slug ? other.slug : person.slug;
			const key = `${leftSlug}::${rightSlug}`;
			const existing = lookAlikeByPair.get(key);

			if (existing && existing.score >= candidate.score) continue;

			const left = leftSlug === person.slug ? person : other;
			const right = left.slug === person.slug ? other : person;

			lookAlikeByPair.set(key, {
				left: {
					slug: left.slug,
					name: left.name,
					roles: left.roles
				},
				right: {
					slug: right.slug,
					name: right.name,
					roles: right.roles
				},
				score: candidate.score,
				reason: candidate.reason
			});
		}
	}

	const lookAlikeMatches = Array.from(lookAlikeByPair.values())
		.filter((pair) => pair.score >= 0.7)
		.sort((a, b) => b.score - a.score || a.left.name.localeCompare(b.left.name, undefined, { sensitivity: 'base' }));

	return {
		people: {
			all,
			potentialMatches,
			lookAlikeMatches
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
		const result = await applySingleMerge({
			supabase,
			from,
			to,
			includeCreators,
			includeStarring
		});

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
				affected: result.affected,
				updated: result.updated
			}
		};
	},

	quickMerge: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const keepName = asTrimmedString(form.get('keep_name'));
		const mergeFrom = asTrimmedString(form.get('merge_from'));
		const allNamesRaw = asTrimmedString(form.get('all_names'));

		if (!keepName) return fail(400, { message: 'Keep name is required.' });

		const fromNames: string[] = [];
		if (mergeFrom) fromNames.push(mergeFrom);

		if (allNamesRaw) {
			try {
				const parsed = JSON.parse(allNamesRaw) as unknown;
				if (Array.isArray(parsed)) {
					for (const item of parsed) {
						if (typeof item !== 'string') continue;
						const trimmed = item.trim();
						if (!trimmed || trimmed === keepName) continue;
						fromNames.push(trimmed);
					}
				}
			} catch {
				return fail(400, { message: 'Invalid match payload.' });
			}
		}

		const uniqueFromNames = dedupePreserveOrder(fromNames).filter((name) => name !== keepName);
		if (!uniqueFromNames.length) {
			return fail(400, { message: 'No source name selected to merge.' });
		}

		const supabase = createSupabaseServiceClient();
		let totalAffected = 0;
		let totalUpdated = 0;

		for (const from of uniqueFromNames) {
			try {
				const result = await applySingleMerge({
					supabase,
					from,
					to: keepName,
					includeCreators: true,
					includeStarring: true
				});
				totalAffected += result.affected;
				totalUpdated += result.updated;
				await movePersonProfile(supabase as any, { fromName: from, toName: keepName });
			} catch (error) {
				return fail(400, {
					message: error instanceof Error ? error.message : 'Failed to merge selected names.'
				});
			}
		}

		await invalidateContentCache();

		return {
			ok: true,
			quickMerge: {
				keepName,
				merged: uniqueFromNames,
				affected: totalAffected,
				updated: totalUpdated
			}
		};
	}
};
