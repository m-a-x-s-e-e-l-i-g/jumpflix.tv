<script lang="ts">
  import type { Facets } from '$lib/tv/types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as m from '$lib/paraglide/messages';
  
  export let facets: Facets | undefined;

  const facetEmojis: Record<string, string> = {
    // Type
    fiction: '🎬',
    documentary: '📹',
    session: '🎥',
    event: '🏆',
    tutorial: '📚',

    // Mood
    energetic: '⚡',
    chill: '😌',
    gritty: '🔥',
    wholesome: '💚',
    artistic: '🎨',

    // Movement
    flow: '🌊',
    'big-sends': '🚀',
    style: '🤸',
    technical: '⚙️',
    speed: '🏎️',
    oldskool: '📼',
    contemporary: '💃',

    // Environment
    street: '🏙️',
    rooftops: '🏢',
    nature: '🌲',
    urbex: '🏚️',
    gym: '🏋️',

    // Film Style
    cinematic: '🎞️',
    'street-cinematic': '🛣️',
    skateish: '🛹',
    raw: '📱',
    pov: '👁️',
    longtakes: '🎥',
    'music-driven': '🎵',
    montage: '⚡',
    slowmo: '🐌',
    gonzo: '🌀',
    vintage: '📼',
    minimalist: '⬜',
    experimental: '🔮',

    // Theme
    journey: '🗺️',
    team: '👥',
    competition: '🥇',
    educational: '🎓',
    travel: '✈️',
    creative: '✨',
    entertainment: '🎪',

    // Era
    'pre-2000': '📹',
    '2000s': '📀',
    '2010s': '📱',
    '2020s': '🎬',
    '2030s': '🚀'
  };

  const facetLabelMessages: Record<string, () => string> = {
    // Type
    fiction: m.facet_type_fiction,
    documentary: m.facet_type_documentary,
    session: m.facet_type_session,
    event: m.facet_type_event,
    tutorial: m.facet_type_tutorial,

    // Mood
    energetic: m.facet_mood_energetic,
    chill: m.facet_mood_chill,
    gritty: m.facet_mood_gritty,
    wholesome: m.facet_mood_wholesome,
    artistic: m.facet_mood_artistic,

    // Movement
    flow: m.facet_movement_flow,
    'big-sends': m.facet_movement_bigSends,
    style: m.facet_movement_style,
    technical: m.facet_movement_technical,
    speed: m.facet_movement_speed,
    oldskool: m.facet_movement_oldskool,
    contemporary: m.facet_movement_contemporary,

    // Environment
    street: m.facet_environment_street,
    rooftops: m.facet_environment_rooftops,
    nature: m.facet_environment_nature,
    urbex: m.facet_environment_urbex,
    gym: m.facet_environment_gym,

    // Film Style
    cinematic: m.facet_filmStyle_cinematic,
    'street-cinematic': m.facet_filmStyle_streetCinematic,
    skateish: m.facet_filmStyle_skateish,
    raw: m.facet_filmStyle_raw,
    pov: m.facet_filmStyle_pov,
    longtakes: m.facet_filmStyle_longtakes,
    'music-driven': m.facet_filmStyle_musicDriven,
    montage: m.facet_filmStyle_montage,
    slowmo: m.facet_filmStyle_slowmo,
    gonzo: m.facet_filmStyle_gonzo,
    vintage: m.facet_filmStyle_vintage,
    minimalist: m.facet_filmStyle_minimalist,
    experimental: m.facet_filmStyle_experimental,

    // Theme
    journey: m.facet_theme_journey,
    team: m.facet_theme_team,
    competition: m.facet_theme_competition,
    educational: m.facet_theme_educational,
    travel: m.facet_theme_travel,
    creative: m.facet_theme_creative,
    entertainment: m.facet_theme_entertainment,

    // Era
    'pre-2000': m.facet_era_pre2000,
    '2000s': m.facet_era_2000s,
    '2010s': m.facet_era_2010s,
    '2020s': m.facet_era_2020s,
    '2030s': m.facet_era_2030s
  };

  const facetDescriptionMessages: Record<string, () => string> = {
    // Type
    fiction: m.facet_type_fiction_desc,
    documentary: m.facet_type_documentary_desc,
    session: m.facet_type_session_desc,
    event: m.facet_type_event_desc,
    tutorial: m.facet_type_tutorial_desc,

    // Mood
    energetic: m.facet_mood_energetic_desc,
    chill: m.facet_mood_chill_desc,
    gritty: m.facet_mood_gritty_desc,
    wholesome: m.facet_mood_wholesome_desc,
    artistic: m.facet_mood_artistic_desc,

    // Movement
    flow: m.facet_movement_flow_desc,
    'big-sends': m.facet_movement_bigSends_desc,
    style: m.facet_movement_style_desc,
    technical: m.facet_movement_technical_desc,
    speed: m.facet_movement_speed_desc,
    oldskool: m.facet_movement_oldskool_desc,
    contemporary: m.facet_movement_contemporary_desc,

    // Environment
    street: m.facet_environment_street_desc,
    rooftops: m.facet_environment_rooftops_desc,
    nature: m.facet_environment_nature_desc,
    urbex: m.facet_environment_urbex_desc,
    gym: m.facet_environment_gym_desc,

    // Film Style
    cinematic: m.facet_filmStyle_cinematic_desc,
    'street-cinematic': m.facet_filmStyle_streetCinematic_desc,
    skateish: m.facet_filmStyle_skateish_desc,
    raw: m.facet_filmStyle_raw_desc,
    pov: m.facet_filmStyle_pov_desc,
    longtakes: m.facet_filmStyle_longtakes_desc,
    'music-driven': m.facet_filmStyle_musicDriven_desc,
    montage: m.facet_filmStyle_montage_desc,
    slowmo: m.facet_filmStyle_slowmo_desc,
    gonzo: m.facet_filmStyle_gonzo_desc,
    vintage: m.facet_filmStyle_vintage_desc,
    minimalist: m.facet_filmStyle_minimalist_desc,
    experimental: m.facet_filmStyle_experimental_desc,

    // Theme
    journey: m.facet_theme_journey_desc,
    team: m.facet_theme_team_desc,
    competition: m.facet_theme_competition_desc,
    educational: m.facet_theme_educational_desc,
    travel: m.facet_theme_travel_desc,
    creative: m.facet_theme_creative_desc,
    entertainment: m.facet_theme_entertainment_desc,

    // Era
    'pre-2000': m.facet_era_pre2000_desc,
    '2000s': m.facet_era_2000s_desc,
    '2010s': m.facet_era_2010s_desc,
    '2020s': m.facet_era_2020s_desc,
    '2030s': m.facet_era_2030s_desc
  };

  const getFacetLabel = (key: string, fallback: string): string => {
    const msg = facetLabelMessages[key];
    return msg ? msg() : fallback;
  };

  const getFacetDescription = (key: string): string => {
    const msg = facetDescriptionMessages[key];
    return msg ? msg() : '';
  };
  
  // Helper to add facets to result array
  const addFacet = (result: Array<{ key: string }>, key: string | string[]) => {
    if (Array.isArray(key)) {
      key.forEach(k => result.push({ key: k }));
    } else {
      result.push({ key });
    }
  };
  
  // Build ordered list of chips to display
  // Order: Type · Mood · Movement · Environment · Film Style · Theme · Era
  $: chips = (() => {
    if (!facets) return [];
    
    const result: Array<{ key: string }> = [];
    
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
            <span 
              class="chip"
              role="listitem"
            >
              {#if facetEmojis[chip.key]}
                <span class="emoji" aria-hidden="true">{facetEmojis[chip.key]}</span>
              {/if}
              {getFacetLabel(chip.key, chip.key)}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content class="bg-gray-900 text-white border border-gray-700" arrowClasses="bg-gray-900">
            {#snippet children()}
              <p class="tooltip-text">{getFacetDescription(chip.key)}</p>
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
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
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
