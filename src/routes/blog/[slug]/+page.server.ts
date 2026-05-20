import { error } from '@sveltejs/kit';

import { getAllBlogPostSummaries, getBlogPostBySlug, getRelatedBlogPosts } from '$lib/blog/content';

import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	return getAllBlogPostSummaries().map((post) => ({ slug: post.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const post = getBlogPostBySlug(params.slug);
	if (!post) {
		throw error(404, 'Article not found');
	}
	const related = getRelatedBlogPosts(post.slug, 8);

	return {
		post,
		related: related.slice(0, 4)
	};
};
