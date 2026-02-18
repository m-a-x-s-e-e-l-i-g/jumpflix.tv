import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const parentData = await parent();
	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders({
		'Cache-Control': isAuthenticated
			? 'private, no-store'
			: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
		Vary: 'Cookie'
	});

	const { slug, episode } = params as { slug: string; episode: string };
	throw redirect(
		308,
		`/series/${encodeURIComponent(slug)}/seasons/1/episodes/${encodeURIComponent(episode)}`
	);
};
