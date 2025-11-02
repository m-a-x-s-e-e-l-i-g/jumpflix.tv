/**
 * Utility to generate BlurHash from image URLs
 */

import sharp from 'sharp';
import { encode } from 'blurhash';

/**
 * Fetch an image from a URL and generate its BlurHash
 * @param imageUrl - The URL of the image
 * @returns The BlurHash string
 */
export async function generateBlurhashFromUrl(imageUrl: string): Promise<string> {
	try {
		// Fetch the image
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Convert to raw RGBA pixels
		const { data, info } = await sharp(buffer)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const pixels = new Uint8ClampedArray(data);

		// Generate blurhash (4x4 components for good quality/size balance)
		const blurhash = encode(pixels, info.width, info.height, 4, 4);

		return blurhash;
	} catch (error) {
		console.error('Error generating blurhash:', error);
		throw error;
	}
}

/**
 * Generate BlurHash from a local file path
 * @param filePath - The path to the image file
 * @returns The BlurHash string
 */
export async function generateBlurhashFromFile(filePath: string): Promise<string> {
	try {
		const { data, info } = await sharp(filePath)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const pixels = new Uint8ClampedArray(data);
		const blurhash = encode(pixels, info.width, info.height, 4, 4);

		return blurhash;
	} catch (error) {
		console.error('Error generating blurhash from file:', error);
		throw error;
	}
}
