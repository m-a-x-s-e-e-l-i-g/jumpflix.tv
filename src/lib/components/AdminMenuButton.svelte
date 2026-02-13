<script lang="ts">
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import { onMount } from 'svelte';

	let showAdminMenu = $state(false);
	let menuRef: HTMLDivElement | undefined = $state(undefined);
	let buttonRef: HTMLButtonElement | undefined = $state(undefined);

	function handleClickOutside(event: MouseEvent) {
		if (
			showAdminMenu &&
			menuRef &&
			buttonRef &&
			!menuRef.contains(event.target as Node) &&
			!buttonRef.contains(event.target as Node)
		) {
			showAdminMenu = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="relative">
	<button
		bind:this={buttonRef}
		onclick={() => (showAdminMenu = !showAdminMenu)}
		class="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
		aria-label="Admin menu"
		title="Admin"
	>
		<ShieldIcon class="size-5" />
	</button>

	{#if showAdminMenu}
		<div
			bind:this={menuRef}
			class="absolute top-full left-0 mt-2 w-56 rounded-lg border border-border bg-background shadow-lg overflow-hidden z-50"
		>
			<div class="px-4 py-3 border-b border-border">
				<p class="text-sm font-medium text-foreground truncate">Admin</p>
				<p class="text-xs text-muted-foreground truncate">Tools & moderation</p>
			</div>

			<a
				href="/admin/suggestions"
				onclick={() => (showAdminMenu = false)}
				class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
			>
				<WrenchIcon class="size-4" />
				<span>Suggestions</span>
			</a>

			<a
				href="/admin/reviews"
				onclick={() => (showAdminMenu = false)}
				class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
			>
				<WrenchIcon class="size-4" />
				<span>Reviews</span>
			</a>
		</div>
	{/if}
</div>
