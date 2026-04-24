import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/server/admin';
import {
	getYouTubeThumbnailCandidates,
	isLikelyMissingYouTubeThumbnail,
	isYouTubeVideoId
} from '$lib/youtube-thumbnails';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';

const POSTER_PROMPT =
	"make movie poster sized image, keep existing text, don't add any additional text, no borders or frames around the poster.";

function escapePromptText(value: string): string {
	return value.replace(/["\\]/g, '\\$&');
}

function buildPosterPrompt(title: string, includeTitle: boolean): string {
	if (!includeTitle) return POSTER_PROMPT;

	const safeTitle = escapePromptText(title.trim());
	return `make movie poster sized image, prominently include the movie title "${safeTitle}" as part of the poster design, preserve other important existing visual elements, no borders or frames around the poster, don't add any other text.`;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function wrapTitle(title: string, maxCharsPerLine: number, maxLines: number): string[] {
	const words = title.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return ['UNTITLED'];

	const lines: string[] = [];
	let current = '';

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length <= maxCharsPerLine) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		current = word;
		if (lines.length >= maxLines - 1) break;
	}

	if (current && lines.length < maxLines) {
		lines.push(current);
	}

	if (lines.length === 0) lines.push(words.join(' ').slice(0, maxCharsPerLine));
	return lines.slice(0, maxLines);
}

async function applyTitleOverlay(posterBuffer: Buffer, title: string): Promise<Buffer> {
	const width = 1024;
	const height = 1536;
	const maxCharsPerLine = title.length > 36 ? 20 : 24;
	const lines = wrapTitle(title.toUpperCase(), maxCharsPerLine, 3).map(escapeXml);
	const fontSize = lines.length === 1 ? 90 : lines.length === 2 ? 72 : 58;
	const lineHeight = Math.round(fontSize * 1.12);
	const textBlockHeight = lineHeight * lines.length;
	const bottomPadding = 72;
	const textTop = height - bottomPadding - textBlockHeight;

	const textMarkup = lines
		.map((line, index) => {
			const y = textTop + lineHeight * (index + 1);
			return `<text x="50%" y="${y}" text-anchor="middle">${line}</text>`;
		})
		.join('');

	const overlaySvg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="titleFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="45%" stop-color="rgba(0,0,0,0.42)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#titleFade)"/>
  <g fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="1.4">
    ${textMarkup}
  </g>
</svg>`;

	return sharp(posterBuffer)
		.composite([{ input: Buffer.from(overlaySvg) }])
		.webp({ quality: 92 })
		.toBuffer();
}

type ThumbnailSource = {
	url: string;
	buffer: Buffer;
	width: number;
	height: number;
};

async function fetchBestThumbnail(videoId: string): Promise<ThumbnailSource | null> {
	for (const candidateUrl of getYouTubeThumbnailCandidates(videoId)) {
		const response = await fetch(candidateUrl);
		if (!response.ok) continue;

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.startsWith('image/')) continue;

		const buffer = Buffer.from(await response.arrayBuffer());
		if (!buffer.length) continue;

		try {
			const metadata = await sharp(buffer).metadata();
			const width = metadata.width ?? 0;
			const height = metadata.height ?? 0;
			if (width <= 0 || height <= 0) continue;
			if (isLikelyMissingYouTubeThumbnail(width, height)) continue;

			return { url: candidateUrl, buffer, width, height };
		} catch {
			continue;
		}
	}

	return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const apiKey = env.OPENAI_API_KEY?.trim();
	const openai = apiKey ? new OpenAI({ apiKey }) : null;

	if (!openai) {
		throw error(500, 'OPENAI_API_KEY is not configured on the server.');
	}

	const body = (await request.json().catch(() => null)) as {
		videoId?: unknown;
		thumbnailUrl?: unknown;
		slug?: unknown;
		title?: unknown;
		includeTitle?: unknown;
	} | null;

	const videoId = typeof body?.videoId === 'string' ? body.videoId.trim() : '';
	const thumbnailUrl = typeof body?.thumbnailUrl === 'string' ? body.thumbnailUrl.trim() : '';
	const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const includeTitle = body?.includeTitle === true;

	if (!videoId && !thumbnailUrl) {
		throw error(400, 'Either a YouTube video ID or Vimeo thumbnail URL is required.');
	}

	if (!slug) {
		throw error(400, 'A slug is required before generating a poster.');
	}

	if (includeTitle && !title) {
		throw error(400, 'A title is required when including it in the poster.');
	}

	// Fetch thumbnail source
	let source: ThumbnailSource | null = null;

	if (videoId) {
		// YouTube path
		if (!isYouTubeVideoId(videoId)) {
			throw error(400, 'A valid YouTube video ID is required.');
		}
		source = await fetchBestThumbnail(videoId);
		if (!source) {
			throw error(404, 'No usable YouTube thumbnail was found for this video.');
		}
	} else if (thumbnailUrl) {
		// Vimeo path - fetch the thumbnail URL directly
		try {
			const response = await fetch(thumbnailUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.startsWith('image/')) {
				throw new Error('Response is not an image');
			}

			const buffer = Buffer.from(await response.arrayBuffer());
			if (!buffer.length) {
				throw new Error('Response body is empty');
			}

			try {
				const metadata = await sharp(buffer).metadata();
				const width = metadata.width ?? 0;
				const height = metadata.height ?? 0;
				if (width <= 0 || height <= 0) {
					throw new Error('Invalid image dimensions');
				}

				source = { url: thumbnailUrl, buffer, width, height };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : 'Unknown error';
				throw new Error(`Failed to process thumbnail: ${msg}`);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'unknown error';
			throw error(502, `Could not fetch Vimeo thumbnail: ${msg}`);
		}
	}

	if (!source) {
		throw error(400, 'Failed to load thumbnail source.');
	}

	try {
		const sourceFile = await toFile(source.buffer, `${videoId || 'vimeo'}.jpg`, { type: 'image/jpeg' });
		const result = await openai.images.edit({
			image: sourceFile,
			prompt: buildPosterPrompt(title, includeTitle),
			model: 'gpt-image-1.5',
			n: 1,
			size: '1024x1536',
			quality: 'auto',
			background: 'auto',
			input_fidelity: 'high',
			output_format: 'webp'
		});

		const imageBase64 = result.data?.[0]?.b64_json;
		if (!imageBase64) {
			throw new Error('OpenAI did not return poster image data.');
		}

		let posterBuffer = await sharp(Buffer.from(imageBase64, 'base64'))
			.resize(1024, 1536, { fit: 'cover' })
			.webp({ quality: 92 })
			.toBuffer();

		if (includeTitle) {
			posterBuffer = await applyTitleOverlay(posterBuffer, title);
		}

		const posterDir = path.join(process.cwd(), 'static', 'images', 'posters');
		await mkdir(posterDir, { recursive: true });
		await writeFile(path.join(posterDir, `${slug}.webp`), posterBuffer);

		const posterUrl = `/images/posters/${slug}.webp`;
		return json({
			posterUrl,
			previewUrl: `${posterUrl}?v=${Date.now()}`,
			sourceThumbnailUrl: source.url,
			sourceWidth: source.width,
			sourceHeight: source.height
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Failed to generate poster';
		throw error(502, message);
	}
};
