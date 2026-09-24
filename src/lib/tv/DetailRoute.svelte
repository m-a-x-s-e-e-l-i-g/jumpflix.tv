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
	<div class="explore-more">
		{#if collections.length}
			<div class="explore-collections">
				{#each collections as feed}
					<a class="explore-collection" href={localizeHref(`/collections/${feed.slug}`)}>
						<span>{feed.title()}</span><span aria-hidden="true">→</span>
					</a>
				{/each}
			</div>
		{/if}

		{#if related.length}
			<ul class="explore-titles">
				{#each related as item, index}
					<li>
						<a class="explore-title" href={getUrlForItem(item)}>
							<span class="explore-number" aria-hidden="true"
								>{String(index + 1).padStart(2, '0')}</span
							>
							<span class="explore-title-copy">
								<strong>{item.title}</strong>
								<span class="explore-meta"
									>{item.type === 'series' ? m.tv_pillSeries() : m.tv_pillFilm()}{item.type ===
										'movie' && item.year
										? ` · ${item.year}`
										: ''}</span
								>
							</span>
							<span class="explore-arrow" aria-hidden="true">→</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.explore-more {
		max-width: 72rem;
		margin: clamp(1.5rem, 3vw, 2.5rem) auto 0;
		padding: clamp(1.25rem, 2vw, 2rem) 1.5rem clamp(3.5rem, 7vw, 6rem);
		border-top: 1px solid rgba(248, 250, 252, 0.18);
	}

	.explore-collections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-bottom: clamp(1.75rem, 3vw, 2.5rem);
	}

	.explore-collection {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 1.25rem;
		padding: 0.65rem 0.85rem 0.65rem 1rem;
		border: 1px solid rgba(248, 250, 252, 0.23);
		border-radius: 999px;
		color: var(--jf-ink);
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			border-color 160ms ease,
			background-color 160ms ease;
	}

	.explore-collection span:last-child {
		color: var(--primary);
		font-size: 1rem;
		line-height: 1;
	}

	.explore-collection:hover,
	.explore-collection:focus-visible {
		border-color: var(--primary);
		background: rgba(248, 250, 252, 0.06);
	}

	.explore-titles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.explore-titles li {
		min-width: 0;
		border-top: 1px solid rgba(248, 250, 252, 0.17);
	}

	.explore-title {
		display: flex;
		min-height: 6.2rem;
		align-items: center;
		gap: 1.1rem;
		padding: 1rem 0.2rem;
		color: var(--jf-ink);
		text-decoration: none;
	}

	.explore-number {
		align-self: start;
		margin-top: 0.3rem;
		color: var(--primary);
		font-size: 0.7rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.1em;
	}

	.explore-title-copy {
		display: grid;
		min-width: 0;
		gap: 0.35rem;
	}

	.explore-title-copy strong {
		font-size: clamp(1.05rem, 1.5vw, 1.3rem);
		font-weight: 600;
		line-height: 1.3;
	}

	.explore-meta {
		color: var(--jf-ink-muted);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.explore-arrow {
		margin-left: auto;
		color: var(--jf-ink-muted);
		font-size: 1.2rem;
		transition:
			color 160ms ease,
			transform 160ms ease;
	}

	.explore-title:hover .explore-title-copy strong,
	.explore-title:focus-visible .explore-title-copy strong,
	.explore-title:hover .explore-arrow,
	.explore-title:focus-visible .explore-arrow {
		color: var(--primary);
	}

	.explore-title:hover .explore-arrow,
	.explore-title:focus-visible .explore-arrow {
		transform: translateX(2px);
	}

	.explore-more a:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
	}

	@media (max-width: 640px) {
		.explore-titles {
			grid-template-columns: minmax(0, 1fr);
		}

		.explore-title {
			min-height: 5.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.explore-more a,
		.explore-arrow {
			transition: none;
		}
	}
</style>
