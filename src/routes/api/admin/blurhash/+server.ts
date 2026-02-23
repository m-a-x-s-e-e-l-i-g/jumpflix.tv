import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import sharp from 'sharp';
import { encode } from 'blurhash';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const imageUrl = url.searchParams.get('url')?.trim();
	if (!imageUrl) throw error(400, 'Missing url parameter');

	let parsed: URL;
	try {
		parsed = new URL(imageUrl);
	} catch {
		throw error(400, 'Invalid URL');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw error(400, 'Only http/https URLs are supported');
	}

	try {
		const res = await fetch(imageUrl);
		if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
		const buffer = Buffer.from(await res.arrayBuffer());
		const { data, info } = await sharp(buffer)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const pixels = new Uint8ClampedArray(data);
		const blurhash = encode(pixels, info.width, info.height, 4, 4);
		return json({ blurhash });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Failed to generate blurhash';
		throw error(502, msg);
	}
};
