<div align="center">

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./static/images/jumpflix.webp" />
	<img src="./static/images/jumpflix.webp" alt="JUMPFLIX – Parkour & Freerunning TV" width="420" />
</picture>

### JUMPFLIX • Curated Parkour & Freerunning Movies & Series

<em>Open‑source, community‑driven streaming style catalog for the art of movement.</em>

---
</div>


[![Netlify Status](https://api.netlify.com/api/v1/badges/5b284dd6-29a6-4a8b-ae2f-69e3e2528b30/deploy-status)](https://app.netlify.com/projects/jumpflix/deploys) [![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

![jumpflix-tv-parkour-freerun-films-documentaries](https://github.com/user-attachments/assets/b1dae52c-3d6d-4117-a3cf-8e7a1f98c363)

## ✨ What is JUMPFLIX?

JUMPFLIX is a SvelteKit + Tailwind powered web app that curates the best parkour & freerunning feature films, documentaries and long‑form series—from legendary classics like *Jump London* to modern community productions and all‑women showcases. It isn't a pirate streaming site: instead it links responsibly to official YouTube/Vimeo embeds and (where appropriate) to legitimate paid providers (e.g. STORROR+, JustWatch, Vimeo On Demand, etc.).

The goal: an elegant, fast, mobile‑friendly discovery hub honoring the culture, people, history & progression of parkour.

## 🔥 Core Highlights

- Instant fuzzy-ish search & live filtering
- Deterministic random ordering (stable shuffle per session) with multiple sort modes (title, year, duration)
- Paid vs free toggle (surface free community films first if you want)
- Inline modal player for YouTube / Vimeo + external provider deep‑links
- Keyboard navigation (arrow keys + Enter)
- Mobile details overlay & desktop live sidebar panel
- Accessibility minded (focus handling, escape to close, reduced clutter)
- Internationalization (English + Dutch via Paraglide i18n)
- Type‑safe content model (`Movie`, `Series`) & utility helpers
- Zero backend: purely static deployable (edge/CDN friendly)

## 🧱 Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | SvelteKit (Svelte 5) |
| Styling | Tailwind CSS v4 + `tailwind-variants` + `tailwind-merge` + `tailwindcss-animate` |
| UI Bits | `bits-ui`, custom small components |
| i18n | `@inlang/paraglide-js` (messages generated from `/messages/*.json`) |
| Tooling | Vite, TypeScript, ESLint, Prettier, svelte-check |
| Content | Supabase (PostgreSQL) |

## 🗂 Directory Glimpse

```text
src/
  lib/
    server/        # Supabase client + content service
    tv/            # TV page components, store, types & utils
    paraglide/     # Generated i18n runtime (do not edit manually)
  routes/
    +page.svelte   # Main TV experience
supabase/          # SQL schema for Supabase project
scripts/           # Seed & utility scripts (blurhash, favicons, sitemap)
messages/          # Source translation JSON (en, nl)
project.inlang/    # Paraglide project settings
```

## 🚀 Quick Start

Clone & install dependencies:

```bash
git clone https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv.git
cd jumpflix.tv
npm install
```

Run the dev server:

```bash
npm run dev
```
Then open the printed local URL (typically `http://localhost:5173`). Add `-- --open` to auto‑launch:

```bash
npm run dev -- --open
```

Type safety & linting:

```bash
npm run check      # svelte-check + TS
npm run lint       # eslint + prettier check
npm run format     # auto-format
```

Build production bundle:

```bash
npm run build
npm run preview   # locally preview built output
```

## 🗄 Supabase Setup

The app expects content to come from Supabase. Create a Supabase project, then:

1. Apply the schema in `supabase/schema.sql` (Supabase SQL editor or CLI).
2. Generate service and anon keys under Project Settings → API.
3. Copy values into environment variables (see `.env.example` guidance below).
4. Seed the catalog by running the script once the tables exist.

### Environment variables

Create a `.env` (or populate your deployment provider) with:

```bash
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
SUPABASE_ANON_KEY="public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="service-role-key" # server-only
```

`SUPABASE_SERVICE_ROLE_KEY` must never ship to the browser—it's reserved for privileged server-side operations.

## 🌐 Internationalization (Paraglide)

Messages live in `/messages/{locale}.json`. Paraglide generates runtime modules into `src/lib/paraglide/` at build/dev time via the Vite plugin. Add a locale:

1. Create `messages/fr.json` (follow schema).
2. Add the locale code to `project.inlang/settings.json` under `locales`.
3. Restart dev server (or re-run `npm run dev`).
4. Import messages anywhere: `import * as m from '$lib/paraglide/messages';`

## 🧪 Content Model

Defined in `src/lib/tv/types.ts`:

```ts
interface Movie { id: number|string; title: string; year?: string; duration?: string; videoId?: string; vimeoId?: string; /* ... */ }
interface Series { id: number|string; title: string; playlistId?: string; videoCount?: number; /* ... */ }
```

Helper utilities (`utils.ts`) provide deterministic shuffling, sorting, search matching, and embed URL builders.

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow Keys | Navigate grid items |
| Enter | Open selected (inline player / details) |
| Escape | Close player / fullscreen / overlays |

## 🧊 Deterministic Shuffle

The grid's default ordering uses a seeded pseudo‑random generator → each session gets a stable “organic” ordering while still feeling non-linear. Sorting overrides (title, year, duration) apply after filtering.

## 💡 Design Philosophy

Minimal chrome, content first. Fast perceived performance. Respect creators by linking to official sources. Encourage exploration while remaining respectful to paid releases (clear paid badge & external provider links).

## 🤝 Contributing

Pull requests welcome—especially for:

- New verified films / documentaries / series (include legit source links)
- Additional locales (translations)
- Accessibility refinements
- Lightweight performance wins (bundle size, loading behavior)

Content PR checklist:

1. Add the entry to `movies.ts` or `series.ts` with `id`, `title`, `type`, and at least one of: `videoId`, `vimeoId`, or `externalUrl`.
2. Provide a `thumbnail` (web‑optimized `.webp` preferred; local images go in `static/images/posters/`).
3. Include `creators` / `starring` arrays when known (credit people!).
4. If paid: set `paid: true`, add `provider`, `price` (if meaningful) & `externalUrl`.
5. Run `npm run lint && npm run check` before submitting.

## 🔐 Licensing & Attribution

This repository contains only metadata & links/IDs to third‑party hosted videos. Actual video content is not redistributed. Thumbnails sourced from official providers or TMDB style paths should respect their respective licenses/terms. Remove any asset you have rights concerns about via PR.

Repository license: Creative Commons Attribution‑NonCommercial‑NoDerivatives 4.0 International (CC BY‑NC‑ND 4.0).

- Attribution required — credit “Max Seelig — MAXmade.nl — Jumpflix.tv”.
- NonCommercial — no commercial use.
- NoDerivatives — you may not distribute modified versions.
- Full legal code: [CC BY‑NC‑ND 4.0 legal code](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode)

Notes:

- Third‑party logos, thumbnails, and embedded videos remain under their own licenses/terms.
- By contributing, you agree your contribution is included under the repository’s CC BY‑NC‑ND 4.0 license.
- Because of “NoDerivatives”, redistribution of a modified fork is not permitted under this license.

## 🛠 Deployment

Currently adapter‑auto. For static/edge hosting (e.g. Netlify / Vercel) just build and deploy the output. If switching adapters, edit `svelte.config.js` accordingly.

## 🧾 Scripts Overview

| Script | Purpose |
|--------|---------|
| `dev` | Start Vite dev server |
| `build` | Production build |
| `preview` | Preview built app |
| `check` | Type & Svelte diagnostics |
| `lint` | Prettier check + ESLint |
| `format` | Auto-format all files |

## 📸 Visual Style

Cards, subtle hover brightness, glassy sidebar (desktop), content-first grid. Dark mode images delivered via `<picture>`/CSS toggling. Layout aims to stay performant with large poster sets.

## ❓ FAQ

**Is this a streaming service?** No, it embeds or links to legitimate sources.  
**Can I add my film?** Yes—open a PR with metadata & links.  
**Why some posters 404 in dev?** Ensure local poster assets are saved under `static/images/posters/` and paths start with `/images/posters/...`.  
**Why deterministic shuffle?** Keeps sessions feeling curated & avoids content “jitter” on each re-render.

## 📄 License

Creative Commons Attribution‑NonCommercial‑NoDerivatives 4.0 International (CC BY‑NC‑ND 4.0) © 2025 Max Seelig — MAXmade.nl — Jumpflix.tv. See `LICENSE`. Full legal code: [creativecommons.org/licenses/by-nc-nd/4.0/legalcode](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode)

---

Made with 🍿 by MAXmade
