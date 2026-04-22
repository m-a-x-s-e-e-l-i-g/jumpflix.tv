import type { ReviewRow } from '$lib/reviews';

export const REVIEW_UPDATED_EVENT = 'review:updated';
export const REVIEW_DELETED_EVENT = 'review:deleted';

export type ReviewUpdatedDetail = {
	mediaId: number;
	review: ReviewRow;
};

export type ReviewDeletedDetail = {
	mediaId: number;
	reviewId: number;
	userId?: string;
};

export function dispatchReviewUpdated(detail: ReviewUpdatedDetail): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<ReviewUpdatedDetail>(REVIEW_UPDATED_EVENT, { detail }));
}

export function dispatchReviewDeleted(detail: ReviewDeletedDetail): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<ReviewDeletedDetail>(REVIEW_DELETED_EVENT, { detail }));
}