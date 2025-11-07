# Structured Tagging (Facets) Implementation

This document describes the implementation of structured tagging (facets) for parkour videos in JumpFlix, as specified in [Issue #38](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/38).

## Overview

The facets system provides a structured way to categorize and tag parkour content without using freeform tags. Each facet represents a specific aspect of the video content, making it easier to organize, discover, and curate themed collections.

## Facets

### Required Facets (Single or Multi-Select)

1. **Type** (single-select) - What the video is:
   - Fiction / Parkour Film (narrative stories)
   - Documentary (real people, interviews)
   - Session / Edit / Team Film (classic parkour videos)
   - Event / Jam / Competition
   - Tutorial / Educational

2. **Mood / Vibe** (multi-select) - Emotional tone:
   - Energetic
   - Chill
   - Gritty
   - Wholesome
   - Intense
   - Artistic

3. **Movement Style** (multi-select) - How the body moves:
   - Flow (continuous lines)
   - Big Sends (roofs, fear jumps)
   - Tricking (mainly connecting flips)
   - Technical (precise, quirky)
   - Speed / Chase (fast movement)
   - Oldskool (parkour basics)
   - Dance (noodle movement)

4. **Environment** (single-select) - Primary setting:
   - Street / Urban
   - Rooftops
   - Nature
   - Urbex (abandoned)
   - Gym (indoor setup)

5. **Film Style / Editing** (single-select):
   - Cinematic (color, composition, narrative tone)
   - Skate-ish (fisheye, rough, VX vibes)
   - Raw Session (little/no music, breathing, talking)
   - POV / Chasecam
   - Long Takes (slow, minimal cutting)

6. **Theme / Purpose** (single-select):
   - Journey (personal growth / reflection)
   - Team Film (group identity / collective style)
   - Event Highlight (jam / gathering recap)
   - Competition (speed/skill battles)
   - Educational (tutorials / breakdowns)
   - Travel (city hopping / exploring spots)
   - Creative / Expression (artistic intent, experimental)
   - Showcase / Entertainment (fun, hype)

### Automatic Facets

These are calculated automatically from existing data:

- **Length**: Short (<7m) / Medium (7-30m) / Feature (30-70m) / Long Feature (70m+)
  - Calculated from the `duration` field
- **Era**: 2000s / 2010s / 2020s / 2030s
  - Calculated from the `year` field

### Modifiers

Optional modifiers (0-2) can be added for additional context. These are shown in brackets, e.g., `[Long Takes]`

## Display Format

Facets are displayed in a consistent canonical order:

```
Type · Mood · Movement · Environment · Film Style · Theme · [Modifiers]
```

### Examples

- **BALANCING ORGANISMS** → `Session · Chill · Flow · Street · Cinematic · Journey · [Long Takes]`
- **Banlieue 13** → `Fiction · Energetic · Speed/Chase · Rooftops · Cinematic · Competition`

## Database Schema

### Migration: `20251106000000_add_facets.sql`

Adds the following columns to the `media_items` table:

- `facet_type`: TEXT with check constraint
- `facet_mood`: TEXT[] array
- `facet_movement`: TEXT[] array
- `facet_environment`: TEXT with check constraint
- `facet_film_style`: TEXT with check constraint
- `facet_theme`: TEXT with check constraint
- `facet_modifiers`: TEXT[] array

Indexes are created for efficient filtering:
- B-tree indexes for single-select facets
- GIN indexes for array (multi-select) facets

A view `media_facets_view` is created to include auto-calculated `facet_length` and `facet_era`.

## TypeScript Types

### In `src/lib/supabase/types.ts`

Database types are updated to include all facet fields in the `media_items` table Row, Insert, and Update types.

### In `src/lib/tv/types.ts`

```typescript
export type FacetType = 'fiction' | 'documentary' | 'session' | 'event' | 'tutorial';
export type FacetMood = 'energetic' | 'chill' | 'gritty' | 'wholesome' | 'intense' | 'artistic';
export type FacetMovement = 'flow' | 'big-sends' | 'tricking' | 'technical' | 'speed' | 'oldskool' | 'dance';
export type FacetEnvironment = 'street' | 'rooftops' | 'nature' | 'urbex' | 'gym';
export type FacetFilmStyle = 'cinematic' | 'skateish' | 'raw' | 'pov' | 'longtakes';
export type FacetTheme = 'journey' | 'team' | 'event' | 'competition' | 'educational' | 'travel' | 'creative' | 'entertainment';
export type FacetLength = 'short' | 'medium' | 'feature' | 'long-feature';
export type FacetEra = '2000s' | '2010s' | '2020s' | '2030s' | 'pre-2000';

export interface Facets {
  type?: FacetType;
  mood?: FacetMood[];
  movement?: FacetMovement[];
  environment?: FacetEnvironment;
  filmStyle?: FacetFilmStyle;
  theme?: FacetTheme;
  modifiers?: string[];
  length?: FacetLength; // Auto-calculated
  era?: FacetEra; // Auto-calculated
}
```

The `BaseContent` interface now includes an optional `facets` field.

## Components

### `FacetChips.svelte`

A reusable Svelte component that displays facet chips in the canonical order. Features:
- Displays all facets in the correct order
- Uses friendly labels for each facet value
- Shows modifiers in brackets with a different style
- Separates chips with centered dots
- Responsive design for mobile
- Accessible with proper ARIA attributes

Usage:
```svelte
<FacetChips facets={item.facets} />
```

### Integration

Facet chips are displayed in:
- **Desktop Details Panel** (`SidebarDetails.svelte`) - Below the description
- **Mobile Details Overlay** (`MobileDetailsOverlay.svelte`) - Below the description

## Content Service

The `content-service.ts` file has been updated to:
1. Map facet fields from database rows to content items
2. Calculate automatic facets (length and era) from existing data
3. Only include facets if at least one is set (to avoid empty facet objects)

## Adding Facets to Content

### Via Admin CLI

The admin CLI tool (`scripts/admin-cli.ts`) will be enhanced in a separate issue ([#39](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/39)) to support adding and editing facets interactively.

### Via SQL

You can manually add facets via SQL:

```sql
UPDATE media_items
SET 
  facet_type = 'session',
  facet_mood = ARRAY['chill', 'artistic'],
  facet_movement = ARRAY['flow'],
  facet_environment = 'street',
  facet_film_style = 'cinematic',
  facet_theme = 'journey',
  facet_modifiers = ARRAY['Long Takes']
WHERE slug = 'balancing-organisms-2024';
```

## Future Enhancements

As noted in the issue, filtering is not implemented yet. The facets will be used later to:
- Create dynamic theme-based content feeds
- Build curated sections (e.g., "Movie Night" for long-form entertainment)
- Enable advanced search and discovery features

## Acceptance Criteria

✅ No free text tags
✅ Facet coverage for media items is optional
✅ Database schema supports all required facets
✅ TypeScript types are properly defined
✅ UI components display facets in canonical order
✅ Automatic facets (length, era) are calculated from existing data
