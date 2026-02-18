<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { SelectedFacets, FacetType, FacetMood, FacetMovement, FacetEnvironment, FacetFilmStyle, FacetTheme, FacetEra } from './types';
  import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  
  interface Props {
    selectedFacets: Writable<SelectedFacets>;
  }
  
  let { selectedFacets }: Props = $props();
  
  // Facet metadata with display names and emojis
  const facetCategories = {
    type: {
      label: 'Type',
      options: [
        { value: 'fiction', label: 'Fiction', emoji: '🎬' },
        { value: 'documentary', label: 'Documentary', emoji: '📹' },
        { value: 'session', label: 'Session', emoji: '🎥' },
        { value: 'event', label: 'Event', emoji: '🏆' },
        { value: 'tutorial', label: 'Tutorial', emoji: '📚' }
      ] as const
    },
    mood: {
      label: 'Mood',
      options: [
        { value: 'energetic', label: 'Energetic', emoji: '⚡' },
        { value: 'chill', label: 'Chill', emoji: '😌' },
        { value: 'gritty', label: 'Gritty', emoji: '🔥' },
        { value: 'wholesome', label: 'Wholesome', emoji: '💚' },
        { value: 'artistic', label: 'Artistic', emoji: '🎨' }
      ] as const
    },
    movement: {
      label: 'Movement',
      options: [
        { value: 'flow', label: 'Flow', emoji: '🌊' },
        { value: 'big-sends', label: 'Big Sends', emoji: '🚀' },
        { value: 'style', label: 'Style', emoji: '🤸' },
        { value: 'technical', label: 'Technical', emoji: '⚙️' },
        { value: 'speed', label: 'Speed', emoji: '🏎️' },
        { value: 'oldskool', label: 'Oldskool', emoji: '📼' },
        { value: 'contemporary', label: 'Contemporary', emoji: '💃' }
      ] as const
    },
    environment: {
      label: 'Environment',
      options: [
        { value: 'street', label: 'Street', emoji: '🏙️' },
        { value: 'rooftops', label: 'Rooftops', emoji: '🏢' },
        { value: 'nature', label: 'Nature', emoji: '🌲' },
        { value: 'urbex', label: 'Urbex', emoji: '🏚️' },
        { value: 'gym', label: 'Gym', emoji: '🏋️' }
      ] as const
    },
    filmStyle: {
      label: 'Film Style',
      options: [
        { value: 'cinematic', label: 'Cinematic', emoji: '🎞️' },
        { value: 'street-cinematic', label: 'Street-Cinematic', emoji: '🛣️' },
        { value: 'skateish', label: 'Skate-ish', emoji: '🛹' },
        { value: 'raw', label: 'Raw', emoji: '📱' },
        { value: 'pov', label: 'POV', emoji: '👁️' },
        { value: 'longtakes', label: 'Long Takes', emoji: '🎥' },
        { value: 'music-driven', label: 'Music-Driven', emoji: '🎵' },
        { value: 'montage', label: 'Montage', emoji: '⚡' },
        { value: 'slowmo', label: 'Slowmo', emoji: '🐌' },
        { value: 'gonzo', label: 'Gonzo', emoji: '🌀' },
        { value: 'vintage', label: 'Vintage', emoji: '📼' },
        { value: 'minimalist', label: 'Minimalist', emoji: '⬜' },
        { value: 'experimental', label: 'Experimental', emoji: '🔮' }
      ] as const
    },
    theme: {
      label: 'Theme',
      options: [
        { value: 'journey', label: 'Journey', emoji: '🗺️' },
        { value: 'team', label: 'Team', emoji: '👥' },
        { value: 'competition', label: 'Competition', emoji: '🥇' },
        { value: 'educational', label: 'Educational', emoji: '🎓' },
        { value: 'travel', label: 'Travel', emoji: '✈️' },
        { value: 'creative', label: 'Creative', emoji: '✨' },
        { value: 'entertainment', label: 'Entertainment', emoji: '🎪' }
      ] as const
    },
    era: {
      label: 'Era',
      options: [
        { value: 'pre-2000', label: 'Pre-2000', emoji: '📹' },
        { value: '2000s', label: '2000s', emoji: '📀' },
        { value: '2010s', label: '2010s', emoji: '📱' },
        { value: '2020s', label: '2020s', emoji: '🎬' },
        { value: '2030s', label: '2030s', emoji: '🚀' }
      ] as const
    }
  } as const;

  const facetCategoryKeys = Object.keys(facetCategories) as Array<keyof typeof facetCategories>;
  
  let isOpen = $state(false);
  
  function toggleFacet(category: keyof SelectedFacets, value: string) {
    selectedFacets.update((current) => {
      const updated = { ...current } as Record<string, string[] | undefined>;
      const currentValues = updated[category] ?? [];

      if (currentValues.includes(value)) {
        updated[category] = currentValues.filter((v) => v !== value);
      } else {
        updated[category] = [...currentValues, value];
      }

      return updated as unknown as SelectedFacets;
    });
  }

  function isFacetSelected(category: keyof SelectedFacets, value: string): boolean {
    const values = ($selectedFacets as unknown as Record<string, string[] | undefined>)[category] ?? [];
    return values.includes(value);
  }
  
  function clearAllFilters() {
    selectedFacets.set({});
  }
  
  const hasAnyFilters = $derived(Object.values($selectedFacets).some(arr => Array.isArray(arr) && arr.length > 0));
  const filterCount = $derived(Object.values($selectedFacets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0));
</script>

<button 
  class="filter-toggle"
  onclick={() => isOpen = true}
  aria-label="Open facet filters"
>
  <span class="filter-icon">
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  </span>
  <span class="filter-text">Filters</span>
  {#if filterCount > 0}
    <span class="filter-badge">{filterCount}</span>
  {/if}
</button>

<DialogRoot bind:open={isOpen}>
  <DialogContent class="max-h-[85vh] max-w-3xl overflow-y-auto">
    <div class="dialog-header-with-action">
      <DialogHeader>
        <DialogTitle>Filter by Facets</DialogTitle>
      </DialogHeader>
      {#if hasAnyFilters}
        <button class="clear-button" onclick={clearAllFilters}>
          Clear all
        </button>
      {/if}
    </div>
    
    <div class="filter-categories">
      {#each facetCategoryKeys as categoryKey}
        {@const category = facetCategories[categoryKey]}
        <div class="filter-category">
          <h4 class="category-label">{category.label}</h4>
          <div class="facet-chips">
            {#each category.options as option}
              {@const isSelected = isFacetSelected(categoryKey, option.value)}
              <button
                class="facet-chip"
                class:selected={isSelected}
                onclick={() => toggleFacet(categoryKey, option.value)}
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
