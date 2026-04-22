import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestPeopleNames } from '$lib/server/people-suggest';

export const GET: RequestHandler = async ({ url }) => {
	const query = String(url.searchParams.get('q') ?? '');
	const role = String(url.searchParams.get('role') ?? 'any');
	const results = await suggestPeopleNames({ query, role, limit: 12 });

	return json({ results });
};