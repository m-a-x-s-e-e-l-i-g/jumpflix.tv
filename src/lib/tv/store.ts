import { writable, derived, type Readable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { ContentItem, Episode, SortBy } from './types';
import { buildRankMap, filterAndSortContent, isInlinePlayable, keyFor } from './utils';
import {
  getAllWatchProgress,
  getSeriesProgressSummary,
  PROGRESS_CHANGE_EVENT,
  type WatchProgress
} from '$lib/tv/watchHistory';

// Base data (loaded at runtime via setContent)
const seed = new Date().toISOString().slice(0, 10);

export const baseContent = writable<ContentItem[]>([]);

type ContentMeta = {
  items: ContentItem[];
  rankMap: Map<string, number>;
  contentByKey: Map<string, ContentItem>;
};

const contentMeta = derived(baseContent, ($items): ContentMeta => {
  const map = new Map<string, ContentItem>();
  for (const item of $items) {
    map.set(keyFor(item), item);
  }
  return {
    items: $items,
    rankMap: buildRankMap($items, seed),
    contentByKey: map
  };
});

let currentMeta: ContentMeta = {
  items: [],
  rankMap: new Map(),
  contentByKey: new Map()
};

contentMeta.subscribe((meta) => {
  currentMeta = meta;
});

// UI state stores
export const searchQuery = writable('');
export const showPaid = writable(true);
export const sortBy = writable<SortBy>('default');
export const showWatched = writable(true);
export const selectedContent = writable<ContentItem | null>(null);
export const showPlayer = writable(false);
export const showDetailsPanel = writable(false);
export const selectedIndex = writable(0);
// When playing a single episode from a series, this holds the selected episode
export const selectedEpisode = writable<Episode | null>(null);

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

const watchedBaseIds = writable<Set<string>>(new Set());
const inProgressBaseIds = writable<Set<string>>(new Set());

function baseIdFromMediaId(mediaId: string): string {
  if (!mediaId) return mediaId;
  const first = mediaId.indexOf(':');
  if (first === -1) return mediaId;
  const second = mediaId.indexOf(':', first + 1);
  if (second === -1) return mediaId;
  return mediaId.slice(0, second);
}

function shouldCountAsWatched(progress: WatchProgress): boolean {
  if (!progress.isWatched) return false;
  if (progress.mediaId.includes(':ep:')) return false;
  if (progress.type === 'episode') return false;
  return true;
}

function refreshProgressSets() {
  if (!browser) return;
  const entries = getAllWatchProgress();
  const watched = new Set<string>();
  const progressSummary = new Map<string, { tracked: number; watchedCount: number; hasPartial: boolean }>();

  for (const entry of entries) {
    const baseId = baseIdFromMediaId(entry.mediaId);
    if (!baseId) continue;

    if (shouldCountAsWatched(entry)) {
      watched.add(baseId);
    }

    const summary = progressSummary.get(baseId) ?? { tracked: 0, watchedCount: 0, hasPartial: false };
    summary.tracked += 1;
    if (entry.isWatched) summary.watchedCount += 1;
    if (entry.percent > 0 && !entry.isWatched) summary.hasPartial = true;
    progressSummary.set(baseId, summary);
  }

  const inProgress = new Set<string>();
  for (const [baseId, summary] of progressSummary.entries()) {
    if (watched.has(baseId)) continue;
    if (summary.hasPartial) {
      inProgress.add(baseId);
      continue;
    }
    if (summary.watchedCount > 0 && summary.watchedCount < summary.tracked) {
      inProgress.add(baseId);
    }
  }

  for (const [baseId, item] of currentMeta.contentByKey.entries()) {
    if (!baseId.startsWith('series:')) continue;
    const totalEpisodesRaw = Number((item as any)?.episodeCount);
    const totalEpisodes = Number.isFinite(totalEpisodesRaw) && totalEpisodesRaw > 0
      ? Math.floor(totalEpisodesRaw)
      : null;
    const summary = getSeriesProgressSummary(baseId, { totalEpisodes });
    if (!summary) {
      continue;
    }
    if (summary.isWatched) {
      watched.add(baseId);
      inProgress.delete(baseId);
    } else if (summary.percent > 0) {
      inProgress.add(baseId);
      watched.delete(baseId);
    }
  }

  watchedBaseIds.set(watched);
  inProgressBaseIds.set(inProgress);
}

if (browser) {
  refreshProgressSets();
  const handleProgressChange: EventListener = () => refreshProgressSets();
  window.addEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
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
  [contentMeta, debouncedSearch, showPaid, sortBy, showWatched, watchedBaseIds, inProgressBaseIds],
  ([$meta, $search, $showPaid, $sortBy, $showWatched, $watchedBaseIds, $inProgressBaseIds]) =>
    filterAndSortContent($meta.items, $meta.rankMap, {
      searchQuery: $search,
      showPaid: $showPaid,
      sortBy: $sortBy,
      showWatched: $showWatched,
      watchedBaseIds: $watchedBaseIds,
      inProgressBaseIds: $inProgressBaseIds
    })
);

// All items, only sorted (no filtering). Useful to keep DOM stable by hiding non-matching items.
export const sortedAllContent = derived(
  [contentMeta, sortBy, inProgressBaseIds],
  ([$meta, $sortBy, $inProgressBaseIds]) =>
    filterAndSortContent($meta.items, $meta.rankMap, {
      searchQuery: '',
      showPaid: true,
      sortBy: $sortBy,
      inProgressBaseIds: $inProgressBaseIds
    })
);

// Set of keys for currently visible items (for fast membership checks in UI)
export const visibleKeys = derived(visibleContent, ($list) => new Set($list.map((i) => keyFor(i))));

// Keep selection/index consistent when the visible list changes, but do NOT auto-select
// anything on initial load. This ensures nothing is selected until the user clicks or
// the route directly specifies an item (e.g., /movie/<slug> or /series/<slug>).
visibleContent.subscribe((list) => {
  if (list.length === 0) {
    selectedContent.set(null);
    selectedIndex.set(0);
    return;
  }
  const current = get(selectedContent);
  if (!current) {
    // No selection yet; keep index at 0 but do not auto-pick an item
    selectedIndex.set(0);
    return;
  }
  const idx = list.findIndex((i) => i.id === current.id && i.type === current.type);
  if (idx >= 0) {
    selectedIndex.set(idx);
  } else {
    // Previously selected item no longer visible; clear selection
    selectedContent.set(null);
    selectedIndex.set(0);
  }
});

// Actions
export function selectContent(item: ContentItem) {
  selectedContent.set(item);
  // IMPORTANT: Use the current visibleContent ordering (which can be filtered & sorted)
  // rather than the full catalog ordering. Using the full list caused keyboard
  // navigation to "jump" after clicking a card because selectedIndex did not match
  // the position within the displayed grid.
  let currentList: ContentItem[] = [];
  const unsub = visibleContent.subscribe(list => { currentList = list; });
  unsub();
  const idx = currentList.findIndex(i => i.id === item.id && i.type === item.type);
  selectedIndex.set(idx >= 0 ? idx : 0);
  showPlayer.set(false);
  // Reset episode selection when switching content
  selectedEpisode.set(null);
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

// Open a specific episode (YouTube video) within a series
export function openEpisode(ep: Episode) {
  selectedEpisode.set(ep);
  showPlayer.set(true);
}

// Select an episode (do not open the player). Useful for preparing the Play button.
export function selectEpisode(ep: Episode) {
  // Avoid redundant updates but allow refreshed metadata (e.g., external URLs)
  const cur = get(selectedEpisode);
  if (cur && cur.id === ep.id) {
    const keys: (keyof Episode)[] = ['title', 'thumbnail', 'externalUrl', 'position', 'duration'];
    const unchanged = keys.every((key) => cur[key] === ep[key]);
    if (unchanged) return;
  }
  selectedEpisode.set(ep);
}

export function closePlayer() { 
  showPlayer.set(false); 
  selectedEpisode.set(null); 
  
  // On mobile, show the details panel when closing the player if there's selected content
  if (browser && typeof window !== 'undefined' && window.innerWidth < 768) {
    const current = get(selectedContent);
    if (current) {
      showDetailsPanel.set(true);
    }
  }
}
export function openDetailsPanel() { showDetailsPanel.set(true); }
export function closeDetailsPanel() { showDetailsPanel.set(false); }

// Helper to update sort
export function setSort(value: SortBy) { sortBy.set(value); }

export function setContent(items: ContentItem[]) {
  baseContent.set([...items]);
  if (browser) {
    refreshProgressSets();
  }
}


