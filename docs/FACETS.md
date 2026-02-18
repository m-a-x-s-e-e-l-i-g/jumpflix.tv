# Jumpflix.tv Facets Documentation

## Overview

Facets are a structured tagging system for categorizing parkour videos on Jumpflix.tv. They enable users to filter and discover content based on specific attributes like movement style, mood, filming technique, and more.

**Related Issue:** [#38](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/38)

## Facet Types

### 1. Content Type (`facet_type`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

Defines the fundamental content format of the video.

| Value         | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `fiction`     | Fiction / Parkour Film - Narrative stories with plot and characters     |
| `documentary` | Documentary - Real people, interviews, behind-the-scenes                |
| `session`     | Session / Edit / Team Film - Classic parkour videos showing training    |
| `event`       | Event / Jam / Competition - Coverage of gatherings and competitions     |
| `tutorial`    | Tutorial / Educational - Instructional content and technique breakdowns |

---

### 2. Mood (`facet_mood`)

**Selection Mode:** Multi-select  
**Field Type:** Text array

Captures the emotional tone and vibe of the video.

| Value       | Description                          |
| ----------- | ------------------------------------ |
| `energetic` | High energy, intense, pumped up      |
| `chill`     | Relaxed, laid-back atmosphere        |
| `gritty`    | Raw, edgy, underground feel          |
| `wholesome` | Positive, uplifting, feel-good       |
| `intense`   | Serious, focused, high-stakes        |
| `artistic`  | Creative expression, aesthetic focus |

---

### 3. Movement Style (`facet_movement`)

**Selection Mode:** Multi-select  
**Field Type:** Text array

Describes the parkour movement characteristics featured in the video.

| Value          | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `flow`         | Smooth, continuous movement with rhythm                                    |
| `big-sends`    | Large, impressive jumps and drops                                          |
| `style`        | Flips, twists, creative variations (formerly "tricking")                   |
| `technical`    | Precise, difficult movements requiring high skill                          |
| `speed`        | Fast-paced movement, chase sequences                                       |
| `oldskool`     | Traditional parkour style, foundational techniques                         |
| `contemporary` | Modern movement blending parkour with other disciplines (formerly "dance") |

**Note:** "tricking" was renamed to "style" and "dance" was renamed to "contemporary" in recent migrations.

---

### 4. Environment (`facet_environment`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

The primary location or setting where the video takes place.

| Value      | Description                                     |
| ---------- | ----------------------------------------------- |
| `street`   | Street / Urban - Typical city environment       |
| `rooftops` | Rooftops - Elevated urban locations             |
| `nature`   | Nature - Outdoor natural environments           |
| `urbex`    | Urbex (Urban Exploration) - Abandoned buildings |
| `gym`      | Gym - Indoor training facilities                |

---

### 5. Film Style (`facet_film_style`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

The cinematographic and editing approach used in the video.

| Value              | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `cinematic`        | Smooth camera work, controlled shots, strong color grade, polished feel   |
| `street-cinematic` | DSLR stability + fisheye inserts. Clean composition but still street grit |
| `skateish`         | VX/handcam energy, fisheye close-ups, sidewalk culture, rough and fast    |
| `raw`              | No polish. Real sound, breathing, slips, banter. Training as-is           |
| `pov`              | First-person or tight follow angle. Immersive, fast, physical             |
| `longtakes`        | Minimal cuts. Continuous routes. Flow and timing are the edit             |
| `music-driven`     | Editing rhythms follow the soundtrack. Beat-matched cuts and pacing       |
| `montage`          | Quick cuts, hype, best moments stacked. Energy > continuity               |
| `slowmo`           | Slow motion used deliberately to show form, weight shift, control         |
| `gonzo`            | Handheld chaos. Shaky, crowd energy, "in the middle of it"                |
| `vintage`          | MiniDV, Hi8, 4:3, film grain, color decay. Nostalgic skate-era vibes      |
| `minimalist`       | Calm framing, few edits, open space. Quiet mood, clean pacing             |
| `experimental`     | Non-linear, surreal cuts, visual abstraction, intentionally weird         |

**Note:** The film style options were significantly expanded in migration `20251109000000_expand_film_styles.sql`.

---

### 6. Theme (`facet_theme`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

The underlying purpose or narrative focus of the content.

| Value           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `journey`       | Journey - Personal growth, reflection, development    |
| `team`          | Team Film - Group identity, collective style          |
| `event`         | Event Highlight - Jam or gathering recap              |
| `competition`   | Competition - Speed/skill battles                     |
| `educational`   | Educational - Tutorials, technique breakdowns         |
| `travel`        | Travel - City hopping, exploring new spots            |
| `creative`      | Creative / Expression - Artistic intent, experimental |
| `entertainment` | Showcase / Entertainment - Fun, hype, performance     |

---

### 7. Era (`facet_era`)

**Selection Mode:** Auto-calculated  
**Field Type:** Computed from `year` field

Automatically determined from the video's release year.

| Value      | Year Range      |
| ---------- | --------------- |
| `pre-2000` | Before 2000     |
| `2000s`    | 2000-2009       |
| `2010s`    | 2010-2019       |
| `2020s`    | 2020-2029       |
| `2030s`    | 2030 and beyond |

**Note:** This facet is computed in the `media_facets_view` view, not stored directly in the database.

---

## Database Implementation

### Tables & Columns

Facets are stored in the `public.media_items` table:

- `facet_type` - TEXT with CHECK constraint
- `facet_mood` - TEXT[] (array)
- `facet_movement` - TEXT[] (array)
- `facet_environment` - TEXT with CHECK constraint
- `facet_film_style` - TEXT with CHECK constraint
- `facet_theme` - TEXT with CHECK constraint

### Views

**`public.media_facets_view`** - Provides access to all facets including the auto-calculated `facet_era` field.

### Indexes

For efficient filtering:

- `media_items_facet_type_idx` - B-tree index on `facet_type`
- `media_items_facet_environment_idx` - B-tree index on `facet_environment`
- `media_items_facet_film_style_idx` - B-tree index on `facet_film_style`
- `media_items_facet_theme_idx` - B-tree index on `facet_theme`
- `media_items_facet_mood_idx` - GIN index on `facet_mood` (array)
- `media_items_facet_movement_idx` - GIN index on `facet_movement` (array)

GIN indexes are used for array columns to support efficient queries using array operators.

---

## Migration History

1. **20251106000000_add_facets.sql** - Initial facets implementation
2. **20251107000000_remove_facet_modifiers.sql** - Removed `facet_modifiers` column (simplified model)
3. **20251107000001_fix_media_facets_view_security.sql** - Fixed view security properties
4. **20251108000000_remove_length_facet.sql** - Removed buggy auto-calculated length facet
5. **20251109000000_expand_film_styles.sql** - Expanded film style options from 5 to 13 values
6. **20251109000002_replace_tricking_with_style.sql** - Renamed "tricking" → "style" in movement facets, "dance" → "contemporary"

---

## Usage Examples

### Filtering by Single Facet

```sql
SELECT * FROM media_items WHERE facet_type = 'session';
```

### Filtering by Array Facet

```sql
SELECT * FROM media_items WHERE 'flow' = ANY(facet_movement);
```

### Multiple Facet Filters

```sql
SELECT * FROM media_facets_view
WHERE facet_type = 'session'
  AND facet_environment = 'street'
  AND 'energetic' = ANY(facet_mood)
  AND facet_era = '2020s';
```

### Finding Videos with Multiple Movement Styles

```sql
SELECT * FROM media_items
WHERE facet_movement @> ARRAY['flow', 'technical'];
```

---

## Design Principles

1. **Single-select vs Multi-select**: Facets use single-select (text) for mutually exclusive categories and multi-select (text array) for complementary attributes.

2. **Performance**: Indexes are carefully chosen - B-tree for single values, GIN for arrays.

3. **Flexibility**: The system allows null values for optional categorization.

4. **Auto-calculation**: Some facets (like era) are computed from existing data to ensure consistency.

5. **Evolution**: The facet system has been refined based on real-world usage, removing complexity (modifiers, length) while expanding useful categories (film styles).

---

## Future Considerations

- Additional facet types could be added as the content library grows
- Machine learning could assist in auto-tagging videos with facets
- User-contributed facet suggestions could improve categorization accuracy
- Analytics on facet usage could guide UX improvements for filtering
