<script lang="ts">
	import type { Facets } from '$lib/tv/types';
	import * as Tooltip from '$lib/components/ui/tooltip';

	export let facets: Facets | undefined;

	// Comprehensive facet metadata with descriptions and emojis
	interface FacetMetadata {
		label: string;
		description: string;
		emoji: string;
	}

	const facetMetadata: Record<string, FacetMetadata> = {
		// Type
		fiction: {
			label: 'Fiction',
			description: 'Narrative-driven parkour film with storyline',
			emoji: '🎬'
		},
		documentary: {
			label: 'Documentary',
			description: 'Real stories and insights into parkour culture',
			emoji: '📹'
		},
		session: {
			label: 'Session',
			description: 'Team edit or session footage from training',
			emoji: '🎥'
		},
		event: {
			label: 'Event',
			description: 'Jam, competition, or organized gathering',
			emoji: '🏆'
		},
		tutorial: {
			label: 'Tutorial',
			description: 'Educational content teaching parkour techniques',
			emoji: '📚'
		},

		// Mood
		energetic: {
			label: 'Energetic',
			description: 'High-energy vibe with intense action',
			emoji: '⚡'
		},
		chill: {
			label: 'Chill',
			description: 'Relaxed and laid-back atmosphere',
			emoji: '😌'
		},
		gritty: {
			label: 'Gritty',
			description: 'Raw, rough, and unpolished street vibe',
			emoji: '🔥'
		},
		wholesome: {
			label: 'Wholesome',
			description: 'Positive, uplifting, and feel-good content',
			emoji: '💚'
		},
		artistic: {
			label: 'Artistic',
			description: 'Creative expression and aesthetic focus',
			emoji: '🎨'
		},

		// Movement
		flow: {
			label: 'Flow',
			description: 'Continuous, fluid movement lines',
			emoji: '🌊'
		},
		'big-sends': {
			label: 'Big Sends',
			description: 'Scary jumps, rooftops, and fear challenges',
			emoji: '🚀'
		},
		style: {
			label: 'Style',
			description: 'Heavy acrobatic lines and combos',
			emoji: '🤸'
		},
		technical: {
			label: 'Technical',
			description: 'Precise, German, quirky, and technical movements',
			emoji: '⚙️'
		},
		speed: {
			label: 'Speed/Chase',
			description: 'Fast-paced running and chase sequences',
			emoji: '🏎️'
		},
		oldskool: {
			label: 'Oldskool',
			description: 'Classic parkour fundamentals and basics',
			emoji: '📼'
		},
		contemporary: {
			label: 'Contemporary',
			description: 'Dance-like movements and fluid transitions',
			emoji: '💃'
		},

		// Environment
		street: {
			label: 'Street',
			description: 'Urban street spots and city locations',
			emoji: '🏙️'
		},
		rooftops: {
			label: 'Rooftops',
			description: 'High-altitude rooftop training and jumps',
			emoji: '🏢'
		},
		nature: {
			label: 'Nature',
			description: 'Outdoor natural environments and landscapes',
			emoji: '🌲'
		},
		urbex: {
			label: 'Urbex',
			description: 'Abandoned buildings and urban exploration',
			emoji: '🏚️'
		},
		gym: {
			label: 'Gym',
			description: 'Indoor training facilities and parkour gyms',
			emoji: '🏋️'
		},

		// Film Style
		cinematic: {
			label: 'Cinematic',
			description: 'Smooth camera work, controlled shots, strong color grade',
			emoji: '🎞️'
		},
		'street-cinematic': {
			label: 'Street-Cinematic',
			description: 'DSLR stability + fisheye inserts, clean yet gritty',
			emoji: '🛣️'
		},
		skateish: {
			label: 'Skate-ish',
			description: 'VX/handcam energy, fisheye close-ups, rough and fast',
			emoji: '🛹'
		},
		raw: {
			label: 'Raw Session',
			description: 'No polish. Real sound, breathing, slips, banter',
			emoji: '📱'
		},
		pov: {
			label: 'POV',
			description: 'First-person or tight follow angle, immersive',
			emoji: '👁️'
		},
		longtakes: {
			label: 'Long Takes',
			description: 'Minimal cuts, continuous routes, flow and timing',
			emoji: '🎥'
		},
		'music-driven': {
			label: 'Music-Driven',
			description: 'Editing rhythms follow the soundtrack, beat-matched',
			emoji: '🎵'
		},
		montage: {
			label: 'Montage',
			description: 'Quick cuts, hype, best moments stacked',
			emoji: '⚡'
		},
		slowmo: {
			label: 'Slowmo',
			description: 'Slow motion used to show form, weight shift, control',
			emoji: '🐌'
		},
		gonzo: {
			label: 'Gonzo',
			description: 'Handheld chaos, shaky, crowd energy, in the middle of it',
			emoji: '🌀'
		},
		vintage: {
			label: 'Vintage',
			description: 'MiniDV, Hi8, 4:3, film grain, nostalgic skate-era vibes',
			emoji: '📼'
		},
		minimalist: {
			label: 'Minimalist',
			description: 'Calm framing, few edits, open space, quiet mood',
			emoji: '⬜'
		},
		experimental: {
			label: 'Experimental',
			description: 'Non-linear, surreal cuts, visual abstraction',
			emoji: '🔮'
		},

		// Theme
		journey: {
			label: 'Journey',
			description: 'Personal growth and transformation story',
			emoji: '🗺️'
		},
		team: {
			label: 'Team Film',
			description: 'Showcasing team identity and crew dynamics',
			emoji: '👥'
		},
		competition: {
			label: 'Competition',
			description: 'Contest or competitive event coverage',
			emoji: '🥇'
		},
		educational: {
			label: 'Educational',
			description: 'Teaching techniques and parkour knowledge',
			emoji: '🎓'
		},
		travel: {
			label: 'Travel',
			description: 'Exploring new locations and spots around the world',
			emoji: '✈️'
		},
		creative: {
			label: 'Creative',
			description: 'Artistic expression and experimental filmmaking',
			emoji: '✨'
		},
		entertainment: {
			label: 'Entertainment',
			description: 'Showcase and entertainment-focused content',
			emoji: '🎪'
		},

		// Era (auto)
		'2000s': {
			label: '2000s',
			description: 'Released in the 2000s',
			emoji: '📀'
		},
		'2010s': {
			label: '2010s',
			description: 'Released in the 2010s',
			emoji: '📱'
		},
		'2020s': {
			label: '2020s',
			description: 'Released in the 2020s',
			emoji: '🎬'
		},
		'2030s': {
			label: '2030s',
			description: 'Released in the 2030s',
			emoji: '🚀'
		},
		'pre-2000': {
			label: 'Pre-2000',
			description: 'Released before 2000',
			emoji: '📹'
		}
	};

	// Helper to get metadata with fallback
	const getMetadata = (key: string): FacetMetadata => {
		return (
			facetMetadata[key] || {
				label: key,
				description: '',
				emoji: ''
			}
		);
	};

	// Helper to add facets to result array
	const addFacet = (
		result: Array<{ key: string; metadata: FacetMetadata }>,
		key: string | string[]
	) => {
		if (Array.isArray(key)) {
			key.forEach((k) => result.push({ key: k, metadata: getMetadata(k) }));
		} else {
			result.push({ key, metadata: getMetadata(key) });
		}
	};

	// Build ordered list of chips to display
	// Order: Type · Mood · Movement · Environment · Film Style · Theme · Era
	$: chips = (() => {
		if (!facets) return [];

		const result: Array<{ key: string; metadata: FacetMetadata }> = [];

		// Add facets in order, skipping any that are undefined or empty
		if (facets.type) addFacet(result, facets.type);
		if (facets.mood?.length) addFacet(result, facets.mood);
		if (facets.movement?.length) addFacet(result, facets.movement);
		if (facets.environment) addFacet(result, facets.environment);
		if (facets.filmStyle) addFacet(result, facets.filmStyle);
		if (facets.theme) addFacet(result, facets.theme);
		if (facets.era) addFacet(result, facets.era);

		return result;
	})();
</script>

{#if chips.length > 0}
	<Tooltip.Provider disableCloseOnTriggerClick={true}>
		<div class="facet-chips" role="list" aria-label="Content facets">
			{#each chips as chip}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<span class="chip" role="listitem">
							{#if chip.metadata.emoji}
								<span class="emoji" aria-hidden="true">{chip.metadata.emoji}</span>
							{/if}
							{chip.metadata.label}
						</span>
					</Tooltip.Trigger>
					<Tooltip.Content
						class="border border-gray-700 bg-gray-900 text-white"
						arrowClasses="bg-gray-900"
					>
						{#snippet children()}
							<p class="tooltip-text">{chip.metadata.description}</p>
						{/snippet}
					</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</div>
	</Tooltip.Provider>
{/if}

<style>
	.facet-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
		color: rgba(255, 255, 255, 0.9);
		font-weight: 500;
		white-space: nowrap;
		transition: all 0.2s ease;
		cursor: help;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.chip:hover {
		background-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.2);
	}

	.emoji {
		font-size: 0.875rem;
		line-height: 1;
	}

	.tooltip-text {
		font-size: 0.875rem;
		line-height: 1.25rem;
		max-width: 16rem;
	}

	@media (max-width: 640px) {
		.facet-chips {
			font-size: 0.7rem;
			gap: 0.25rem;
		}

		.chip {
			padding: 0.1rem 0.375rem;
			gap: 0.2rem;
		}

		.emoji {
			font-size: 0.75rem;
		}
	}
</style>
