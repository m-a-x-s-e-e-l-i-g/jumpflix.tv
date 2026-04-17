import { slugify } from '$lib/tv/slug';

type MaybeArray = string[] | null | undefined;

export type PersonProfileRow = {
	slug: string;
	name: string;
	instagram_handles: string[] | null;
	created_at?: string;
	updated_at?: string;
};

export type ParsedInstagramEntry = {
	name: string;
	slug: string;
	instagramHandles: string[];
	lineNumbers: number[];
	rawLines: string[];
};

export type IgnoredInstagramLine = {
	lineNumber: number;
	text: string;
	reason: string;
};

export type KnownPerson = {
	name: string;
	slug: string;
	roles: {
		creator: boolean;
		athlete: boolean;
	};
};

export type PersonMatchCandidate = {
	slug: string;
	name: string;
	score: number;
	reason: 'exact' | 'strong' | 'possible';
	roles: KnownPerson['roles'];
};

function dedupePreserveOrder(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(trimmed);
	}
	return out;
}

function tokenizeName(value: string): string[] {
	return slugify(value)
		.split('-')
		.map((token) => token.trim())
		.filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	const current = new Array<number>(b.length + 1).fill(0);

	for (let row = 1; row <= a.length; row += 1) {
		current[0] = row;
		for (let col = 1; col <= b.length; col += 1) {
			const cost = a[row - 1] === b[col - 1] ? 0 : 1;
			current[col] = Math.min(
				current[col - 1] + 1,
				previous[col] + 1,
				previous[col - 1] + cost
			);
		}
		for (let col = 0; col <= b.length; col += 1) previous[col] = current[col];
	}

	return previous[b.length] ?? Math.max(a.length, b.length);
}

function scoreNameMatch(inputName: string, candidateName: string): number {
	const inputSlug = slugify(inputName);
	const candidateSlug = slugify(candidateName);
	if (!inputSlug || !candidateSlug) return 0;
	if (inputSlug === candidateSlug) return 1;

	const inputTokens = tokenizeName(inputName);
	const candidateTokens = tokenizeName(candidateName);
	if (!inputTokens.length || !candidateTokens.length) return 0;

	const candidateTokenSet = new Set(candidateTokens);
	const tokenMatches = inputTokens.filter((token) => candidateTokenSet.has(token)).length;
	const tokenOverlap = tokenMatches / Math.max(inputTokens.length, candidateTokens.length);

	const editDistance = levenshteinDistance(inputSlug, candidateSlug);
	const editSimilarity = 1 - editDistance / Math.max(inputSlug.length, candidateSlug.length);
	const sameLastToken = inputTokens.at(-1) === candidateTokens.at(-1);
	const sameFirstToken = inputTokens[0] === candidateTokens[0];
	const prefixMatch =
		inputSlug.startsWith(candidateSlug) ||
		candidateSlug.startsWith(inputSlug) ||
		inputTokens.every((token) => candidateTokenSet.has(token));

	return Math.max(
		0,
		editSimilarity * 0.45 +
			tokenOverlap * 0.35 +
			(prefixMatch ? 0.1 : 0) +
			(sameLastToken ? 0.07 : 0) +
			(sameFirstToken ? 0.03 : 0)
	);
}

function getCandidateReason(score: number): PersonMatchCandidate['reason'] | null {
	if (score >= 0.999) return 'exact';
	if (score >= 0.86) return 'strong';
	if (score >= 0.6) return 'possible';
	return null;
}

export function normalizeInstagramHandles(values: MaybeArray): string[] {
	const handles = Array.isArray(values) ? values : [];
	return dedupePreserveOrder(
		handles
			.map((value) => normalizeInstagramHandle(value))
			.filter(Boolean)
	);
}

export function normalizeInstagramHandle(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';

	let candidate = trimmed
		.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
		.replace(/^@+/, '')
		.trim();

	candidate = candidate.split(/[/?#]/, 1)[0]?.trim() ?? '';
	if (!candidate) return '';

	const normalized = candidate.toLowerCase();
	return /^[a-z0-9._]{1,30}$/.test(normalized) ? normalized : '';
}

function extractInstagramHandles(line: string): string[] {
	const handles: string[] = [];

	for (const match of line.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)(?:[/?#]|$)/gi)) {
		const handle = normalizeInstagramHandle(match[1] ?? '');
		if (handle) handles.push(handle);
	}

	for (const match of line.matchAll(/@([A-Za-z0-9._]{1,30})/g)) {
		const handle = normalizeInstagramHandle(match[1] ?? '');
		if (handle) handles.push(handle);
	}

	return dedupePreserveOrder(handles);
}

function extractDisplayName(line: string): string {
	const match = /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+(?:[/?#]|$)|@[A-Za-z0-9._]{1,30}/i.exec(line);
	if (!match || typeof match.index !== 'number') return '';

	let name = line.slice(0, match.index).trim();
	name = name.replace(/^[\s\-–—*•\d.)]+/, '').trim();
	name = name.replace(/[|,:;\/-]+$/, '').trim();
	name = name.replace(/\s{2,}/g, ' ');
	return name;
}

export function parseBulkInstagramInput(input: string): {
	entries: ParsedInstagramEntry[];
	ignoredLines: IgnoredInstagramLine[];
} {
	const bySlug = new Map<string, ParsedInstagramEntry>();
	const ignoredLines: IgnoredInstagramLine[] = [];
	const lines = input.split(/\r?\n/);

	for (const [index, originalLine] of lines.entries()) {
		const lineNumber = index + 1;
		const trimmed = originalLine.trim();
		if (!trimmed) continue;

		const instagramHandles = extractInstagramHandles(trimmed);
		if (!instagramHandles.length) {
			ignoredLines.push({
				lineNumber,
				text: trimmed,
				reason: trimmed.endsWith(':') ? 'heading' : 'no_instagram_handle'
			});
			continue;
		}

		const name = extractDisplayName(trimmed);
		if (!name) {
			ignoredLines.push({
				lineNumber,
				text: trimmed,
				reason: 'missing_name'
			});
			continue;
		}

		const slug = slugify(name);
		if (!slug) {
			ignoredLines.push({
				lineNumber,
				text: trimmed,
				reason: 'invalid_name'
			});
			continue;
		}

		const existing = bySlug.get(slug);
		if (existing) {
			existing.name = name;
			existing.instagramHandles = dedupePreserveOrder([
				...existing.instagramHandles,
				...instagramHandles
			]);
			existing.lineNumbers.push(lineNumber);
			existing.rawLines.push(trimmed);
			continue;
		}

		bySlug.set(slug, {
			name,
			slug,
			instagramHandles,
			lineNumbers: [lineNumber],
			rawLines: [trimmed]
		});
	}

	return {
		entries: Array.from(bySlug.values()),
		ignoredLines
	};
}

export function buildKnownPeopleMap(content: unknown): Map<string, KnownPerson> {
	const items = Array.isArray(content) ? content : [];
	const people = new Map<string, KnownPerson>();

	function addName(value: unknown, role: 'creator' | 'athlete') {
		if (typeof value !== 'string') return;
		const name = value.trim();
		if (!name) return;
		const slug = slugify(name);
		if (!slug) return;

		const existing = people.get(slug);
		if (existing) {
			existing.roles[role] = true;
			return;
		}

		people.set(slug, {
			name,
			slug,
			roles: {
				creator: role === 'creator',
				athlete: role === 'athlete'
			}
		});
	}

	for (const item of items) {
		const creators = (item as any)?.creators;
		const starring = (item as any)?.starring;
		if (Array.isArray(creators)) {
			for (const creator of creators) addName(creator, 'creator');
		}
		if (Array.isArray(starring)) {
			for (const athlete of starring) addName(athlete, 'athlete');
		}
	}

	return people;
}

export function findPersonMatchCandidates(
	inputName: string,
	knownPeople: Iterable<KnownPerson>,
	limit = 5
): PersonMatchCandidate[] {
	const ranked: PersonMatchCandidate[] = [];

	for (const person of knownPeople) {
		const score = Number(scoreNameMatch(inputName, person.name).toFixed(3));
		const reason = getCandidateReason(score);
		if (!reason) continue;

		ranked.push({
			slug: person.slug,
			name: person.name,
			score,
			reason,
			roles: person.roles
		});
	}

	ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
	return ranked.slice(0, limit);
}

export function chooseSuggestedPerson(candidates: PersonMatchCandidate[]): PersonMatchCandidate | null {
	const [first, second] = candidates;
	if (!first) return null;
	if (first.reason === 'exact' || first.reason === 'strong') return first;
	if (!second || first.score - second.score >= 0.12) return first;
	return null;
}

export function sortKnownPeople(values: Iterable<KnownPerson>): KnownPerson[] {
	return Array.from(values).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function isMissingPersonProfilesTableError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
	return code === '42P01';
}

export async function movePersonProfile(
	supabase: any,
	opts: { fromName: string; toName: string }
): Promise<void> {
	const fromSlug = slugify(opts.fromName);
	const toSlug = slugify(opts.toName);
	if (!fromSlug || !toSlug || fromSlug === toSlug) return;

	const { data, error } = await supabase
		.from('person_profiles')
		.select('slug, name, instagram_handles')
		.in('slug', [fromSlug, toSlug]);

	if (error) {
		if (isMissingPersonProfilesTableError(error)) return;
		throw new Error(error.message);
	}

	const rows = ((data ?? []) as PersonProfileRow[]).filter(Boolean);
	const fromRow = rows.find((row) => row.slug === fromSlug) ?? null;
	const toRow = rows.find((row) => row.slug === toSlug) ?? null;

	if (!fromRow && !toRow) return;

	const instagramHandles = normalizeInstagramHandles([
		...normalizeInstagramHandles(fromRow?.instagram_handles),
		...normalizeInstagramHandles(toRow?.instagram_handles)
	]);

	const { error: upsertError } = await supabase.from('person_profiles').upsert(
		{
			slug: toSlug,
			name: opts.toName.trim() || toRow?.name || fromRow?.name || toSlug,
			instagram_handles: instagramHandles
		},
		{ onConflict: 'slug' }
	);

	if (upsertError) throw new Error(upsertError.message);

	if (fromRow) {
		const { error: deleteError } = await supabase.from('person_profiles').delete().eq('slug', fromSlug);
		if (deleteError) throw new Error(deleteError.message);
	}
}