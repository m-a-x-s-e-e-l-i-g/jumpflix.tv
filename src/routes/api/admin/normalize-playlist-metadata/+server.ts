import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import OpenAI from 'openai';

function uniqueNames(input: unknown): string[] {
	if (!Array.isArray(input)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of input) {
		if (typeof value !== 'string') continue;
		const trimmed = value.trim().replace(/\s+/g, ' ');
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(trimmed);
	}
	return out;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const body = (await request.json().catch(() => null)) as {
		playlistTitle?: unknown;
		channelName?: unknown;
		episodeTitles?: unknown;
		episodeDescriptions?: unknown;
	} | null;

	const playlistTitle = typeof body?.playlistTitle === 'string' ? body.playlistTitle.trim() : '';
	const channelName = typeof body?.channelName === 'string' ? body.channelName.trim() : '';
	const episodeTitles = Array.isArray(body?.episodeTitles)
		? (body.episodeTitles as unknown[])
				.map((v) => (typeof v === 'string' ? v.trim() : ''))
				.filter(Boolean)
		: [];
	const episodeDescriptions = Array.isArray(body?.episodeDescriptions)
		? (body.episodeDescriptions as unknown[])
				.map((v) => (typeof v === 'string' ? v.trim() : ''))
				.filter(Boolean)
		: [];

	if (episodeDescriptions.length === 0 && episodeTitles.length === 0) {
		return json({
			description: '',
			creators: channelName ? [channelName] : [],
			athletes: []
		});
	}

	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return json({
			description: '',
			creators: channelName ? [channelName] : [],
			athletes: []
		});
	}

	const openai = new OpenAI({ apiKey });

	// Truncate descriptions to avoid token overruns — keep first 400 chars each
	const truncatedDescriptions = episodeDescriptions
		.slice(0, 15)
		.map((d) => d.slice(0, 400))
		.join('\n\n---\n\n');

	const titlesText = episodeTitles.slice(0, 15).join('\n');

	let content = '';
	try {
		const completion = await openai.chat.completions.create({
			model: 'gpt-4.1-mini',
			temperature: 0,
			response_format: { type: 'json_object' },
			messages: [
				{
					role: 'system',
					content:
						'You clean metadata for a parkour/freerunning video series catalog. Given the series title, channel, episode titles, and episode descriptions, return a JSON object with keys: description, creators, athletes. Rules: description must be a single, concise English paragraph (2–4 sentences) summarizing the series as a whole — what it is, its style, setting, and theme. No camera gear, social links, hashtags, sponsors, or calls to action. creators: explicitly credited creators/directors/channels/producers. athletes: explicitly featured athletes/performers across all episodes. Never invent facts or names.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						seriesTitle: playlistTitle,
						channelName,
						episodeTitles: titlesText,
						episodeDescriptions: truncatedDescriptions
					})
				}
			]
		});

		content = completion.choices[0]?.message?.content?.trim() ?? '';
	} catch (err) {
		const message = err instanceof Error ? err.message : 'OpenAI request failed';
		throw error(502, message);
	}

	let parsed: { description?: unknown; creators?: unknown; athletes?: unknown } = {};
	try {
		parsed = JSON.parse(content) as typeof parsed;
	} catch {
		throw error(502, 'Failed to parse AI response');
	}

	return json({
		description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
		creators: uniqueNames(parsed.creators),
		athletes: uniqueNames(parsed.athletes)
	});
};
