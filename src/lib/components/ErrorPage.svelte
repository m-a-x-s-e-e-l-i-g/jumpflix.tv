<script lang="ts">
	import ParkourAnimation from '$lib/components/ParkourAnimation.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';

	export let status: number = 500;
	export let message: string = '';
	export let title: string = '';

	// Auto-determine title and message based on status code if not provided
	$: displayTitle = title || getDefaultTitle(status);
	$: displayMessage = message ? translateMessage(message) : getDefaultMessage(status);

	function translateMessage(msg: string): string {
		// Check if message is a translation key
		if (msg === 'error_server_404') {
			return m.error_server_404();
		}
		return msg;
	}

	function getDefaultTitle(code: number): string {
		switch (code) {
			case 404:
				return m.error_404_title();
			case 500:
				return m.error_500_title();
			default:
				return m.error_general_title();
		}
	}

	function getDefaultMessage(code: number): string {
		switch (code) {
			case 404:
				return m.error_404_description();
			case 500:
				return m.error_500_description();
			default:
				return m.error_general_description();
		}
	}

	function goHome() {
		goto('/');
	}

	function tryAgain() {
		window.location.reload();
	}

	function getStatusEmoji(code: number): string {
		switch (code) {
			case 404:
				return '🏃‍♂️💨'; // Person running away (like the page)
			case 500:
				return '🤸‍♂️💥'; // Person doing acrobatics with crash
			case 403:
				return '🚫🏃‍♂️'; // No entry + runner
			default:
				return '⚠️🆘'; // Warning + SOS
		}
	}
</script>

<svelte:head>
	<title>Error {status} - JUMPFLIX</title>
	<meta name="description" content={displayMessage} />
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6 text-foreground"
>
	<!-- Animated background elements -->
	<div class="absolute inset-0 -z-10">
		<div
			class="absolute top-20 left-10 h-2 w-2 animate-ping rounded-full bg-primary/20"
			style="animation-delay: 0s; animation-duration: 3s;"
		></div>
		<div
			class="absolute top-32 right-20 h-1 w-1 animate-ping rounded-full bg-accent/30"
			style="animation-delay: 1s; animation-duration: 4s;"
		></div>
		<div
			class="absolute bottom-40 left-1/4 h-1.5 w-1.5 animate-ping rounded-full bg-primary/15"
			style="animation-delay: 2s; animation-duration: 5s;"
		></div>
		<div
			class="absolute right-1/3 bottom-20 h-2 w-2 animate-ping rounded-full bg-accent/20"
			style="animation-delay: 0.5s; animation-duration: 3.5s;"
		></div>
		<div
			class="absolute -top-40 -right-32 h-80 w-80 animate-pulse rounded-full bg-primary/5"
			style="animation-duration: 4s;"
		></div>
		<div
			class="absolute -bottom-40 -left-32 h-96 w-96 animate-pulse rounded-full bg-accent/5"
			style="animation-duration: 6s; animation-delay: 2s;"
		></div>
	</div>

	<div class="relative z-10 mx-auto max-w-2xl space-y-8 text-center">
		<!-- Logo -->
		<div class="mb-8 flex justify-center">
			<a
				href="/"
				aria-label="Go to homepage"
				class="transition-all duration-300 hover:scale-105 hover:drop-shadow-lg"
			>
				<img
					src="/images/jumpflix.webp"
					alt="JUMPFLIX parkour tv"
					class="drop-shadow-md filter"
					style="height: 120px; width: auto; max-height: 120px;"
					loading="eager"
				/>
			</a>
		</div>

		<!-- Error Status with Glass Effect -->
		<div class="space-y-6">
			<div class="relative">
				<div class="font-mono text-8xl font-black text-primary/10 select-none md:text-9xl">
					{status}
				</div>
				<div class="absolute inset-0 flex items-center justify-center">
					<div
						class="rounded-2xl border border-border/50 bg-background/30 px-6 py-2 text-4xl font-bold text-primary/80 backdrop-blur-sm md:text-5xl"
					>
						{status}
					</div>
				</div>
			</div>
			<div class="animate-bounce-gentle text-6xl md:text-7xl">
				{#if status === 404}
					<div class="mb-4 flex justify-center">
						<ParkourAnimation size={120} />
					</div>
				{:else}
					{getStatusEmoji(status)}
				{/if}
			</div>
		</div>

		<!-- Error Content with Glass Card -->
		<div
			class="space-y-6 rounded-3xl border border-border/50 bg-card/30 p-8 shadow-2xl backdrop-blur-sm"
		>
			<h1 class="text-3xl leading-tight font-bold text-foreground md:text-5xl">
				{displayTitle}
			</h1>
			<p class="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
				{displayMessage}
			</p>
		</div>

		<!-- Action Buttons with Enhanced Design -->
		<div class="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
			<button
				type="button"
				class="inline-flex h-11 min-w-[180px] transform items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-medium text-primary-foreground shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
				on:click={goHome}
			>
				<span class="text-lg">🏠</span>
				{m.error_backHome()}
			</button>

			{#if status !== 404}
				<span class="px-3 text-sm font-medium text-muted-foreground">{m.error_or()}</span>
				<button
					type="button"
					class="inline-flex h-11 min-w-[180px] transform items-center justify-center gap-2 rounded-md border border-border bg-background px-6 text-base font-medium shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={tryAgain}
				>
					<span class="animate-spin-slow text-lg">🔄</span>
					{m.error_tryAgain()}
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Enhanced bounce animation for emoji */
	.animate-bounce-gentle {
		animation: bounceGentle 3s ease-in-out infinite;
	}

	@keyframes bounceGentle {
		0%,
		20%,
		53%,
		80%,
		100% {
			transform: translateY(0px) scale(1);
		}
		40%,
		43% {
			transform: translateY(-15px) scale(1.05);
		}
		70% {
			transform: translateY(-8px) scale(1.02);
		}
		90% {
			transform: translateY(-3px) scale(1.01);
		}
	}

	/* Slow spin animation */
	.animate-spin-slow {
		animation: spin 3s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Glass effect enhancement */
	.backdrop-blur-sm {
		backdrop-filter: blur(4px);
	}
</style>
