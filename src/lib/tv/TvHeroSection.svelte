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

<div class="hero-shell">
  <div class="hero-grid">
    <div class="hero-main">
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
        <h1 class="hero-logo-text">
          <span style={`--logo-scroll-tilt: ${logoTilt.toFixed(3)}deg;`}>JUMPFLIX</span>
        </h1>
      </div>

      <h2 class="hero-title jf-display">{m.tv_heroHeading()}</h2>
      <p class="hero-dek">{m.tv_heroTagline()}</p>

      <div class="hero-actions">
        <a href="/#search" on:click={handleStartWatching} class="hero-cta">
          {m.tv_heroCtaWatch()}
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M18 13l-6 6" /><path d="M6 13l6 6" /></svg>
        </a>
        <SubmitFilmDialog label={m.tv_heroCtaSubmit()} />
      </div>
    </div>

  </div>
</div>

<style>
  .hero-shell {
    position: relative;
    z-index: 10;
    margin: 0;
    max-width: none;
    padding: 0 clamp(1.5rem, 3vw, 3.75rem) 2.5rem;
  }

  .hero-grid {
    display: grid;
    gap: 3.5rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    align-items: center;
  }

  .hero-main {
    display: grid;
    gap: 1.25rem;
    text-align: center;
    justify-items: center;
  }

  .hero-logo-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
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
  .hero-logo-text {
    font-family: 'Bebas Neue', 'Anton', 'Archivo Black', sans-serif;
    font-size: clamp(2.1rem, 4vw, 4.2rem);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    line-height: 0.86;
    user-select: none;
  }

  .hero-title {
    font-size: clamp(2.6rem, 5vw, 4.6rem);
    color: var(--jf-ink);
    line-height: 1.02;
    text-shadow: 0 20px 45px rgba(2, 6, 23, 0.75);
  }

  .hero-dek {
    max-width: 480px;
    font-size: 0.95rem;
    line-height: 1.7;
    color: rgba(226, 232, 240, 0.72);
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: center;
  }

  .hero-cta {
    display: inline-flex;
    align-items: end;
    gap: 0.75rem;
    border-radius: 999px;
    background: linear-gradient(120deg, rgba(229, 9, 20, 0.95), rgba(229, 9, 20, 0.7));
    padding: 0.85rem 1.8rem;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #fff;
    box-shadow: 0 25px 50px -24px rgba(229, 9, 20, 0.75);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .hero-cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 30px 60px -26px rgba(229, 9, 20, 0.85);
  }

  .hero-cta:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 6px;
  }


  @media (max-width: 640px) {
    .hero-shell {
      padding: 2rem 1.25rem 1.5rem;
    }

    .hero-logo-text {
      font-size: clamp(1.4rem, 9vw, 3.2rem);
      letter-spacing: 0.12em;
    }

    .hero-actions {
      flex-direction: column;
      align-items: center;
    }
  }
  .hero-logo-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms ease, filter 200ms ease;
  }
  .hero-logo-link:hover {
    transform: translateY(-1px);
    filter: drop-shadow(0 25px 60px rgba(229, 9, 20, 0.45));
  }
  .hero-logo-link:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 6px;
  }
  :global(.hero-logo) {
    height: 110px;
    width: auto;
    filter: drop-shadow(0 22px 40px rgba(0, 0, 0, 0.45));
  }
</style>
