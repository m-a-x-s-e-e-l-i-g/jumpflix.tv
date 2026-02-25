import { env } from '$env/dynamic/private';

export type SpotifyTrack = {
	id: string;
	url: string;
	title: string;
	artist: string;
	durationMs?: number;
};

type SpotifyToken = {
	access_token: string;
	token_type: string;
	expires_in: number;
};

let cachedToken: { value: string; expiresAtMs: number } | null = null;

function normalizeLoose(value: string) {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function stripTitleNoise(value: string) {
	let v = (value || '').trim();
	if (!v) return '';
	v = v.replace(/\([^)]*\)/g, ' ');
	v = v.replace(/\[[^\]]*\]/g, ' ');
	v = v.replace(
		/\s+-\s+(remaster(ed)?|radio edit|edit|mix|version|live|mono|stereo|bonus track|from .*|original motion picture soundtrack).*$/i,
		' '
	);
	return v;
}

function normalizeTitleExact(value: string) {
	return normalizeLoose(stripTitleNoise(value));
}

function tokenize(value: string) {
	return normalizeLoose(value).split(' ').filter(Boolean);
}

export function hasSpotifyCredentials(): boolean {
	return Boolean(env.SPOTIFY_CLIENT_ID?.trim() && env.SPOTIFY_CLIENT_SECRET?.trim());
}

async function getSpotifyAccessToken(): Promise<string> {
	const now = Date.now();
	if (cachedToken && cachedToken.expiresAtMs > now + 15_000) return cachedToken.value;

	const clientId = env.SPOTIFY_CLIENT_ID?.trim();
	const clientSecret = env.SPOTIFY_CLIENT_SECRET?.trim();
	if (!clientId) throw new Error('Missing SPOTIFY_CLIENT_ID env var (required for Spotify API calls).');
	if (!clientSecret)
		throw new Error('Missing SPOTIFY_CLIENT_SECRET env var (required for Spotify API calls).');

	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			authorization: `Basic ${basic}`,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ grant_type: 'client_credentials' })
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Spotify token request failed: ${res.status} ${text}`);
	}

	const json = (await res.json()) as SpotifyToken;
	cachedToken = {
		value: json.access_token,
		expiresAtMs: Date.now() + json.expires_in * 1000
	};
	return cachedToken.value;
}

async function searchSpotifyTrackByTitleAndArtist(params: {
	title: string;
	artist?: string;
}): Promise<SpotifyTrack | null> {
	const title = (params.title || '').trim();
	const artist = (params.artist || '').trim();
	if (!title) return null;

	const token = await getSpotifyAccessToken();

	const qParts: string[] = [];
	qParts.push(`track:${title}`);
	if (artist) qParts.push(`artist:${artist}`);

	const url = new URL('https://api.spotify.com/v1/search');
	url.searchParams.set('type', 'track');
	url.searchParams.set('limit', '10');
	url.searchParams.set('q', qParts.join(' '));

	const res = await fetch(url.toString(), {
		headers: { authorization: `Bearer ${token}` }
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Spotify search failed: ${res.status} ${text}`);
	}

	const json: any = await res.json();
	const items: any[] = json?.tracks?.items ?? [];

	const targetTitle = normalizeTitleExact(title);
	const targetArtistTokens = artist ? new Set(tokenize(artist)) : null;

	for (const item of items) {
		const foundTitle = normalizeTitleExact(String(item?.name ?? ''));
		if (!foundTitle || foundTitle !== targetTitle) continue;

		const artists = Array.isArray(item?.artists)
			? item.artists
					.map((a: any) => a?.name)
					.filter(Boolean)
					.join(', ')
			: '';
		if (targetArtistTokens) {
			const foundArtistTokens = new Set(tokenize(artists));
			let ok = true;
			for (const tok of targetArtistTokens) {
				if (!foundArtistTokens.has(tok)) {
					ok = false;
					break;
				}
			}
			if (!ok) continue;
		}

		const id = String(item?.id ?? '').trim();
		if (!id) continue;

		return {
			id,
			url: String(item?.external_urls?.spotify ?? `https://open.spotify.com/track/${id}`),
			title: String(item?.name ?? '').trim(),
			artist: artists,
			durationMs: typeof item?.duration_ms === 'number' ? item.duration_ms : undefined
		};
	}

	return null;
}

export async function bestEffortSearchSpotifyTrack(params: {
	title: string;
	artist?: string;
}): Promise<SpotifyTrack | null> {
	const title = (params.title || '').trim();
	const artist = (params.artist || '').trim();
	if (!title) return null;

	const direct = await searchSpotifyTrackByTitleAndArtist({ title, artist: artist || undefined });
	if (direct) return direct;

	if (artist) {
		const swapped = await searchSpotifyTrackByTitleAndArtist({ title: artist, artist: title });
		if (swapped) return swapped;
	}

	const titleOnly = await searchSpotifyTrackByTitleAndArtist({ title, artist: undefined });
	if (titleOnly) return titleOnly;

	if (artist) {
		const swappedTitleOnly = await searchSpotifyTrackByTitleAndArtist({
			title: artist,
			artist: undefined
		});
		if (swappedTitleOnly) return swappedTitleOnly;
	}

	return null;
}

export async function searchSpotifyTracks(params: {
	title: string;
	artist?: string;
	limit?: number;
}): Promise<SpotifyTrack[]> {
	const title = (params.title || '').trim();
	const artist = (params.artist || '').trim();
	const limitRaw = typeof params.limit === 'number' ? params.limit : Number(params.limit);
	const limit = Number.isFinite(limitRaw) ? Math.min(10, Math.max(1, Math.floor(limitRaw))) : 10;
	if (!title) return [];

	const token = await getSpotifyAccessToken();

	const runQuery = async (qParts: string[]): Promise<SpotifyTrack[]> => {
		const url = new URL('https://api.spotify.com/v1/search');
		url.searchParams.set('type', 'track');
		url.searchParams.set('limit', String(limit));
		url.searchParams.set('q', qParts.join(' '));

		const res = await fetch(url.toString(), {
			headers: { authorization: `Bearer ${token}` }
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Spotify search failed: ${res.status} ${text}`);
		}

		const json: any = await res.json();
		const items: any[] = json?.tracks?.items ?? [];
		const out: SpotifyTrack[] = [];
		for (const item of items) {
			const id = String(item?.id ?? '').trim();
			if (!id) continue;
			const artists = Array.isArray(item?.artists)
				? item.artists
						.map((a: any) => a?.name)
						.filter(Boolean)
						.join(', ')
				: '';
			out.push({
				id,
				url: String(item?.external_urls?.spotify ?? `https://open.spotify.com/track/${id}`),
				title: String(item?.name ?? '').trim(),
				artist: artists,
				durationMs: typeof item?.duration_ms === 'number' ? item.duration_ms : undefined
			});
		}
		return out;
	};

	const qParts: string[] = [];
	qParts.push(`track:${title}`);
	if (artist) qParts.push(`artist:${artist}`);

	let results = await runQuery(qParts);
	if (!results.length && artist) {
		results = await runQuery([`track:${title}`]);
	}

	const seen = new Set<string>();
	const deduped: SpotifyTrack[] = [];
	for (const t of results) {
		const key = String(t?.id ?? '').trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		deduped.push(t);
	}
	return deduped;
}
