import type { Movie } from './types';

const YOUTUBE_SHORT = /^youtube\/([^\s]+.*)$/i;
const VIMEO_SHORT = /^vimeo\/([^\s]+.*)$/i;
const HLS_SHORT = /^hls\/([^\s]+.*)$/i;
const YOUTUBE_DOMAIN =
	/^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const VIMEO_DOMAIN = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com/i;
const HAS_PROTOCOL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type PlaybackSourceKind = 'youtube' | 'vimeo' | 'hls' | 'direct';

export type PlaybackSource = {
	kind: PlaybackSourceKind;
	src: string;
	keySuffix: string;
};

function ensureProtocol(url: string) {
	if (HAS_PROTOCOL.test(url)) return url;
	if (url.startsWith('//')) return `https:${url}`;
	return `https://${url.replace(/^\/+/, '')}`;
}

function buildKeySuffix(kind: PlaybackSourceKind, value: string) {
	switch (kind) {
		case 'youtube':
			return `yt:${value}`;
		case 'vimeo':
			return `vimeo:${value}`;
		case 'hls':
			return `hls:${value}`;
		default:
			return `src:${value}`;
	}
}

export function isLikelyHlsUrl(value: string) {
	return /\.m3u8(?:$|[?#])/i.test(value.trim());
}

export function resolveInlinePlaybackSource(
	value: string | null | undefined,
	options?: { fallback?: 'youtube' | 'direct' }
): PlaybackSource | null {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return null;

	const hlsMatch = trimmed.match(HLS_SHORT);
	if (hlsMatch?.[1]?.trim()) {
		const hlsSrc = hlsMatch[1].trim();
		return { kind: 'hls', src: hlsSrc, keySuffix: buildKeySuffix('hls', hlsSrc) };
	}

	const ytMatch = trimmed.match(YOUTUBE_SHORT);
	if (ytMatch?.[1]?.trim()) {
		const youtubeId = ytMatch[1].trim();
		return {
			kind: 'youtube',
			src: `youtube/${youtubeId}`,
			keySuffix: buildKeySuffix('youtube', youtubeId)
		};
	}

	const vimeoMatch = trimmed.match(VIMEO_SHORT);
	if (vimeoMatch?.[1]?.trim()) {
		const vimeoId = vimeoMatch[1].trim();
		return {
			kind: 'vimeo',
			src: `vimeo/${vimeoId}`,
			keySuffix: buildKeySuffix('vimeo', vimeoId)
		};
	}

	if (YOUTUBE_DOMAIN.test(trimmed)) {
		return {
			kind: 'youtube',
			src: ensureProtocol(trimmed),
			keySuffix: buildKeySuffix('youtube', trimmed)
		};
	}

	if (VIMEO_DOMAIN.test(trimmed)) {
		return {
			kind: 'vimeo',
			src: ensureProtocol(trimmed),
			keySuffix: buildKeySuffix('vimeo', trimmed)
		};
	}

	if (isLikelyHlsUrl(trimmed)) {
		return { kind: 'hls', src: trimmed, keySuffix: buildKeySuffix('hls', trimmed) };
	}

	if (HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
		return { kind: 'direct', src: trimmed, keySuffix: buildKeySuffix('direct', trimmed) };
	}

	if (options?.fallback === 'direct') {
		return { kind: 'direct', src: trimmed, keySuffix: buildKeySuffix('direct', trimmed) };
	}

	return {
		kind: 'youtube',
		src: `youtube/${trimmed}`,
		keySuffix: buildKeySuffix('youtube', trimmed)
	};
}

export function resolveMoviePlaybackSource(
	movie: Pick<Movie, 'streamUrl' | 'videoId' | 'vimeoId'>
): PlaybackSource | null {
	const streamUrl = String(movie.streamUrl ?? '').trim();
	if (streamUrl) {
		return {
			kind: isLikelyHlsUrl(streamUrl) ? 'hls' : 'direct',
			src: streamUrl,
			keySuffix: buildKeySuffix(isLikelyHlsUrl(streamUrl) ? 'hls' : 'direct', streamUrl)
		};
	}

	const youtubeSource = resolveInlinePlaybackSource(movie.videoId ?? null, { fallback: 'youtube' });
	if (youtubeSource) return youtubeSource;

	const vimeoId = String(movie.vimeoId ?? '').trim();
	if (!vimeoId) return null;

	return {
		kind: 'vimeo',
		src: `vimeo/${vimeoId}`,
		keySuffix: buildKeySuffix('vimeo', vimeoId)
	};
}

export function getPublicProviderLinkSource(source: PlaybackSource | null) {
	if (!source) return null;

	const trimmed = source.src.trim();
	if (source.kind === 'youtube') {
		if (trimmed.startsWith('youtube/')) {
			const youtubeId = trimmed.slice('youtube/'.length).trim();
			if (!youtubeId) return null;
			return {
				kind: 'youtube' as const,
				url: `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
			};
		}
		if (YOUTUBE_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
			return { kind: 'youtube' as const, url: ensureProtocol(trimmed) };
		}
		if (YOUTUBE_ID_PATTERN.test(trimmed)) {
			return {
				kind: 'youtube' as const,
				url: `https://www.youtube.com/watch?v=${encodeURIComponent(trimmed)}`
			};
		}
		return null;
	}

	if (source.kind === 'vimeo') {
		if (trimmed.startsWith('vimeo/')) {
			const vimeoId = trimmed.slice('vimeo/'.length).trim();
			if (!vimeoId) return null;
			return { kind: 'vimeo' as const, url: `https://vimeo.com/${encodeURIComponent(vimeoId)}` };
		}
		if (VIMEO_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
			return { kind: 'vimeo' as const, url: ensureProtocol(trimmed) };
		}
		return { kind: 'vimeo' as const, url: `https://vimeo.com/${encodeURIComponent(trimmed)}` };
	}

	return null;
}