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

<div class="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
	<!-- Animated background elements -->
	<div class="absolute inset-0 -z-10">
		<div class="absolute top-20 left-10 w-2 h-2 bg-primary/20 rounded-full animate-ping" style="animation-delay: 0s; animation-duration: 3s;"></div>
		<div class="absolute top-32 right-20 w-1 h-1 bg-accent/30 rounded-full animate-ping" style="animation-delay: 1s; animation-duration: 4s;"></div>
		<div class="absolute bottom-40 left-1/4 w-1.5 h-1.5 bg-primary/15 rounded-full animate-ping" style="animation-delay: 2s; animation-duration: 5s;"></div>
		<div class="absolute bottom-20 right-1/3 w-2 h-2 bg-accent/20 rounded-full animate-ping" style="animation-delay: 0.5s; animation-duration: 3.5s;"></div>
		<div class="absolute -top-40 -right-32 w-80 h-80 bg-primary/5 rounded-full animate-pulse" style="animation-duration: 4s;"></div>
		<div class="absolute -bottom-40 -left-32 w-96 h-96 bg-accent/5 rounded-full animate-pulse" style="animation-duration: 6s; animation-delay: 2s;"></div>
	</div>

	<div class="max-w-2xl mx-auto text-center space-y-8 relative z-10">
		<!-- Logo -->
		<div class="flex justify-center mb-8">
			<a href="/" aria-label="Go to homepage" class="transition-all duration-300 hover:scale-105 hover:drop-shadow-lg">
				<img
					src="/images/jumpflix.webp"
					alt="JUMPFLIX parkour tv"
					class="filter drop-shadow-md"
					style="height: 120px; width: auto; max-height: 120px;"
					loading="eager"
				/>
			</a>
		</div>

		<!-- Error Status with Glass Effect -->
		<div class="space-y-6">
			<div class="relative">
				<div class="text-8xl md:text-9xl font-mono font-black text-primary/10 select-none">
					{status}
				</div>
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="text-4xl md:text-5xl font-bold text-primary/80 backdrop-blur-sm bg-background/30 px-6 py-2 rounded-2xl border border-border/50">
						{status}
					</div>
				</div>
			</div>
			<div class="text-6xl md:text-7xl animate-bounce-gentle">
				{#if status === 404}
					<div class="flex justify-center mb-4">
						<ParkourAnimation size={120} />
					</div>
				{:else}
					{getStatusEmoji(status)}
				{/if}
			</div>
		</div>

		<!-- Error Content with Glass Card -->
		<div class="backdrop-blur-sm bg-card/30 border border-border/50 rounded-3xl p-8 space-y-6 shadow-2xl">
			<h1 class="text-3xl md:text-5xl font-bold text-foreground leading-tight">
				{displayTitle}
			</h1>
			<p class="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
				{displayMessage}
			</p>
		</div>

		<!-- Action Buttons with Enhanced Design -->
		<div class="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
			<button 
				type="button"
				class="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-300 transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6 text-base min-w-[180px] shadow-lg hover:shadow-xl" 
				on:click={goHome}
			>
				<span class="text-lg">🏠</span> {m.error_backHome()}
			</button>
			
			{#if status !== 404}
				<span class="text-muted-foreground text-sm font-medium px-3">{m.error_or()}</span>
				<button 
					type="button"
					class="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-300 transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none border border-border bg-background hover:bg-muted/40 h-11 px-6 text-base min-w-[180px] shadow-md hover:shadow-lg" 
					on:click={tryAgain}
				>
					<span class="text-lg animate-spin-slow">🔄</span> {m.error_tryAgain()}
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
		0%, 20%, 53%, 80%, 100% {
			transform: translateY(0px) scale(1);
		}
		40%, 43% {
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