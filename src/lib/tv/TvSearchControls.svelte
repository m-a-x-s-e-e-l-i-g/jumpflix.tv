<script lang="ts">
  import type { Writable } from 'svelte/store';
  import Switch from '$lib/components/ui/Switch.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { SortBy, SelectedFacets } from '$lib/tv/types';
  import { FEEDS } from '$lib/tv/feeds';
  import FacetFilterPanel from './FacetFilterPanel.svelte';

	interface Props {
		searchQuery: Writable<string>;
		showPaid: Writable<boolean>;
		showWatched: Writable<boolean>;
		sortBy: Writable<SortBy>;
		selectedFacets: Writable<SelectedFacets>;
		activeFeedSlug: Writable<string | null>;
	}

	let { searchQuery, showPaid, showWatched, sortBy, selectedFacets, activeFeedSlug }: Props =
		$props();

	function clearSearch() {
		searchQuery.set('');
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery.set(target.value);
	}

	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		sortBy.set(target.value as SortBy);
	}

	function toggleFeed(slug: string) {
		activeFeedSlug.update((current) => (current === slug ? null : slug));
	}

	function clearFeed() {
		activeFeedSlug.set(null);
	}

  const containerClass = 'tv-search-surface';
  const labelClass = 'tv-search-toggle';
  const selectClass = 'tv-search-select';
  const sortOptions: Array<{ value: SortBy; label: () => string }> = [
    { value: 'default', label: () => m.tv_sort_random() },
    { value: 'added-desc', label: () => m.tv_sort_addedDesc() },
    { value: 'title-asc', label: () => m.tv_sort_titleAsc() },
    { value: 'year-desc', label: () => m.tv_sort_yearDesc() },
    { value: 'year-asc', label: () => m.tv_sort_yearAsc() },
    { value: 'duration-asc', label: () => m.tv_sort_durationAsc() },
    { value: 'duration-desc', label: () => m.tv_sort_durationDesc() },
    { value: 'rating-desc', label: () => m.tv_sort_ratingDesc() },
    { value: 'rating-asc', label: () => m.tv_sort_ratingAsc() }
  ];
</script>

<div id="search" class="search-wrap">
	<div class={containerClass}>
		<div class="feed-strip">
			<div class="feed-strip-copy">
				<span class="feed-strip-label">Curated feeds</span>
				<p class="feed-strip-text">Preset combinations built from the facet system.</p>
			</div>

			<div class="feed-strip-grid">
				{#each FEEDS as feed (feed.slug)}
					<button
						type="button"
						class="feed-card"
						class:selected={$activeFeedSlug === feed.slug}
						onclick={() => toggleFeed(feed.slug)}
						aria-pressed={$activeFeedSlug === feed.slug}
					>
						<span class="feed-card-title">{feed.title}</span>
						<span class="feed-card-description">{feed.description}</span>
					</button>
				{/each}
			</div>

			{#if $activeFeedSlug}
				<button type="button" class="feed-reset" onclick={clearFeed}>Clear feed</button>
			{/if}
		</div>

		<div class="search-grid">
			<form class="search-input" onsubmit={(event) => event.preventDefault()}>
				<span class="search-icon" aria-hidden="true">
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
						/>
					</svg>
				</span>
				{#if $searchQuery}
					<button
						type="button"
						class="search-clear"
						onclick={clearSearch}
						aria-label="Clear search"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							stroke="currentColor"
							fill="none"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
				<input
					value={$searchQuery}
					oninput={handleInput}
					type="text"
					autocomplete="off"
					spellcheck="false"
					placeholder={m.tv_searchPlaceholder()}
					aria-label="Search content"
					class="search-field"
				/>
				<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
			</form>

			<div class="search-controls">
				<FacetFilterPanel {selectedFacets} {activeFeedSlug} />

				<div class="search-toggle-row">
					<label class={labelClass}>
						<span>{m.tv_showPaid()}</span>
						<Switch bind:checked={$showPaid} ariaLabel={m.tv_showPaid()} />
					</label>

					<label class={labelClass}>
						<span>{m.tv_showWatched()}</span>
						<Switch bind:checked={$showWatched} ariaLabel={m.tv_showWatched()} />
					</label>
				</div>

        <div class="search-select">
          <select value={$sortBy} onchange={handleSortChange} class={selectClass}>
            {#each sortOptions as option (option.value)}
              <option value={option.value}>{option.label()}</option>
            {/each}
          </select>
          <span class="search-caret" aria-hidden="true">▾</span>
        </div>
			</div>
		</div>
	</div>
</div>


<style>
	.search-wrap {
		position: relative;
		z-index: 10;
		margin: 0;
		width: 100%;
		max-width: none;
		padding: 0 clamp(1.5rem, 3vw, 3.75rem);
	}

	.tv-search-surface {
		position: relative;
		border-radius: 30px;
		padding: 1.6rem;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: linear-gradient(155deg, rgba(14, 19, 36, 0.96), rgba(10, 14, 26, 0.88));
		box-shadow: 0 40px 100px -55px rgba(2, 6, 23, 0.9);
		overflow: hidden;
	}

	.tv-search-surface::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(130deg, rgba(229, 9, 20, 0.14), rgba(37, 99, 235, 0.16));
		opacity: 0.9;
		pointer-events: none;
		mix-blend-mode: screen;
	}

	.feed-strip {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.feed-strip-copy {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.feed-strip-label {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(248, 250, 252, 0.92);
	}

	.feed-strip-text {
		font-size: 0.82rem;
		color: rgba(226, 232, 240, 0.68);
	}

	.feed-strip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.feed-card {
		display: grid;
		gap: 0.35rem;
		min-height: 5.5rem;
		align-content: start;
		border-radius: 22px;
		border: 1px solid rgba(248, 250, 252, 0.12);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
			rgba(7, 10, 20, 0.72);
		padding: 0.95rem 1rem;
		text-align: left;
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			background 0.18s ease,
			box-shadow 0.18s ease;
	}

	.feed-card:hover,
	.feed-card:focus-visible {
		transform: translateY(-1px);
		border-color: rgba(229, 9, 20, 0.35);
		background:
			linear-gradient(180deg, rgba(229, 9, 20, 0.12), rgba(59, 130, 246, 0.08)),
			rgba(7, 10, 20, 0.82);
		box-shadow: 0 20px 40px -32px rgba(2, 6, 23, 0.9);
	}

	.feed-card.selected {
		border-color: rgba(229, 9, 20, 0.48);
		background:
			linear-gradient(180deg, rgba(229, 9, 20, 0.18), rgba(59, 130, 246, 0.1)),
			rgba(7, 10, 20, 0.88);
		box-shadow: inset 0 0 0 1px rgba(229, 9, 20, 0.18);
	}

	.feed-card-title {
		font-size: 0.88rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: rgba(248, 250, 252, 0.96);
	}

	.feed-card-description {
		font-size: 0.76rem;
		line-height: 1.45;
		color: rgba(226, 232, 240, 0.68);
	}

	.feed-reset {
		justify-self: start;
		border-radius: 999px;
		border: 1px solid rgba(248, 250, 252, 0.18);
		background: rgba(7, 10, 20, 0.72);
		padding: 0.5rem 0.85rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.8);
	}

	.feed-reset:hover,
	.feed-reset:focus-visible {
		border-color: rgba(248, 250, 252, 0.3);
		color: rgba(248, 250, 252, 0.96);
	}

	.search-grid {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 1.2rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		align-items: center;
	}

	.search-input {
		position: relative;
		min-width: 240px;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
		color: rgba(226, 232, 240, 0.6);
	}

	.search-clear {
		position: absolute;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		border-radius: 999px;
		padding: 0.2rem;
		color: rgba(226, 232, 240, 0.6);
		transition: color 0.2s ease;
	}

	.search-clear:hover {
		color: rgba(248, 250, 252, 0.9);
	}

	.search-field {
		width: 100%;
		height: 3.1rem;
		border-radius: 22px;
		border: 1px solid rgba(248, 250, 252, 0.15);
		background: rgba(7, 10, 20, 0.72);
		padding: 0 3rem 0 3rem;
		font-size: 0.9rem;
		color: rgba(248, 250, 252, 0.92);
		box-shadow: inset 0 0 0 1px rgba(248, 250, 252, 0.04);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.search-field:focus {
		outline: none;
		border-color: rgba(229, 9, 20, 0.6);
		box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.2);
	}

	.search-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		justify-content: flex-start;
		align-items: center;
	}

	.search-toggle-row {
		display: contents;
	}

	.tv-search-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		border-radius: 999px;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: rgba(8, 12, 24, 0.65);
		padding: 0.6rem 1rem;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(226, 232, 240, 0.85);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.tv-search-toggle:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 30px -22px rgba(2, 6, 23, 0.55);
	}

	.search-select {
		position: relative;
		min-width: 180px;
	}

	.tv-search-select {
		appearance: none;
		width: 100%;
		border-radius: 18px;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: rgba(10, 14, 26, 0.7);
		padding: 0.6rem 2.4rem 0.6rem 1rem;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: rgba(226, 232, 240, 0.9);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		color-scheme: dark;
	}

	.tv-search-select:focus {
		outline: none;
		border-color: rgba(229, 9, 20, 0.6);
		box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.2);
	}

	.search-caret {
		pointer-events: none;
		position: absolute;
		top: 50%;
		right: 1rem;
		transform: translateY(-50%);
		color: rgba(226, 232, 240, 0.7);
	}

	.tv-search-select option {
		background-color: rgb(15, 23, 42);
		color: rgb(226, 232, 240);
	}

	@media (max-width: 1024px) and (min-width: 641px) {
		.feed-strip-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.feed-card {
			min-height: 4.5rem;
			padding: 0.8rem 0.9rem;
		}

		.feed-card-description {
			display: -webkit-box;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			overflow: hidden;
		}

		.search-grid {
			grid-template-columns: 1fr;
		}

		.search-controls {
			display: grid;
			grid-template-columns: repeat(3, max-content) minmax(220px, 1fr);
			gap: 0.75rem;
			align-items: center;
		}

		.search-toggle-row {
			display: contents;
		}

		.search-select {
			min-width: 220px;
			justify-self: stretch;
		}
	}

	@media (max-width: 640px) {
		.tv-search-surface {
			padding: 1.2rem;
			border-radius: 24px;
		}

		.feed-strip {
			gap: 0.7rem;
			margin-bottom: 0.9rem;
		}

		.feed-strip-copy {
			gap: 0.35rem;
		}

		.feed-strip-text {
			display: none;
		}

		.feed-strip-grid {
			display: flex;
			gap: 0.55rem;
			overflow-x: auto;
			padding-bottom: 0.2rem;
			scrollbar-width: none;
			-webkit-overflow-scrolling: touch;
		}

		.feed-strip-grid::-webkit-scrollbar {
			display: none;
		}

		.feed-card {
			flex: 0 0 auto;
			min-height: 0;
			min-width: 132px;
			max-width: 168px;
			gap: 0.15rem;
			border-radius: 16px;
			padding: 0.65rem 0.75rem;
		}

		.feed-card-title {
			font-size: 0.76rem;
			line-height: 1.2;
		}

		.feed-card-description {
			display: none;
		}

		.feed-reset {
			padding: 0.4rem 0.7rem;
			font-size: 0.6rem;
		}

		.search-controls {
			flex-direction: column;
			align-items: flex-start;
		}

		.search-toggle-row {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.65rem;
			width: 100%;
		}

		.search-toggle-row :global(.tv-search-toggle) {
			justify-content: space-between;
			width: 100%;
		}

		.tv-search-select {
			border-radius: 16px;
		}
	}
</style>
