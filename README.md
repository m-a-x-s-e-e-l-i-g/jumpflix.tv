<div align="center">

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./static/images/jumpflix-dark.webp" />
	<img src="./static/images/jumpflix-light.webp" alt="JUMPFLIX – Parkour & Freerunning TV" width="420" />
</picture>

### JUMPFLIX • Curated Parkour & Freerunning Movies & Playlists

<em>Open‑source, community‑driven streaming style catalog for the art of movement.</em>

---
</div>

## ✨ What is JUMPFLIX?
JUMPFLIX is a SvelteKit + Tailwind powered web app that curates the best parkour & freerunning feature films, documentaries and long‑form playlists—from legendary classics like *Jump London* to modern community productions and all‑women showcases. It isn't a pirate streaming site: instead it links responsibly to official YouTube/Vimeo embeds and (where appropriate) to legitimate paid providers (e.g. STORROR+, JustWatch, Vimeo On Demand, etc.).

The goal: an elegant, fast, mobile‑friendly discovery hub honoring the culture, people, history & progression of parkour.

## 🔥 Core Highlights
- Instant fuzzy-ish search & live filtering
- Deterministic random ordering (stable shuffle per session) with multiple sort modes (title, year, duration)
- Paid vs free toggle (surface free community films first if you want)
- Inline modal player for YouTube / Vimeo + external provider deep‑links
- Keyboard navigation (arrow keys + Enter)
- Mobile details overlay & desktop live sidebar panel
- Accessibility minded (focus handling, escape to close, reduced clutter)
- Light/Dark adaptive artwork
- Internationalization (English + Dutch via Paraglide i18n)
- Type‑safe content model (`Movie`, `Playlist`) & utility helpers
- Zero backend: purely static deployable (edge/CDN friendly)

## 🧱 Tech Stack
| Layer | Stack |
|-------|-------|
| Framework | SvelteKit (Svelte 5) |
| Styling | Tailwind CSS v4 + `tailwind-variants` + `tailwind-merge` + `tailwindcss-animate` |
| UI Bits | `bits-ui`, custom small components |
| i18n | `@inlang/paraglide-js` (messages generated from `/messages/*.json`) |
| Tooling | Vite, TypeScript, ESLint, Prettier, svelte-check |
| Content | Curated static arrays (`movies.ts`, `playlists.ts`) |

## 🗂 Directory Glimpse
```
src/
	lib/
		assets/        # Static curated movie & playlist data
		tv/            # TV page components, store, types & utils
		paraglide/     # Generated i18n runtime (do not edit manually)
	routes/
		+page.svelte   # Main TV experience
messages/          # Source translation JSON (en, nl)
project.inlang/    # Paraglide project settings
```

## 🚀 Quick Start
Clone & install dependencies:
```bash
git clone https://github.com/your-user/jumpflix.tv.git
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
interface Playlist { id: number|string; title: string; playlistId?: string; videoCount?: number; /* ... */ }
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
* New verified films / documentaries / playlists (include legit source links)
* Additional locales (translations)
* Accessibility refinements
* Lightweight performance wins (bundle size, loading behavior)

Content PR checklist:
1. Add the entry to `movies.ts` or `playlists.ts` with `id`, `title`, `type`, and at least one of: `videoId`, `vimeoId`, or `externalUrl`.
2. Provide a `thumbnail` (web‑optimized `.webp` preferred; local images go in `static/images/posters/`).
3. Include `creators` / `starring` arrays when known (credit people!).
4. If paid: set `paid: true`, add `provider`, `price` (if meaningful) & `externalUrl`.
5. Run `npm run lint && npm run check` before submitting.

## 🔐 Licensing & Attribution
This repository contains only metadata & links/IDs to third‑party hosted videos. Actual video content is not redistributed. Thumbnails sourced from official providers or TMDB style paths should respect their respective licenses/terms. Remove any asset you have rights concerns about via PR.

Codebase license: MIT (see below). Data contributions implicitly MIT as part of the repo unless otherwise stated.

## 🗺 Roadmap (Aspirational)
- [ ] User selectable locale UI toggle
- [ ] More robust search (token ranking / fuzzy threshold)
- [ ] Tag system (women-led, historical, documentary, cinematic, tour, competition) + filtering
- [ ] Offline manifest / PWA install capability
- [ ] Light analytics (privacy-preserving, self-hosted)
- [ ] “Up next” autoplay queue
- [ ] Trailer vs full length flag

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
MIT © 2025 — See `LICENSE` (add one if not present).

---
<div align="center">
Made with ❤️, TypeScript & movement energy.
<br/>
Got an idea? Open an issue.
</div>

