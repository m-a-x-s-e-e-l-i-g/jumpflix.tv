import { writable, derived, type Readable } from 'svelte/store';
import { movies } from '$lib/assets/movies';
import { playlists } from '$lib/assets/playlists';
import type { ContentItem, SortBy } from './types';
import { buildRankMap, filterAndSortContent, isInlinePlayable, keyFor } from './utils';

// Base data (static for now)
const seed = new Date().toISOString().slice(0, 10);
export const allContent: ContentItem[] = ([...(movies as any), ...(playlists as any)] as ContentItem[]);
const rankMap = buildRankMap(allContent, seed);

// UI state stores
export const searchQuery = writable('');
export const showPaid = writable(true);
export const sortBy = writable<SortBy>('default');
export const selectedContent = writable<ContentItem | null>(null);
export const showPlayer = writable(false);
export const showDetailsPanel = writable(false);
export const selectedIndex = writable(0);

// Track thumbnails that have successfully loaded so we can keep them cached
export const loadedThumbnails = writable<Set<string>>(new Set());
export function markThumbnailLoaded(src?: string) {
  if (!src) return;
  loadedThumbnails.update(set => {
    if (set.has(src)) return set;
    const next = new Set(set);
    next.add(src);
    return next;
  });
}

// Debounced search to avoid filtering on every keystroke
function debounceStore<T>(src: Readable<T>, delay = 150): Readable<T> {
  return derived(src, ($v, set) => {
    const to = setTimeout(() => set($v), delay);
    return () => clearTimeout(to);
  });
}
const debouncedSearch = debounceStore(searchQuery, 160);

// Derived filtered + sorted content
export const visibleContent = derived(
  [debouncedSearch, showPaid, sortBy],
  ([$search, $showPaid, $sortBy]) => filterAndSortContent(allContent, rankMap, {
    searchQuery: $search,
    showPaid: $showPaid,
    sortBy: $sortBy
  })
);

// All items, only sorted (no filtering). Useful to keep DOM stable by hiding non-matching items.
export const sortedAllContent = derived([sortBy], ([$sortBy]) =>
  filterAndSortContent(allContent, rankMap, {
    searchQuery: '',
    showPaid: true,
    sortBy: $sortBy
  })
);

// Set of keys for currently visible items (for fast membership checks in UI)
export const visibleKeys = derived(visibleContent, ($list) => new Set($list.map((i) => keyFor(i))));

// Keep selectedContent in sync when list changes
visibleContent.subscribe(list => {
  if (list.length === 0) {
    selectedContent.set(null);
    selectedIndex.set(0);
    return;
  }
  let current: ContentItem | null = null;
  selectedContent.update(val => { current = val; return val; });
  if (!current || !list.some(i => i.id === current!.id && i.type === current!.type)) {
    selectedContent.set(list[0]);
    selectedIndex.set(0);
  } else {
    const idx = list.findIndex(i => current && i.id === current.id && i.type === current.type);
    if (idx >= 0) selectedIndex.set(idx);
  }
});

// Actions
export function selectContent(item: ContentItem) {
  selectedContent.set(item);
  // IMPORTANT: Use the current visibleContent ordering (which can be filtered & sorted)
  // rather than the original allContent ordering. Using allContent caused keyboard
  // navigation to "jump" after clicking a card because selectedIndex did not match
  // the position within the displayed grid.
  let currentList: ContentItem[] = [];
  const unsub = visibleContent.subscribe(list => { currentList = list; });
  unsub();
  const idx = currentList.findIndex(i => i.id === item.id && i.type === item.type);
  selectedIndex.set(idx >= 0 ? idx : 0);
  showPlayer.set(false);
}

export function selectByOffset(offset: number, currentCols = 1) {
  let idx: number; let len: number;
  selectedIndex.update(i => { idx = i; return i; });
  visibleContent.subscribe(list => { len = list.length; })();
  const next = idx! + offset;
  if (next >= 0 && next < len!) {
    visibleContent.subscribe(list => selectContent(list[next]))();
  }
}

export function openContent(item: ContentItem) {
  selectContent(item);
  if (isInlinePlayable(item)) {
    showPlayer.set(true);
  }
}

export function closePlayer() { showPlayer.set(false); }
export function openDetailsPanel() { showDetailsPanel.set(true); }
export function closeDetailsPanel() { showDetailsPanel.set(false); }

// Helper to update sort
export function setSort(value: SortBy) { sortBy.set(value); }
