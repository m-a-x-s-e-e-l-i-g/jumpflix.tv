# Jumpflix.tv Facets Documentation — v2

## Overview

Facets are the structured tagging system for categorizing parkour videos on Jumpflix.tv. They power the browse and filter experience, letting users find content by format, focus, movement, setting, production quality, and presentation style.

This document describes the **v2 taxonomy**, which simplifies the original model by giving each facet a single clear job and eliminating overlap between dimensions.

**Related Issue:** [#38](https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/38)

---

## Facet Reference

### 1. Content Type (`facet_type`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

What kind of video is this? Describes the fundamental content format.

| Value         | Description                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| `session`     | Session / Edit — Classic parkour footage; training, location edits, team films |
| `event`       | Event — Coverage of a gathering: jam, competition, or community meet           |
| `documentary` | Documentary — Real people, real stories; interviews, behind-the-scenes         |
| `fiction`     | Fiction / Parkour Film — Narrative with plot and characters (story > movement) |
| `talk`        | Talk — Speaking-format content: interviews, mindset pieces, lectures           |
| `tutorial`    | Tutorial — Instructional content: technique, training, gear and setup          |
| `music-video` | Music Video — Music-driven edit where the track drives structure and pacing    |

**Tagging guidance:**
- A showreel is still `session` — use `facet_focus=showreel` to make it filterable.
- A personal journey / mindset piece is `talk` — use `facet_focus=conceptual` if needed.
- A narrative parkour film with more story than movement still fits `fiction`.
- A ceremony or awards show (e.g. STORROR Awards) fits `talk`.

---

### 2. Focus (`facet_focus`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

What is the video specifically about? Use this to distinguish sub-types within a content type. Not every video needs a focus value — only set it when it meaningfully narrows discovery.

| Value         | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `showreel`    | Highlight / best-of reel, athlete profile, or year compilation                       |
| `competition` | Competitive format: speed, style, Chase Tag, or similar structured contest           |
| `jam`         | Community jam, gathering, or informal session recap                                  |
| `conceptual`  | Mindset, personal journey, philosophical, or experimental concept-driven content     |
| `gear`        | Equipment, setup, or build-focused content                                           |
| `awards`      | Awards ceremony, recognition show, community retrospective                           |

**Tagging guidance:**
- Showreels → `facet_type=session` + `facet_focus=showreel`
- Competitions → `facet_type=event` + `facet_focus=competition`
- Jam recaps → `facet_type=event` + `facet_focus=jam`
- Personal journey / mindset → `facet_type=talk` + `facet_focus=conceptual`
- Gear/setup tutorials → `facet_type=tutorial` + `facet_focus=gear`
- Awards ceremony → `facet_type=talk` + `facet_focus=awards`
- A session without a specific angle → leave `facet_focus` null

---

### 3. Movement Style (`facet_movement`)

**Selection Mode:** Multi-select  
**Field Type:** Text array

What kind of movement is featured? Select all that meaningfully represent the video.

| Value          | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `flow`         | Smooth, continuous movement with rhythm                                    |
| `big-sends`    | Large, impressive jumps and drops                                          |
| `style`        | Flips, twists, creative variations (formerly "tricking")                   |
| `descents`     | Drops, downclimbs, descending lines and controlled landings                |
| `technical`    | Precise, difficult movements requiring high skill                          |
| `speed`        | Fast-paced movement, chase sequences                                       |
| `oldskool`     | Traditional parkour style, foundational techniques                         |
| `contemporary` | Modern movement blending parkour with other disciplines (formerly "dance") |

**Note:** "tricking" was renamed to "style" and "dance" was renamed to "contemporary" in earlier migrations.

---

### 4. Environment (`facet_environment`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

Where does the video **primarily** take place? Choose the dominant setting — the one that best represents what a viewer should expect, not every setting that briefly appears.

| Value      | Description                                     |
| ---------- | ----------------------------------------------- |
| `street`   | Street / Urban — Typical city environment       |
| `rooftops` | Rooftops — Elevated urban locations             |
| `nature`   | Nature — Outdoor natural environments           |
| `urbex`    | Urbex (Urban Exploration) — Abandoned buildings |
| `gym`      | Gym — Indoor training facilities                |

**Tagging rule — dominant setting only:** A video filmed mostly in the city that includes one nature shot is `street`, not `nature`. This keeps environment filters clean and useful. If two settings are genuinely equal, default to the one that visually defines the video.

---

### 5. Production Quality (`facet_production`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

How polished is the production? This is about craft and finish level — not aesthetic genre or style choices. A phone-clip compilation and a high-budget film are both valid; this facet simply describes where they sit on the production spectrum.

| Value      | Description                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `raw`      | Minimal editing, rough capture — phone clips, real sound, ungraded footage, training-as-is       |
| `casual`   | Creator-made with clear intent — lightly edited, vlog-adjacent, not highly polished              |
| `produced` | Deliberately crafted — proper shooting, intentional editing and post, semi-pro to strong indie   |
| `premium`  | Standout high-end production — exceptional cinematography, editing, sound design, or overall finish |

**Tagging guidance:**
- `raw` is for content where minimal production reflects the capture context, not a creative decision. A deliberately rough or lo-fi aesthetic that is clearly intentional (stylised grain, intentional noise, etc.) is better tagged `casual` or `produced` depending on the overall craft level.
- `casual` fits creator-led content, travel vlogs, and day-in-the-life formats where polish is secondary.
- `produced` is the most common value for intentional parkour edits.
- `premium` is reserved for work where the production itself is a distinguishing quality.

---

### 6. Presentation (`facet_presentation`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

How is the video framed for the viewer? This is about audience viewing mode and format — not polish, not subject matter.

| Value       | Description                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `standard`  | Traditional edited/watchable format — neither POV-led, vlog-led, nor otherwise distinct in framing            |
| `pov`       | First-person or tight follow-cam — immersive physical experience is central to how the video is presented      |
| `vlog`      | Personality-led, diary or travel format — direct-to-camera or creator framing drives the viewing experience    |
| `top-down`  | Bird's-eye or overhead angle — drone top-down, 2D-style, or overhead framing is the defining visual perspective |
| `stylized`  | Distinct format concept that defines the presentation — gameplay imitation, abstract visual structure, or other intentional framing device |

**Tagging guidance:**
- A normal parkour edit with no special framing → `standard`
- GoPro / first-person line experience → `pov`
- Creator-led day, trip, or event update → `vlog`
- Top-down drone / bird's-eye 2D perspective → `top-down`
- Gameplay-imitation, abstract concept, or intentionally unusual framing → `stylized`
- An experimental 16mm film with a defined visual concept fits `stylized` (the format is the statement)

---

### 7. Medium (`facet_medium`)

**Selection Mode:** Single-select  
**Field Type:** Text (enum)

What is the primary production medium? Use this to surface non-live-action content that needs its own filter.

| Value         | Description                                                              |
| ------------- | ------------------------------------------------------------------------ |
| `live-action` | Standard video footage — the default for nearly all parkour content      |
| `animation`   | Animated content — 2D, 3D, or stop-motion with parkour or movement themes |
| `mixed-media` | Intentional blend of live-action and animation or other non-video elements |

**Tagging guidance:**
- This field is nullable. For standard video footage, leave it null (the default is assumed to be live-action and does not need to be set explicitly).
- Set `animation` for fully animated parkour films or shorts.
- Use `mixed-media` only when the blend is a defining feature of the work, not incidental.

---

### 8. Era (`facet_era`) — Computed

**Selection Mode:** Auto-calculated  
**Field Type:** Computed from `year` field

Automatically determined from the video's release year. No manual tagging required.

| Value      | Year Range      |
| ---------- | --------------- |
| `pre-2000` | Before 2000     |
| `2000s`    | 2000–2009       |
| `2010s`    | 2010–2019       |
| `2020s`    | 2020–2029       |
| `2030s`    | 2030 and beyond |

**Note:** Computed in the `media_facets_view` view, not stored directly in the database.

---

### 9. Length (`facet_length`) — Computed

**Selection Mode:** Auto-calculated  
**Field Type:** Computed from `duration` field

Automatically determined from content duration. No manual tagging required.

| Value         | Duration Range   |
| ------------- | ---------------- |
| `short-form`  | Under 15 minutes |
| `medium-form` | 15–45 minutes    |
| `long-form`   | 45+ minutes      |

**Note:** Computed in the `media_facets_view` view, not stored directly in the database.

---

## Content Advisories (`content_warnings`)

**Selection Mode:** Multi-select  
**Field Type:** Text array  
**Purpose:** Advisory / safety metadata — not part of the browse taxonomy

`content_warnings` is a separate advisory field for flagging content that may not be suitable for all audiences. It is not a creative facet and should not be used for filtering or browsing. Its purpose is viewer safety and informed consent.

| Value              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `violence`         | Depictions of violence or graphic injury             |
| `substances`       | Alcohol, drugs, or substance use                     |
| `strong-language`  | Frequent or severe profanity                         |
| `sexual-content`   | Nudity or sexual material                            |
| `intense-themes`   | Distressing subjects: mental health, grief, trauma   |

This field is intentionally kept outside the main facet taxonomy so it does not influence browse or recommendation logic. Add warnings conservatively and only when clearly applicable.

---

## Classification Guidance — Edge Cases

The following examples clarify how to handle content that sits between categories.

| Content                                              | Classification                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Athlete highlight reel / year-end edit               | `type=session`, `focus=showreel`                                            |
| Personal journey / mindset / philosophy piece        | `type=talk`, `focus=conceptual`                                             |
| Equipment build or training setup tutorial           | `type=tutorial`, `focus=gear`                                               |
| Style or Chase Tag competition recap                 | `type=event`, `focus=competition`                                           |
| Jam recap or community gathering edit                | `type=event`, `focus=jam`                                                   |
| Annual awards ceremony (e.g. STORROR Awards)         | `type=talk`, `focus=awards`                                                 |
| Animated parkour short or film                       | `type=fiction` or `session`, `medium=animation`                             |
| GoPro / first-person line video                      | `type=session`, `presentation=pov`                                          |
| Creator-led travel or event vlog                     | `type=session` or `event`, `presentation=vlog`                              |
| Top-down bird's-eye drone / 2D overhead content      | `presentation=top-down`                                                     |
| Gameplay-imitation or abstract format-concept video  | `presentation=stylized`                                                     |
| Experimental 16mm or analog film                     | `production=produced` or `premium`, `presentation=stylized`                 |
| Narrative parkour film (story-heavy, less movement)  | `type=fiction`                                                              |
| Music video with parkour                             | `type=music-video`                                                          |

---

## Migration Guide — v1 → v2

The following maps old facet values to their v2 equivalents.

### Deprecated facets

| Old facet       | Status      | Replacement                        |
| --------------- | ----------- | ---------------------------------- |
| `facet_mood`    | Removed     | No direct replacement — editorial tags or curated collections if needed |
| `facet_film_style` | Removed  | Split into `facet_production` + `facet_presentation` |
| `facet_theme`   | Removed     | Replaced by `facet_focus`          |

### `facet_theme` value mapping

| Old `facet_theme` value | New classification                                                    |
| ----------------------- | --------------------------------------------------------------------- |
| `showcase`              | `facet_focus=showreel`                                                |
| `journey`               | `facet_type=talk`, `facet_focus=conceptual`                          |
| `competition`           | `facet_type=event`, `facet_focus=competition`                        |
| `event`                 | `facet_type=event` (use `facet_focus=jam` for jams)                  |
| `educational`           | `facet_type=tutorial` or `talk`                                      |
| `team`                  | Covered by `facet_type=session` — no direct replacement needed       |
| `travel`                | Covered by `facet_type=session` or `event` — no direct replacement   |
| `creative`              | `facet_presentation=stylized` or `facet_focus=conceptual`            |
| `entertainment`         | Covered by `facet_type` — no direct replacement needed               |

### `facet_film_style` value mapping

| Old `facet_film_style` value | New classification                                              |
| ----------------------------- | --------------------------------------------------------------- |
| `cinematic`                   | `facet_production=produced` or `premium`                       |
| `street-cinematic`            | `facet_production=produced`                                     |
| `skateish`                    | `facet_production=raw` or `casual`                             |
| `raw`                         | `facet_production=raw`                                          |
| `pov`                         | `facet_presentation=pov`                                        |
| `gonzo`                       | `facet_production=raw`, `facet_presentation=pov` if applicable |
| `vintage`                     | `facet_production=casual` or `raw`, `facet_presentation=stylized` |
| `minimalist`                  | `facet_production=produced` — no direct presentation mapping   |
| `experimental`                | `facet_presentation=stylized`                                   |
| `longtakes`                   | `facet_production=produced` — no direct presentation mapping   |
| `music-driven`                | `facet_type=music-video`                                        |
| `montage`                     | `facet_production=produced` — no direct presentation mapping   |
| `slowmo`                      | No direct mapping — editorial tag if needed                    |

---

## Database Implementation

### Tables & Columns

Facets are stored in the `public.media_items` table:

| Column                | Type         | Notes                                    |
| --------------------- | ------------ | ---------------------------------------- |
| `facet_type`          | TEXT         | CHECK constraint on allowed values       |
| `facet_focus`         | TEXT         | CHECK constraint on allowed values       |
| `facet_movement`      | TEXT[]       | GIN-indexed array                        |
| `facet_environment`   | TEXT         | CHECK constraint on allowed values       |
| `facet_production`    | TEXT         | CHECK constraint on allowed values       |
| `facet_presentation`  | TEXT         | CHECK constraint on allowed values       |
| `facet_medium`        | TEXT         | CHECK constraint on allowed values       |
| `content_warnings`    | TEXT[]       | GIN-indexed array — advisory only        |

### Views

**`public.media_facets_view`** — Provides access to all facets including computed fields `facet_era` and `facet_length`.

### Indexes

| Index                              | Type   | Column               |
| ---------------------------------- | ------ | -------------------- |
| `media_items_facet_type_idx`       | B-tree | `facet_type`         |
| `media_items_facet_focus_idx`      | B-tree | `facet_focus`        |
| `media_items_facet_environment_idx`| B-tree | `facet_environment`  |
| `media_items_facet_production_idx` | B-tree | `facet_production`   |
| `media_items_facet_presentation_idx`| B-tree | `facet_presentation` |
| `media_items_facet_medium_idx`     | B-tree | `facet_medium`       |
| `media_items_facet_movement_idx`   | GIN    | `facet_movement`     |
| `media_items_content_warnings_idx` | GIN    | `content_warnings`   |

GIN indexes are used for array columns to support efficient filtering with array operators.

---

## Migration History

1. **20251106000000_add_facets.sql** — Initial facets implementation
2. **20251107000000_remove_facet_modifiers.sql** — Removed `facet_modifiers` column (simplified model)
3. **20251107000001_fix_media_facets_view_security.sql** — Fixed view security properties
4. **20251108000000_remove_length_facet.sql** — Removed buggy auto-calculated length facet
5. **20251109000000_expand_film_styles.sql** — Expanded film style options from 5 to 13 values
6. **20251109000002_replace_tricking_with_style.sql** — Renamed "tricking" → "style", "dance" → "contemporary"
7. **20260218000001_add_length_facet.sql** — Re-added length facet with `short-form`/`medium-form`/`long-form`
8. **20260419000000_add_showcase_theme.sql** — Added `showcase` as a dedicated theme value
9. *(pending)* — v2 migration: add `facet_focus`, `facet_production`, `facet_presentation`, `facet_medium`, `content_warnings`; drop `facet_mood`, `facet_film_style`, `facet_theme`

---

## Usage Examples

### Filter by content type

```sql
SELECT * FROM media_items WHERE facet_type = 'session';
```

### Find all showreels

```sql
SELECT * FROM media_items
WHERE facet_type = 'session'
  AND facet_focus = 'showreel';
```

### Filter by movement style (array)

```sql
SELECT * FROM media_items WHERE 'flow' = ANY(facet_movement);
```

### Filter by multiple movement styles

```sql
SELECT * FROM media_items
WHERE facet_movement @> ARRAY['flow', 'technical'];
```

### Combined filter example

```sql
SELECT * FROM media_facets_view
WHERE facet_type = 'session'
  AND facet_environment = 'street'
  AND facet_production = 'premium'
  AND facet_era = '2020s';
```

### Find POV content

```sql
SELECT * FROM media_items WHERE facet_presentation = 'pov';
```

---

## Design Principles

1. **One job per facet.** Each facet answers a distinct question: what is it, what's it about, where, how polished, how presented, what medium. No two facets should answer the same question.

2. **Dominant value only.** For single-select facets — especially `facet_environment` — choose the value that best represents the dominant identity of the video, not every element present.

3. **Single-select vs multi-select.** Single-select (text) for mutually exclusive categories; multi-select (text array) for genuinely additive attributes like movement styles or content warnings.

4. **Computed facets are low maintenance.** `facet_era` and `facet_length` are derived from existing fields and require no tagging effort. Keep them.

5. **Content advisories are not browse facets.** `content_warnings` exists for viewer safety and informed consent, not for browsing or recommendations. Keep it separate.

6. **Performance.** B-tree indexes for single-value columns, GIN indexes for arrays.
