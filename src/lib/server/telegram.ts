import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } from '$env/static/private';

const BOT_TOKEN = TELEGRAM_BOT_TOKEN?.trim();
const CHANNEL_ID = TELEGRAM_CHANNEL_ID?.trim();

export async function sendTelegramMessage(
	text: string,
	options?: {
		disableWebPagePreview?: boolean;
	}
): Promise<void> {
	if (!BOT_TOKEN || !CHANNEL_ID) {
		throw new Error('Telegram configuration missing. Ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are set.');
	}

	const payload = {
		chat_id: CHANNEL_ID,
		text,
		disable_web_page_preview: options?.disableWebPagePreview ?? true
	};

	const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(`Telegram API error ${response.status}${errorText ? `: ${errorText}` : ''}`);
	}
}

export async function trySendTelegramMessage(
	text: string,
	options?: {
		disableWebPagePreview?: boolean;
	}
): Promise<boolean> {
	try {
		await sendTelegramMessage(text, options);
		return true;
	} catch (err) {
		console.warn('Telegram message not sent', err);
		return false;
	}
}
