import { env } from '$env/dynamic/public';
import { getAllBlogPostSummaries } from '$lib/blog/content';

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
	const posts = getAllBlogPostSummaries();
	const items = posts
		.map((post) => {
			const link = `${SITE}${post.canonicalPath}`;
			const pubDate = new Date(post.date).toUTCString();
			const updatedDate = new Date(post.updated ?? post.date).toUTCString();

			return `\n    <item>\n      <title>${xmlEscape(post.title)}</title>\n      <link>${xmlEscape(link)}</link>\n      <guid isPermaLink=\"true\">${xmlEscape(link)}</guid>\n      <description>${xmlEscape(post.description)}</description>\n      <pubDate>${pubDate}</pubDate>\n      <dc:date>${updatedDate}</dc:date>\n      <category>${xmlEscape(post.category)}</category>\n    </item>`;
		})
		.join('');

	const lastBuildDate = posts.length
		? new Date(posts[0].updated ?? posts[0].date).toUTCString()
		: new Date().toUTCString();

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>JumpFlix Blog</title>\n    <link>${SITE}/blog</link>\n    <description>Watch-first parkour and freerunning guides from JumpFlix.</description>\n    <language>en</language>\n    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>${items}\n  </channel>\n</rss>\n`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8',
			'Cache-Control': 'public, max-age=1800'
		}
	});
};
