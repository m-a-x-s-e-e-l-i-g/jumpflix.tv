import type { PageServerLoad } from './$types';
import { slugify } from '$lib/tv/slug';
import { error, redirect } from '@sveltejs/kit';

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const rawParam = typeof params.name === 'string' ? safeDecodeURIComponent(params.name) : '';
	const slug = slugify(rawParam);
	if (!slug) throw error(404, 'Creator not found');
	throw redirect(301, `/people/${slug}`);
};
