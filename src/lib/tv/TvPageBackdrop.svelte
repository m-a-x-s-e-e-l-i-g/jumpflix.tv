<div class="page-backdrop" aria-hidden="true">
  <div class="hero-gradient hero-gradient--page"></div>
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
    background:
      radial-gradient(140% 96% at 18% 14%, rgba(255, 255, 255, 0.55), transparent 62%),
      radial-gradient(120% 92% at 70% 18%, rgba(244, 114, 182, 0.22), transparent 74%),
      radial-gradient(150% 110% at 90% 52%, rgba(14, 165, 233, 0.18), transparent 78%),
      linear-gradient(190deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.18) 42%, transparent 82%),
      var(--hero-gradient);
    background-repeat: no-repeat;
    opacity: var(--hero-gradient-opacity);
    transition: opacity 320ms ease;
  }

  .hero-gradient::after {
    content: '';
    position: absolute;
    inset: -12% -16% -20%;
    background:
      radial-gradient(150% 120% at 30% 18%, rgba(255, 255, 255, 0.36), transparent 68%),
      linear-gradient(205deg, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.28) 58%, rgba(15, 23, 42, 0.08) 100%);
    mix-blend-mode: soft-light;
    pointer-events: none;
  }

  :global(.dark) .hero-gradient {
    background:
      radial-gradient(135% 95% at 22% 18%, rgba(229, 9, 20, 0.38), transparent 68%),
      radial-gradient(130% 88% at 72% 20%, rgba(59, 130, 246, 0.32), transparent 74%),
      radial-gradient(140% 105% at 48% 65%, rgba(148, 163, 184, 0.14), transparent 78%),
      linear-gradient(205deg, rgba(59, 130, 246, 0.22), rgba(5, 7, 18, 0.22) 45%, transparent 82%),
      var(--hero-gradient);
  }

  :global(.dark) .hero-gradient::after {
    background:
      radial-gradient(150% 120% at 32% 24%, rgba(229, 9, 20, 0.34), transparent 72%),
      radial-gradient(150% 120% at 68% 18%, rgba(59, 130, 246, 0.28), transparent 74%),
      linear-gradient(215deg, rgba(5, 7, 18, 0.92), rgba(5, 7, 18, 0.46) 60%, rgba(5, 7, 18, 0.14) 100%);
  }

  .hero-gradient--page {
    height: 100%;
    opacity: 1;
  }
</style>
