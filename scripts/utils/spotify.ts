type SpotifyToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type SpotifyTrack = {
  id: string;
  url: string;
  title: string;
  artist: string;
  durationMs?: number;
};

let cachedToken: { value: string; expiresAtMs: number } | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name} env var (required for Spotify API calls).`);
  }
  return value.trim();
}

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
  // Remove bracketed qualifiers that are frequently omitted in user-provided titles.
  v = v.replace(/\([^)]*\)/g, ' ');
  v = v.replace(/\[[^\]]*\]/g, ' ');
  // Remove common " - Something" suffixes that Spotify often appends.
  v = v.replace(/\s+-\s+(remaster(ed)?|radio edit|edit|mix|version|live|mono|stereo|bonus track|from .*|original motion picture soundtrack).*$/i, ' ');
  return v;
}

function normalizeTitleExact(value: string) {
  return normalizeLoose(stripTitleNoise(value));
}

function tokenize(value: string) {
  return normalizeLoose(value).split(' ').filter(Boolean);
}

export function extractSpotifyTrackId(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // spotify:track:ID
  const uri = raw.match(/^spotify:track:([A-Za-z0-9]{10,})$/);
  if (uri) return uri[1];

  // https://open.spotify.com/track/ID?...
  try {
    const url = new URL(raw);
    if (/spotify\.com$/i.test(url.hostname) || /open\.spotify\.com$/i.test(url.hostname)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'track' && parts[1]) return parts[1];
    }
  } catch {
    // not a URL
  }

  // plain-ish ID
  if (/^[A-Za-z0-9]{10,}$/.test(raw)) return raw;

  return null;
}

async function getSpotifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 15_000) return cachedToken.value;

  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = requireEnv('SPOTIFY_CLIENT_SECRET');
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

export async function fetchSpotifyTrack(trackId: string): Promise<SpotifyTrack> {
  const token = await getSpotifyAccessToken();

  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify track fetch failed: ${res.status} ${text}`);
  }

  const json: any = await res.json();
  const title = String(json?.name ?? '').trim();
  const artist = Array.isArray(json?.artists) ? json.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '';
  const url = String(json?.external_urls?.spotify ?? `https://open.spotify.com/track/${trackId}`);

  if (!title || !artist) throw new Error('Spotify track response missing title/artist.');

  return {
    id: trackId,
    url,
    title,
    artist,
    durationMs: typeof json?.duration_ms === 'number' ? json.duration_ms : undefined
  };
}

export async function searchSpotifyTrackByTitleAndArtist(params: {
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

    const artists = Array.isArray(item?.artists) ? item.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '';
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

  // 1) Primary: title + artist
  const direct = await searchSpotifyTrackByTitleAndArtist({ title, artist: artist || undefined });
  if (direct) return direct;

  // 2) Some YouTube tracklists are "Title - Artist"; try swapped
  if (artist) {
    const swapped = await searchSpotifyTrackByTitleAndArtist({ title: artist, artist: title });
    if (swapped) return swapped;
  }

  // 3) Fallback: title-only (still exact-normalized title match)
  const titleOnly = await searchSpotifyTrackByTitleAndArtist({ title, artist: undefined });
  if (titleOnly) return titleOnly;

  // 4) Last chance: swapped title-only
  if (artist) {
    const swappedTitleOnly = await searchSpotifyTrackByTitleAndArtist({ title: artist, artist: undefined });
    if (swappedTitleOnly) return swappedTitleOnly;
  }

  return null;
}
