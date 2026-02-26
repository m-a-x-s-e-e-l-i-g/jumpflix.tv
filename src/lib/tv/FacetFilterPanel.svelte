<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type {
		SelectedFacets,
		FacetType,
		FacetMood,
		FacetMovement,
		FacetEnvironment,
		FacetFilmStyle,
		FacetTheme,
		FacetEra,
		FacetLength
	} from './types';
	import {
		Dialog as DialogRoot,
		DialogContent,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		selectedFacets: Writable<SelectedFacets>;
	}

	let { selectedFacets }: Props = $props();

	// Facet metadata with display names and emojis (using i18n)
	const facetCategories = $derived({
		type: {
			label: m.facet_type(),
			options: [
				{ value: 'fiction', label: m.facet_type_fiction(), emoji: '🎬' },
				{ value: 'documentary', label: m.facet_type_documentary(), emoji: '📹' },
				{ value: 'session', label: m.facet_type_session(), emoji: '🎥' },
				{ value: 'event', label: m.facet_type_event(), emoji: '🏆' },
				{ value: 'tutorial', label: m.facet_type_tutorial(), emoji: '📚' },
				{ value: 'music-video', label: m.facet_type_musicVideo(), emoji: '🎵' },
				{ value: 'talk', label: m.facet_type_talk(), emoji: '🎤' }
			] as const
		},
		mood: {
			label: m.facet_mood(),
			options: [
				{ value: 'energetic', label: m.facet_mood_energetic(), emoji: '⚡' },
				{ value: 'chill', label: m.facet_mood_chill(), emoji: '😌' },
				{ value: 'gritty', label: m.facet_mood_gritty(), emoji: '🔥' },
				{ value: 'wholesome', label: m.facet_mood_wholesome(), emoji: '💚' },
				{ value: 'artistic', label: m.facet_mood_artistic(), emoji: '🎨' }
			] as const
		},
		movement: {
			label: m.facet_movement(),
			options: [
				{ value: 'flow', label: m.facet_movement_flow(), emoji: '🌊' },
				{ value: 'big-sends', label: m.facet_movement_bigSends(), emoji: '🚀' },
				{ value: 'style', label: m.facet_movement_style(), emoji: '🤸' },
				{ value: 'descents', label: m.facet_movement_descents(), emoji: '⬇️' },
				{ value: 'technical', label: m.facet_movement_technical(), emoji: '⚙️' },
				{ value: 'speed', label: m.facet_movement_speed(), emoji: '🏎️' },
				{ value: 'oldskool', label: m.facet_movement_oldskool(), emoji: '📼' },
				{ value: 'contemporary', label: m.facet_movement_contemporary(), emoji: '💃' }
			] as const
		},
		environment: {
			label: m.facet_environment(),
			options: [
				{ value: 'street', label: m.facet_environment_street(), emoji: '🏙️' },
				{ value: 'rooftops', label: m.facet_environment_rooftops(), emoji: '🏢' },
				{ value: 'nature', label: m.facet_environment_nature(), emoji: '🌲' },
				{ value: 'urbex', label: m.facet_environment_urbex(), emoji: '🏚️' },
				{ value: 'gym', label: m.facet_environment_gym(), emoji: '🏋️' }
			] as const
		},
		filmStyle: {
			label: m.facet_filmStyle(),
			options: [
				{ value: 'cinematic', label: m.facet_filmStyle_cinematic(), emoji: '🎞️' },
				{ value: 'street-cinematic', label: m.facet_filmStyle_streetCinematic(), emoji: '🛣️' },
				{ value: 'skateish', label: m.facet_filmStyle_skateish(), emoji: '🛹' },
				{ value: 'raw', label: m.facet_filmStyle_raw(), emoji: '📱' },
				{ value: 'pov', label: m.facet_filmStyle_pov(), emoji: '👁️' },
				{ value: 'longtakes', label: m.facet_filmStyle_longtakes(), emoji: '🎥' },
				{ value: 'music-driven', label: m.facet_filmStyle_musicDriven(), emoji: '🎵' },
				{ value: 'montage', label: m.facet_filmStyle_montage(), emoji: '⚡' },
				{ value: 'slowmo', label: m.facet_filmStyle_slowmo(), emoji: '🐌' },
				{ value: 'gonzo', label: m.facet_filmStyle_gonzo(), emoji: '🌀' },
				{ value: 'vintage', label: m.facet_filmStyle_vintage(), emoji: '📼' },
				{ value: 'minimalist', label: m.facet_filmStyle_minimalist(), emoji: '⬜' },
				{ value: 'experimental', label: m.facet_filmStyle_experimental(), emoji: '🔮' }
			] as const
		},
		theme: {
			label: m.facet_theme(),
			options: [
				{ value: 'journey', label: m.facet_theme_journey(), emoji: '🗺️' },
				{ value: 'team', label: m.facet_theme_team(), emoji: '👥' },
				{ value: 'competition', label: m.facet_theme_competition(), emoji: '🥇' },
				{ value: 'educational', label: m.facet_theme_educational(), emoji: '🎓' },
				{ value: 'travel', label: m.facet_theme_travel(), emoji: '✈️' },
				{ value: 'creative', label: m.facet_theme_creative(), emoji: '✨' },
				{ value: 'entertainment', label: m.facet_theme_entertainment(), emoji: '🎪' }
			] as const
		},
		era: {
			label: m.facet_era(),
			options: [
				{ value: 'pre-2000', label: m.facet_era_pre2000(), emoji: '📹' },
				{ value: '2000s', label: m.facet_era_2000s(), emoji: '📀' },
				{ value: '2010s', label: m.facet_era_2010s(), emoji: '📱' },
				{ value: '2020s', label: m.facet_era_2020s(), emoji: '🎬' },
				{ value: '2030s', label: m.facet_era_2030s(), emoji: '🚀' }
			] as const
		},
		length: {
			label: m.facet_length(),
			options: [
				{ value: 'short-form', label: m.facet_length_shortForm(), emoji: '⚡' },
				{ value: 'medium-form', label: m.facet_length_mediumForm(), emoji: '⏱️' },
				{ value: 'long-form', label: m.facet_length_longForm(), emoji: '🎞️' }
			] as const
		}
	});

	let isOpen = $state(false);

	function toggleFacet(category: keyof SelectedFacets, value: string) {
		selectedFacets.update((current) => {
			const updated = { ...current };
			const currentValues = (updated[category] || []) as unknown[];

			if (currentValues.includes(value)) {
				// Remove the value
				updated[category] = (currentValues.filter((v) => v !== value) as unknown) as any;
			} else {
				// Add the value
				updated[category] = ([...currentValues, value] as unknown) as any;
			}

			return updated;
		});
	}

	function isFacetSelected(category: keyof SelectedFacets, value: string): boolean {
		const values = $selectedFacets[category] as unknown;
		return Array.isArray(values) && (values as unknown[]).includes(value);
	}

	function clearAllFilters() {
		selectedFacets.set({});
	}

	const hasAnyFilters = $derived(
		Object.values($selectedFacets).some((arr) => Array.isArray(arr) && arr.length > 0)
	);
	const filterCount = $derived(
		Object.values($selectedFacets).reduce(
			(sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
			0
		)
	);
</script>

<button class="filter-toggle" onclick={() => (isOpen = true)} aria-label="Open facet filters">
	<span class="filter-icon">
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
			/>
		</svg>
	</span>
	<span class="filter-text">{m.facet_filters()}</span>
	{#if filterCount > 0}
		<span class="filter-badge">{filterCount}</span>
	{/if}
</button>

<DialogRoot bind:open={isOpen}>
	<DialogContent class="max-h-[85vh] max-w-3xl overflow-y-auto">
		<div class="dialog-header-with-action">
			<DialogHeader>
				<DialogTitle>{m.facet_filterByFacets()}</DialogTitle>
			</DialogHeader>
			{#if hasAnyFilters}
				<button class="clear-button" onclick={clearAllFilters}>
					{m.facet_clearAll()}
				</button>
			{/if}
		</div>

		<div class="filter-categories">
			{#each Object.entries(facetCategories) as [categoryKey, category]}
				<div class="filter-category">
					<h4 class="category-label">{category.label}</h4>
					<div class="facet-chips">
						{#each category.options as option}
							{@const isSelected = isFacetSelected(
								categoryKey as keyof SelectedFacets,
								option.value
							)}
							<button
								class="facet-chip"
								class:selected={isSelected}
								onclick={() => toggleFacet(categoryKey as keyof SelectedFacets, option.value)}
								aria-pressed={isSelected}
							>
								<span class="chip-emoji">{option.emoji}</span>
								<span class="chip-label">{option.label}</span>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</DialogContent>
</DialogRoot>

<style>
	.dialog-header-with-action {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.filter-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 999px;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: rgba(8, 12, 24, 0.65);
		padding: 0.6rem 1rem;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(226, 232, 240, 0.85);
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.filter-toggle:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 30px -22px rgba(2, 6, 23, 0.55);
		background: rgba(8, 12, 24, 0.8);
	}

	.filter-icon {
		display: flex;
		align-items: center;
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		background: rgba(229, 9, 20, 0.8);
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 700;
		color: white;
	}

	.clear-button {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(229, 9, 20, 0.9);
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		transition: all 0.2s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.clear-button:hover {
		background: rgba(229, 9, 20, 0.1);
		color: rgba(229, 9, 20, 1);
	}

	.filter-categories {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.filter-category {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.category-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(226, 232, 240, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.facet-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.facet-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 500;
		color: rgba(226, 232, 240, 0.85);
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.facet-chip:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.facet-chip.selected {
		background: rgba(229, 9, 20, 0.3);
		border-color: rgba(229, 9, 20, 0.6);
		color: rgba(248, 250, 252, 0.95);
	}

	.facet-chip.selected:hover {
		background: rgba(229, 9, 20, 0.4);
		border-color: rgba(229, 9, 20, 0.8);
	}

	.chip-emoji {
		font-size: 0.875rem;
		line-height: 1;
	}

	.chip-label {
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.filter-toggle {
			padding: 0.5rem 0.8rem;
			font-size: 0.65rem;
		}

		.facet-chips {
			gap: 0.4rem;
		}

		.facet-chip {
			padding: 0.35rem 0.6rem;
			font-size: 0.7rem;
		}
	}
</style>
