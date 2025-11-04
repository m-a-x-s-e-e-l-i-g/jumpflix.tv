<script lang="ts">
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';

	let open = $state(false);
	let menuRef: HTMLDivElement | undefined = $state(undefined);
	let buttonRef: HTMLButtonElement | undefined = $state(undefined);

	const tips = $derived([
		m.help_tip_slowMotion()
	]);

	function toggleMenu() {
		open = !open;
	}

	function closeMenu() {
		open = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			open &&
			menuRef &&
			buttonRef &&
			!menuRef.contains(event.target as Node) &&
			!buttonRef.contains(event.target as Node)
		) {
			closeMenu();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeMenu();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="relative">
	<button
		bind:this={buttonRef}
		onclick={toggleMenu}
		aria-expanded={open}
		aria-haspopup="dialog"
		aria-label={m.help_buttonLabel()}
		class="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
	>
		<HelpCircleIcon class="size-5" />
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			role="dialog"
			aria-label={m.help_dialogLabel()}
			class="absolute top-full left-0 mt-2 w-64 rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2 z-50"
		>
			<div class="flex items-center justify-between gap-2 border-b border-border pb-2">
				<h2 class="text-sm font-semibold text-foreground">{m.help_title()}</h2>
				<button
					onclick={closeMenu}
					class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={m.help_close()}
				>
					<XIcon class="size-3.5" />
				</button>
			</div>
			<ul class="mt-2 space-y-2 text-xs text-muted-foreground">
				{#each tips as tip}
					<li class="flex items-start gap-2">
						<span class="mt-1 inline-block size-1.5 rounded-full bg-primary/70" aria-hidden="true"></span>
						<span>{tip}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
