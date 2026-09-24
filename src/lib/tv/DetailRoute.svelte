<script lang="ts">
	import { getContext, type ComponentProps } from 'svelte';
	import TvDetailPanel from './TvDetailPanel.svelte';
	import { page } from '$app/stores';
	import { FEEDS } from './feeds';
	import { matchesFeed } from './utils';
	import { getUrlForItem } from './slug';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import type { ContentItem } from './types';
	// Only detail routes import the detail UI; the persistent shell owns player state.
	const getProps = getContext<() => ComponentProps<typeof TvDetailPanel>>('jumpflix-detail-props');
	const props = $derived(getProps());
	const collections = $derived(
		props.selected ? FEEDS.filter((feed) => matchesFeed(props.selected!, feed.slug)) : []
	);
	const related = $derived(($page.data.related ?? []) as ContentItem[]);
</script>

<TvDetailPanel {...props} />

{#if collections.length || related.length}
	<nav aria-label={m.tv_exploreMore()} class="mx-auto max-w-6xl space-y-5 px-6 pb-12">
		<h2 class="jf-display text-2xl">{m.tv_exploreMore()}</h2>
		<div class="flex flex-wrap gap-x-6 gap-y-3">
			{#each collections as feed}<a
					class="text-primary underline underline-offset-4"
					href={localizeHref(`/collections/${feed.slug}`)}>{feed.title()}</a
				>{/each}
		</div>
		<ul class="grid gap-3 sm:grid-cols-2">
			{#each related as item}<li>
					<a class="text-muted-foreground hover:text-foreground" href={getUrlForItem(item)}
						>{item.title}</a
					>
				</li>{/each}
		</ul>
	</nav>
{/if}
