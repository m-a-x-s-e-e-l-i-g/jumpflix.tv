import type { PageServerLoad } from './$types';
import { fetchEpisodesBySeasonId } from '$lib/server/content-service';
import { fetchAllContent } from '$lib/server/content-service';
import { resolveInlinePlaybackSource, resolveMoviePlaybackSource } from '$lib/tv/playback-source';
import type { ContentItem, Movie, Series, VideoTrack } from '$lib/tv/types';
import { decode } from 'html-entities';

type AutoplayEntry = {
	id: string;
	title: string;
	poster: string | null;
	src: string;
	keySeed: string;
	mediaId: number | null;
	mediaType: 'movie' | 'series';
	tracks?: VideoTrack[];
};

function shuffleEntries<T>(items: T[]): T[] {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

function normalizePoster(value: string | null | undefined): string | null {
	const poster = String(value ?? '').trim();
	return poster || null;
}

function normalizeTitle(value: string | null | undefined, fallback: string): string {
	const normalized = decode(String(value ?? ''))
		.replace(/\s+/g, ' ')
		.trim();
	return normalized || fallback;
}

function isSessionContent(item: ContentItem): boolean {
	return item.facets?.type === 'session';
}

function isMovie(item: ContentItem): item is Movie {
	return item.type === 'movie';
}

function isSeries(item: ContentItem): item is Series {
	return item.type === 'series';
}

function buildMovieEntry(movie: Movie): AutoplayEntry | null {
	const playbackSource = resolveMoviePlaybackSource(movie);
	if (!playbackSource) return null;

	return {
		id: `movie:${movie.id}`,
		title: normalizeTitle(movie.title, 'Untitled movie'),
		poster: normalizePoster(movie.thumbnail),
		src: playbackSource.src,
		keySeed: `autoplay:movie:${movie.id}:${playbackSource.keySuffix}`,
		mediaId: typeof movie.id === 'number' ? movie.id : Number(movie.id) || null,
		mediaType: 'movie',
		tracks: movie.tracks
	};
}

async function buildSeriesEntries(series: Series): Promise<AutoplayEntry[]> {
	const playableSeasons = (series.seasons ?? []).filter(
		(season): season is NonNullable<Series['seasons']>[number] & { id: number } =>
			typeof season?.id === 'number' && Number.isFinite(season.id)
	);

	if (!playableSeasons.length) return [];

	const seasonsWithEpisodes = await Promise.all(
		playableSeasons.map(async (season) => ({
			season,
			episodes: await fetchEpisodesBySeasonId(season.id)
		}))
	);

	const entries: AutoplayEntry[] = [];
	for (const { season, episodes } of seasonsWithEpisodes) {
		for (const episode of episodes) {
			const episodeId = String(episode.id ?? '').trim();
			if (!episodeId || /^\d+$/.test(episodeId) || episode.externalUrl) continue;

			const playbackSource = resolveInlinePlaybackSource(episodeId, { fallback: 'youtube' });
			if (!playbackSource) continue;

			entries.push({
				id: `series:${series.id}:season:${season.id}:episode:${episodeId}`,
				title: `${normalizeTitle(series.title, 'Untitled series')} — ${normalizeTitle(episode.title, 'Untitled episode')}`,
				poster: normalizePoster(series.thumbnail),
				src: playbackSource.src,
				keySeed: `autoplay:series:${series.id}:season:${season.id}:episode:${episodeId}:${playbackSource.keySuffix}`,
				mediaId: typeof series.id === 'number' ? series.id : Number(series.id) || null,
				mediaType: 'series'
			});
		}
	}

	return entries;
}

async function buildAutoplayQueue(content: ContentItem[]): Promise<AutoplayEntry[]> {
	const sessionContent = content.filter(isSessionContent);
	const movieEntries = sessionContent.filter(isMovie).map(buildMovieEntry).filter(Boolean) as AutoplayEntry[];
	const seriesEntries = (
		await Promise.all(sessionContent.filter(isSeries).map((series) => buildSeriesEntries(series)))
	).flat();

	const uniqueEntries = Array.from(
		new Map([...movieEntries, ...seriesEntries].map((entry) => [entry.id, entry])).values()
	);

	return shuffleEntries(uniqueEntries);
}

export const load: PageServerLoad = async ({ setHeaders }) => {
	const content = await fetchAllContent();
	const queue = await buildAutoplayQueue(content);

	setHeaders({
		'Cache-Control': 'private, no-store',
		Vary: 'Cookie'
	});

	return { queue };
};