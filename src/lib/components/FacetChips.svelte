<script lang="ts">
  import type { Facets } from '$lib/tv/types';
  import * as Tooltip from '$lib/components/ui/tooltip';
  
  export let facets: Facets | undefined;
  
  // Comprehensive facet metadata with descriptions, colors, and emojis
  interface FacetMetadata {
    label: string;
    description: string;
    emoji: string;
    color: string;
  }
  
  const facetMetadata: Record<string, FacetMetadata> = {
    // Type
    fiction: { 
      label: 'Fiction', 
      description: 'Narrative-driven parkour film with storyline',
      emoji: '🎬',
      color: 'rgba(139, 92, 246, 0.15)' // purple
    },
    documentary: { 
      label: 'Documentary', 
      description: 'Real stories and insights into parkour culture',
      emoji: '📹',
      color: 'rgba(59, 130, 246, 0.15)' // blue
    },
    session: { 
      label: 'Session', 
      description: 'Team edit or session footage from training',
      emoji: '🎥',
      color: 'rgba(34, 197, 94, 0.15)' // green
    },
    event: { 
      label: 'Event', 
      description: 'Jam, competition, or organized gathering',
      emoji: '🏆',
      color: 'rgba(249, 115, 22, 0.15)' // orange
    },
    tutorial: { 
      label: 'Tutorial', 
      description: 'Educational content teaching parkour techniques',
      emoji: '📚',
      color: 'rgba(14, 165, 233, 0.15)' // sky
    },
    
    // Mood
    energetic: { 
      label: 'Energetic', 
      description: 'High-energy vibe with intense action',
      emoji: '⚡',
      color: 'rgba(234, 179, 8, 0.15)' // yellow
    },
    chill: { 
      label: 'Chill', 
      description: 'Relaxed and laid-back atmosphere',
      emoji: '😌',
      color: 'rgba(96, 165, 250, 0.15)' // light blue
    },
    gritty: { 
      label: 'Gritty', 
      description: 'Raw, rough, and unpolished street vibe',
      emoji: '🔥',
      color: 'rgba(239, 68, 68, 0.15)' // red
    },
    wholesome: { 
      label: 'Wholesome', 
      description: 'Positive, uplifting, and feel-good content',
      emoji: '💚',
      color: 'rgba(34, 197, 94, 0.15)' // green
    },
    artistic: { 
      label: 'Artistic', 
      description: 'Creative expression and aesthetic focus',
      emoji: '🎨',
      color: 'rgba(168, 85, 247, 0.15)' // purple
    },
    
    // Movement
    flow: { 
      label: 'Flow', 
      description: 'Continuous, fluid movement lines',
      emoji: '🌊',
      color: 'rgba(59, 130, 246, 0.15)' // blue
    },
    'big-sends': { 
      label: 'Big Sends', 
      description: 'Scary jumps, rooftops, and fear challenges',
      emoji: '🚀',
      color: 'rgba(239, 68, 68, 0.15)' // red
    },
    tricking: { 
      label: 'Tricking', 
      description: 'Flips, twists, and acrobatic movements',
      emoji: '🤸',
      color: 'rgba(236, 72, 153, 0.15)' // pink
    },
    technical: { 
      label: 'Technical', 
      description: 'Precise, quirky, and technical movements',
      emoji: '⚙️',
      color: 'rgba(148, 163, 184, 0.15)' // slate
    },
    speed: { 
      label: 'Speed/Chase', 
      description: 'Fast-paced running and chase sequences',
      emoji: '🏎️',
      color: 'rgba(234, 179, 8, 0.15)' // yellow
    },
    oldskool: { 
      label: 'Oldskool', 
      description: 'Classic parkour fundamentals and basics',
      emoji: '📼',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    dance: { 
      label: 'Dance', 
      description: 'Noodle movement and dance-like flow',
      emoji: '💃',
      color: 'rgba(236, 72, 153, 0.15)' // pink
    },
    
    // Environment
    street: { 
      label: 'Street', 
      description: 'Urban street spots and city locations',
      emoji: '🏙️',
      color: 'rgba(100, 116, 139, 0.15)' // slate
    },
    rooftops: { 
      label: 'Rooftops', 
      description: 'High-altitude rooftop training and jumps',
      emoji: '🏢',
      color: 'rgba(239, 68, 68, 0.15)' // red
    },
    nature: { 
      label: 'Nature', 
      description: 'Outdoor natural environments and landscapes',
      emoji: '🌲',
      color: 'rgba(34, 197, 94, 0.15)' // green
    },
    urbex: { 
      label: 'Urbex', 
      description: 'Abandoned buildings and urban exploration',
      emoji: '🏚️',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    gym: { 
      label: 'Gym', 
      description: 'Indoor training facilities and parkour gyms',
      emoji: '🏋️',
      color: 'rgba(59, 130, 246, 0.15)' // blue
    },
    
    // Film Style
    cinematic: { 
      label: 'Cinematic', 
      description: 'Professional cinematography with music and effects',
      emoji: '🎞️',
      color: 'rgba(139, 92, 246, 0.15)' // purple
    },
    skateish: { 
      label: 'Skate-ish', 
      description: 'Skate video aesthetic with fisheye and VX',
      emoji: '🛹',
      color: 'rgba(249, 115, 22, 0.15)' // orange
    },
    raw: { 
      label: 'Raw Session', 
      description: 'Minimal editing with raw footage and simple music',
      emoji: '📱',
      color: 'rgba(148, 163, 184, 0.15)' // slate
    },
    pov: { 
      label: 'POV', 
      description: 'First-person perspective and chase cam footage',
      emoji: '👁️',
      color: 'rgba(14, 165, 233, 0.15)' // sky
    },
    longtakes: { 
      label: 'Long Takes', 
      description: 'Extended single-shot sequences',
      emoji: '🎥',
      color: 'rgba(168, 85, 247, 0.15)' // purple
    },
    
    // Theme
    journey: { 
      label: 'Journey', 
      description: 'Personal growth and transformation story',
      emoji: '🗺️',
      color: 'rgba(59, 130, 246, 0.15)' // blue
    },
    team: { 
      label: 'Team Film', 
      description: 'Showcasing team identity and crew dynamics',
      emoji: '👥',
      color: 'rgba(34, 197, 94, 0.15)' // green
    },
    competition: { 
      label: 'Competition', 
      description: 'Contest or competitive event coverage',
      emoji: '🥇',
      color: 'rgba(234, 179, 8, 0.15)' // yellow
    },
    educational: { 
      label: 'Educational', 
      description: 'Teaching techniques and parkour knowledge',
      emoji: '🎓',
      color: 'rgba(14, 165, 233, 0.15)' // sky
    },
    travel: { 
      label: 'Travel', 
      description: 'Exploring new locations and spots around the world',
      emoji: '✈️',
      color: 'rgba(59, 130, 246, 0.15)' // blue
    },
    creative: { 
      label: 'Creative', 
      description: 'Artistic expression and experimental filmmaking',
      emoji: '✨',
      color: 'rgba(168, 85, 247, 0.15)' // purple
    },
    entertainment: { 
      label: 'Entertainment', 
      description: 'Showcase and entertainment-focused content',
      emoji: '🎪',
      color: 'rgba(236, 72, 153, 0.15)' // pink
    },
    
    // Era (auto)
    '2000s': { 
      label: '2000s', 
      description: 'Released in the 2000s',
      emoji: '📀',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    '2010s': { 
      label: '2010s', 
      description: 'Released in the 2010s',
      emoji: '📱',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    '2020s': { 
      label: '2020s', 
      description: 'Released in the 2020s',
      emoji: '🎬',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    '2030s': { 
      label: '2030s', 
      description: 'Released in the 2030s',
      emoji: '🚀',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    },
    'pre-2000': { 
      label: 'Pre-2000', 
      description: 'Released before 2000',
      emoji: '📹',
      color: 'rgba(120, 113, 108, 0.15)' // stone
    }
  };
  
  // Build ordered list of chips to display
  // Order: Type · Mood · Movement · Environment · Film Style · Theme
  $: chips = (() => {
    if (!facets) return [];
    
    const result: Array<{ key: string; metadata: FacetMetadata }> = [];
    
    // Type (single-select)
    if (facets.type) {
      const key = facets.type;
      result.push({ 
        key, 
        metadata: facetMetadata[key] || { 
          label: key, 
          description: '', 
          emoji: '',
          color: 'rgba(255, 255, 255, 0.1)' 
        }
      });
    }
    
    // Mood (multi-select)
    if (facets.mood && facets.mood.length > 0) {
      facets.mood.forEach(key => {
        result.push({ 
          key, 
          metadata: facetMetadata[key] || { 
            label: key, 
            description: '', 
            emoji: '',
            color: 'rgba(255, 255, 255, 0.1)' 
          }
        });
      });
    }
    
    // Movement (multi-select)
    if (facets.movement && facets.movement.length > 0) {
      facets.movement.forEach(key => {
        result.push({ 
          key, 
          metadata: facetMetadata[key] || { 
            label: key, 
            description: '', 
            emoji: '',
            color: 'rgba(255, 255, 255, 0.1)' 
          }
        });
      });
    }
    
    // Environment (single-select)
    if (facets.environment) {
      const key = facets.environment;
      result.push({ 
        key, 
        metadata: facetMetadata[key] || { 
          label: key, 
          description: '', 
          emoji: '',
          color: 'rgba(255, 255, 255, 0.1)' 
        }
      });
    }
    
    // Film Style (single-select)
    if (facets.filmStyle) {
      const key = facets.filmStyle;
      result.push({ 
        key, 
        metadata: facetMetadata[key] || { 
          label: key, 
          description: '', 
          emoji: '',
          color: 'rgba(255, 255, 255, 0.1)' 
        }
      });
    }
    
    // Theme (single-select)
    if (facets.theme) {
      const key = facets.theme;
      result.push({ 
        key, 
        metadata: facetMetadata[key] || { 
          label: key, 
          description: '', 
          emoji: '',
          color: 'rgba(255, 255, 255, 0.1)' 
        }
      });
    }
    
    return result;
  })();
</script>

{#if chips.length > 0}
  <Tooltip.Provider>
    <div class="facet-chips" role="list" aria-label="Content facets">
      {#each chips as chip}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <span 
              class="chip"
              role="listitem"
            >
              {#if chip.metadata.emoji}
                <span class="emoji" aria-hidden="true">{chip.metadata.emoji}</span>
              {/if}
              {chip.metadata.label}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content class="bg-gray-900 text-white border border-gray-700" arrowClasses="bg-gray-900">
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
