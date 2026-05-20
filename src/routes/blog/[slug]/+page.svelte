<script lang="ts">
	import type { BlogPostSummary } from '$lib/blog/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function toTagSlug(tag: string): string {
		return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	}

	function riskBadgeClass(riskLevel: BlogPostSummary['riskLevel']): string {
		if (riskLevel === 'high') return 'border-red-400/45 bg-red-500/10 text-red-200';
		if (riskLevel === 'moderate') return 'border-amber-300/45 bg-amber-500/10 text-amber-100';
		return 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100';
	}

	const articleSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: data.post.title,
		description: data.post.description,
		datePublished: data.post.date,
		dateModified: data.post.updated ?? data.post.date,
		author: {
			'@type': 'Organization',
			name: data.post.author
		},
		publisher: {
			'@type': 'Organization',
			name: 'JUMPFLIX'
		},
		image: [data.post.coverImage],
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': `https://www.jumpflix.tv${data.post.canonicalPath}`
		}
	});

	const faqSchema = $derived(
		data.post.faq.length
			? {
					'@context': 'https://schema.org',
					'@type': 'FAQPage',
					mainEntity: data.post.faq.map((item) => ({
						'@type': 'Question',
						name: item.question,
						acceptedAnswer: {
							'@type': 'Answer',
							text: item.answer
						}
					}))
				}
			: null
	);
</script>

<svelte:head>
	<title>{data.post.title} | JumpFlix Blog</title>
	<meta name="description" content={data.post.description} />
	<link rel="canonical" href={`https://www.jumpflix.tv${data.post.canonicalPath}`} />
	<meta property="og:title" content={data.post.title} />
	<meta property="og:description" content={data.post.description} />
	<meta property="og:url" content={`https://www.jumpflix.tv${data.post.canonicalPath}`} />
	<meta property="og:image" content={data.post.coverImage} />
	<meta property="og:type" content="article" />
	<meta property="article:published_time" content={data.post.date} />
	<meta property="article:modified_time" content={data.post.updated ?? data.post.date} />
	{#each data.post.tags as tag}
		<meta property="article:tag" content={tag} />
	{/each}
	<meta name="twitter:title" content={data.post.title} />
	<meta name="twitter:description" content={data.post.description} />
	<meta name="twitter:image" content={data.post.coverImage} />
	<script type="application/ld+json">
		{JSON.stringify(articleSchema)}
	</script>
	{#if faqSchema}
		<script type="application/ld+json">
			{JSON.stringify(faqSchema)}
		</script>
	{/if}
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 md:px-8 md:pt-28">
	<article class="jf-surface rounded-3xl border border-border/70 p-5 md:p-8">
		<a
			href="/blog"
			class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>Back To Blog</span>
		</a>

		<div class="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
			<span>{formatDate(data.post.date)}</span>
			<span aria-hidden="true">•</span>
			<span>{data.post.readingMinutes} min read</span>
			<span aria-hidden="true">•</span>
			<span>{data.post.category}</span>
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			<span class="rounded-full border border-border/65 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-foreground/90">
				{data.post.practiceMode === 'watch-only' ? 'Watch-Only' : 'Safe Practice'}
			</span>
			<span
				class={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${riskBadgeClass(data.post.riskLevel)}`}
			>
				{data.post.ageGuidance}
			</span>
		</div>

		<h1 class="jf-display mt-4 text-3xl leading-tight text-foreground md:text-5xl">{data.post.title}</h1>
		<p class="mt-4 text-sm leading-7 text-muted-foreground md:text-base">{data.post.description}</p>

		<div class="mt-4 flex flex-wrap gap-2">
			{#each data.post.tags as tag}
				<a
					href={`/blog/tag/${toTagSlug(tag)}`}
					class="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:text-foreground"
				>
					{tag}
				</a>
			{/each}
		</div>

		<div class="blog-prose mt-8 max-w-[72ch] text-foreground">
			{@html data.post.html}
		</div>

		<section class="mt-10 rounded-2xl border border-primary/35 bg-primary/10 p-5 md:p-6">
			<h2 class="text-xl font-semibold text-foreground md:text-2xl">
				{data.post.practiceMode === 'watch-only' ? 'Watch With Caution On JumpFlix' : 'Keep Watching On JumpFlix'}
			</h2>
			<p class="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
				{#if data.post.practiceMode === 'watch-only'}
					Treat this queue as inspiration analysis, not a beginner training plan. Scale down what you watch
					before trying anything in real sessions.
				{:else}
					This guide is built for watch intent. Open the related discovery stream and start with one full
					video right now.
				{/if}
			</p>
			<a
				href={data.post.ctaHref}
				class="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/60 bg-background/70 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
			>
				<span>{data.post.ctaLabel}</span>
				<span aria-hidden="true">→</span>
			</a>
		</section>
	</article>

	{#if data.related.length}
		<section class="mt-8">
			<h2 class="text-2xl font-semibold text-foreground">Related Articles</h2>
			<div class="mt-4 grid gap-4 md:grid-cols-2">
				{#each data.related as post}
					<article class="jf-surface-soft rounded-2xl border border-border/70 p-4 md:p-5">
						<p class="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatDate(post.date)}</p>
						<div class="mt-2 flex flex-wrap gap-2">
							<span class="rounded-full border border-border/65 bg-background/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/90">
								{post.practiceMode === 'watch-only' ? 'Watch-Only' : 'Safe Practice'}
							</span>
							<span
								class={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${riskBadgeClass(post.riskLevel)}`}
							>
								{post.ageGuidance}
							</span>
						</div>
						<h3 class="mt-2 text-lg font-semibold text-foreground">
							<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
						</h3>
						<p class="mt-2 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>
						<a
							href={`/blog/${post.slug}`}
							class="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
						>
							<span>Read</span>
							<span aria-hidden="true">→</span>
						</a>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.blog-prose :global(h2) {
		margin-top: 2.3rem;
		font-size: clamp(1.35rem, 2vw, 1.8rem);
		line-height: 1.25;
		font-weight: 700;
		color: rgba(248, 250, 252, 0.96);
	}

	.blog-prose :global(h3) {
		margin-top: 1.8rem;
		font-size: clamp(1.1rem, 1.8vw, 1.35rem);
		line-height: 1.35;
		font-weight: 700;
		color: rgba(248, 250, 252, 0.95);
	}

	.blog-prose :global(p),
	.blog-prose :global(li) {
		font-size: 1.02rem;
		line-height: 1.78;
		color: rgba(226, 232, 240, 0.92);
	}

	.blog-prose :global(ul),
	.blog-prose :global(ol) {
		margin-top: 1rem;
		padding-left: 1.35rem;
	}

	.blog-prose :global(a) {
		color: rgba(248, 250, 252, 0.96);
		text-decoration: underline;
		text-decoration-color: rgba(148, 163, 184, 0.55);
		text-underline-offset: 4px;
		transition: text-decoration-color 180ms ease;
	}

	.blog-prose :global(a:hover) {
		text-decoration-color: rgba(248, 250, 252, 0.95);
	}

	.blog-prose :global(pre) {
		margin-top: 1.25rem;
		overflow-x: auto;
		border-radius: 1rem;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(2, 6, 23, 0.7);
		padding: 0.95rem 1.05rem;
		font-size: 0.88rem;
	}

	.blog-prose :global(code:not(pre code)) {
		border-radius: 0.4rem;
		background: rgba(15, 23, 42, 0.65);
		padding: 0.1rem 0.35rem;
		font-size: 0.87em;
	}

	.blog-prose :global(blockquote) {
		margin-top: 1.2rem;
		border-left: 2px solid rgba(229, 9, 20, 0.6);
		padding-left: 1rem;
		color: rgba(203, 213, 225, 0.95);
	}
</style>
