import matter from 'gray-matter';
import { marked } from 'marked';

import { slugify } from '$lib/tv/slug';

import type {
	BlogFaqItem,
	BlogLane,
	BlogPost,
	BlogPostSummary,
	BlogPracticeMode,
	BlogRiskLevel,
	BlogTag
} from './types';

const SITE_URL = 'https://www.jumpflix.tv';
const DEFAULT_AUTHOR = 'JumpFlix Editorial Crew';
const DEFAULT_COVER_IMAGE = `${SITE_URL}/images/jumpflix.webp`;
const DEFAULT_CTA_LABEL = 'Watch related videos on JumpFlix';
const DEFAULT_CTA_HREF = '/?q=parkour%20videos';
const SAFE_START_CATEGORIES = new Set(['kid-beginner', 'beginner-literacy']);
const SKILL_BUILDING_CATEGORIES = new Set([
	'tutorials',
	'move-specific',
	'pov',
	'fear-progression',
	'fails-safety',
	'challenges',
	'best-videos'
]);
const MODERATE_RISK_CATEGORIES = new Set(['spot-location']);
const SAFE_START_TERMS = ['beginner', 'kid', 'kids', 'safety', 'safely', 'starter'];
const SKILL_BUILDING_TERMS = ['tutorial', 'progression', 'drill', 'technique', 'session', 'pov'];
const HIGH_RISK_TERMS = ['rooftop', 'rooftops', 'urbex', 'abandoned', 'viral', 'stunt', 'big-send'];
const MODERATE_RISK_TERMS = ['fail', 'challenge', 'fear', 'risk', 'consequence', 'spot'];

marked.use({
	gfm: true,
	breaks: false
});

const rawMarkdownFiles = import.meta.glob('/blog/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

function asString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const values = value
		.map((entry) => asString(entry))
		.filter((entry): entry is string => Boolean(entry));
	return Array.from(new Set(values));
}

function normalizeDate(value: unknown, filePath: string, fieldName: string): string {
	if (!value) {
		throw new Error(`Missing required frontmatter field \"${fieldName}\" in ${filePath}`);
	}

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error(`Invalid date in frontmatter field \"${fieldName}\" for ${filePath}`);
		}
		return value.toISOString();
	}

	const valueString = asString(value);
	if (!valueString) {
		throw new Error(`Invalid date in frontmatter field \"${fieldName}\" for ${filePath}`);
	}
	const parsed = new Date(valueString);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Invalid date in frontmatter field \"${fieldName}\" for ${filePath}`);
	}
	return parsed.toISOString();
}

function stripMarkdown(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^>\s?/gm, '')
		.replace(/[*_~]/g, '')
		.replace(/\n+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function buildExcerpt(markdown: string, customExcerpt?: string): string {
	const fromFrontmatter = asString(customExcerpt);
	if (fromFrontmatter) return fromFrontmatter;

	const plain = stripMarkdown(markdown);
	if (plain.length <= 190) return plain;
	return `${plain.slice(0, 187).trimEnd()}...`;
}

function parseFaq(value: unknown): BlogFaqItem[] {
	if (!Array.isArray(value)) return [];

	const faq: BlogFaqItem[] = [];
	for (const row of value) {
		if (!row || typeof row !== 'object') continue;
		const item = row as Record<string, unknown>;
		const question = asString(item.question);
		const answer = asString(item.answer);
		if (!question || !answer) continue;
		faq.push({ question, answer });
	}

	return faq;
}

function readingMinutes(markdown: string): number {
	const plain = stripMarkdown(markdown);
	if (!plain) return 1;
	const words = plain.split(/\s+/).filter(Boolean).length;
	return Math.max(3, Math.ceil(words / 210));
}

function toSummary(post: BlogPost): BlogPostSummary {
	const { html: _html, markdown: _markdown, ...summary } = post;
	return summary;
}

function normalizeTag(tag: string): string {
	return tag.trim().toLowerCase();
}

function normalizeCategory(category: string): string {
	return category.trim().toLowerCase();
}

function containsSignal(signals: string[], terms: string[]): boolean {
	for (const signal of signals) {
		for (const term of terms) {
			if (signal.includes(term)) {
				return true;
			}
		}
	}
	return false;
}

function classifyPostSafety(input: {
	category: string;
	tags: string[];
	keywords: string[];
	title: string;
	slug: string;
}): {
	lane: BlogLane;
	riskLevel: BlogRiskLevel;
	ageGuidance: string;
	practiceMode: BlogPracticeMode;
} {
	const category = normalizeCategory(input.category);
	const signals = [category, input.title, input.slug, ...input.tags, ...input.keywords].map((value) =>
		normalizeTag(value)
	);

	let riskLevel: BlogRiskLevel = 'low';
	if (category === 'viral-stunt' || containsSignal(signals, HIGH_RISK_TERMS)) {
		riskLevel = 'high';
	} else if (MODERATE_RISK_CATEGORIES.has(category) || containsSignal(signals, MODERATE_RISK_TERMS)) {
		riskLevel = 'moderate';
	}

	let lane: BlogLane = 'culture-film';
	if (riskLevel === 'high') {
		lane = 'watch-only';
	} else if (SAFE_START_CATEGORIES.has(category) || containsSignal(signals, SAFE_START_TERMS)) {
		lane = 'safe-start';
	} else if (SKILL_BUILDING_CATEGORIES.has(category) || containsSignal(signals, SKILL_BUILDING_TERMS)) {
		lane = 'skill-building';
	}

	let ageGuidance = 'Ages 12+ · guided progression';
	let practiceMode: BlogPracticeMode = 'safe-practice';

	if (lane === 'safe-start') {
		ageGuidance = 'Ages 10+ · beginner safe start';
	}

	if (riskLevel === 'moderate') {
		ageGuidance = 'Ages 13+ · supervised practice';
	}

	if (riskLevel === 'high') {
		ageGuidance = 'Ages 15+ · watch-only inspiration';
		practiceMode = 'watch-only';
	}

	return { lane, riskLevel, ageGuidance, practiceMode };
}

function hasPublishPlaceholder(markdown: string): boolean {
	return /video\s+embed\s+placeholder/i.test(markdown) || /class=['"]video-placeholder['"]/i.test(markdown);
}

function parsePost(filePath: string, raw: string): BlogPost {
	const parsed = matter(raw);
	const fm = parsed.data as Record<string, unknown>;
	const markdown = parsed.content.trim();
	if (hasPublishPlaceholder(markdown)) {
		throw new Error(`Unpublished video placeholder detected in ${filePath}`);
	}

	const fallbackSlug = filePath
		.split('/')
		.pop()
		?.replace(/\.md$/i, '')
		.trim();

	const title = asString(fm.title);
	if (!title) {
		throw new Error(`Missing required frontmatter field \"title\" in ${filePath}`);
	}

	const description = asString(fm.description);
	if (!description) {
		throw new Error(`Missing required frontmatter field \"description\" in ${filePath}`);
	}

	const slug =
		slugify(asString(fm.slug) || title || fallbackSlug || '') ||
		slugify(fallbackSlug || '') ||
		slugify(title);
	if (!slug) {
		throw new Error(`Unable to resolve slug for ${filePath}`);
	}

	const date = normalizeDate(fm.date, filePath, 'date');
	const updatedRaw = fm.updated;
	const updated = updatedRaw ? normalizeDate(updatedRaw, filePath, 'updated') : undefined;

	const tags = asStringArray(fm.tags);
	const keywords = asStringArray(fm.keywords);
	const category = asString(fm.category) || (tags[0] ?? 'watch-guides');
	const author = asString(fm.author) || DEFAULT_AUTHOR;
	const coverImage = asString(fm.coverImage)
		? asString(fm.coverImage)?.startsWith('http')
			? asString(fm.coverImage)
			: `${SITE_URL}${asString(fm.coverImage)}`
		: DEFAULT_COVER_IMAGE;
	const ctaLabel = asString(fm.ctaLabel) || DEFAULT_CTA_LABEL;
	const ctaHref = asString(fm.ctaHref) || DEFAULT_CTA_HREF;
	const faq = parseFaq(fm.faq);
	const canonicalPath = `/blog/${slug}`;
	const safety = classifyPostSafety({ category, tags, keywords, title, slug });

	const html = marked.parse(markdown) as string;

	return {
		slug,
		filePath,
		title,
		description,
		excerpt: buildExcerpt(markdown, asString(fm.excerpt)),
		date,
		updated,
		category,
		tags,
		keywords,
		author,
		coverImage: coverImage || DEFAULT_COVER_IMAGE,
		readingMinutes: readingMinutes(markdown),
		canonicalPath,
		ctaLabel,
		ctaHref,
		lane: safety.lane,
		riskLevel: safety.riskLevel,
		ageGuidance: safety.ageGuidance,
		practiceMode: safety.practiceMode,
		faq,
		markdown,
		html
	};
}

const posts = Object.entries(rawMarkdownFiles).map(([filePath, raw]) => parsePost(filePath, raw));

const slugSet = new Set<string>();
for (const post of posts) {
	if (slugSet.has(post.slug)) {
		throw new Error(`Duplicate blog slug detected: ${post.slug}`);
	}
	slugSet.add(post.slug);
}

const BLOG_POSTS: BlogPost[] = posts.sort((a, b) => {
	if (a.date === b.date) return a.slug.localeCompare(b.slug);
	return b.date.localeCompare(a.date);
});

const BLOG_SUMMARIES: BlogPostSummary[] = BLOG_POSTS.map((post) => toSummary(post));

const BLOG_POST_BY_SLUG = new Map(BLOG_POSTS.map((post) => [post.slug, post]));

const tagMap = new Map<string, { tag: string; count: number }>();
const postsByTagSlug = new Map<string, BlogPostSummary[]>();

for (const post of BLOG_SUMMARIES) {
	for (const rawTag of post.tags) {
		const canonicalTag = normalizeTag(rawTag);
		if (!canonicalTag) continue;
		const tagSlug = slugify(canonicalTag);
		if (!tagSlug) continue;

		const currentTag = tagMap.get(tagSlug);
		if (currentTag) {
			currentTag.count += 1;
		} else {
			tagMap.set(tagSlug, { tag: canonicalTag, count: 1 });
		}

		const taggedPosts = postsByTagSlug.get(tagSlug) ?? [];
		taggedPosts.push(post);
		postsByTagSlug.set(tagSlug, taggedPosts);
	}
}

const BLOG_TAGS: BlogTag[] = Array.from(tagMap.entries())
	.map(([slug, info]) => ({ tag: info.tag, slug, count: info.count }))
	.sort((a, b) => {
		if (a.count !== b.count) return b.count - a.count;
		return a.tag.localeCompare(b.tag);
	});

function scoreRelated(base: BlogPost, candidate: BlogPost): number {
	let score = 0;

	if (candidate.category.toLowerCase() === base.category.toLowerCase()) {
		score += 3;
	}

	const baseTags = new Set(base.tags.map((tag) => normalizeTag(tag)));
	const baseKeywords = new Set(base.keywords.map((keyword) => normalizeTag(keyword)));

	for (const tag of candidate.tags) {
		if (baseTags.has(normalizeTag(tag))) score += 2;
	}
	for (const keyword of candidate.keywords) {
		if (baseKeywords.has(normalizeTag(keyword))) score += 1;
	}

	return score;
}

export function getAllBlogPosts(): BlogPost[] {
	return BLOG_POSTS;
}

export function getAllBlogPostSummaries(): BlogPostSummary[] {
	return BLOG_SUMMARIES;
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
	const normalized = slugify(slug || '');
	if (!normalized) return null;
	return BLOG_POST_BY_SLUG.get(normalized) ?? null;
}

export function getAllBlogTags(): BlogTag[] {
	return BLOG_TAGS;
}

export function getBlogPostsByTag(tagSlug: string): BlogPostSummary[] {
	const normalized = slugify(tagSlug || '');
	if (!normalized) return [];
	return postsByTagSlug.get(normalized) ?? [];
}

export function getRelatedBlogPosts(slug: string, limit = 3): BlogPostSummary[] {
	const source = getBlogPostBySlug(slug);
	if (!source) return [];

	const related = BLOG_POSTS.filter((post) => post.slug !== source.slug)
		.map((post) => ({ post, score: scoreRelated(source, post) }))
		.sort((a, b) => {
			if (a.score !== b.score) return b.score - a.score;
			if (a.post.date !== b.post.date) return b.post.date.localeCompare(a.post.date);
			return a.post.slug.localeCompare(b.post.slug);
		})
		.slice(0, Math.max(1, limit))
		.map(({ post }) => toSummary(post));

	return related;
}
