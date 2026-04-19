import type { ReviewRow } from '$lib/reviews';

export const REVIEW_UPDATED_EVENT = 'review:updated';

export type ReviewUpdatedDetail = {
	mediaId: number;
	review: ReviewRow;
};

export function dispatchReviewUpdated(detail: ReviewUpdatedDetail): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<ReviewUpdatedDetail>(REVIEW_UPDATED_EVENT, { detail }));
}