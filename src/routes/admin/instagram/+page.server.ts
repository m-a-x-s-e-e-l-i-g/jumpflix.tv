import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { fetchAllContent } from '$lib/server/content-service';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import OpenAI from 'openai';
import {
	buildKnownPeopleMap,
	chooseSuggestedPerson,
	findPersonMatchCandidates,
	isMissingPersonProfilesTableError,
	normalizeInstagramHandles,
	parseBulkInstagramInput,
	sortKnownPeople,
	type PersonProfileRow
} from '$lib/server/person-profiles';

type ProfilePreviewItem = {
	parsedName: string;
	parsedSlug: string;
	instagramHandles: string[];
	suggestedSlug: string | null;
	suggestedName: string | null;
	suggestionConfidence: 'exact' | 'strong' | 'possible' | 'none';
	candidates: Array<{
		slug: string;
		name: string;
		score: number;
		reason: 'exact' | 'strong' | 'possible';
		roles: { creator: boolean; athlete: boolean };
	}>;
	existingHandles: string[];
	lineNumbers: number[];
};

type AIFormattedEntry = {
	name: string;
	instagram_handles: string[];
};

function buildFormattedBulkText(entries: AIFormattedEntry[]): string {
	return entries
		.map((entry) => {
			const name = typeof entry.name === 'string' ? entry.name.trim() : '';
			const handles = normalizeInstagramHandles(entry.instagram_handles).map((handle) => `@${handle}`);
			if (!name || !handles.length) return '';
			return `${name}   ${handles.join(' / ')}`;
		})
		.filter(Boolean)
		.join('\n');
}

async function formatBulkInstagramInputWithAI(input: string): Promise<string> {
	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY is not configured on the server.');
	}

	const openai = new OpenAI({ apiKey });
	const completion = await openai.chat.completions.create({
		model: 'gpt-4.1-mini',
		temperature: 0,
		response_format: { type: 'json_object' },
		messages: [
			{
				role: 'system',
				content:
					'You normalize messy credits lists into structured JSON. Extract only real people that have at least one Instagram handle. Do not invent names or handles. Return an object with an entries array. Each entry must have name and instagram_handles. instagram_handles must be lowercase handles without @ or URL parts.'
			},
			{
				role: 'user',
				content: `Convert this text into structured entries:\n\n${input}`
			}
		]
	});

	const content = completion.choices[0]?.message?.content?.trim() ?? '';
	if (!content) {
		throw new Error('OpenAI returned an empty response.');
	}

	let parsed: { entries?: AIFormattedEntry[] } | null = null;
	try {
		parsed = JSON.parse(content) as { entries?: AIFormattedEntry[] };
	} catch {
		throw new Error('OpenAI returned invalid JSON.');
	}

	const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
	const formatted = buildFormattedBulkText(entries);
	if (!formatted) {
		throw new Error('OpenAI could not extract any usable Instagram entries from that text.');
	}

	return formatted;
}

async function loadKnownPeople() {
	const content = await fetchAllContent();
	return buildKnownPeopleMap(content);
}

async function loadProfiles(): Promise<{ profiles: PersonProfileRow[]; tableReady: boolean; error: string | null }> {
	const supabase = createSupabaseServiceClient();
	const { data, error } = await supabase
		.from('person_profiles')
		.select('slug, name, instagram_handles, created_at, updated_at')
		.order('name', { ascending: true });

	if (error) {
		if (isMissingPersonProfilesTableError(error)) {
			return {
				profiles: [],
				tableReady: false,
				error: 'person_profiles table is missing. Run the latest Supabase migration first.'
			};
		}

		return {
			profiles: [],
			tableReady: true,
			error: error.message
		};
	}

	return {
		profiles: ((data ?? []) as PersonProfileRow[]).map((row) => ({
			...row,
			instagram_handles: normalizeInstagramHandles(row.instagram_handles)
		})),
		tableReady: true,
		error: null
	};
}

async function buildPreviewItems(input: string): Promise<{
	items: ProfilePreviewItem[];
	ignoredLines: ReturnType<typeof parseBulkInstagramInput>['ignoredLines'];
}> {
	const parsed = parseBulkInstagramInput(input);
	const knownPeople = await loadKnownPeople();
	const suggestions = parsed.entries.map((entry) => {
		const candidates = findPersonMatchCandidates(entry.name, knownPeople.values());
		const suggested = chooseSuggestedPerson(candidates);
		return { entry, candidates, suggested };
	});
	const slugs = Array.from(
		new Set(
			suggestions.flatMap(({ entry, suggested }) => [entry.slug, suggested?.slug].filter(Boolean) as string[])
		)
	);
	const existingBySlug = new Map<string, string[]>();

	if (slugs.length) {
		const supabase = createSupabaseServiceClient();
		const { data, error } = await supabase
			.from('person_profiles')
			.select('slug, instagram_handles')
			.in('slug', slugs);

		if (error && !isMissingPersonProfilesTableError(error)) {
			throw new Error(error.message);
		}

		for (const row of (data ?? []) as Array<{ slug: string; instagram_handles: string[] | null }>) {
			existingBySlug.set(row.slug, normalizeInstagramHandles(row.instagram_handles));
		}
	}

	return {
		items: suggestions.map(({ entry, candidates, suggested }) => {
			const existingSlug = suggested?.slug ?? entry.slug;
			return {
				parsedName: entry.name,
				parsedSlug: entry.slug,
				instagramHandles: entry.instagramHandles,
				suggestedSlug: suggested?.slug ?? null,
				suggestedName: suggested?.name ?? null,
				suggestionConfidence: suggested?.reason ?? 'none',
				candidates,
				existingHandles: existingBySlug.get(existingSlug) ?? [],
				lineNumbers: entry.lineNumbers
			};
		}),
		ignoredLines: parsed.ignoredLines
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const knownPeople = await loadKnownPeople();
	const profileState = await loadProfiles();

	return {
		knownPeople: sortKnownPeople(knownPeople.values()),
		profiles: profileState.profiles,
		tableReady: profileState.tableReady,
		error: profileState.error,
		aiReady: Boolean(env.OPENAI_API_KEY?.trim())
	};
};

export const actions: Actions = {
	aiPreview: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const bulkText = typeof form.get('bulk_text') === 'string' ? String(form.get('bulk_text')).trim() : '';
		if (!bulkText) return fail(400, { message: 'Paste some raw text first.' });

		try {
			const formattedText = await formatBulkInstagramInputWithAI(bulkText);
			const preview = await buildPreviewItems(formattedText);
			if (!preview.items.length) {
				return fail(400, {
					message: 'AI reformatted the text, but nothing usable was left to preview.',
					bulkText: formattedText
				});
			}

			return {
				ok: true,
				bulkText: formattedText,
				preview,
				notice: 'AI reformatted the text. Review the suggestions below before saving.'
			};
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'AI formatting failed.',
				bulkText
			});
		}
	},

	preview: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const bulkText = typeof form.get('bulk_text') === 'string' ? String(form.get('bulk_text')).trim() : '';
		if (!bulkText) return fail(400, { message: 'Paste at least one line with a name and Instagram handle.' });

		const preview = await buildPreviewItems(bulkText);
		if (!preview.items.length) {
			return fail(400, {
				message: 'Nothing usable was parsed from the pasted text.',
				bulkText,
				preview
			});
		}

		return {
			ok: true,
			bulkText,
			preview
		};
	},

	apply: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const bulkText = typeof form.get('bulk_text') === 'string' ? String(form.get('bulk_text')).trim() : '';
		if (!bulkText) return fail(400, { message: 'Paste at least one line with a name and Instagram handle.' });

		const parsed = parseBulkInstagramInput(bulkText);
		if (!parsed.entries.length) {
			return fail(400, { message: 'Nothing usable was parsed from the pasted text.', bulkText });
		}

		const knownPeople = await loadKnownPeople();
		const rowsBySlug = new Map<string, { slug: string; name: string; instagram_handles: string[] }>();

		for (const entry of parsed.entries) {
			if (!form.has(`include:${entry.slug}`)) continue;

			const selection = typeof form.get(`match:${entry.slug}`) === 'string'
				? String(form.get(`match:${entry.slug}`))
				: '';

			let selectedSlug = entry.slug;
			let selectedName = entry.name;

			if (selection.startsWith('known:')) {
				const known = knownPeople.get(selection.slice('known:'.length));
				if (known) {
					selectedSlug = known.slug;
					selectedName = known.name;
				}
			}

			const existing = rowsBySlug.get(selectedSlug);
			if (existing) {
				existing.instagram_handles = normalizeInstagramHandles([
					...existing.instagram_handles,
					...entry.instagramHandles
				]);
				continue;
			}

			rowsBySlug.set(selectedSlug, {
				slug: selectedSlug,
				name: selectedName,
				instagram_handles: normalizeInstagramHandles(entry.instagramHandles)
			});
		}

		const rows = Array.from(rowsBySlug.values());
		if (!rows.length) {
			return fail(400, {
				message: 'No entries were approved for saving.',
				bulkText
			});
		}

		const supabase = createSupabaseServiceClient();
		const { error } = await supabase.from('person_profiles').upsert(rows, { onConflict: 'slug' });

		if (error) {
			if (isMissingPersonProfilesTableError(error)) {
				return fail(400, {
					message: 'person_profiles table is missing. Run the latest Supabase migration first.',
					bulkText
				});
			}

			return fail(400, { message: error.message, bulkText });
		}

		return {
			ok: true,
			bulkText,
			result: {
				updated: rows.length
			}
		};
	},

	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const slug = typeof form.get('slug') === 'string' ? String(form.get('slug')).trim() : '';
		if (!slug) return fail(400, { message: 'Profile slug is required.' });

		const supabase = createSupabaseServiceClient();
		const { error } = await supabase.from('person_profiles').delete().eq('slug', slug);
		if (error) return fail(400, { message: error.message });

		return { ok: true, deletedSlug: slug };
	}
};