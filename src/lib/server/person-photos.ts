import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

export const PHOTO_BUCKET = 'person-photos';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export class PhotoError extends Error {
	constructor(
		message: string,
		public stopImport = false
	) {
		super(message);
	}
}
export type InstagramPhotoConfig = { token?: string; accountId?: string; version?: string };

export function instagramPhotosConfigured(config: InstagramPhotoConfig): boolean {
	return Boolean(
		config.token?.trim() &&
			/^\d+$/.test(config.accountId ?? '') &&
			/^v\d+\.0$/.test(config.version ?? '')
	);
}

export async function normalizePhoto(bytes: Uint8Array): Promise<Buffer> {
	if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
		throw new PhotoError('Choose an image smaller than 5 MB.');
	try {
		const image = sharp(bytes, { limitInputPixels: 25_000_000 });
		const metadata = await image.metadata();
		if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) {
			throw new PhotoError('Choose a still JPEG, PNG or WebP image.');
		}
		return await image.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
	} catch (error) {
		if (error instanceof PhotoError) throw error;
		throw new PhotoError('This image could not be read. Choose a JPEG, PNG or WebP image.');
	}
}

export function instagramImageUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new PhotoError('Instagram returned an invalid photo URL.');
	}
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.port ||
		!['cdninstagram.com', 'fbcdn.net'].some((host) => url.hostname.endsWith(`.${host}`))
	) {
		throw new PhotoError('Instagram returned an unsupported photo URL.');
	}
	return url;
}

export async function downloadInstagramPhoto(value: string, request = fetch): Promise<Uint8Array> {
	let url = instagramImageUrl(value);
	const signal = AbortSignal.timeout(10_000);
	for (let redirects = 0; redirects <= 3; redirects++) {
		const response = await request(url, { redirect: 'manual', signal });
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location');
			await response.body?.cancel();
			if (!location) break;
			url = instagramImageUrl(new URL(location, url).href);
			continue;
		}
		if (!response.ok || !response.body)
			throw new PhotoError('Instagram photo download failed. Try again or upload a photo.');
		if (Number(response.headers.get('content-length')) > MAX_PHOTO_BYTES) {
			await response.body.cancel();
			throw new PhotoError('The Instagram photo is too large.');
		}
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		try {
			while (true) {
				const { done, value: chunk } = await reader.read();
				if (done) break;
				size += chunk.length;
				if (size > MAX_PHOTO_BYTES) throw new PhotoError('The Instagram photo is too large.');
				chunks.push(chunk);
			}
		} finally {
			await reader.cancel();
		}
		return Buffer.concat(chunks);
	}
	throw new PhotoError('Instagram redirected too many times. Upload a photo instead.');
}

export async function importInstagramPhoto(
	handle: string,
	config: InstagramPhotoConfig,
	request = fetch
): Promise<Buffer> {
	if (!instagramPhotosConfigured(config))
		throw new PhotoError('Instagram imports are not configured yet. You can upload a photo.', true);
	if (!/^[a-z0-9._]{1,30}$/.test(handle)) throw new PhotoError('Choose a saved Instagram handle.');
	const url = new URL(`https://graph.facebook.com/${config.version}/${config.accountId}`);
	url.searchParams.set(
		'fields',
		`business_discovery.username(${handle}){username,profile_picture_url}`
	);
	const response = await request(url, {
		headers: { Authorization: `Bearer ${config.token}` },
		redirect: 'error',
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) {
		const errorCode = await response
			.json()
			.then((body) => body?.error?.code)
			.catch(() => null);
		const stopImport =
			[401, 403, 429].includes(response.status) ||
			[4, 10, 17, 32, 190, 200, 613].includes(errorCode);
		throw new PhotoError(
			response.status === 429
				? 'Instagram is busy. Try again later.'
				: 'Instagram could not provide this photo. Check API access or upload a photo.',
			stopImport
		);
	}
	const result = await response.json();
	const profile = result?.business_discovery;
	if (
		profile?.username?.toLowerCase() !== handle ||
		typeof profile?.profile_picture_url !== 'string'
	) {
		throw new PhotoError(
			'No photo available for this account. Personal accounts need an uploaded photo.'
		);
	}
	return normalizePhoto(await downloadInstagramPhoto(profile.profile_picture_url, request));
}

export async function savePersonPhoto(
	supabase: SupabaseClient<Database>,
	slug: string,
	name: string,
	bytes: Buffer,
	source: 'upload' | 'instagram',
	handle: string | null
): Promise<void> {
	const path = `${randomUUID()}.webp`;
	const bucket = supabase.storage.from(PHOTO_BUCKET);
	const { error: uploadError } = await bucket.upload(path, bytes, {
		contentType: 'image/webp',
		cacheControl: '31536000',
		upsert: false
	});
	if (uploadError)
		throw new PhotoError(
			'Photo could not be stored. Check that the profile photo migration has been applied.',
			true
		);
	// Only photo fields are changed: existing Instagram handles are retained.
	const { error } = await supabase.from('person_profiles').upsert(
		{
			slug,
			name,
			profile_photo_path: path,
			profile_photo_source: source,
			profile_photo_handle: handle
		},
		{ onConflict: 'slug' }
	);
	if (error) {
		await bucket.remove([path]);
		throw new PhotoError('Photo could not be saved. Please try again.', true);
	}
	// Keep previous immutable objects: a person merge may still reference them.
}
