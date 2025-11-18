import { browser } from '$app/environment';

export const RATING_UPDATED_EVENT = 'rating:updated';

export type RatingUpdatedDetail = {
	mediaId: number;
	rating: number | null;
	averageRating?: number;
	ratingCount?: number;
};

export function dispatchRatingUpdated(detail: RatingUpdatedDetail): void {
	if (!browser) return;
	window.dispatchEvent(new CustomEvent<RatingUpdatedDetail>(RATING_UPDATED_EVENT, { detail }));
}
