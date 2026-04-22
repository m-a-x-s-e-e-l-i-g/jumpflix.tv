export const USER_XP_WEIGHTS = {
	watching: 5,
	rating: 15,
	reviewing: 25,
	contributions: 40
} as const;

export type UserXpKind = keyof typeof USER_XP_WEIGHTS;

export type UserXpCounts = {
	watchingCount?: number | null;
	ratingCount?: number | null;
	reviewingCount?: number | null;
	contributionsCount?: number | null;
};

export type UserXpSummary = {
	total: number;
	watching: number;
	rating: number;
	reviewing: number;
	contributions: number;
	counts: {
		watching: number;
		rating: number;
		reviewing: number;
		contributions: number;
	};
};

function normalizeCount(value: number | null | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}

	return Math.max(0, Math.floor(value));
}

export function calculateUserXp(counts: UserXpCounts): UserXpSummary {
	const normalizedCounts = {
		watching: normalizeCount(counts.watchingCount),
		rating: normalizeCount(counts.ratingCount),
		reviewing: normalizeCount(counts.reviewingCount),
		contributions: normalizeCount(counts.contributionsCount)
	};

	const watching = normalizedCounts.watching * USER_XP_WEIGHTS.watching;
	const rating = normalizedCounts.rating * USER_XP_WEIGHTS.rating;
	const reviewing = normalizedCounts.reviewing * USER_XP_WEIGHTS.reviewing;
	const contributions = normalizedCounts.contributions * USER_XP_WEIGHTS.contributions;

	return {
		total: watching + rating + reviewing + contributions,
		watching,
		rating,
		reviewing,
		contributions,
		counts: normalizedCounts
	};
}

export function awardUserXp(
	summary: UserXpSummary | null | undefined,
	kind: UserXpKind,
	count = 1
): UserXpSummary {
	const nextCount = normalizeCount(count);
	if (nextCount === 0) {
		return (
			summary ??
			calculateUserXp({
				watchingCount: 0,
				ratingCount: 0,
				reviewingCount: 0,
				contributionsCount: 0
			})
		);
	}

	return calculateUserXp({
		watchingCount: (summary?.counts.watching ?? 0) + (kind === 'watching' ? nextCount : 0),
		ratingCount: (summary?.counts.rating ?? 0) + (kind === 'rating' ? nextCount : 0),
		reviewingCount: (summary?.counts.reviewing ?? 0) + (kind === 'reviewing' ? nextCount : 0),
		contributionsCount:
			(summary?.counts.contributions ?? 0) + (kind === 'contributions' ? nextCount : 0)
	});
}