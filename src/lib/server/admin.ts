import { ADMIN_EMAILS, ADMIN_USER_IDS } from '$env/static/private';
import { error } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

function parseCsv(value: string | undefined | null): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function isAdminUser(user: User | null): boolean {
	if (!user) return false;

	const allowedEmails = parseCsv(ADMIN_EMAILS).map((e) => e.toLowerCase());
	const allowedUserIds = parseCsv(ADMIN_USER_IDS);

	const email = user.email?.toLowerCase() ?? '';
	if (email && allowedEmails.includes(email)) return true;
	if (allowedUserIds.includes(user.id)) return true;

	return false;
}

export function isAdminConfigured(): boolean {
	const allowedEmails = parseCsv(ADMIN_EMAILS);
	const allowedUserIds = parseCsv(ADMIN_USER_IDS);
	return allowedEmails.length > 0 || allowedUserIds.length > 0;
}

export function requireAdmin(user: User | null): asserts user is User {
	if (!isAdminConfigured()) {
		throw error(
			403,
			'Admin stats are not configured. Set ADMIN_EMAILS and/or ADMIN_USER_IDS in your server env (then restart the dev server).'
		);
	}

	if (!isAdminUser(user)) {
		throw error(403, 'Forbidden');
	}
}
