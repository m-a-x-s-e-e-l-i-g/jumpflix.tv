import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { fetchAllContent } from '$lib/server/content-service';
import { slugify } from '$lib/tv/slug';

type SuggestRole = 'creator' | 'athlete' | 'any';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const q = String(url.searchParams.get('q') ?? '').trim();
	const roleRaw = String(url.searchParams.get('role') ?? 'any').trim().toLowerCase();
	const role: SuggestRole = roleRaw === 'creator' || roleRaw === 'athlete' || roleRaw === 'any' ? roleRaw : 'any';

	// Keep this endpoint cheap and avoid returning huge payloads.
	if (q.length < 2) {
		return json({ results: [] as Array<{ name: string }> });
	}

	const qLower = q.toLowerCase();
	const qSlug = slugify(q);

	const content = await fetchAllContent();
	const counts = new Map<string, number>();

	function addName(name: unknown) {
		if (typeof name !== 'string') return;
		const trimmed = name.trim();
		if (!trimmed) return;
		counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
	}

	for (const item of content) {
		const creators = (item as any)?.creators;
		const starring = (item as any)?.starring;

		if (role === 'creator' || role === 'any') {
			if (Array.isArray(creators)) {
				for (const c of creators) addName(c);
			}
		}

		if (role === 'athlete' || role === 'any') {
			if (Array.isArray(starring)) {
				for (const s of starring) addName(s);
			}
		}
	}

	const results = Array.from(counts.entries())
		.map(([name, count]) => ({ name, count }))
		.filter(({ name }) => {
			const lower = name.toLowerCase();
			if (lower.includes(qLower)) return true;
			if (qSlug && slugify(name).includes(qSlug)) return true;
			return false;
		})
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.name.localeCompare(b.name);
		})
		.slice(0, 12)
		.map(({ name }) => ({ name }));

	return json({ results });
};
