import type { ContentItem } from '$lib/tv/types';

export function computeColumns(gridEl: HTMLElement | null): number {
	if (!gridEl) return 1;
	const children = Array.from(gridEl.children) as HTMLElement[];
	if (!children.length) return 1;

	const visible = children.filter((el) => el.offsetParent !== null);
	if (!visible.length) return 1;

	const firstRowTop = visible[0].offsetTop;
	let count = 0;
	for (const el of visible) {
		if (Math.abs(el.offsetTop - firstRowTop) < 2) count++;
		else break;
	}

	return count || 1;
}

export function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

	const role = target.getAttribute('role');
	return role === 'textbox' || role === 'combobox';
}

export function clampIndex(length: number, idx: number) {
	if (!length) return 0;
	return Math.max(0, Math.min(length - 1, idx));
}

export function ensureVisibleSelection(options: {
	gridEl: HTMLElement | null;
	visibleContent: ContentItem[];
	allContent: ContentItem[];
	index: number;
	margin?: number;
}) {
	if (typeof window === 'undefined') return;
	const { gridEl, visibleContent, allContent, index, margin = 16 } = options;
	if (!gridEl) return;

	const domIndex = getDomIndexForVisibleIndex(visibleContent, allContent, index);
	if (domIndex < 0) return;

	const el = gridEl.children[domIndex] as HTMLElement | undefined;
	if (!el) return;

	requestAnimationFrame(() => {
		try {
			const rect = el.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const outsideTop = rect.top < margin;
			const outsideBottom = rect.bottom > vh - margin;
			const outsideLeft = rect.left < margin;
			const outsideRight = rect.right > vw - margin;
			if (outsideTop || outsideBottom || outsideLeft || outsideRight) {
				el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
			}
		} catch {}
	});
}

export function getDomIndexForVisibleIndex(
	visibleContent: ContentItem[],
	allContent: ContentItem[],
	visibleIndex: number
) {
	const target = visibleContent[visibleIndex];
	if (!target) return -1;

	const targetKey = `${target.type}:${target.id}`;
	return allContent.findIndex((item) => `${item.type}:${item.id}` === targetKey);
}
