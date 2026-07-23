import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { slugify } from '$lib/tv/slug';
import { importSpotifyTracklistFromYouTube } from '$lib/server/tracklist-import.server';
import { invalidateContentCache } from '$lib/server/content-service';
import { fetchPlaylistItems, type PlaylistItem } from '$lib/server/youtube-playlist.server';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);
	return {};
};

function parseArrayInput(input: string): string[] {
	if (!input.trim()) return [];
	return input
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function parsePlaylistId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	try {
		const url = new URL(trimmed);
		const host = url.hostname.toLowerCase();
		if (host === 'youtube.com' || host === 'www.youtube.com') {
			const listParam = url.searchParams.get('list');
			if (listParam && /^[A-Za-z0-9_-]{10,}$/.test(listParam)) return listParam;
		}
	} catch {
		// Keep parsing as a raw playlist ID.
	}

	if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
	return null;
}

type EpisodeOrder = 'playlist' | 'reverse' | 'oldest' | 'newest';

type SeasonDraft = {
	playlistId: string;
	customName: string | null;
	episodeOrder: EpisodeOrder;
	excludedVideoIds: string[];
};

function parseEpisodeOrder(value: unknown): EpisodeOrder {
	return value === 'reverse' || value === 'oldest' || value === 'newest' ? value : 'playlist';
}

function orderPlaylistItems(items: PlaylistItem[], episodeOrder: EpisodeOrder): PlaylistItem[] {
	if (episodeOrder === 'playlist') return items;
	if (episodeOrder === 'reverse') return items.toReversed();

	const direction = episodeOrder === 'oldest' ? 1 : -1;
	return items
		.map((item, index) => ({ item, index, publishedAt: Date.parse(item.publishedAt ?? '') }))
		.sort((a, b) => {
			const aHasDate = Number.isFinite(a.publishedAt);
			const bHasDate = Number.isFinite(b.publishedAt);
			if (!aHasDate && !bHasDate) return a.index - b.index;
			if (!aHasDate) return 1;
			if (!bHasDate) return -1;
			return (a.publishedAt - b.publishedAt) * direction || a.index - b.index;
		})
		.map(({ item }) => item);
}

function parseSeasonDrafts(form: FormData): SeasonDraft[] {
	const raw = String(form.get('seasons_json') || '').trim();
	if (raw) {
		try {
			const parsed = JSON.parse(raw) as Array<{
				playlistId?: unknown;
				customName?: unknown;
				episodeOrder?: unknown;
				excludedVideoIds?: unknown;
			}>;
			if (Array.isArray(parsed)) {
				const drafts = parsed
					.map((item) => {
						const playlistId = parsePlaylistId(String(item?.playlistId || ''));
						if (!playlistId) return null;
						const customName = String(item?.customName || '').trim() || null;
						const excludedVideoIds = Array.isArray(item?.excludedVideoIds)
							? item.excludedVideoIds
								.map((id) => String(id).trim())
								.filter((id) => /^[A-Za-z0-9_-]{6,}$/.test(id))
							: [];
						return {
							playlistId,
							customName,
							episodeOrder: parseEpisodeOrder(item?.episodeOrder),
							excludedVideoIds: [...new Set(excludedVideoIds)]
						};
					})
					.filter((item): item is SeasonDraft => item !== null);
				if (drafts.length > 0) return drafts;
			}
		} catch {
			// Fall back to legacy single-season fields.
		}
	}

	const legacyPlaylistId = parsePlaylistId(String(form.get('playlist_id') || ''));
	if (!legacyPlaylistId) return [];

	return [
		{
			playlistId: legacyPlaylistId,
			customName: String(form.get('season_name') || '').trim() || null,
			episodeOrder: 'playlist',
			excludedVideoIds: []
		}
	];
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();

		const title = String(form.get('title') || '').trim();
		if (!title) return fail(400, { message: 'Title is required' });

		const year = String(form.get('year') || '').trim() || null;
		const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
		const slugInput = String(form.get('slug') || '').trim();
		const slug = slugInput || defaultSlug;

		const providerInput = String(form.get('provider') || '').trim().toLowerCase();
		let normalizedProvider: string | null = providerInput || null;

		let youtubeVideoId = String(form.get('video_id') || '').trim() || null;
		let vimeoId = String(form.get('vimeo_id') || '').trim() || null;
		const streamUrl = String(form.get('stream_url') || '').trim() || null;

		if (providerInput === 'vimeo') {
			if (!vimeoId && youtubeVideoId) vimeoId = youtubeVideoId;
			youtubeVideoId = null;
		}

		if (providerInput === 'youtube') {
			if (!youtubeVideoId && vimeoId) youtubeVideoId = vimeoId;
			vimeoId = null;
		}

		if (!normalizedProvider) {
			if (vimeoId && !youtubeVideoId) normalizedProvider = 'vimeo';
			if (youtubeVideoId && !vimeoId) normalizedProvider = 'youtube';
			if (streamUrl) {
				if (/\.m3u8(?:$|[?#])/i.test(streamUrl)) normalizedProvider = 'hls';
				else if (/(bunnycdn|b-cdn|mediadelivery|bunny)/i.test(streamUrl)) normalizedProvider = 'bunny';
				else normalizedProvider = 'direct';
			}
		}

		const supabase = createSupabaseServiceClient();

		const { data, error } = await supabase
			.from('media_items')
			.insert({
				slug,
				type: 'movie',
				title,
				description: String(form.get('description') || '').trim() || null,
				year,
				duration: String(form.get('duration') || '').trim() || null,
				video_id: youtubeVideoId,
				vimeo_id: vimeoId,
				thumbnail: String(form.get('thumbnail') || '').trim() || null,
				blurhash: String(form.get('blurhash') || '').trim() || null,
				paid: form.get('paid') === 'true',
				provider: normalizedProvider,
				external_url: String(form.get('external_url') || '').trim() || null,
				stream_url: streamUrl,
				trakt: String(form.get('trakt') || '').trim() || null,
				creators: parseArrayInput(String(form.get('creators') || '')),
				starring: parseArrayInput(String(form.get('starring') || ''))
			})
			.select()
			.single();

		if (error) {
			return fail(400, { message: error.message });
		}

		// Best-effort: auto-import Spotify-backed tracklist from YouTube metadata.
		// Never block saving the movie on this step.
		try {
			const ytId = String((data as any)?.video_id ?? '').trim();
			if (ytId) {
				await importSpotifyTracklistFromYouTube({
					supabase,
					movieId: Number((data as any).id),
					youtubeVideoId: ytId
				});
			}
		} catch {
			// best-effort only
		}

		// Ensure the new movie is visible immediately after redirect.
		await invalidateContentCache();

		redirect(302, `/movie/${data.slug}`);
	},

	savePlaylistSeries: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();

		const title = String(form.get('title') || '').trim();
		if (!title) return fail(400, { message: 'Title is required' });

		const seasons = parseSeasonDrafts(form);
		if (seasons.length === 0) {
			return fail(400, { message: 'At least one valid season playlist is required' });
		}

		const year = String(form.get('year') || '').trim() || null;
		const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
		const slugInput = String(form.get('slug') || '').trim();
		const slug = slugInput || defaultSlug;

		const supabase = createSupabaseServiceClient();

		// 1. Create the series media item
		const { data: series, error: seriesError } = await supabase
			.from('media_items')
			.insert({
				slug,
				type: 'series',
				title,
				description: String(form.get('description') || '').trim() || null,
				year,
				thumbnail: String(form.get('thumbnail') || '').trim() || null,
				blurhash: String(form.get('blurhash') || '').trim() || null,
				paid: form.get('paid') === 'true',
				provider: 'youtube',
				creators: parseArrayInput(String(form.get('creators') || '')),
				starring: parseArrayInput(String(form.get('starring') || ''))
			})
			.select()
			.single();

		if (seriesError) {
			return fail(400, { message: seriesError.message });
		}

		// 2. Create all requested seasons
		const seasonRows = seasons.map((season, index) => ({
			series_id: Number(series.id),
			season_number: index + 1,
			playlist_id: season.playlistId,
			custom_name: season.customName
		}));

		const { data: createdSeasons, error: seasonError } = await supabase
			.from('series_seasons')
			.insert(seasonRows)
			.select()
			.order('season_number', { ascending: true });

		if (seasonError) {
			// Roll back the series if season creation fails
			await supabase.from('media_items').delete().eq('id', series.id);
			return fail(400, { message: `Failed to create season: ${seasonError.message}` });
		}

		const seasonsByNumber = new Map<number, { id: number; season_number: number }>();
		for (const createdSeason of createdSeasons ?? []) {
			const seasonNumber = Number((createdSeason as { season_number: unknown }).season_number);
			const seasonId = Number((createdSeason as { id: unknown }).id);
			if (Number.isFinite(seasonNumber) && Number.isFinite(seasonId)) {
				seasonsByNumber.set(seasonNumber, { id: seasonId, season_number: seasonNumber });
			}
		}

		// 3. Sync episodes from each playlist (best-effort)
		for (const [index, season] of seasons.entries()) {
			const seasonRecord = seasonsByNumber.get(index + 1);
			if (!seasonRecord) continue;

			try {
				const playlistItems = await fetchPlaylistItems(season.playlistId);
				const excludedVideoIds = new Set(season.excludedVideoIds);
				const includedItems = playlistItems.filter((item) => !excludedVideoIds.has(item.id));
				const items = orderPlaylistItems(includedItems, season.episodeOrder);
				if (items.length === 0) continue;

				const episodes = items.map((item, episodeIndex) => ({
					season_id: seasonRecord.id,
					episode_number: episodeIndex + 1,
					video_id: item.id,
					title: item.title,
					thumbnail: item.thumbnail ?? null,
					published_at: item.publishedAt ?? null
				}));

				await supabase.from('series_episodes').insert(episodes);
			} catch {
				// best-effort only — series and seasons are already saved
			}
		}

		await invalidateContentCache();

		redirect(302, `/series/${series.slug}`);
	}
};
