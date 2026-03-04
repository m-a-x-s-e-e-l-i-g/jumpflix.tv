import type { PageServerLoad } from './$types';
import type { ContentItem } from '$lib/tv/types';
import { slugify } from '$lib/tv/slug';
import { error, redirect } from '@sveltejs/kit';

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

type PersonRoles = {
	creator: boolean;
	athlete: boolean;
};

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const rawParam = typeof params.slug === 'string' ? safeDecodeURIComponent(params.slug) : '';
	const slug = slugify(rawParam);
	if (!slug) throw error(404, 'Person not found');
	if (rawParam !== slug) throw redirect(301, `/people/${slug}`);

	const parentData = await parent();
	const content = ((parentData as unknown as { content?: ContentItem[] }).content ?? []) as ContentItem[];

	const displayNameCounts = new Map<string, number>();
	const includedKeys = new Set<string>();
	const filtered: ContentItem[] = [];
	let hasCreator = false;
	let hasAthlete = false;

	for (const item of content) {
		const key = `${(item as any)?.type ?? 'unknown'}:${String((item as any)?.id ?? '')}`;
		if (!key || includedKeys.has(key)) continue;

		const creators = (item as any)?.creators;
		const starring = (item as any)?.starring;

		const creatorNames = Array.isArray(creators) ? (creators as unknown[]) : [];
		const athleteNames = Array.isArray(starring) ? (starring as unknown[]) : [];

		let matches = false;
		let matchesCreator = false;
		let matchesAthlete = false;

		for (const c of creatorNames) {
			if (typeof c !== 'string') continue;
			if (slugify(c) !== slug) continue;
			matches = true;
			matchesCreator = true;
			displayNameCounts.set(c, (displayNameCounts.get(c) ?? 0) + 1);
		}

		for (const s of athleteNames) {
			if (typeof s !== 'string') continue;
			if (slugify(s) !== slug) continue;
			matches = true;
			matchesAthlete = true;
			displayNameCounts.set(s, (displayNameCounts.get(s) ?? 0) + 1);
		}

		if (!matches) continue;

		includedKeys.add(key);
		filtered.push(item);
		if (matchesCreator) hasCreator = true;
		if (matchesAthlete) hasAthlete = true;
	}

	if (filtered.length === 0) throw error(404, 'Person not found');

	let name = slug;
	let bestCount = -1;
	for (const [candidate, count] of displayNameCounts.entries()) {
		if (count > bestCount) {
			bestCount = count;
			name = candidate;
		}
	}

	const roles: PersonRoles = {
		creator: hasCreator,
		athlete: hasAthlete
	};

	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders({
		'Cache-Control': isAuthenticated
			? 'private, no-store'
			: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
		Vary: 'Cookie'
	});

	return { content: filtered, name, slug, roles };
};
