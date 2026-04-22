import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { suggestPeopleNames } from '$lib/server/people-suggest';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const query = String(url.searchParams.get('q') ?? '');
	const role = String(url.searchParams.get('role') ?? 'any');
	const results = await suggestPeopleNames({ query, role, limit: 12 });

	return json({ results });
};
