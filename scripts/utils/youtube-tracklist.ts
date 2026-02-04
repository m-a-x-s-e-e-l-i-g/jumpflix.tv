export type YouTubeTrackCandidate = {
  startOffsetSeconds: number;
  startTimecode?: string;
  title: string;
  artist?: string;
};

export type YouTubeImportSource = 'youtube_chapters' | 'youtube_music' | 'mixed';

import { parseTimecodeToSeconds } from '../../src/lib/utils/timecode.js';
export { parseTimecodeToSeconds };

function splitArtistTitle(raw: string): { artist?: string; title: string } {
  const value = (raw || '').trim();
  if (!value) return { title: '' };

  // Common separators: "Artist — Title" or "Artist - Title"
  const dash = value.split(/\s+[—–-]\s+/);
  if (dash.length >= 2) {
    const artist = dash[0].trim();
    const title = dash.slice(1).join(' - ').trim();
    return { artist: artist || undefined, title };
  }

  // Fallback: return as title-only
  return { title: value };
}

function extractBalancedJson(html: string, marker: string): any | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const braceStart = html.indexOf('{', idx);
  if (braceStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      const jsonText = html.slice(braceStart, i + 1);
      try {
        return JSON.parse(jsonText);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractYouTubePlayerResponse(html: string): any | null {
  return (
    extractBalancedJson(html, 'ytInitialPlayerResponse') ||
    extractBalancedJson(html, 'var ytInitialPlayerResponse') ||
    extractBalancedJson(html, 'window["ytInitialPlayerResponse"]')
  );
}

function extractYouTubeInitialData(html: string): any | null {
  return (
    extractBalancedJson(html, 'ytInitialData') ||
    extractBalancedJson(html, 'var ytInitialData') ||
    extractBalancedJson(html, 'window["ytInitialData"]')
  );
}

function getText(node: any): string | undefined {
  if (!node) return undefined;
  if (typeof node === 'string') return node;
  if (typeof node?.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node?.runs)) {
    const text = node.runs.map((r: any) => r?.text).filter(Boolean).join('');
    return text || undefined;
  }
  return undefined;
}

function normalizeKey(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectMusicSectionRenderers(root: any): any[] {
  const sections: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const maybe = (node as any).videoDescriptionMusicSectionRenderer;
    if (maybe && typeof maybe === 'object') {
      sections.push(maybe);
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    for (const value of Object.values(node)) {
      visit(value);
    }
  };
  visit(root);
  return sections;
}

function collectVideoAttributeViewModels(root: any): any[] {
  const models: any[] = [];

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;

    const list = (node as any).horizontalCardListRenderer;
    const cards = list?.cards;
    if (Array.isArray(cards)) {
      for (const card of cards) {
        const model = card?.videoAttributeViewModel;
        if (model && typeof model === 'object') {
          models.push(model);
        }
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(root);
  return models;
}

function parseTrackCandidatesFromVideoAttributeViewModel(model: any): YouTubeTrackCandidate | null {
  const title = typeof model?.title === 'string' ? model.title.trim() : '';
  if (!title) return null;

  const artist = typeof model?.subtitle === 'string' ? model.subtitle.trim() : undefined;

  return {
    startOffsetSeconds: 0,
    title,
    artist: artist || undefined
  };
}

function parseTrackCandidatesFromMusicSectionRenderer(renderer: any): YouTubeTrackCandidate[] {
  const candidates: YouTubeTrackCandidate[] = [];

  const lockups =
    renderer?.carouselLockups ||
    renderer?.carouselLockupsRenderer?.carouselLockups ||
    [];

  for (const lockupItem of lockups) {
    const lockup = lockupItem?.carouselLockupRenderer ?? lockupItem;
    const infoRows = lockup?.infoRows || lockup?.infoRowsRenderer?.infoRows || [];
    let title: string | undefined;
    let artist: string | undefined;

    for (const rowItem of infoRows) {
      const row = rowItem?.infoRowRenderer ?? rowItem;
      const label = (getText(row?.title) || '').toLowerCase();
      const value = getText(row?.defaultMetadata) || getText(row?.defaultMetadata?.content);
      if (!value) continue;

      if (label.includes('song') || label.includes('track')) {
        title = value.trim();
      } else if (label.includes('artist')) {
        artist = value.trim();
      }
    }

    if (!title) {
      // Sometimes a fallback title exists on the lockup itself
      title = (getText(lockup?.title) || getText(lockup?.headline) || '').trim() || undefined;
    }

    if (!title) continue;

    candidates.push({
      startOffsetSeconds: 0,
      title,
      artist: artist || undefined
    });
  }

  return candidates;
}

export function parseTrackCandidatesFromMusicInThisVideo(initialData: any): YouTubeTrackCandidate[] {
  if (!initialData) return [];
  const sections = collectMusicSectionRenderers(initialData);
  const out: YouTubeTrackCandidate[] = [];
  for (const section of sections) {
    out.push(...parseTrackCandidatesFromMusicSectionRenderer(section));
  }

  // Some watch pages render music attribution as a horizontalCardListRenderer with
  // videoAttributeViewModel cards (title = song, subtitle = artist)
  const attributeModels = collectVideoAttributeViewModels(initialData);
  for (const model of attributeModels) {
    const cand = parseTrackCandidatesFromVideoAttributeViewModel(model);
    if (cand) out.push(cand);
  }

  // de-dupe by normalized "artist|title"
  const seen = new Set<string>();
  const deduped: YouTubeTrackCandidate[] = [];
  for (const cand of out) {
    const key = `${normalizeKey(cand.artist || '')}|${normalizeKey(cand.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cand);
  }
  return deduped;
}

export async function fetchYouTubeDescription(videoId: string): Promise<string> {
  const id = (videoId || '').trim();
  if (!id) throw new Error('Missing YouTube videoId');

  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      // Some regions require a UA to return full HTML
      'user-agent': 'Mozilla/5.0 (compatible; JumpFlixTracklistBot/1.0)'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube watch page: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // Prefer ytInitialPlayerResponse.videoDetails.shortDescription
  const player = extractYouTubePlayerResponse(html);

  const desc = player?.videoDetails?.shortDescription;
  if (typeof desc === 'string') return desc;

  // Fallback: try another known blob
  const data = extractYouTubeInitialData(html);

  const altDesc = data?.engagementPanels?.[0]?.engagementPanelSectionListRenderer?.content?.structuredDescriptionContentRenderer?.items?.[0]?.videoDescriptionHeaderRenderer?.description?.runs?.map((r: any) => r?.text).join('');
  if (typeof altDesc === 'string' && altDesc.trim()) return altDesc;

  return '';
}

export async function fetchYouTubeTrackCandidates(videoId: string): Promise<{
  candidates: YouTubeTrackCandidate[];
  importSource: YouTubeImportSource | null;
}> {
  const id = (videoId || '').trim();
  if (!id) throw new Error('Missing YouTube videoId');

  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; JumpFlixTracklistBot/1.0)'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube watch page: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const player = extractYouTubePlayerResponse(html);
  const desc = typeof player?.videoDetails?.shortDescription === 'string' ? player.videoDetails.shortDescription : '';
  const chapterCandidates = parseTrackCandidatesFromDescription(desc);

  const initialData = extractYouTubeInitialData(html);
  const musicCandidates = parseTrackCandidatesFromMusicInThisVideo(initialData);

  const hasChapters = chapterCandidates.length > 0;
  const hasMusic = musicCandidates.length > 0;

  let importSource: YouTubeImportSource | null = null;
  if (hasChapters && hasMusic) importSource = 'mixed';
  else if (hasChapters) importSource = 'youtube_chapters';
  else if (hasMusic) importSource = 'youtube_music';

  // Combine while preferring chapter entries (they include timestamps)
  const combined: YouTubeTrackCandidate[] = [];
  const seen = new Set<string>();
  for (const cand of chapterCandidates) {
    const key = `${normalizeKey(cand.artist || '')}|${normalizeKey(cand.title)}`;
    seen.add(key);
    combined.push(cand);
  }
  for (const cand of musicCandidates) {
    const key = `${normalizeKey(cand.artist || '')}|${normalizeKey(cand.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(cand);
  }

  combined.sort((a, b) => (a.startOffsetSeconds ?? 0) - (b.startOffsetSeconds ?? 0));

  return { candidates: combined, importSource };
}

export function parseTrackCandidatesFromDescription(description: string): YouTubeTrackCandidate[] {
  const lines = (description || '').split(/\r?\n/);
  const candidates: YouTubeTrackCandidate[] = [];

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;

    // Supports mm:ss and hh:mm:ss
    const match = raw.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (!match) continue;

    const timecode = match[1];
    const rest = match[2];
    const seconds = parseTimecodeToSeconds(timecode);
    if (seconds === null) continue;

    const { artist, title } = splitArtistTitle(rest);
    if (!title) continue;

    candidates.push({
      startOffsetSeconds: seconds,
      startTimecode: timecode,
      title,
      artist
    });
  }

  // Sort by time, then stable
  candidates.sort((a, b) => a.startOffsetSeconds - b.startOffsetSeconds);
  return candidates;
}
