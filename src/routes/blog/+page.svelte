<script lang="ts">
	import type { BlogPostSummary } from '$lib/blog/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const primaryTags = $derived(data.tags.slice(0, 5));
	const secondaryTags = $derived(data.tags.slice(5));

	const safeStartLane = $derived(data.lanes.safeStart);
	const skillBuildingLane = $derived(data.lanes.skillBuilding);
	const cultureLane = $derived(data.lanes.cultureFilm);
	const watchOnlyLane = $derived(data.lanes.watchOnly);

	function toTagSlug(tag: string): string {
		return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	}

	function formatDate(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function riskBadgeClass(riskLevel: BlogPostSummary['riskLevel']): string {
		if (riskLevel === 'high') return 'border-red-400/40 bg-red-500/10 text-red-200';
		if (riskLevel === 'moderate') return 'border-amber-300/45 bg-amber-500/10 text-amber-100';
		return 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100';
	}

	function modeLabel(post: BlogPostSummary): string {
		return post.practiceMode === 'watch-only' ? 'Watch-Only' : 'Safe Practice';
	}
</script>

<svelte:head>
	<title>JumpFlix Blog | Safe-Start Parkour Watch Guides and Training Discovery</title>
	<meta
		name="description"
		content="Lane-based parkour watch guides for beginners, kids, and progression-focused viewers. Start safe, then branch into skill-building, films, and watch-only inspiration."
	/>
	<link rel="canonical" href="https://www.jumpflix.tv/blog" />
	<meta property="og:title" content="JumpFlix Blog | Safe-Start Parkour Watch Guides" />
	<meta
		property="og:description"
		content="Find what to watch next in parkour with a calm lane system: safe-start, skill-building, culture, and optional watch-only inspiration."
	/>
	<meta property="og:url" content="https://www.jumpflix.tv/blog" />
	<meta property="og:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
	<meta name="twitter:title" content="JumpFlix Blog | Safe-Start Parkour Watch Guides" />
	<meta
		name="twitter:description"
		content="Find what to watch next in parkour with safe-start lanes and clear watch-only boundaries for higher-risk content."
	/>
	<meta name="twitter:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
	<link rel="alternate" type="application/rss+xml" title="JumpFlix Blog RSS" href="/blog/rss.xml" />
</svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 md:px-8 md:pt-28">
	<section class="jf-surface relative overflow-hidden rounded-3xl p-6 md:p-9">
		<div class="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
			<div
				class="absolute -left-28 top-0 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
			></div>
			<div
				class="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl"
			></div>
		</div>
		<div class="relative z-10">
			<a
				href="/"
				class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
			>
				<span aria-hidden="true">←</span>
				<span>Back To Catalog</span>
			</a>
			<p class="jf-label mt-5">JumpFlix Editorial</p>
			<h1 class="jf-display mt-3 max-w-3xl text-3xl leading-tight text-foreground md:text-5xl">
				Start safe. Build skill. Keep the culture.
			</h1>
			<p class="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
				This archive is structured for calm discovery, not adrenaline scrolling. Start with foundations,
				then branch into technical, cultural, and high-consequence inspiration lanes.
			</p>
			<div class="mt-6 flex flex-wrap gap-2">
				{#if data.kidStart}
					<a
						href={`/blog/${data.kidStart.slug}`}
						class="rounded-full border border-emerald-300/55 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-200 hover:text-white"
					>
						Start Here
					</a>
				{/if}
				<a
					href="/blog/tag/beginner-parkour"
					class="rounded-full border border-border/70 bg-background/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
				>
					Beginner Tag
				</a>
				<a
					href="/blog/rss.xml"
					class="rounded-full border border-border/70 bg-background/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
				>
					RSS Feed
				</a>
			</div>
		</div>
	</section>

	<section class="jf-surface-soft mt-6 rounded-2xl border border-border/70 p-4 md:p-5">
		<p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quick Filters</p>
		<div class="mt-3 flex flex-wrap items-start gap-2">
			{#each primaryTags as tag}
				<a
					href={`/blog/tag/${tag.slug}`}
					class="rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
				>
					{tag.tag} · {tag.count}
				</a>
			{/each}
			{#if secondaryTags.length}
				<details class="rounded-xl border border-border/60 bg-background/45 px-3 py-1.5 text-xs text-muted-foreground">
					<summary class="cursor-pointer select-none uppercase tracking-[0.12em]">More Filters</summary>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each secondaryTags as tag}
							<a
								href={`/blog/tag/${tag.slug}`}
								class="rounded-full border border-border/70 bg-background/55 px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] transition hover:border-border hover:text-foreground"
							>
								{tag.tag} · {tag.count}
							</a>
						{/each}
					</div>
				</details>
			{/if}
		</div>
	</section>

	<section class="mt-8">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-2xl font-semibold text-foreground">Lane 1: Safe Start</h2>
			<p class="text-sm text-muted-foreground">Beginner-ready reads first.</p>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each safeStartLane as post}
				<article class="jf-surface-soft rounded-3xl border border-border/70 p-5 md:p-6">
					<div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
						<span>{formatDate(post.date)}</span>
						<span aria-hidden="true">•</span>
						<span>{post.readingMinutes} min read</span>
						<span aria-hidden="true">•</span>
						<span>{post.category}</span>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						<span class="rounded-full border border-emerald-400/45 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-100">
							{modeLabel(post)}
						</span>
						<span
							class={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${riskBadgeClass(post.riskLevel)}`}
						>
							{post.ageGuidance}
						</span>
					</div>
					<h3 class="mt-3 text-2xl font-semibold leading-tight text-foreground">
						<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
					</h3>
					<p class="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{post.description}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each post.tags.slice(0, 4) as tag}
							<a
								href={`/blog/tag/${toTagSlug(tag)}`}
								class="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:text-foreground"
							>
								{tag}
							</a>
						{/each}
					</div>
					<a
						href={`/blog/${post.slug}`}
						class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
					>
						<span>Read Article</span>
						<span aria-hidden="true">→</span>
					</a>
				</article>
			{/each}
		</div>
	</section>

	<section class="mt-9">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-2xl font-semibold text-foreground">Lane 2: Skill Building</h2>
			<p class="text-sm text-muted-foreground">Tutorial, POV, and progression guides with practical cues.</p>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each skillBuildingLane as post}
				<article class="jf-surface-soft rounded-3xl border border-border/70 p-5 md:p-6">
					<div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
						<span>{formatDate(post.date)}</span>
						<span aria-hidden="true">•</span>
						<span>{post.readingMinutes} min read</span>
						<span aria-hidden="true">•</span>
						<span>{post.category}</span>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						<span class="rounded-full border border-primary/45 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-primary-foreground">
							{modeLabel(post)}
						</span>
						<span
							class={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${riskBadgeClass(post.riskLevel)}`}
						>
							{post.ageGuidance}
						</span>
					</div>
					<h3 class="mt-3 text-2xl font-semibold leading-tight text-foreground">
						<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
					</h3>
					<p class="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{post.description}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each post.tags.slice(0, 4) as tag}
							<a
								href={`/blog/tag/${toTagSlug(tag)}`}
								class="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:text-foreground"
							>
								{tag}
							</a>
						{/each}
					</div>
					<a
						href={`/blog/${post.slug}`}
						class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
					>
						<span>Read Article</span>
						<span aria-hidden="true">→</span>
					</a>
				</article>
			{/each}
		</div>
	</section>

	<section class="mt-9">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-2xl font-semibold text-foreground">Lane 3: Culture and Film</h2>
			<p class="text-sm text-muted-foreground">Documentaries, athlete stories, and long-form context.</p>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each cultureLane as post}
				<article class="jf-surface-soft rounded-3xl border border-border/70 p-5 md:p-6">
					<div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
						<span>{formatDate(post.date)}</span>
						<span aria-hidden="true">•</span>
						<span>{post.readingMinutes} min read</span>
						<span aria-hidden="true">•</span>
						<span>{post.category}</span>
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						<span class="rounded-full border border-border/65 bg-background/55 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-foreground/90">
							{modeLabel(post)}
						</span>
						<span
							class={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${riskBadgeClass(post.riskLevel)}`}
						>
							{post.ageGuidance}
						</span>
					</div>
					<h3 class="mt-3 text-2xl font-semibold leading-tight text-foreground">
						<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
					</h3>
					<p class="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{post.description}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each post.tags.slice(0, 4) as tag}
							<a
								href={`/blog/tag/${toTagSlug(tag)}`}
								class="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:text-foreground"
							>
								{tag}
							</a>
						{/each}
					</div>
					<a
						href={`/blog/${post.slug}`}
						class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
					>
						<span>Read Article</span>
						<span aria-hidden="true">→</span>
					</a>
				</article>
			{/each}
		</div>
	</section>

	<section class="mt-9">
		{#if watchOnlyLane.length}
			<div class="flex flex-wrap items-end justify-between gap-3">
				<h2 class="text-2xl font-semibold text-foreground">Watch-Only Inspiration Lane</h2>
				<p class="text-sm text-muted-foreground">High consequence content for analysis, not imitation.</p>
			</div>
			<div class="mt-4 grid gap-4 md:grid-cols-2">
				{#each watchOnlyLane as post}
					<article class="jf-surface-soft rounded-3xl border border-red-400/25 p-5 md:p-6">
						<div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
							<span>{formatDate(post.date)}</span>
							<span aria-hidden="true">•</span>
							<span>{post.readingMinutes} min read</span>
							<span aria-hidden="true">•</span>
							<span>{post.category}</span>
						</div>
						<div class="mt-3 flex flex-wrap gap-2">
							<span class="rounded-full border border-red-400/45 bg-red-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-red-200">
								Watch-Only
							</span>
							<span class="rounded-full border border-red-400/45 bg-red-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-red-200">
								{post.ageGuidance}
							</span>
						</div>
						<h3 class="mt-3 text-2xl font-semibold leading-tight text-foreground">
							<a href={`/blog/${post.slug}`} class="transition hover:text-primary">{post.title}</a>
						</h3>
						<p class="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{post.description}</p>
						<a
							href={`/blog/${post.slug}`}
							class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
						>
							<span>Read With Caution</span>
							<span aria-hidden="true">→</span>
						</a>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
