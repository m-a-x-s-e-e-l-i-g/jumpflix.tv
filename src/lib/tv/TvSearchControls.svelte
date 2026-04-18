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
				<span class="feed-strip-label jf-label">{m.tv_feedStripLabel()}</span>
				<p class="feed-strip-text">{m.tv_feedStripDescription()}</p>
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
						<span class="feed-card-title">{feed.title()}</span>
						<span class="feed-card-description">{feed.description()}</span>
					</button>
				{/each}
			</div>

			{#if $activeFeedSlug}
				<button type="button" class="feed-reset" onclick={clearFeed}>{m.tv_clearFeed()}</button>
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
						aria-label={m.tv_clearSearch()}
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
					aria-label={m.tv_searchAria()}
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
				  <select value={$sortBy} onchange={handleSortChange} class={selectClass} aria-label={m.tv_sortLabel()}>
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
		--search-border: color-mix(in oklch, var(--foreground) 12%, transparent);
		--search-border-strong: color-mix(in oklch, var(--foreground) 18%, transparent);
		--search-field-bg: color-mix(in oklch, var(--card) 62%, transparent);
		--search-field-bg-soft: color-mix(in oklch, var(--card) 54%, transparent);
		--search-surface-bg: linear-gradient(
			155deg,
			color-mix(in oklch, var(--background) 46%, transparent),
			color-mix(in oklch, var(--card) 50%, transparent)
		);
		--search-accent-soft: color-mix(in oklch, var(--primary) 18%, transparent);
		--search-accent-border: color-mix(in oklch, var(--primary) 46%, transparent);
		--search-shadow: 0 40px 100px -55px rgba(2, 6, 23, 0.9);
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
		border: 1px solid var(--search-border-strong);
		background: var(--search-surface-bg);
		backdrop-filter: blur(28px) saturate(116%);
		-webkit-backdrop-filter: blur(28px) saturate(116%);
		box-shadow: var(--search-shadow);
		overflow: hidden;
	}

	.tv-search-surface::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background:
			radial-gradient(120% 110% at 10% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 62%),
			radial-gradient(90% 90% at 100% 0%, color-mix(in oklch, var(--foreground) 6%, transparent), transparent 68%),
			linear-gradient(180deg, color-mix(in oklch, var(--foreground) 4%, transparent), transparent 26%);
		opacity: 1;
		pointer-events: none;
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
		color: color-mix(in oklch, var(--foreground) 94%, transparent);
	}

	.feed-strip-text {
		font-size: 0.82rem;
		line-height: 1.55;
		max-width: 60ch;
		color: color-mix(in oklch, var(--muted-foreground) 88%, transparent);
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
		border: 1px solid var(--search-border);
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--foreground) 5%, transparent),
				color-mix(in oklch, var(--foreground) 1.5%, transparent)
			),
			var(--search-field-bg);
		backdrop-filter: blur(18px) saturate(110%);
		-webkit-backdrop-filter: blur(18px) saturate(110%);
		padding: 0.95rem 1rem;
		text-align: left;
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.feed-card:hover,
	.feed-card:focus-visible {
		transform: translateY(-1px);
		border-color: var(--search-accent-border);
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--primary) 14%, transparent),
				color-mix(in oklch, var(--foreground) 3%, transparent)
			),
			color-mix(in oklch, var(--card) 78%, transparent);
		box-shadow:
			0 0 0 1px color-mix(in oklch, var(--primary) 16%, transparent),
			0 20px 40px -32px rgba(2, 6, 23, 0.9);
		outline: none;
	}

	.feed-card.selected {
		border-color: color-mix(in oklch, var(--primary) 58%, transparent);
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--primary) 18%, transparent),
				color-mix(in oklch, var(--foreground) 4%, transparent)
			),
			color-mix(in oklch, var(--card) 82%, transparent);
		box-shadow:
			inset 0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent),
			0 18px 38px -30px rgba(65, 9, 16, 0.54);
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
		color: color-mix(in oklch, var(--muted-foreground) 88%, transparent);
	}

	.feed-reset {
		justify-self: start;
		border-radius: 999px;
		border: 1px solid var(--search-border-strong);
		background: var(--search-field-bg-soft);
		backdrop-filter: blur(12px) saturate(106%);
		-webkit-backdrop-filter: blur(12px) saturate(106%);
		padding: 0.5rem 0.85rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--muted-foreground) 92%, transparent);
		transition:
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.feed-reset:hover,
	.feed-reset:focus-visible {
		border-color: var(--search-accent-border);
		background: var(--search-accent-soft);
		color: color-mix(in oklch, var(--foreground) 96%, transparent);
		outline: none;
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
		color: color-mix(in oklch, var(--foreground) 82%, transparent);
		filter: drop-shadow(0 1px 8px color-mix(in oklch, var(--background) 40%, transparent));
	}

	.search-clear {
		position: absolute;
		right: 1rem;
		top: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		width: 2rem;
		border-radius: 999px;
		border: 1px solid transparent;
		background: transparent;
		transform: translateY(-50%);
		padding: 0.2rem;
		color: color-mix(in oklch, var(--muted-foreground) 80%, transparent);
		transition:
			color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.search-clear:hover,
	.search-clear:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 28%, transparent);
		background: var(--search-accent-soft);
		color: color-mix(in oklch, var(--foreground) 96%, transparent);
		outline: none;
	}

	.search-field {
		width: 100%;
		height: 3.1rem;
		border-radius: 22px;
		border: 1px solid var(--search-border);
		background: var(--search-field-bg);
		backdrop-filter: blur(16px) saturate(108%);
		-webkit-backdrop-filter: blur(16px) saturate(108%);
		padding: 0 3rem 0 3rem;
		font-size: 0.9rem;
		color: color-mix(in oklch, var(--foreground) 94%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--foreground) 4%, transparent);
		transition:
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.search-field::placeholder {
		color: color-mix(in oklch, var(--muted-foreground) 80%, transparent);
	}

	.search-field:focus {
		outline: none;
		border-color: var(--search-accent-border);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent);
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
		border: 1px solid var(--search-border-strong);
		background: var(--search-field-bg-soft);
		backdrop-filter: blur(16px) saturate(108%);
		-webkit-backdrop-filter: blur(16px) saturate(108%);
		padding: 0.6rem 1rem;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: color-mix(in oklch, var(--foreground) 88%, transparent);
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.tv-search-toggle:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 30px -22px rgba(2, 6, 23, 0.55);
		border-color: color-mix(in oklch, var(--foreground) 24%, transparent);
	}

	.search-select {
		position: relative;
		min-width: 180px;
	}

	.tv-search-select {
		appearance: none;
		width: 100%;
		border-radius: 18px;
		border: 1px solid var(--search-border-strong);
		background: var(--search-field-bg-soft);
		backdrop-filter: blur(16px) saturate(108%);
		-webkit-backdrop-filter: blur(16px) saturate(108%);
		padding: 0.6rem 2.4rem 0.6rem 1rem;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: color-mix(in oklch, var(--foreground) 90%, transparent);
		transition:
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
		color-scheme: dark;
	}

	.tv-search-select:focus {
		outline: none;
		border-color: var(--search-accent-border);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent);
	}

	.search-caret {
		pointer-events: none;
		position: absolute;
		top: 50%;
		right: 1rem;
		transform: translateY(-50%);
		color: color-mix(in oklch, var(--muted-foreground) 84%, transparent);
	}

	.tv-search-select option {
		background-color: rgb(15, 23, 42);
		color: rgb(226, 232, 240);
	}

	@media (prefers-reduced-motion: reduce) {
		.feed-card,
		.feed-reset,
		.search-clear,
		.search-field,
		.tv-search-toggle,
		.tv-search-select {
			transition: none;
		}

		.feed-card:hover,
		.feed-card:focus-visible,
		.tv-search-toggle:hover {
			transform: none;
		}
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
