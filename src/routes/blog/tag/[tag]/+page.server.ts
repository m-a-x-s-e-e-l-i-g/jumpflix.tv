import { error } from '@sveltejs/kit';

import { getAllBlogTags, getBlogPostsByTag } from '$lib/blog/content';

import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	return getAllBlogTags().map((tag) => ({ tag: tag.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const posts = getBlogPostsByTag(params.tag);
	if (!posts.length) {
		throw error(404, 'Tag not found');
	}

	const tagMeta = getAllBlogTags().find((entry) => entry.slug === params.tag);

	return {
		tag: tagMeta?.tag ?? params.tag,
		tagSlug: params.tag,
		posts
	};
};
