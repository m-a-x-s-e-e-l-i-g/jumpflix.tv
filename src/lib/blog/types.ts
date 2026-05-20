export type BlogFaqItem = {
	question: string;
	answer: string;
};

export type BlogLane = 'safe-start' | 'skill-building' | 'culture-film' | 'watch-only';

export type BlogRiskLevel = 'low' | 'moderate' | 'high';

export type BlogPracticeMode = 'safe-practice' | 'watch-only';

export type BlogPost = {
	slug: string;
	filePath: string;
	title: string;
	description: string;
	excerpt: string;
	date: string;
	updated?: string;
	category: string;
	tags: string[];
	keywords: string[];
	author: string;
	coverImage: string;
	readingMinutes: number;
	canonicalPath: string;
	ctaLabel: string;
	ctaHref: string;
	lane: BlogLane;
	riskLevel: BlogRiskLevel;
	ageGuidance: string;
	practiceMode: BlogPracticeMode;
	faq: BlogFaqItem[];
	markdown: string;
	html: string;
};

export type BlogPostSummary = Omit<BlogPost, 'markdown' | 'html'>;

export type BlogTag = {
	tag: string;
	slug: string;
	count: number;
};
