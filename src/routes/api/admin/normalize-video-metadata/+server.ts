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

function basicDescriptionCleanup(input: string): string {
	return input
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

function tokenizeForSimilarity(input: string): string[] {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 1);
}

function isCloseDescriptionEdit(original: string, candidate: string): boolean {
	const source = basicDescriptionCleanup(original);
	const next = basicDescriptionCleanup(candidate);
	if (!source || !next) return false;

	const sourceTokens = tokenizeForSimilarity(source);
	const nextTokens = tokenizeForSimilarity(next);
	if (sourceTokens.length < 3 || nextTokens.length < 3) {
		return source.toLowerCase() === next.toLowerCase();
	}

	const sourceSet = new Set(sourceTokens);
	let shared = 0;
	for (const token of nextTokens) {
		if (sourceSet.has(token)) shared += 1;
	}

	const overlap = shared / nextTokens.length;
	const sourceLen = sourceTokens.length;
	const nextLen = nextTokens.length;
	const withinReasonableLength = nextLen >= Math.floor(sourceLen * 0.4) && nextLen <= Math.ceil(sourceLen * 1.3);

	return overlap >= 0.75 && withinReasonableLength;
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
	const cleanedOriginalDescription = basicDescriptionCleanup(description);

	if (!description) {
		return json({ description: '', creators: author ? [author] : [], athletes: [] });
	}

	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return json({ description: cleanedOriginalDescription, creators: author ? [author] : [], athletes: [] });
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
						'You clean video metadata for a catalog. Return a JSON object with keys: description, creators, athletes. Description rules: treat rawDescription as source-of-truth; keep it very close to the original when present; only improve readability (spacing, punctuation, broken line breaks, obvious grammar). Remove non-descriptive noise like social links, hashtags, timestamps, sponsor/call-to-action blocks, camera gear lists, and tracklists. Do not summarize beyond the original text, do not translate, do not infer missing details, and do not add any fact, claim, name, or theme that is not explicitly present in rawDescription. If rawDescription is already readable, keep it almost unchanged. creators should include explicitly credited creators/directors/channels/producers/editors. athletes should include explicitly featured performers/athletes. Never invent facts or names. If uncertain, return empty arrays.'
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
		return json({ description: cleanedOriginalDescription, creators: author ? [author] : [], athletes: [] });
	}

	let parsed: NormalizedPayload | null = null;
	try {
		parsed = JSON.parse(content) as NormalizedPayload;
	} catch {
		return json({ description: cleanedOriginalDescription, creators: author ? [author] : [], athletes: [] });
	}

	const aiDescription =
		typeof parsed.description === 'string' && parsed.description.trim()
			? parsed.description.trim()
			: cleanedOriginalDescription;

	const normalizedDescription = isCloseDescriptionEdit(cleanedOriginalDescription, aiDescription)
		? basicDescriptionCleanup(aiDescription)
		: cleanedOriginalDescription;

	const creators = uniqueNames(parsed.creators);
	const athletes = uniqueNames(parsed.athletes);

	return json({
		description: normalizedDescription,
		creators,
		athletes
	});
};
