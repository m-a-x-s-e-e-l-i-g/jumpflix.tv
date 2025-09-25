#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function autoDiscoverBrandIcon() {
  const candidates = [
    // Preferred brand location
    'static/brand/app-icon.png',
    'static/brand/app-icon.webp',
    'static/brand/app-icon.jpg',
    // Fallbacks: existing assets folder
    'src/lib/assets/app-icon.png',
    'src/lib/assets/app-icon.webp',
    'src/lib/assets/app-icon.jpg',
    'src/lib/assets/apple-touch-icon.png',
    'src/lib/assets/favicon.png',
    'src/lib/assets/logo.png'
  ];
  for (const rel of candidates) {
    const p = path.resolve(process.cwd(), rel);
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

async function parseArgs() {
  const [, , inputPathArg, bg = '#0b1220'] = process.argv; // default to app dark theme background
  let inputPath = inputPathArg;
  if (!inputPath) {
    inputPath = await autoDiscoverBrandIcon();
  }
  if (!inputPath) {
    console.error('No input provided. Place a brand icon in static/brand/app-icon.(png|webp|jpg) or pass a path.');
    console.error('Usage: node scripts/generate-icons.mjs <path-to-logo> [background]');
    process.exit(1);
  }
  return { inputPath: path.resolve(process.cwd(), inputPath), bg };
}

async function generate() {
  const { inputPath, bg } = await parseArgs();
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outDir = path.resolve(__dirname, '..', 'static', 'icons');
  await ensureDir(outDir);

  const sizes = [192, 512];
  const base = path.basename(inputPath).toLowerCase();
  const fullBleed = base.includes('app-icon') || base.includes('apple-touch-icon') || base.includes('favicon');
  console.log('[icons] using source:', inputPath, '| fullBleed =', fullBleed);

  // Generate Android/Chrome icons (transparent background unless bg provided)
  for (const size of sizes) {
    const out = path.join(outDir, `icon-${size}.png`);
    if (fullBleed) {
      await sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(out);
    } else {
      // Create square canvas to ensure padding/margins are consistent
      const canvas = sharp({ create: { width: size, height: size, channels: 4, background: bg } });
      const icon = await sharp(inputPath)
        .resize({ width: Math.round(size * 0.78), height: Math.round(size * 0.78), fit: 'inside' })
        .png()
        .toBuffer();
      await canvas
        .composite([{ input: icon, gravity: 'center' }])
        .png({ compressionLevel: 9 })
        .toFile(out);
    }
    console.log('Wrote', out);
  }

  // Generate Apple touch icon (opaque background recommended)
  const appleOut = path.join(outDir, 'apple-touch-icon.png');
  {
    const size = 180;
    if (fullBleed) {
      await sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(appleOut);
    } else {
      const canvas = sharp({ create: { width: size, height: size, channels: 4, background: bg } });
      const icon = await sharp(inputPath)
        .resize({ width: Math.round(size * 0.78), height: Math.round(size * 0.78), fit: 'inside' })
        .png()
        .toBuffer();
      await canvas
        .composite([{ input: icon, gravity: 'center' }])
        .png({ compressionLevel: 9 })
        .toFile(appleOut);
    }
  }
  console.log('Wrote', appleOut);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
