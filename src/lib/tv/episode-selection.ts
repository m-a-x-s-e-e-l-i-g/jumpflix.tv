import type { Series } from './types';

export function findEpisode(series: Series, seasonParam: string, episodeParam: string) {
	if (!/^[1-9]\d*$/.test(seasonParam) || !/^[1-9]\d*$/.test(episodeParam)) return null;
	const seasonNumber = Number(seasonParam);
	const episodeNumber = Number(episodeParam);
	if (!Number.isSafeInteger(seasonNumber) || !Number.isSafeInteger(episodeNumber)) return null;
	const season = series.seasons.find((entry) => entry.seasonNumber === seasonNumber);
	const episode = season?.episodes?.find((entry) => entry.position === episodeNumber);
	return episode ? { episode, seasonNumber, episodeNumber } : null;
}
