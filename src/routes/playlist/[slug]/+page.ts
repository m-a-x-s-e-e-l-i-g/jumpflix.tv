import { redirect } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
	const { slug } = params as { slug: string };
	throw redirect(301, `/series/${slug}`);
};
