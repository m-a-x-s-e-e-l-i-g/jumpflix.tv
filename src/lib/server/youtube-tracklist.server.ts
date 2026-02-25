export type YouTubeTrackCandidate = {
	startOffsetSeconds: number;
	startTimecode?: string;
	title: string;
	artist?: string;
};

export type YouTubeImportSource = 'youtube_chapters' | 'youtube_music' | 'mixed';

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
		const text = node.runs
			.map((r: any) => r?.text)
			.filter(Boolean)
			.join('');
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
		renderer?.carouselLockups || renderer?.carouselLockupsRenderer?.carouselLockups || [];

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

function parseTrackCandidatesFromMusicInThisVideo(initialData: any): YouTubeTrackCandidate[] {
	if (!initialData) return [];
	const sections = collectMusicSectionRenderers(initialData);
	const out: YouTubeTrackCandidate[] = [];
	for (const section of sections) {
		out.push(...parseTrackCandidatesFromMusicSectionRenderer(section));
	}

	const attributeModels = collectVideoAttributeViewModels(initialData);
	for (const model of attributeModels) {
		const cand = parseTrackCandidatesFromVideoAttributeViewModel(model);
		if (cand) out.push(cand);
	}

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

	const initialData = extractYouTubeInitialData(html);
	const musicCandidates = parseTrackCandidatesFromMusicInThisVideo(initialData);

	const hasMusic = musicCandidates.length > 0;

	let importSource: YouTubeImportSource | null = null;
	if (hasMusic) importSource = 'youtube_music';

	// Only use the "Music in this video" candidates for autodetection.
	// (They are already de-duped inside `parseTrackCandidatesFromMusicInThisVideo`.)
	return { candidates: musicCandidates, importSource };
}
