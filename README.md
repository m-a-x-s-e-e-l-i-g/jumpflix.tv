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

JUMPFLIX is a SvelteKit + Tailwind powered web app that curates the best parkour & freerunning feature films, documentaries and long‑form series—from legendary classics like _Jump London_ to modern community productions and all‑women showcases. It isn't a pirate streaming site: instead it links responsibly to official YouTube/Vimeo embeds and (where appropriate) to legitimate paid providers (e.g. STORROR+, JustWatch, Vimeo On Demand, etc.).

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
- Supabase backend for content management with interactive admin CLI
- Automatic episode syncing from YouTube playlists (no API key needed)
- BlurHash placeholders for smooth image loading
- SEO optimized with automatic sitemap generation and search engine submission
- PWA support with offline capabilities

## 🧱 Tech Stack

| Layer        | Stack                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Framework    | SvelteKit (Svelte 5)                                                             |
| Styling      | Tailwind CSS v4 + `tailwind-variants` + `tailwind-merge` + `tailwindcss-animate` |
| UI Bits      | `bits-ui`, `svelte-sonner`, custom components                                    |
| Video Player | Vidstack with YouTube/Vimeo providers                                            |
| i18n         | `@inlang/paraglide-js` (messages generated from `/messages/*.json`)              |
| Tooling      | Vite, TypeScript, ESLint, Prettier, svelte-check                                 |
| Backend      | Supabase (PostgreSQL) with service-role admin access                             |

## 🗂 Directory Glimpse

```text
src/
  lib/
    server/           # Supabase client + content service
    tv/               # TV page components, store, types & utils
    paraglide/        # Generated i18n runtime (do not edit manually)
    components/       # Reusable UI components
    assets/           # Static content data & blurhash mappings
  routes/
    +page.svelte      # Main TV experience
    movie/[slug]/     # Individual movie pages
    series/[slug]/    # Individual series pages
    sitemap.xml/      # Dynamic sitemap generation
supabase/             # SQL schema for Supabase project
  migrations/         # Database migration files
scripts/              # Admin CLI, seed scripts, blurhash, favicon, sitemap generation
content/              # JSON seed data for movies & series
messages/             # Source translation JSON (en, nl)
project.inlang/       # Paraglide project settings
static/
  images/posters/     # Movie and series poster images
  icons/              # PWA icons (generated)
```

## 🚀 Quick Start

Clone & install dependencies:

```bash
git clone https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv.git
cd jumpflix.tv
npm install
```

**Set up environment variables** - Create a `.env` file:

```bash
# Supabase (required for content)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram (optional - for film submissions)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

# Sitemap submission (optional)
FORCE_SITEMAP_SUBMISSION=false
```

See [Supabase Setup](#-supabase-setup) below for details.

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

The app requires Supabase for content management. Here's how to set it up:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Apply the schema**: Run the SQL in `supabase/migrations/202510310001_initial_schema.sql` in your Supabase SQL editor
3. **Get your credentials** from Project Settings → API:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Add to `.env`** (see above)
5. **Seed the database** (optional):

```bash
npm run admin
```

Select "Add Movie" or "Add Series" to populate content, or use the seed files in `content/`.

### Admin CLI

The admin CLI (`scripts/admin-cli.ts`) provides an interactive interface for content management:

```bash
npm run admin
```

Features:

- 🎥 **Add Movie** - With auto-generated blurhash from thumbnails
- 📺 **Add Series** - With automatic YouTube playlist episode syncing
- 🔄 **Refresh Episodes** - Sync episodes from YouTube playlists (no API key needed)
- 📋 **List All Content**
- ✏️ **Edit Content**
- 🗑️ **Delete Content**

See `scripts/README.md` for detailed CLI documentation.

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

Defined in `src/lib/supabase/types.ts`:

```ts
interface MediaItem {
	id: number;
	slug: string;
	type: 'movie' | 'series';
	title: string;
	description?: string;
	thumbnail?: string;
	blurhash?: string;
	paid?: boolean;
	provider?: string;
	external_url?: string;
	year?: string;
	duration?: string;
	video_id?: string;
	vimeo_id?: string;
	trakt?: string;
	creators?: string[];
	starring?: string[];
	video_count?: number; // For series
}
```

Helper utilities (`src/lib/tv/utils.ts`) provide deterministic shuffling, sorting, search matching, and embed URL builders.

## 🎮 Keyboard Shortcuts

| Key        | Action                                  |
| ---------- | --------------------------------------- |
| Arrow Keys | Navigate grid items                     |
| Enter      | Open selected (inline player / details) |
| Escape     | Close player / fullscreen / overlays    |

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

1. Use the **admin CLI** (`npm run admin`) to add content with proper validation
2. Provide a `thumbnail` (web‑optimized `.webp` preferred; local images go in `static/images/posters/`)
3. BlurHash will be auto-generated from thumbnails
4. Include `creators` / `starring` arrays when known (credit people!)
5. If paid: set `paid: true`, add `provider` & `external_url`
6. For series: provide YouTube playlist IDs for automatic episode syncing
7. Run `npm run lint && npm run check` before submitting

Alternatively, use the JSON seed files in `content/` - see `content/README.md`.

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

| Script             | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `dev`              | Start Vite dev server                           |
| `build`            | Production build + automatic sitemap submission |
| `build:no-sitemap` | Production build without sitemap submission     |
| `preview`          | Preview built app                               |
| `check`            | Type & Svelte diagnostics                       |
| `lint`             | Prettier check + ESLint                         |
| `generate:favicon` | Generate favicon files                          |
| `admin`            | Interactive admin CLI for content management    |
| `submit-sitemap`   | Submit sitemap to search engines                |
| `generate:blurhash`| Generate BlurHash placeholders for posters      |
| `generate:icons`   | Generate PWA icons from brand assets            |
| `generate:favicon` | Generate favicon files                          |

## 📦 Additional Features

### BlurHash Placeholders

Posters use BlurHash for smooth loading. Generate hashes for new posters:

```bash
npm run generate:blurhash
```

See `docs/BLURHASH.md` for details.

### Sitemap & SEO

The app automatically:

- Generates a sitemap at `/sitemap.xml`
- Submits to search engines after build (configurable)
- Includes structured data (Schema.org) for movies and series

See `docs/SITEMAP_SUBMISSION.md` for configuration.

### PWA Icons

Generate icons from your brand assets:

```bash
npm run generate:icons
npm run generate:favicon
```

Place source images in `static/brand/` - see `static/brand/README.md`.

## 📸 Visual Style

Cards, subtle hover brightness, glassy sidebar (desktop), content-first grid. Dark mode images delivered via `<picture>`/CSS toggling. Layout aims to stay performant with large poster sets.

## ❓ FAQ

**Is this a streaming service?** No, it embeds or links to legitimate sources.  
**Can I add my film?** Yes—use the admin CLI (`npm run admin`) or open a PR with metadata & links.  
**How do I manage content?** Use the interactive admin CLI: `npm run admin`  
**Do I need a YouTube API key?** No, episode syncing uses public Atom feeds.  
**Why some posters 404 in dev?** Ensure local poster assets are saved under `static/images/posters/` and paths start with `/images/posters/...`.  
**Why deterministic shuffle?** Keeps sessions feeling curated & avoids content "jitter" on each re-render.  
**How do I update episodes?** Run "Refresh Episodes" in the admin CLI - it syncs from YouTube automatically.

## 📄 License

Creative Commons Attribution‑NonCommercial‑NoDerivatives 4.0 International (CC BY‑NC‑ND 4.0) © 2025 Max Seelig — MAXmade.nl — Jumpflix.tv. See `LICENSE`. Full legal code: [creativecommons.org/licenses/by-nc-nd/4.0/legalcode](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode)

---

Made with 🍿 by MAXmade
