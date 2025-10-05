import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug, episode } = params as { slug: string; episode: string };
	throw redirect(
		308,
		`/series/${encodeURIComponent(slug)}/seasons/1/episodes/${encodeURIComponent(episode)}`
	);
};
