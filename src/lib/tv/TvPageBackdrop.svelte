<div class="page-backdrop" aria-hidden="true">
  <div class="hero-gradient hero-gradient--page"></div>
  <div class="hero-glow hero-glow--one hero-glow--page"></div>
  <div class="hero-glow hero-glow--two hero-glow--page"></div>
  <div class="hero-grid hero-grid--page"></div>
  <div class="hero-noise hero-noise--page"></div>
</div>

<style>
  .page-backdrop {
    position: absolute;
    inset: 0;
    z-index: -30;
    pointer-events: none;
    overflow: hidden;
  }

  .hero-gradient {
    position: absolute;
    inset: 0;
    background: var(--hero-gradient);
    opacity: var(--hero-gradient-opacity);
  }

  .hero-glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(120px);
    opacity: 0.7;
    mix-blend-mode: screen;
    animation: heroGlow 14s ease-in-out infinite alternate;
    will-change: transform, opacity;
  }

  .hero-glow--one {
    top: -28%;
    right: 12%;
    width: 420px;
    height: 420px;
    background: var(--hero-glow-one);
    animation-delay: -3s;
  }

  .hero-glow--two {
    bottom: -30%;
    left: 6%;
    width: 520px;
    height: 520px;
    background: var(--hero-glow-two);
    animation-delay: -8s;
  }

  .hero-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, var(--hero-grid-line-x) 1px, transparent 1px),
      linear-gradient(to bottom, var(--hero-grid-line-y) 1px, transparent 1px);
    background-size: 140px 140px;
    mask-image: radial-gradient(circle at 40% 30%, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0) 70%);
    opacity: var(--hero-grid-opacity);
  }

  .hero-noise {
    position: absolute;
    inset: -10px;
    background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none"%3E%3Cfilter id="n" x="0" y="0" width="1" height="1"%3E%3CfeTurbulence baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" type="fractalNoise"/%3E%3CfeColorMatrix type="saturate" values="0"/%3E%3C/filter%3E%3Crect width="200" height="200" filter="url(%23n)" opacity="0.22"/%3E%3C/svg%3E');
    background-size: 260px;
    opacity: var(--hero-noise-opacity);
    mix-blend-mode: soft-light;
    pointer-events: none;
    will-change: opacity;
  }

  .hero-gradient--page,
  .hero-grid--page,
  .hero-noise--page,
  .hero-glow--page {
    height: 100%;
  }

  .hero-gradient--page {
    opacity: 1;
  }

  .hero-grid--page {
    opacity: var(--hero-grid-opacity);
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.6) 65%, rgba(0, 0, 0, 0.2) 100%);
  }

  .hero-noise--page {
    opacity: var(--hero-noise-opacity);
  }

  .hero-glow--page {
    filter: blur(160px);
    opacity: var(--hero-glow-page-opacity);
    animation-duration: 20s;
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-glow {
      animation: none;
      opacity: 0.55;
    }

    .hero-noise {
      opacity: calc(var(--hero-noise-opacity) * 0.6);
    }

    .hero-grid {
      mask-image: none;
    }
  }

  @keyframes heroGlow {
    from {
      transform: translate3d(-12px, -10px, 0) scale(0.96);
      opacity: 0.68;
    }
    to {
      transform: translate3d(16px, 18px, 0) scale(1.04);
      opacity: 0.85;
    }
  }
</style>
