#!/usr/bin/env node
const origin = (process.env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
const url = origin + '/sitemap.xml';
try {
	const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
	if (!response.ok) throw new Error('HTTP ' + response.status);
	const xml = await response.text();
	if (!xml.includes('<urlset') || !xml.includes('<loc>'))
		throw new Error('Response is not a populated sitemap');
	console.log('Sitemap available: ' + url);
	console.log(
		'Discovery is declared in robots.txt. Submit this URL in Google Search Console and Bing Webmaster Tools.'
	);
	console.log('This check does not submit URLs or confirm indexing.');
} catch (error) {
	console.error('Sitemap check failed:', error.message);
	process.exitCode = 1;
}
