import { fetchAllContent } from '$lib/server/content-service';
import { slugify } from '$lib/tv/slug';

export type SuggestRole = 'creator' | 'athlete' | 'any';

function normalizeRole(roleRaw: string): SuggestRole {
	const role = roleRaw.trim().toLowerCase();
	return role === 'creator' || role === 'athlete' || role === 'any' ? role : 'any';
}

export async function suggestPeopleNames(opts: {
	query: string;
	role?: string;
	limit?: number;
}): Promise<Array<{ name: string }>> {
	const query = String(opts.query ?? '').trim();
	const role = normalizeRole(String(opts.role ?? 'any'));
	const limit = Math.max(1, Math.min(25, Math.floor(opts.limit ?? 12)));

	if (query.length < 2) {
		return [];
	}

	const queryLower = query.toLowerCase();
	const querySlug = slugify(query);
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
				for (const creator of creators) addName(creator);
			}
		}

		if (role === 'athlete' || role === 'any') {
			if (Array.isArray(starring)) {
				for (const athlete of starring) addName(athlete);
			}
		}
	}

	return Array.from(counts.entries())
		.map(([name, count]) => ({ name, count }))
		.filter(({ name }) => {
			const lower = name.toLowerCase();
			if (lower.includes(queryLower)) return true;
			if (querySlug && slugify(name).includes(querySlug)) return true;
			return false;
		})
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.name.localeCompare(b.name);
		})
		.slice(0, limit)
		.map(({ name }) => ({ name }));
}