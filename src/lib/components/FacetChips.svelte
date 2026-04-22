<script lang="ts">
  import type { Facets } from '$lib/tv/types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as m from '$lib/paraglide/messages';
  
  export let facets: Facets | undefined;

  type FacetCategory = 'type' | 'focus' | 'movement' | 'environment' | 'production' | 'presentation' | 'medium' | 'era' | 'length';
  type Chip = { key: string; category: FacetCategory };

  const facetLookupKey = (category: FacetCategory, key: string): string => `${category}:${key}`;

  const facetEmojis: Record<string, string> = {
    // Type
    'type:fiction': '🎬',
    'type:documentary': '📹',
    'type:session': '🎥',
    'type:event': '🏆',
    'type:tutorial': '📚',
    'type:music-video': '🎵',
    'type:talk': '🎤',

    // Focus
    'focus:showreel': '🎞️',
    'focus:competition': '🥇',
    'focus:jam': '🎉',
    'focus:conceptual': '💭',
    'focus:gear': '🔧',
    'focus:awards': '🏅',

    // Movement
    'movement:flow': '🌊',
    'movement:big-sends': '🚀',
    'movement:style': '🤸',
    'movement:descents': '⬇️',
    'movement:technical': '⚙️',
    'movement:speed': '🏎️',
    'movement:oldskool': '📼',
    'movement:contemporary': '💃',

    // Environment
    'environment:street': '🏙️',
    'environment:rooftops': '🏢',
    'environment:nature': '🌲',
    'environment:urbex': '🏚️',
    'environment:gym': '🏋️',

    // Production
    'production:raw': '📱',
    'production:casual': '🎒',
    'production:produced': '🎬',
    'production:premium': '✨',

    // Presentation
    'presentation:standard': '🎥',
    'presentation:pov': '👁️',
    'presentation:vlog': '📓',
    'presentation:top-down': '🚁',
    'presentation:stylized': '🔮',

    // Medium
    'medium:live-action': '🎞️',
    'medium:animation': '🎨',
    'medium:mixed-media': '🔀',

    // Era
    'era:pre-2000': '📹',
    'era:2000s': '📀',
    'era:2010s': '📱',
    'era:2020s': '🎬',
    'era:2030s': '🚀',

    // Length
    'length:short-form': '⚡',
    'length:medium-form': '⏱️',
    'length:long-form': '🎞️'
  };

  const facetLabelMessages: Record<string, () => string> = {
    // Type
    'type:fiction': m.facet_type_fiction,
    'type:documentary': m.facet_type_documentary,
    'type:session': m.facet_type_session,
    'type:event': m.facet_type_event,
    'type:tutorial': m.facet_type_tutorial,
    'type:music-video': m.facet_type_musicVideo,
    'type:talk': m.facet_type_talk,

    // Focus
    'focus:showreel': m.facet_focus_showreel,
    'focus:competition': m.facet_focus_competition,
    'focus:jam': m.facet_focus_jam,
    'focus:conceptual': m.facet_focus_conceptual,
    'focus:gear': m.facet_focus_gear,
    'focus:awards': m.facet_focus_awards,

    // Movement
    'movement:flow': m.facet_movement_flow,
    'movement:big-sends': m.facet_movement_bigSends,
    'movement:style': m.facet_movement_style,
    'movement:descents': m.facet_movement_descents,
    'movement:technical': m.facet_movement_technical,
    'movement:speed': m.facet_movement_speed,
    'movement:oldskool': m.facet_movement_oldskool,
    'movement:contemporary': m.facet_movement_contemporary,

    // Environment
    'environment:street': m.facet_environment_street,
    'environment:rooftops': m.facet_environment_rooftops,
    'environment:nature': m.facet_environment_nature,
    'environment:urbex': m.facet_environment_urbex,
    'environment:gym': m.facet_environment_gym,

    // Production
    'production:raw': m.facet_production_raw,
    'production:casual': m.facet_production_casual,
    'production:produced': m.facet_production_produced,
    'production:premium': m.facet_production_premium,

    // Presentation
    'presentation:standard': m.facet_presentation_standard,
    'presentation:pov': m.facet_presentation_pov,
    'presentation:vlog': m.facet_presentation_vlog,
    'presentation:top-down': m.facet_presentation_topDown,
    'presentation:stylized': m.facet_presentation_stylized,

    // Medium
    'medium:live-action': m.facet_medium_liveAction,
    'medium:animation': m.facet_medium_animation,
    'medium:mixed-media': m.facet_medium_mixedMedia,

    // Era
    'era:pre-2000': m.facet_era_pre2000,
    'era:2000s': m.facet_era_2000s,
    'era:2010s': m.facet_era_2010s,
    'era:2020s': m.facet_era_2020s,
    'era:2030s': m.facet_era_2030s,

    // Length
    'length:short-form': m.facet_length_shortForm,
    'length:medium-form': m.facet_length_mediumForm,
    'length:long-form': m.facet_length_longForm
  };

  const facetDescriptionMessages: Record<string, () => string> = {
    // Type
    'type:fiction': m.facet_type_fiction_desc,
    'type:documentary': m.facet_type_documentary_desc,
    'type:session': m.facet_type_session_desc,
    'type:event': m.facet_type_event_desc,
    'type:tutorial': m.facet_type_tutorial_desc,
    'type:music-video': m.facet_type_musicVideo_desc,
    'type:talk': m.facet_type_talk_desc,

    // Focus
    'focus:showreel': m.facet_focus_showreel_desc,
    'focus:competition': m.facet_focus_competition_desc,
    'focus:jam': m.facet_focus_jam_desc,
    'focus:conceptual': m.facet_focus_conceptual_desc,
    'focus:gear': m.facet_focus_gear_desc,
    'focus:awards': m.facet_focus_awards_desc,

    // Movement
    'movement:flow': m.facet_movement_flow_desc,
    'movement:big-sends': m.facet_movement_bigSends_desc,
    'movement:style': m.facet_movement_style_desc,
    'movement:descents': m.facet_movement_descents_desc,
    'movement:technical': m.facet_movement_technical_desc,
    'movement:speed': m.facet_movement_speed_desc,
    'movement:oldskool': m.facet_movement_oldskool_desc,
    'movement:contemporary': m.facet_movement_contemporary_desc,

    // Environment
    'environment:street': m.facet_environment_street_desc,
    'environment:rooftops': m.facet_environment_rooftops_desc,
    'environment:nature': m.facet_environment_nature_desc,
    'environment:urbex': m.facet_environment_urbex_desc,
    'environment:gym': m.facet_environment_gym_desc,

    // Production
    'production:raw': m.facet_production_raw_desc,
    'production:casual': m.facet_production_casual_desc,
    'production:produced': m.facet_production_produced_desc,
    'production:premium': m.facet_production_premium_desc,

    // Presentation
    'presentation:standard': m.facet_presentation_standard_desc,
    'presentation:pov': m.facet_presentation_pov_desc,
    'presentation:vlog': m.facet_presentation_vlog_desc,
    'presentation:top-down': m.facet_presentation_topDown_desc,
    'presentation:stylized': m.facet_presentation_stylized_desc,

    // Medium
    'medium:live-action': m.facet_medium_liveAction_desc,
    'medium:animation': m.facet_medium_animation_desc,
    'medium:mixed-media': m.facet_medium_mixedMedia_desc,

    // Era
    'era:pre-2000': m.facet_era_pre2000_desc,
    'era:2000s': m.facet_era_2000s_desc,
    'era:2010s': m.facet_era_2010s_desc,
    'era:2020s': m.facet_era_2020s_desc,
    'era:2030s': m.facet_era_2030s_desc,

    // Length
    'length:short-form': m.facet_length_shortForm_desc,
    'length:medium-form': m.facet_length_mediumForm_desc,
    'length:long-form': m.facet_length_longForm_desc
  };

  const getFacetLabel = (chip: Chip): string => {
    const msg = facetLabelMessages[facetLookupKey(chip.category, chip.key)];
    const fallback = chip.key;
    return msg ? msg() : fallback;
  };

  const getFacetDescription = (chip: Chip): string => {
    const msg = facetDescriptionMessages[facetLookupKey(chip.category, chip.key)];
    return msg ? msg() : '';
  };
  
  // Helper to add facets to result array
  const addFacet = (result: Chip[], category: FacetCategory, key: string | string[]) => {
    if (Array.isArray(key)) {
      key.forEach(k => result.push({ key: k, category }));
    } else {
      result.push({ key, category });
    }
  };
  
  // Build ordered list of chips to display
  // Order: Type · Focus · Movement · Environment · Production · Presentation · Medium · Era · Length
  $: chips = (() => {
    if (!facets) return [];
    
    const result: Chip[] = [];
    
    if (facets.type) addFacet(result, 'type', facets.type);
    if (facets.focus) addFacet(result, 'focus', facets.focus);
    if (facets.movement?.length) addFacet(result, 'movement', facets.movement);
    if (facets.environment) addFacet(result, 'environment', facets.environment);
    if (facets.production) addFacet(result, 'production', facets.production);
    if (facets.presentation) addFacet(result, 'presentation', facets.presentation);
    if (facets.medium) addFacet(result, 'medium', facets.medium);
    if (facets.era) addFacet(result, 'era', facets.era);
    if (facets.length) addFacet(result, 'length', facets.length);
    
    return result;
  })();
</script>

{#if chips.length > 0}
  <Tooltip.Provider disableCloseOnTriggerClick={true}>
    <div class="facet-chips" role="list" aria-label="Content facets">
      {#each chips as chip}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <span 
              class="chip"
              role="listitem"
            >
              {#if facetEmojis[facetLookupKey(chip.category, chip.key)]}
                <span class="emoji" aria-hidden="true">{facetEmojis[facetLookupKey(chip.category, chip.key)]}</span>
              {/if}
              {getFacetLabel(chip)}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content class="bg-gray-900 text-white border border-gray-700" arrowClasses="bg-gray-900">
            {#snippet children()}
              <p class="font-medium">{getFacetLabel(chip)}</p>
              <p class="tooltip-text">{getFacetDescription(chip)}</p>
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
