import { browser } from '$app/environment';
import { USER_XP_WEIGHTS, type UserXpKind } from '$lib/xp';

export const XPOP_AWARDED_EVENT = 'xpop:awarded';

const DEFAULT_XPOP_LABELS: Record<UserXpKind, string> = {
	watching: 'Watched',
	rating: 'Rating locked in',
	reviewing: 'Review posted',
	contributions: 'Contribution approved'
};

export type XPopAwardDetail = {
	kind: UserXpKind;
	count: number;
	amount: number;
	label: string;
};

export function dispatchXPopAwarded(
	kind: UserXpKind,
	options?: {
		count?: number;
		amount?: number;
		label?: string;
	}
): void {
	if (!browser) return;

	const count = Math.max(1, Math.floor(options?.count ?? 1));
	const amount = Math.max(0, Math.floor(options?.amount ?? USER_XP_WEIGHTS[kind] * count));

	window.dispatchEvent(
		new CustomEvent<XPopAwardDetail>(XPOP_AWARDED_EVENT, {
			detail: {
				kind,
				count,
				amount,
				label: options?.label?.trim() || DEFAULT_XPOP_LABELS[kind]
			}
		})
	);
}