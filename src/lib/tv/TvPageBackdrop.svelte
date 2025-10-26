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
      radial-gradient(135% 95% at 22% 18%, rgba(229, 9, 20, 0.38), transparent 68%),
      radial-gradient(130% 88% at 72% 20%, rgba(59, 130, 246, 0.32), transparent 74%),
      radial-gradient(140% 105% at 48% 65%, rgba(148, 163, 184, 0.14), transparent 78%),
      linear-gradient(205deg, rgba(59, 130, 246, 0.22), rgba(5, 7, 18, 0.22) 45%, transparent 82%),
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
      radial-gradient(150% 120% at 32% 24%, rgba(229, 9, 20, 0.34), transparent 72%),
      radial-gradient(150% 120% at 68% 18%, rgba(59, 130, 246, 0.28), transparent 74%),
      linear-gradient(215deg, rgba(5, 7, 18, 0.92), rgba(5, 7, 18, 0.46) 60%, rgba(5, 7, 18, 0.14) 100%);
    mix-blend-mode: soft-light;
    pointer-events: none;
  }

  .hero-gradient--page {
    height: 100%;
    opacity: 1;
  }
</style>
