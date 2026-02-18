#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true });
}

async function autoDiscoverBrandIcon() {
	const candidates = ['src/lib/assets/favicon.png'];
	for (const rel of candidates) {
		const p = path.resolve(process.cwd(), rel);
		try {
			await fs.access(p);
			return p;
		} catch {}
	}
	return null;
}

async function main() {
	const input = await autoDiscoverBrandIcon();
	if (!input) {
		console.error('No brand icon found. Place one at static/brand/app-icon.(png|webp|jpg).');
		process.exit(1);
	}
	console.log('[favicon] using source:', input);

	const outDir = path.resolve(__dirname, '..', 'static');
	await ensureDir(outDir);

	const sizes = [16, 32];
	for (const size of sizes) {
		const out = path.join(outDir, `favicon-${size}x${size}.png`);
		await sharp(input)
			.resize(size, size, { fit: 'cover' })
			.png({ compressionLevel: 9 })
			.toFile(out);
		console.log('Wrote', out);
	}

	// Windows/legacy browsers prefer ICO with multiple sizes (16, 32, 48)
	const icoOut = path.join(outDir, 'favicon.ico');
	const png16 = await sharp(input).resize(16, 16, { fit: 'cover' }).png().toBuffer();
	const png32 = await sharp(input).resize(32, 32, { fit: 'cover' }).png().toBuffer();
	const png48 = await sharp(input).resize(48, 48, { fit: 'cover' }).png().toBuffer();
	const icoBuf = await pngToIco([png16, png32, png48]);
	await fs.writeFile(icoOut, icoBuf);
	console.log('Wrote', icoOut);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
