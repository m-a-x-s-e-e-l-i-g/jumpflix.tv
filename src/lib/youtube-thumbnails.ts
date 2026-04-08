const YOUTUBE_THUMBNAIL_QUALITIES = [
	'maxresdefault',
	'sddefault',
	'hqdefault',
	'mqdefault',
	'default'
] as const;

export type YouTubeThumbnailQuality = (typeof YOUTUBE_THUMBNAIL_QUALITIES)[number];

export function isYouTubeVideoId(value: string): boolean {
	return /^[A-Za-z0-9_-]{11}$/.test(value.trim());
}

export function isLikelyMissingYouTubeThumbnail(width: number, height: number): boolean {
	return width === 120 && height === 90;
}

export function getYouTubeThumbnailCandidates(videoId: string): string[] {
	const id = videoId.trim();
	if (!isYouTubeVideoId(id)) return [];
	return YOUTUBE_THUMBNAIL_QUALITIES.map((quality) => `https://img.youtube.com/vi/${id}/${quality}.jpg`);
}
