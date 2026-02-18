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
			radial-gradient(120% 100% at 18% 16%, rgba(229, 9, 20, 0.36), transparent 70%),
			radial-gradient(130% 120% at 80% 12%, rgba(37, 99, 235, 0.28), transparent 74%),
			radial-gradient(120% 120% at 50% 70%, rgba(148, 163, 184, 0.16), transparent 80%),
			linear-gradient(210deg, rgba(20, 30, 55, 0.55), rgba(5, 7, 18, 0.3) 45%, transparent 85%),
			linear-gradient(
				180deg,
				rgba(5, 7, 18, 0.95),
				rgba(5, 7, 18, 0.75) 55%,
				rgba(5, 7, 18, 1) 100%
			);
		background-repeat: no-repeat;
		opacity: 1;
	}

	.hero-gradient::after {
		content: '';
		position: absolute;
		inset: -14% -18% -18%;
		background:
			radial-gradient(140% 120% at 28% 24%, rgba(229, 9, 20, 0.28), transparent 72%),
			radial-gradient(140% 120% at 70% 18%, rgba(59, 130, 246, 0.22), transparent 74%),
			linear-gradient(
				210deg,
				rgba(5, 7, 18, 0.9),
				rgba(5, 7, 18, 0.5) 60%,
				rgba(5, 7, 18, 0.18) 100%
			);
		mix-blend-mode: soft-light;
		pointer-events: none;
	}

	.hero-gradient--page {
		height: 100%;
		opacity: 1;
	}
</style>
