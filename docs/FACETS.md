# JUMPFLIX Facet System

This document describes the facet taxonomy used across Jumpflix for browsing, filtering, and tagging media.

---

## Overview

Facets are structured metadata dimensions that make the catalog browsable and filterable. The system is split into:

- **Manual creative facets** — tagged by editors per media item
- **Computed helper facets** — automatically derived from other fields (year, duration)
- **Content warnings** — separate advisory field, not a browse facet

---

## Manual Creative Facets

### 1. `facet_type` — Single-select

_What kind of content is this?_

| Value | Description |
|-------|-------------|
| `session` | Team edit or session footage from training; includes showreels |
| `event` | Jam, competition, or organized gathering |
| `documentary` | Real stories and insights into parkour culture |
| `fiction` | Narrative-driven parkour film with storyline |
| `talk` | Talk/presentation format — ideas, interviews, personal journeys, mindset pieces |
| `tutorial` | Educational content teaching techniques; includes gear/setup tutorials |
| `music-video` | Music-driven edit with a track-focused structure |

> **Rule:** Tag the dominant content identity. A narrative film with more story than movement still fits `fiction`.

---

### 2. `facet_focus` — Single-select

_What is the creative angle or special intent of this video?_

| Value | Description |
|-------|-------------|
| `showreel` | Best-of reel, athlete profile, or year compilation (e.g. athlete/year edits) |
| `competition` | Contest, battle, speed run, or style competition |
| `jam` | Jam or community gathering recap |
| `conceptual` | Reflective, mindset-driven, or personal journey (e.g. "fear and growth" pieces) |
| `gear` | Equipment, setup, or training tool focused |
| `awards` | Annual ceremony or awards format (e.g. STORROR Awards) |

> **Example:** A showreel = `facet_type=session` + `facet_focus=showreel`

> **Example:** STORROR Awards = `facet_type=talk` + `facet_focus=awards`

---

### 3. `facet_movement` — Multi-select

_What style of movement is featured?_

| Value | Description |
|-------|-------------|
| `flow` | Continuous, fluid movement lines |
| `big-sends` | Commitment-heavy moves, gaps, and larger consequences |
| `style` | Distinct personal expression, shape, and movement flavor |
| `descents` | Drops, downclimbs, and vertical movement |
| `technical` | Precision, problem-solving, and dense movement detail |
| `speed` | Chase energy, fast lines, and momentum-focused movement |
| `oldskool` | Earlier-school movement language and classic parkour feel |
| `contemporary` | Modern movement vocabulary and newer stylistic cues |

> **Multi-select:** Tag all movement styles that are meaningfully present in the video.

---

### 4. `facet_environment` — Single-select

_What is the dominant setting?_

| Value | Description |
|-------|-------------|
| `street` | Urban streets, plazas, rails, and public architecture |
| `rooftops` | Movement across roofs, ledges, and elevated city spaces |
| `nature` | Forests, rocks, trails, or natural terrain |
| `urbex` | Abandoned, decayed, or industrial explored locations |
| `gym` | Indoor training spaces, setups, and gym-built lines |

> **Rule:** Tag the **dominant** setting — the one that best defines the visual identity of the video. Do not use for incidental appearances of a setting. A video that is primarily rooftop content but passes through a street is still `rooftops`.

---

### 5. `facet_production` — Single-select

_How polished is this production?_

| Value | Description |
|-------|-------------|
| `raw` | Minimally edited — phone clips, rough capture, real sound, little polish |
| `casual` | Creator-made with light editing — vlog-ish or lightly structured, clear intent but not highly polished |
| `produced` | Clearly crafted edit or film with deliberate shooting, editing, and post-production |
| `premium` | Standout high-end production with exceptional cinematography, editing, sound, and design |

> **Example:** Phone session clips with real sound = `raw`
> **Example:** GoPro vlog with some B-roll = `casual`
> **Example:** Intentional edit with color grade = `produced`
> **Example:** Major team film with a full crew = `premium`

---

### 6. `facet_presentation` — Single-select

_How is this video packaged and presented?_

| Value | Description |
|-------|-------------|
| `standard` | Traditional edited format — neither POV-led nor vlog-led |
| `pov` | First-person or tight follow-cam perspective is central to the experience |
| `vlog` | Personality-led, diary or travel format with direct-to-camera or creator framing |
| `top-down` | Bird's-eye drone or overhead angle used as a primary visual style |
| `stylized` | Unconventional format — gameplay imitation, surreal framing, or intentional visual gimmick |

> **Note:** `presentation` is independent of `production`. A POV video can be `raw` or `produced`.

> **Example:** 16mm Bolex experimental = `facet_presentation=stylized` + `facet_production=produced`

> **Example:** Top-down 2D parkour from drone = `facet_presentation=top-down`

---

### 7. `facet_medium` — Single-select

_What medium is this content in?_

| Value | Description |
|-------|-------------|
| `live-action` | Standard filmed real-world footage (default for most content) |
| `animation` | Animated or illustrated content — traditional, 3D, or digital |
| `mixed-media` | Combination of live footage and animated or graphical elements |

> **Note:** Most videos will not need this tag — `live-action` is the default. Only tag `animation` or `mixed-media` when it's meaningfully defining the video.

---

## Computed Helper Facets

These are **automatically calculated** from other fields and do not require manual tagging.

### 8. `facet_era` — Computed from `year`

| Value | Range |
|-------|-------|
| `pre-2000` | Before 2000 |
| `2000s` | 2000–2009 |
| `2010s` | 2010–2019 |
| `2020s` | 2020–2029 |
| `2030s` | 2030+ |

### 9. `facet_length` — Computed from `duration`

| Value | Range |
|-------|-------|
| `short-form` | Under 15 minutes |
| `medium-form` | 15–45 minutes |
| `long-form` | 45+ minutes |

---

## Content Warnings

`content_warnings` is a **multi-select advisory field** — separate from the browse facets.

It is used for viewer advisories and should not be treated as a creative browse dimension.

| Value | Description |
|-------|-------------|
| `violence` | Contains depictions of violence or injury |
| `substances` | Contains references to alcohol, drugs, or other substances |
| `strong-language` | Contains explicit or strong language |
| `sexual-content` | Contains sexual or adult content |
| `intense-themes` | Contains emotionally intense or distressing themes |

---

## Classification Examples

| Video | `type` | `focus` | `presentation` | `production` | `medium` |
|-------|--------|---------|----------------|--------------|---------|
| Year-end athlete edit (showreel) | `session` | `showreel` | `standard` | `produced` | — |
| STORROR Awards ceremony | `talk` | `awards` | `standard` | `produced` | — |
| Chase Tag competition | `event` | `competition` | `standard` | `produced` | — |
| Community jam recap | `event` | `jam` | `standard` | `casual` | — |
| Fear and mindset piece | `talk` | `conceptual` | `vlog` | `casual` | — |
| Gear/rig setup tutorial | `tutorial` | `gear` | `standard` | `casual` | — |
| GoPro POV session | `session` | — | `pov` | `raw` | — |
| Drone top-down parkour | `session` | — | `top-down` | `produced` | — |
| Gameplay-style stylized video | `session` | — | `stylized` | `produced` | — |
| 16mm Bolex experimental film | `fiction` | — | `stylized` | `produced` | — |
| Animated parkour short | — | — | — | — | `animation` |
| Music video with animation | `music-video` | — | — | `produced` | `mixed-media` |
| Personal vlog series | `session` | — | `vlog` | `casual` | — |

---

## Migration from Previous System

The following old facets were removed or replaced:

| Old | Status | Destination |
|-----|--------|-------------|
| `facet_mood` | **Removed** | Not replaced — no clean destination |
| `facet_film_style` | **Replaced** | → `facet_production` (quality level) + `facet_presentation` (format) |
| `facet_theme` | **Replaced** | → `facet_focus` (narrowed to actionable browse values) |
| `facet_type=vlog` | **Removed** | → `facet_type=session` + `facet_presentation=vlog` |

### Legacy value mappings used in the database migration

| Old value | New value |
|-----------|-----------|
| `facet_theme=showcase` | `facet_focus=showreel` |
| `facet_theme=competition` | `facet_focus=competition` |
| `facet_theme=event` | `facet_focus=jam` |
| `facet_theme=journey` | `facet_focus=conceptual` |
| `facet_theme=educational` | null (type already handles via `tutorial`/`talk`) |
| `facet_theme=team`, `travel`, `creative`, `entertainment` | null (no clean destination) |
| `facet_film_style=pov` | `facet_presentation=pov` |
| `facet_film_style=raw` | `facet_production=raw` |
| `facet_film_style=cinematic`, `street-cinematic`, `minimalist`, `experimental`, `longtakes`, `music-driven`, `montage`, `slowmo` | `facet_production=produced` |
| `facet_film_style=skateish`, `gonzo`, `vintage` | `facet_production=casual` |
| `facet_type=vlog` | `facet_type=session` + `facet_presentation=vlog` |

> **Note on lossy mappings:** Some old film style values (e.g. `longtakes`, `music-driven`, `montage`) describe editing technique rather than production quality. These are mapped to `produced` as a best-effort default. Review individual items if precision matters.

---

## Tagging Rules

1. **Dominant identity rule:** Always tag based on what the video _primarily_ is, not what appears in it incidentally.
2. **Environment is single-select:** Choose the one dominant setting. A video with brief rooftop moments that is primarily street is `street`.
3. **Presentation is separate from production:** A `raw` session can still be `pov`. A `premium` film can be `standard` presentation.
4. **`facet_focus` is optional:** Only tag when a specific angle meaningfully defines the video and helps browsing. Most `session` videos don't need a focus.
5. **`facet_medium` is optional:** Default is `live-action`. Only tag `animation` or `mixed-media` when it's the defining characteristic.
6. **Content warnings are non-browse:** Don't use them for navigation. They're advisory only.
