<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages';

	let castAvailable = $state(false);
	let casting = $state(false);
	let castContext: chrome.cast.framework.CastContext | null = null;

	onMount(() => {
		if (!browser || !window.chrome) return;

		// Wait for Cast API to initialize
		const initializeCast = () => {
			try {
				// Check if Cast API is available
				if (window.cast && window.cast.framework) {
					castContext = window.cast.framework.CastContext.getInstance();

					// Listen for Cast state changes
					castContext.addEventListener(
						window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
						(event: chrome.cast.framework.CastStateEventData) => {
							const state = event.castState;
							castAvailable = state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
							casting = state === window.cast.framework.CastState.CONNECTED;
						}
					);

					// Check initial state
					const currentState = castContext.getCastState();
					castAvailable = currentState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
					casting = currentState === window.cast.framework.CastState.CONNECTED;
				}
			} catch (e) {
				console.log('Cast API not available:', e);
			}
		};

		// Initialize immediately or wait for Cast API
		if (window.__onGCastApiAvailable) {
			const originalCallback = window.__onGCastApiAvailable;
			window.__onGCastApiAvailable = (isAvailable: boolean) => {
				originalCallback(isAvailable);
				if (isAvailable) {
					setTimeout(initializeCast, 100);
				}
			};
		} else {
			window.__onGCastApiAvailable = (isAvailable: boolean) => {
				if (isAvailable) {
					setTimeout(initializeCast, 100);
				}
			};
		}

		// Try to initialize immediately in case API is already loaded
		setTimeout(initializeCast, 500);
	});

	function handleCastClick() {
		if (!castContext) return;

		try {
			if (casting) {
				// Stop casting
				const session = castContext.getCurrentSession();
				if (session) {
					session.endSession(true);
				}
			} else {
				// Start casting - this will show the Cast device picker
				castContext.requestSession();
			}
		} catch (e) {
			console.error('Cast error:', e);
		}
	}
</script>

{#if castAvailable}
	<button
		onclick={handleCastClick}
		class="absolute top-4 right-16 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
		aria-label={casting ? m.tv_stopCasting() : m.tv_castToDevice()}
		title={casting ? m.tv_stopCasting() : m.tv_castToDevice()}
	>
		{#if casting}
			<!-- Cast active icon -->
			<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
				/>
			</svg>
		{:else}
			<!-- Cast icon -->
			<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
				/>
			</svg>
		{/if}
	</button>
{/if}
