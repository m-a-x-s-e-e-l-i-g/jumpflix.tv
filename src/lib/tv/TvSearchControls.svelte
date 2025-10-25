<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Writable } from 'svelte/store';
	import Switch from '$lib/components/ui/Switch.svelte';
	import * as m from '$lib/paraglide/messages';
	import { sortLabels } from '$lib/tv/utils';
	import type { SortBy } from '$lib/tv/types';

	interface Props {
		searchQuery: Writable<string>;
		showPaid: Writable<boolean>;
		sortBy: Writable<SortBy>;
	}

	let { searchQuery, showPaid, sortBy }: Props = $props();

	let isSticky = $state(false);
	let searchElement: HTMLElement | null = null;
	let searchOffsetTop = 0;

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

	const containerClass = 'tv-search-surface';
	const labelClass = 'tv-search-toggle';
	const selectClass = 'tv-search-select';

	onMount(() => {
		if (!browser) return;

		searchElement = document.getElementById('search');
		if (searchElement) {
			searchOffsetTop = searchElement.offsetTop;
		}

		const handleScroll = () => {
			if (!searchElement) return;

			// Update sticky state based on scroll position
			const scrollTop = window.scrollY || document.documentElement.scrollTop;
			isSticky = scrollTop > searchOffsetTop - 20; // Add small buffer
		};

		const updateOffset = () => {
			if (searchElement && !isSticky) {
				searchOffsetTop = searchElement.offsetTop;
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', updateOffset);

		// Initial check
		handleScroll();

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', updateOffset);
		};
	});
</script>

<div id="search" class="search-wrapper" class:sticky={isSticky}>
	<div class={containerClass}>
		{#if isSticky}
			<a href="/" class="logo-container" aria-label="JUMPFLIX Home">
				<img src="/images/jumpflix.webp" alt="JUMPFLIX" class="logo-image" />
			</a>
		{/if}
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center" class:with-logo={isSticky}>
			<form class="group relative min-w-[260px] flex-1" on:submit|preventDefault>
				<span
					class="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-gray-700 transition-colors group-focus-within:text-[#e50914] dark:text-gray-400 dark:group-focus-within:text-[#f87171]"
				>
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
						class="absolute inset-y-0 right-3 z-10 flex items-center rounded-md p-1 text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-[#e50914] focus:ring-offset-2 focus:ring-offset-white/40 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200 dark:focus:ring-offset-slate-950/70"
						on:click={clearSearch}
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
					on:input={handleInput}
					type="text"
					autocomplete="off"
					spellcheck="false"
					placeholder={m.tv_searchPlaceholder()}
					aria-label="Search content"
					class="h-12 w-full rounded-2xl border border-white/50 bg-white/60 pr-12 text-sm text-gray-900 placeholder-gray-600 shadow-sm transition focus:border-[#e50914]/80 focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-gray-100 dark:placeholder-gray-400"
					style="padding-left: 3rem;"
				/>
				<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
			</form>

			<div
				class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center lg:justify-end lg:pl-6"
			>
				<label class={labelClass}>
					<span>{m.tv_showPaid()}</span>
					<Switch
						checked={$showPaid}
						ariaLabel={m.tv_showPaid()}
						on:change={(event) => showPaid.set(event.detail)}
					/>
				</label>

				<div class="relative min-w-[170px]">
					<select value={$sortBy} on:change={handleSortChange} class={selectClass}>
						{#each Object.entries(sortLabels) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
					<span
						class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-600 dark:text-gray-300"
						>▾</span
					>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.search-wrapper {
		position: relative;
		z-index: 10;
		margin: 0 auto;
		margin-top: 7.5rem;
		width: 100%;
		max-width: 80rem;
		transition: all 0.3s ease;
	}

	.search-wrapper.sticky {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		margin-top: 0;
		z-index: 50;
		padding: 0.75rem 1.5rem;
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .search-wrapper.sticky {
		background: rgba(15, 23, 42, 0.98);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.tv-search-surface {
		position: relative;
		border-radius: 28px;
		padding: 1.5rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(248, 250, 252, 0.7));
		box-shadow:
			0 35px 90px -45px rgba(15, 23, 42, 0.6),
			0 18px 40px -32px rgba(15, 23, 42, 0.35);
		overflow: hidden;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.sticky .tv-search-surface {
		border-radius: 20px;
		padding: 1rem 1.5rem;
		box-shadow: none;
	}

	.tv-search-surface::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(120deg, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0) 60%);
		opacity: 0.7;
		pointer-events: none;
		mix-blend-mode: screen;
	}

	:global(.dark) .tv-search-surface {
		border-color: rgba(148, 163, 184, 0.15);
		background: linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.68));
		box-shadow:
			0 35px 100px -50px rgba(2, 6, 23, 0.8),
			0 18px 50px -38px rgba(2, 6, 23, 0.65);
	}

	:global(.dark) .tv-search-surface::before {
		background: linear-gradient(130deg, rgba(59, 130, 246, 0.18), rgba(244, 114, 182, 0.14));
		opacity: 0.85;
	}

	.logo-container {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-right: 0.5rem;
		transition: transform 0.2s ease;
	}

	.logo-container:hover {
		transform: scale(1.05);
	}

	.logo-image {
		height: 48px;
		width: auto;
		object-fit: contain;
		filter: drop-shadow(0 4px 8px rgba(229, 9, 20, 0.3));
	}

	.with-logo {
		flex: 1;
	}

	.tv-search-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-radius: 20px;
		border: 1px solid rgba(148, 163, 184, 0.32);
		background: linear-gradient(140deg, rgba(255, 255, 255, 0.78), rgba(248, 250, 252, 0.55));
		padding: 0.75rem 1rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: rgba(71, 85, 105, 0.95);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.tv-search-toggle:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.45);
	}

	:global(.dark) .tv-search-toggle {
		border-color: rgba(148, 163, 184, 0.25);
		background: linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.66));
		color: rgba(226, 232, 240, 0.9);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
	}

	.tv-search-select {
		appearance: none;
		width: 100%;
		border-radius: 18px;
		border: 1px solid rgba(148, 163, 184, 0.28);
		background: linear-gradient(140deg, rgba(255, 255, 255, 0.88), rgba(248, 250, 252, 0.64));
		padding: 0.65rem 2.6rem 0.65rem 1rem;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.11em;
		color: rgba(30, 41, 59, 0.95);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.tv-search-select:focus {
		outline: none;
		border-color: rgba(229, 9, 20, 0.65);
		box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.16);
	}

	:global(.dark) .tv-search-select {
		border-color: rgba(148, 163, 184, 0.35);
		background: linear-gradient(150deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.76));
		color: rgba(226, 232, 240, 0.95);
	}

	:global(.dark) .tv-search-select:focus {
		border-color: rgba(244, 114, 182, 0.55);
		box-shadow: 0 0 0 3px rgba(244, 114, 182, 0.15);
	}

	@media (max-width: 640px) {
		.tv-search-surface {
			padding: 1.25rem;
			border-radius: 24px;
		}

		.sticky .tv-search-surface {
			padding: 0.875rem 1rem;
			border-radius: 16px;
		}

		.logo-image {
			height: 40px;
		}

		.tv-search-select {
			border-radius: 16px;
		}
	}
</style>
