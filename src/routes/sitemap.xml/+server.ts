import { env } from '$env/dynamic/public';
import { movieSlugMap, playlistSlugMap } from '$lib/tv/slug';

export const prerender = true;

const SITE = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');

function xmlEscape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET = async () => {
  // Base routes
  const paths: string[] = ['/'];

  // Dynamic content routes (movies and playlists)
  const moviePaths = Array.from(movieSlugMap.keys())
    .sort()
    .map((slug) => `/movie/${slug}`);

  const playlistPaths = Array.from(playlistSlugMap.keys())
    .sort()
    .map((slug) => `/playlist/${slug}`);

  const all = [...paths, ...moviePaths, ...playlistPaths];

  const urls = all
    .map((path) => `  <url>\n    <loc>${xmlEscape(`${SITE}${path}`)}</loc>\n  </url>`) 
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
