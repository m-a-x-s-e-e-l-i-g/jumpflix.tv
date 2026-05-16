import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import OpenAI from 'openai';

type NormalizedPayload = {
	description?: unknown;
	creators?: unknown;
	athletes?: unknown;
};

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
		title?: unknown;
		description?: unknown;
		author?: unknown;
		provider?: unknown;
	} | null;

	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const description = typeof body?.description === 'string' ? body.description.trim() : '';
	const author = typeof body?.author === 'string' ? body.author.trim() : '';
	const provider = body?.provider === 'vimeo' ? 'vimeo' : 'youtube';

	if (!description) {
		return json({ description: '', creators: author ? [author] : [], athletes: [] });
	}

	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return json({ description, creators: author ? [author] : [], athletes: [] });
	}

	const openai = new OpenAI({ apiKey });

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
						'You clean video metadata for a catalog. Return JSON object with keys: description, creators, athletes. Rules: description must always be English, concise, and only describe what the video is about (content, setting, style, themes). Remove camera gear, filming/editing credits, social links, hashtags, timestamps, sponsors, calls to action, tracklists, and promotional text. Do not include who made the video or who appears in the description. creators should include explicitly credited creators/directors/channels/producers/editors. athletes should include explicitly featured performers/athletes. Never invent facts or names. If uncertain, return empty arrays.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						provider,
						title,
						author,
						rawDescription: description
					})
				}
			]
		});

		content = completion.choices[0]?.message?.content?.trim() ?? '';
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'OpenAI request failed';
		throw error(502, message);
	}

	if (!content) {
		return json({ description, creators: author ? [author] : [], athletes: [] });
	}

	let parsed: NormalizedPayload | null = null;
	try {
		parsed = JSON.parse(content) as NormalizedPayload;
	} catch {
		return json({ description, creators: author ? [author] : [], athletes: [] });
	}

	const normalizedDescription =
		typeof parsed.description === 'string' && parsed.description.trim()
			? parsed.description.trim()
			: description;

	const creators = uniqueNames(parsed.creators);
	const athletes = uniqueNames(parsed.athletes);

	return json({
		description: normalizedDescription,
		creators,
		athletes
	});
};
