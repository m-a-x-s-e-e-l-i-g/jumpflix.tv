<script lang="ts">
  import type { Facets } from '$lib/tv/types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as m from '$lib/paraglide/messages';
  
  export let facets: Facets | undefined;

  type FacetCategory = 'type' | 'mood' | 'movement' | 'environment' | 'filmStyle' | 'theme' | 'era' | 'length';
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
    'type:vlog': '📓',

    // Mood
    'mood:energetic': '⚡',
    'mood:chill': '😌',
    'mood:gritty': '🔥',
    'mood:wholesome': '💚',
    'mood:artistic': '🎨',

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

    // Film Style
    'filmStyle:cinematic': '🎞️',
    'filmStyle:street-cinematic': '🛣️',
    'filmStyle:skateish': '🛹',
    'filmStyle:raw': '📱',
    'filmStyle:pov': '👁️',
    'filmStyle:longtakes': '🎥',
    'filmStyle:music-driven': '🎵',
    'filmStyle:montage': '⚡',
    'filmStyle:slowmo': '🐌',
    'filmStyle:gonzo': '🌀',
    'filmStyle:vintage': '📼',
    'filmStyle:minimalist': '⬜',
    'filmStyle:experimental': '🔮',

    // Theme
    'theme:journey': '🗺️',
    'theme:team': '👥',
    'theme:event': '🎉',
    'theme:competition': '🥇',
    'theme:educational': '🎓',
    'theme:travel': '✈️',
    'theme:creative': '✨',
    'theme:showcase': '🎞️',
    'theme:entertainment': '🎪',

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
    'type:vlog': m.facet_type_vlog,

    // Mood
    'mood:energetic': m.facet_mood_energetic,
    'mood:chill': m.facet_mood_chill,
    'mood:gritty': m.facet_mood_gritty,
    'mood:wholesome': m.facet_mood_wholesome,
    'mood:artistic': m.facet_mood_artistic,

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

    // Film Style
    'filmStyle:cinematic': m.facet_filmStyle_cinematic,
    'filmStyle:street-cinematic': m.facet_filmStyle_streetCinematic,
    'filmStyle:skateish': m.facet_filmStyle_skateish,
    'filmStyle:raw': m.facet_filmStyle_raw,
    'filmStyle:pov': m.facet_filmStyle_pov,
    'filmStyle:longtakes': m.facet_filmStyle_longtakes,
    'filmStyle:music-driven': m.facet_filmStyle_musicDriven,
    'filmStyle:montage': m.facet_filmStyle_montage,
    'filmStyle:slowmo': m.facet_filmStyle_slowmo,
    'filmStyle:gonzo': m.facet_filmStyle_gonzo,
    'filmStyle:vintage': m.facet_filmStyle_vintage,
    'filmStyle:minimalist': m.facet_filmStyle_minimalist,
    'filmStyle:experimental': m.facet_filmStyle_experimental,

    // Theme
    'theme:journey': m.facet_theme_journey,
    'theme:team': m.facet_theme_team,
    'theme:event': m.facet_theme_event,
    'theme:competition': m.facet_theme_competition,
    'theme:educational': m.facet_theme_educational,
    'theme:travel': m.facet_theme_travel,
    'theme:creative': m.facet_theme_creative,
    'theme:showcase': m.facet_theme_showcase,
    'theme:entertainment': m.facet_theme_entertainment,

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
    'type:vlog': m.facet_type_vlog_desc,

    // Mood
    'mood:energetic': m.facet_mood_energetic_desc,
    'mood:chill': m.facet_mood_chill_desc,
    'mood:gritty': m.facet_mood_gritty_desc,
    'mood:wholesome': m.facet_mood_wholesome_desc,
    'mood:artistic': m.facet_mood_artistic_desc,

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

    // Film Style
    'filmStyle:cinematic': m.facet_filmStyle_cinematic_desc,
    'filmStyle:street-cinematic': m.facet_filmStyle_streetCinematic_desc,
    'filmStyle:skateish': m.facet_filmStyle_skateish_desc,
    'filmStyle:raw': m.facet_filmStyle_raw_desc,
    'filmStyle:pov': m.facet_filmStyle_pov_desc,
    'filmStyle:longtakes': m.facet_filmStyle_longtakes_desc,
    'filmStyle:music-driven': m.facet_filmStyle_musicDriven_desc,
    'filmStyle:montage': m.facet_filmStyle_montage_desc,
    'filmStyle:slowmo': m.facet_filmStyle_slowmo_desc,
    'filmStyle:gonzo': m.facet_filmStyle_gonzo_desc,
    'filmStyle:vintage': m.facet_filmStyle_vintage_desc,
    'filmStyle:minimalist': m.facet_filmStyle_minimalist_desc,
    'filmStyle:experimental': m.facet_filmStyle_experimental_desc,

    // Theme
    'theme:journey': m.facet_theme_journey_desc,
    'theme:team': m.facet_theme_team_desc,
    'theme:event': m.facet_theme_event_desc,
    'theme:competition': m.facet_theme_competition_desc,
    'theme:educational': m.facet_theme_educational_desc,
    'theme:travel': m.facet_theme_travel_desc,
    'theme:creative': m.facet_theme_creative_desc,
    'theme:showcase': m.facet_theme_showcase_desc,
    'theme:entertainment': m.facet_theme_entertainment_desc,

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
  // Order: Type · Mood · Movement · Environment · Film Style · Theme · Era · Length
  $: chips = (() => {
    if (!facets) return [];
    
    const result: Chip[] = [];
    
    // Add facets in order, skipping any that are undefined or empty
    if (facets.type) addFacet(result, 'type', facets.type);
    if (facets.mood?.length) addFacet(result, 'mood', facets.mood);
    if (facets.movement?.length) addFacet(result, 'movement', facets.movement);
    if (facets.environment) addFacet(result, 'environment', facets.environment);
    if (facets.filmStyle) addFacet(result, 'filmStyle', facets.filmStyle);
    if (facets.theme) addFacet(result, 'theme', facets.theme);
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
