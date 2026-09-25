import { toCatalogSummary } from '$lib/tv/catalog-summary';
import { getContentServiceStatus } from '$lib/server/content-service';
import { publicCacheHeaders } from '$lib/server/public-cache';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sendTelegramMessage } from '$lib/server/telegram';
import { fetchAllContent } from '$lib/server/content-service';

export const load: PageServerLoad = async ({ parent, setHeaders }) => {
	const [parentData, content] = await Promise.all([parent(), fetchAllContent()]);
	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders(publicCacheHeaders(isAuthenticated, Boolean(getContentServiceStatus().lastError)));

	return { content: content.map(toCatalogSummary) };
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
			await sendTelegramMessage(submission, { disableWebPagePreview: false });
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
