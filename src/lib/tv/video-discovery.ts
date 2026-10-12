import { decode } from 'html-entities';
import { verifiedDate } from '../seo';
import { resolveMoviePlaybackSource, YOUTUBE_ID_PATTERN } from './playback-source';
import { isoDuration } from './structured-data';
import { getUrlForItem } from './slug';
import type { Movie } from './types';

export type VideoMetadata = { sourceKey: string; publishedAt: string };

/** One source of truth for the visible player and its structured data. */
export function movieVideoSource(movie: Movie) {
	if (movie.paid || movie.availabilityStatus === 'unavailable') return null;
	const source = resolveMoviePlaybackSource(movie);
	if (!source) return null;
	if (source.kind === 'youtube') {
		let id = source.src.replace(/^youtube\//, '');
		try {
			const url = new URL(source.src);
			if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
			else id = url.searchParams.get('v') || url.pathname.split('/').pop() || '';
		} catch {
			/* Raw video ID. */
		}
		if (!YOUTUBE_ID_PATTERN.test(id)) return null;
		return {
			...source,
			sourceKey: `youtube/${id}`,
			embedUrl: `https://www.youtube.com/embed/${id}`
		};
	}
	if (source.kind === 'vimeo') {
		// Preserve the privacy hash on unlisted Vimeo videos.
		const match = source.src.match(/^(?:vimeo\/)?(\d+)(?:\/([a-zA-Z0-9]+))?$/);
		if (!match) return null;
		return {
			...source,
			sourceKey: `vimeo/${match[1]}${match[2] ? `/${match[2]}` : ''}`,
			embedUrl: `https://player.vimeo.com/video/${match[1]}${match[2] ? `?h=${match[2]}` : ''}`
		};
	}
	try {
		const url = new URL(source.src);
		if (!['https:', 'http:'].includes(url.protocol)) return null;
	} catch {
		return null;
	}
	return { ...source, sourceKey: source.src, embedUrl: undefined };
}

export function storedVideoDate(movie: Movie, metadata: unknown): string | undefined {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
	const value = metadata as Partial<VideoMetadata>;
	return movieVideoSource(movie)?.sourceKey === value.sourceKey &&
		typeof value.publishedAt === 'string'
		? verifiedDate(value.publishedAt)
		: undefined;
}

export function buildMovieVideoSchema(movie: Movie, origin: string) {
	const source = movieVideoSource(movie);
	const uploadDate = verifiedDate(movie.publishedAt);
	if (!source || !uploadDate || !movie.thumbnail) return null;
	let thumbnail: URL;
	try {
		thumbnail = new URL(movie.thumbnail, origin);
	} catch {
		return null;
	}
	if (!['http:', 'https:'].includes(thumbnail.protocol)) return null;
	const url = `${origin.replace(/\/$/, '')}${getUrlForItem(movie)}`;
	return {
		'@context': 'https://schema.org',
		'@type': 'VideoObject',
		'@id': `${url}#video`,
		name: decode(movie.title),
		description: decode(movie.description || `Watch ${movie.title} on JUMPFLIX.`),
		thumbnailUrl: [thumbnail.href],
		uploadDate,
		duration: isoDuration(movie.duration),
		about: { '@id': `${url}#movie` },
		embedUrl: source.embedUrl,
		contentUrl: source.embedUrl ? undefined : source.src,
		url
	};
}
