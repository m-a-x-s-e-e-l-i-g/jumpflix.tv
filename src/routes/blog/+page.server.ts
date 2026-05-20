import { getAllBlogPostSummaries, getAllBlogTags } from '$lib/blog/content';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const posts = getAllBlogPostSummaries();
	const lanes = {
		safeStart: posts.filter((post) => post.lane === 'safe-start'),
		skillBuilding: posts.filter((post) => post.lane === 'skill-building'),
		cultureFilm: posts.filter((post) => post.lane === 'culture-film'),
		watchOnly: posts.filter((post) => post.lane === 'watch-only')
	};

	return {
		posts,
		tags: getAllBlogTags(),
		lanes,
		kidStart: lanes.safeStart[0] ?? posts[0] ?? null
	};
};
