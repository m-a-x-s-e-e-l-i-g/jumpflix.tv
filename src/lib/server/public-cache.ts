export function publicCacheHeaders(authenticated: boolean, degraded = false) {
	return {
		'Cache-Control':
			authenticated || degraded
				? 'private, no-store'
				: 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
		Vary: 'Cookie, Accept-Language'
	};
}
