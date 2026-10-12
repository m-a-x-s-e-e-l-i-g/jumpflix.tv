import { buildDiscoveryCatalog } from './discovery-catalog';
import { fetchAllContent, getContentServiceStatus } from './content-service';

/** Public snapshots never read sessions or include personalized layout data. */
export async function discoveryResponse(
	site: string,
	contentType: string,
	render: (catalog: ReturnType<typeof buildDiscoveryCatalog>, checkedAt: string | null) => string
) {
	try {
		const content = await fetchAllContent({ maxAgeMs: 5 * 60 * 1000 });
		const status = getContentServiceStatus();
		if (status.lastError) throw new Error('Catalog unavailable');
		return new Response(render(buildDiscoveryCatalog(content, site), status.cacheFetchedAt), {
			headers: {
				'Content-Type': `${contentType}; charset=UTF-8`,
				'Content-Language': 'en',
				'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch {
		return new Response('JUMPFLIX catalog temporarily unavailable. Please try again shortly.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' }
		});
	}
}
