<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';

	let {
		status = 500,
		title = '',
		message = ''
	} = $props<{ status?: number; title?: string; message?: string }>();

	const statusLabel = $derived(getStatusLabel(status));
	const displayTitle = $derived(title?.trim() || statusLabel);
	const displayDescription = $derived(`Error ${status}`);
	const detailMessage = $derived(message?.trim() || '');
	const metaDescription = $derived(`${status} - ${statusLabel}`);

	function getStatusLabel(code: number): string {
		switch (code) {
			case 400:
				return 'Bad request';
			case 401:
				return 'Unauthorized';
			case 403:
				return 'Access blocked';
			case 404:
				return 'Page not found';
			case 500:
				return 'Server hiccup';
			case 503:
				return 'Service unavailable';
			default:
				return 'Something went wrong';
		}
	}

	function goHome() {
		goto('/');
	}
</script>

<svelte:head>
	<title>Error {status} - JUMPFLIX</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="error-page" role="alert" aria-live="polite">
	<section class="error-card">
		<img src="/images/sad-jumpflix.webp" alt="JUMPFLIX error" class="error-logo" loading="eager" />

		<h1 class="error-heading">{displayTitle}</h1>
		<p class="error-description">{displayDescription}</p>
		{#if detailMessage}
			<p class="error-detail">{detailMessage}</p>
		{/if}

		<div class="error-actions">
			<button type="button" class="primary-action" onclick={goHome}>
				<span>{m.error_backHome()}</span>
			</button>
		</div>
	</section>
</div>

<style>
	.error-page {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
	}

	.error-card {
		width: min(480px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 1.25rem;
		padding: clamp(1.75rem, 4vw, 2.5rem);
		text-align: center;
	}

	.error-logo {
		height: clamp(120px, 12vw, 120px);
		width: auto;
	}

	.error-heading {
		font-size: clamp(2.2rem, 5vw, 3rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		color: hsl(var(--foreground));
	}

	.error-description {
		font-size: 1rem;
		font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: hsl(var(--muted-foreground));
	}

	.error-detail {
		margin-top: -0.25rem;
		font-size: 0.95rem;
		line-height: 1.4;
		color: hsl(var(--foreground));
		opacity: 0.9;
		max-width: 42ch;
	}

	.error-actions {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.primary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.85rem 2.75rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.95rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		cursor: pointer;
		border: none;
		background: #e50914;
		color: #ffffff;
		box-shadow: 0 24px 48px -22px rgba(229, 9, 20, 0.7);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}

	.primary-action:hover {
		background: #ff1a27;
		transform: translateY(-1px);
		box-shadow: 0 28px 56px -24px rgba(229, 9, 20, 0.72);
	}

	.primary-action:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 3px;
		box-shadow:
			0 24px 48px -22px rgba(229, 9, 20, 0.7),
			0 0 0 4px rgba(229, 9, 20, 0.2);
	}

	@media (min-width: 640px) {
		.error-card {
			gap: 1.75rem;
		}

		.error-actions {
			max-width: none;
		}
	}
</style>
