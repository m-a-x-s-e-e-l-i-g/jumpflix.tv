<script lang="ts">
	import type { BlogPostSummary } from '$lib/blog/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function riskBadgeClass(riskLevel: BlogPostSummary['riskLevel']): string {
		if (riskLevel === 'high') return 'border-red-400/45 bg-red-500/10 text-red-200';
		if (riskLevel === 'moderate') return 'border-amber-300/45 bg-amber-500/10 text-amber-100';
		return 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100';
	}
</script>

<svelte:head>
	<title>{data.tag} Parkour Articles | JumpFlix Blog</title>
	<meta
		name="description"
		content={`Browse JumpFlix blog articles tagged ${data.tag}, focused on high-intent parkour watch discovery.`}
	/>
	<link rel="canonical" href={`https://www.jumpflix.tv/blog/tag/${data.tagSlug}`} />
	<meta property="og:title" content={`${data.tag} Parkour Articles | JumpFlix Blog`} />
	<meta
		property="og:description"
		content={`Browse JumpFlix blog articles tagged ${data.tag}, focused on high-intent parkour watch discovery.`}
	/>
	<meta property="og:url" content={`https://www.jumpflix.tv/blog/tag/${data.tagSlug}`} />
	<meta property="og:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 md:px-8 md:pt-28">
	<section class="jf-surface rounded-3xl p-6 md:p-8">
		<a
			href="/blog"
			class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>Back To Blog</span>
		</a>
		<p class="jf-label mt-5">Tag Archive</p>
		<h1 class="jf-display mt-3 text-3xl text-foreground md:text-5xl">{data.tag}</h1>
		<p class="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
			{data.posts.length} article{data.posts.length === 1 ? '' : 's'} focused on this watch intent.
		</p>
	</section>

	<section class="mt-6 grid gap-4 md:grid-cols-2">
		{#each data.posts as post}
			<article class="jf-surface-soft rounded-2xl border border-border/70 p-4 md:p-5">
				<p class="text-xs uppercase tracking-[0.12em] text-muted-foreground">
					{formatDate(post.date)} · {post.readingMinutes} min read
				</p>
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
				<h2 class="mt-2 text-xl font-semibold text-foreground">
					<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
				</h2>
				<p class="mt-2 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>
				<a
					href={`/blog/${post.slug}`}
					class="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
				>
					<span>Read Article</span>
					<span aria-hidden="true">→</span>
				</a>
			</article>
		{/each}
	</section>
</div>
