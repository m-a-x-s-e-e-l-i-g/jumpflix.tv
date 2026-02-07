<script lang="ts">
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  import SubmitFilmDialog from '$lib/components/SubmitFilmDialog.svelte';
  import * as m from '$lib/paraglide/messages';

  export let logoTilt = 0;

  function handleStartWatching(event: MouseEvent) {
    event.preventDefault();
    const searchSection = document.getElementById('search');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
</script>

<div class="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-8 text-center mt-12">
  <div class="hero-logo-stack">
    <a href="/" aria-label="Go to homepage" data-sveltekit-reload class="hero-logo-link">
      <Image
        src="/images/jumpflix.webp"
        alt="JUMPFLIX parkour tv"
        width={93}
        height={118}
        class="hero-logo"
        cdn={dev ? undefined : 'netlify'}
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
    </a>
    <div class="hero-logo-text" aria-hidden="true">
      <span style={`--logo-scroll-tilt: ${logoTilt.toFixed(3)}deg;`}>JUMPFLIX</span>
    </div>
  </div>

  <div class="flex flex-col items-center gap-4">
  <h1 class="text-center text-4xl font-black uppercase tracking-tight text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.65)] sm:text-5xl md:text-6xl">
      <span class="hero-title-gradient">{m.tv_heroHeading()}</span>
    </h1>
  <p class="max-w-2xl text-sm font-medium uppercase tracking-[0.28em] text-white/60 sm:text-xs">
      {m.tv_heroTagline()}
    </p>
  </div>

  <div class="mt-4 flex flex-col items-center gap-4 sm:flex-row">
    <a
      href="/#search"
      on:click={handleStartWatching}
      class="group inline-flex items-center gap-3 rounded-full bg-[#e50914] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_22px_40px_-15px_rgba(229,9,20,0.8)] transition hover:bg-[#f6121d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      {m.tv_heroCtaWatch()}
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-down"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M18 13l-6 6" /><path d="M6 13l6 6" /></svg>
    </a>
    <SubmitFilmDialog label={m.tv_heroCtaSubmit()} />
  </div>
</div>

<style>
  .hero-logo-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin-top: -4rem;
  }
  .hero-logo-text {
    font-family: 'Bebas Neue', 'Anton', 'Archivo Black', sans-serif;
    font-size: clamp(2.3rem, 4vw, 4.75rem);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    line-height: 0.86;
    margin-bottom: 6rem;
    user-select: none;
  }
  .hero-logo-text > span {
    display: inline-block;
    color: #e63b28;
    font-weight: 800;
    transform: perspective(100px) rotateX(calc(31deg + var(--logo-scroll-tilt, 0deg))) scaleX(1.04);
    transform-origin: center top;
    filter: saturate(110%) contrast(110%);
    text-shadow: var(--hero-logo-text-shadow);
  }
  @media (max-width: 479px) {
    .hero-logo-text {
      font-size: clamp(1rem, 10vw, 3.6rem);
      letter-spacing: 0.12em;
    }
  }
  .hero-logo-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms ease, filter 200ms ease;
  }
  .hero-logo-link:hover {
    transform: scale(1.03);
    filter: drop-shadow(0 25px 60px rgba(229, 9, 20, 0.45));
  }
  .hero-logo-link:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 8px;
  }
  :global(.hero-logo) {
    height: 118px;
    width: auto;
    filter: drop-shadow(0 25px 55px rgba(0, 0, 0, 0.5));
  }
  .hero-title-gradient {
    background-image: var(--hero-title-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    text-shadow: var(--hero-title-shadow);
  }
</style>
