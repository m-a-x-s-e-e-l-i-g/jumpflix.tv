import { slugify } from '$lib/tv/slug';

export type InstagramAccount = { handle: string; names: string[] };
export type InstagramPerson = { slug: string; name: string };
export type InstagramCredit = {
	slug: string;
	title: string;
	type: string;
	creators: string[] | null;
	starring: string[] | null;
};
export type InstagramProfile = InstagramPerson & { instagram_handles: string[] | null };
export type InstagramSuggestion = {
	handle: string;
	matchedName: string;
	strength: 'name' | 'possible';
	reason: string;
	score: number;
};
export type InstagramResearchContext = {
	films: { title: string; url: string }[];
	collaborators: (InstagramPerson & { handles: string[]; followed: boolean })[];
};

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function handleValue(value: unknown): string {
	if (typeof value !== 'string') return '';
	const handle = value.trim().replace(/^@/, '').toLowerCase();
	return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : '';
}

function handleFromUrl(value: unknown): string {
	if (typeof value !== 'string') return '';
	try {
		const url = new URL(value);
		if (!['https:', 'http:'].includes(url.protocol)) return '';
		if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return '';
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts[0] === '_u') parts.shift();
		return parts.length === 1 ? handleValue(parts[0]) : '';
	} catch {
		return '';
	}
}

/** Read only the account-list formats, never recurse into messages or other export data. */
export function parseInstagramFollowing(input: string): InstagramAccount[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input.replace(/^\uFEFF/, ''));
	} catch {
		throw new Error(
			'This is not valid JSON. Export Followers and following in JSON format, then choose following.json.'
		);
	}
	const root = record(parsed);
	const entries = Array.isArray(root?.relationships_following)
		? root.relationships_following
		: Array.isArray(parsed)
			? parsed
			: null;
	if (!entries) {
		throw new Error(
			'Choose the following.json file inside your Instagram export, rather than the ZIP or another export section.'
		);
	}
	const byHandle = new Map<string, InstagramAccount>();
	for (const entry of entries) {
		const row = record(entry);
		if (!row) continue;
		const values = Array.isArray(row.string_list_data) ? row.string_list_data : [];
		const detail = values
			.map(record)
			.find((value) => value && (handleValue(value.value) || handleFromUrl(value.href)));
		const handle =
			handleValue(row.username) ||
			handleValue(detail?.value) ||
			handleFromUrl(detail?.href) ||
			handleValue(row.title);
		if (!handle) continue;
		const names = [row.full_name, row.display_name, row.name]
			.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
			.map((name) => name.trim());
		const account = byHandle.get(handle) ?? { handle, names: [] };
		account.names = Array.from(new Set([...account.names, ...names]));
		byHandle.set(handle, account);
	}
	if (!byHandle.size)
		throw new Error(
			'No Instagram accounts were found in this file. Choose a non-empty following export.'
		);
	if (byHandle.size > 20_000) throw new Error('Import at most 20,000 accounts at a time.');
	return Array.from(byHandle.values());
}

export function mergeInstagramAccounts(groups: InstagramAccount[][]): InstagramAccount[] {
	const accounts = new Map<string, InstagramAccount>();
	for (const group of groups)
		for (const account of group) {
			const existing = accounts.get(account.handle);
			accounts.set(account.handle, {
				handle: account.handle,
				names: Array.from(new Set([...(existing?.names ?? []), ...account.names]))
			});
		}
	if (accounts.size > 20_000) throw new Error('Import at most 20,000 accounts at a time.');
	return Array.from(accounts.values());
}

function compact(value: string) {
	return slugify(value).replace(/-/g, '');
}

type IndexedAccount = {
	account: InstagramAccount;
	compactHandle: string;
	displayNames: Map<string, string>;
};

function nameMatch(name: string, indexed: IndexedAccount): InstagramSuggestion | null {
	const { account } = indexed;
	const nameSlug = slugify(name);
	const full = compact(name);
	if (full.length < 4) return null;
	const displayName = indexed.displayNames.get(nameSlug);
	if (displayName) {
		return {
			handle: account.handle,
			matchedName: name,
			strength: 'name',
			reason: `Display name matches ${name}`,
			score: 1
		};
	}
	const handle = indexed.compactHandle;
	if (handle === full) {
		return {
			handle: account.handle,
			matchedName: name,
			strength: 'name',
			reason: `Username matches ${name}`,
			score: 0.95
		};
	}
	if (handle.includes(full) && handle.length - full.length <= 8) {
		return {
			handle: account.handle,
			matchedName: name,
			strength: 'possible',
			reason: `Username contains ${name}`,
			score: 0.8
		};
	}
	const tokens = nameSlug.split('-');
	const first = tokens[0];
	const last = tokens.at(-1) ?? '';
	if (tokens.length > 1 && last.length >= 4 && first.length >= 2) {
		const initialAndLast = `${first[0]}${last}`;
		const lastAndInitial = `${last}${first[0]}`;
		if (handle === initialAndLast || handle === lastAndInitial) {
			return {
				handle: account.handle,
				matchedName: name,
				strength: 'possible',
				reason: `Username matches the initial and surname of ${name}`,
				score: 0.65
			};
		}
	}
	return null;
}

/** Only observed handles can become candidates; sharing credits is context, not identity proof. */
export function suggestInstagramAccounts(
	people: InstagramPerson[],
	accounts: InstagramAccount[],
	profiles: InstagramProfile[],
	credits: InstagramCredit[]
): Record<string, InstagramSuggestion[]> {
	const reserved = new Set(
		profiles
			.flatMap((profile) => profile.instagram_handles ?? [])
			.map((handle) => handle.toLowerCase())
	);
	const available: IndexedAccount[] = accounts
		.filter((account) => !reserved.has(account.handle))
		.map((account) => ({
			account,
			compactHandle: compact(account.handle),
			displayNames: new Map(account.names.map((name) => [slugify(name), name]))
		}));
	const byGram = new Map<string, Set<number>>();
	const byHandle = new Map<string, Set<number>>();
	const byName = new Map<string, Set<number>>();
	function add(index: Map<string, Set<number>>, key: string, account: number) {
		const bucket = index.get(key) ?? new Set<number>();
		bucket.add(account);
		index.set(key, bucket);
	}
	for (const [index, account] of available.entries()) {
		add(byHandle, account.compactHandle, index);
		for (const name of account.displayNames.keys()) add(byName, name, index);
		for (let i = 0; i <= account.compactHandle.length - 4; i++)
			add(byGram, account.compactHandle.slice(i, i + 4), index);
	}
	const aliases = new Map<string, Set<string>>();
	for (const item of credits)
		for (const name of [...(item.creators ?? []), ...(item.starring ?? [])]) {
			const slug = slugify(name.trim());
			const names = aliases.get(slug) ?? new Set<string>();
			names.add(name.trim());
			aliases.set(slug, names);
		}
	const suggestions: Record<string, InstagramSuggestion[]> = Object.create(null);
	for (const person of people) {
		const names = new Set([person.name, ...(aliases.get(person.slug) ?? [])]);
		const eligible = new Set<number>();
		for (const name of names) {
			const slug = slugify(name);
			const tokens = slug.split('-');
			const first = tokens[0] ?? '';
			const last = tokens.at(-1) ?? '';
			for (const bucket of [
				byName.get(slug),
				byGram.get(compact(name).slice(0, 4)),
				byHandle.get(`${first[0]}${last}`),
				byHandle.get(`${last}${first[0]}`)
			]) {
				for (const index of bucket ?? []) eligible.add(index);
			}
		}
		const ranked: InstagramSuggestion[] = [];
		for (const index of eligible) {
			const account = available[index];
			let best: InstagramSuggestion | null = null;
			for (const name of names) {
				const match = nameMatch(name, account);
				if (match && (!best || match.score > best.score)) best = match;
			}
			if (best) ranked.push(best);
		}
		suggestions[person.slug] = ranked
			.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle))
			.slice(0, 5);
	}
	return suggestions;
}

export function buildInstagramResearchContext(
	credits: InstagramCredit[],
	profiles: InstagramProfile[],
	accounts: InstagramAccount[]
): Record<string, InstagramResearchContext> {
	const known = new Map(
		profiles
			.filter((profile) => profile.instagram_handles?.length)
			.map((profile) => [profile.slug, profile])
	);
	const followed = new Set(accounts.map((account) => account.handle));
	const context: Record<string, InstagramResearchContext> = Object.create(null);
	for (const item of credits) {
		const cast = Array.from(
			new Set(
				[...(item.creators ?? []), ...(item.starring ?? [])]
					.map((name) => slugify(name.trim()))
					.filter(Boolean)
			)
		);
		for (const slug of cast) {
			const value = context[slug] ?? { films: [], collaborators: [] };
			if (
				value.films.length < 3 &&
				!value.films.some((film) => film.url.endsWith(`/${item.slug}`))
			) {
				value.films.push({
					title: item.title,
					url: `/${item.type === 'series' ? 'series' : 'movie'}/${item.slug}`
				});
			}
			for (const other of cast) {
				const profile = known.get(other);
				if (
					other === slug ||
					!profile ||
					value.collaborators.some((person) => person.slug === other)
				)
					continue;
				const handles = profile.instagram_handles ?? [];
				value.collaborators.push({
					slug: profile.slug,
					name: profile.name,
					handles,
					followed: handles.some((handle) => followed.has(handle.toLowerCase()))
				});
			}
			context[slug] = value;
		}
	}
	for (const value of Object.values(context)) {
		value.collaborators.sort(
			(a, b) => Number(b.followed) - Number(a.followed) || a.name.localeCompare(b.name)
		);
		value.collaborators = value.collaborators.slice(0, 5);
	}
	return context;
}
