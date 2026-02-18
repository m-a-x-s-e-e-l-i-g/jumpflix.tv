import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sendTelegramMessage } from '$lib/server/telegram';

export const load: PageServerLoad = async ({ parent, setHeaders }) => {
	const parentData = await parent();
	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders({
		'Cache-Control': isAuthenticated
			? 'private, no-store'
			: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
		Vary: 'Cookie'
	});

	return {};
};

export const actions: Actions = {
	submitFilm: async ({ request }) => {
		const formData = await request.formData();
		const rawSubmission = formData.get('submission');
		const submission = typeof rawSubmission === 'string' ? rawSubmission.trim() : '';

		if (!submission) {
			return fail(400, { message: 'Please enter a title or link.' });
		}

		try {
			await sendTelegramMessage(`${submission}`, { disableWebPagePreview: true });
		} catch (error) {
			console.error('Telegram submission error', error);
			const message = String(error ?? '').includes('Telegram configuration missing')
				? 'Submissions are temporarily unavailable.'
				: 'Unable to send submission right now. Please try again shortly.';
			return fail(502, { message });
		}

		return { success: true };
	}
};
