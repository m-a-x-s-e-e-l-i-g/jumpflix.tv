<script lang="ts">
	import { user, loading } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabaseClient';
	import AuthDialog from '$lib/components/AuthDialog.svelte';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';
	import { SheetTrigger } from '$lib/components/ui/sheet';
	import UserIcon from '@lucide/svelte/icons/user';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import type { UserXpSummary } from '$lib/xp';
	import XPopMark from '$lib/components/XPopMark.svelte';

	let { xp = null }: { xp?: UserXpSummary | null } = $props();

	let authDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let showUserMenu = $state(false);
	let menuRef: HTMLDivElement | undefined = $state(undefined);
	let buttonRef: HTMLButtonElement | undefined = $state(undefined);

	async function handleSignOut() {
		if (!supabase) return;

		try {
			// Clear all auth state before signing out
			const { error } = await supabase.auth.signOut({ scope: 'local' });
			if (error) {
				console.error('Sign out error:', error);
				toast.error('Failed to sign out');
			} else {
				// Clear any cached data
				if ('caches' in window) {
					caches.keys().then((names) => {
						names.forEach((name) => caches.delete(name));
					});
				}
				toast.success('Signed out successfully');
				showUserMenu = false;
				// Force reload to clear any stale state
				setTimeout(() => window.location.reload(), 300);
			}
		} catch (err) {
			console.error('Unexpected sign out error:', err);
			toast.error('An error occurred during sign out');
		}
	}

	function getInitials(name: string | undefined): string {
		if (!name) return '?';
		const parts = name.split(' ');
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return name[0].toUpperCase();
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			showUserMenu &&
			menuRef &&
			buttonRef &&
			!menuRef.contains(event.target as Node) &&
			!buttonRef.contains(event.target as Node)
		) {
			showUserMenu = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
	const formatCompactNumber = (value: number) =>
		new Intl.NumberFormat(undefined, {
			notation: 'compact',
			maximumFractionDigits: value >= 1000 ? 1 : 0
		}).format(value);

	let avatarError = $state(false);
	// Reset error flag when the user (and thus their avatar URL) changes
	$effect(() => {
		$user;
		avatarError = false;
	});
</script>

{#if $loading}
	<div
		class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm"
	>
		<LoaderIcon class="size-5 animate-spin" />
	</div>
{:else if $user}
	<div class="relative">
		<button
			bind:this={buttonRef}
			onclick={() => (showUserMenu = !showUserMenu)}
			class="group relative inline-flex h-9 cursor-pointer items-center gap-0.75 overflow-visible rounded-full border border-border/85 bg-background/88 pl-0.5 pr-1.5 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/55 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
			aria-label={xp ? `User menu, ${formatNumber(xp.total)} XPop` : 'User menu'}
			title={xp ? m.stats_xpEarned({ xp: formatNumber(xp.total) }) : undefined}
		>
			<span class="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-foreground/5 ring-1 ring-foreground/6 transition-colors group-hover:bg-foreground/8">
				{#if $user.user_metadata?.avatar_url && !avatarError}
					<img
						src={$user.user_metadata.avatar_url}
						alt={$user.user_metadata?.name ?? 'User'}
						class="h-full w-full rounded-full object-cover"
						onerror={() => (avatarError = true)}
					/>
				{:else if $user.user_metadata?.name}
					<span class="text-xs font-semibold">
						{getInitials($user.user_metadata.name)}
					</span>
				{:else}
					<UserCheckIcon class="size-5" />
				{/if}
			</span>

			{#if xp}
				<span
					class="pointer-events-none inline-flex h-7 items-center gap-1 rounded-full bg-primary px-1.25 pr-1.5 text-primary-foreground shadow-[0_10px_18px_-10px_rgba(0,0,0,0.8)]"
				>
					<XPopMark
						text="XPop"
						iconClass="h-[1.05rem] w-[1.05rem]"
						textClass="text-[9px] leading-none font-semibold tracking-[0.14em] normal-case text-primary-foreground/78"
					/>
					<span class="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-foreground/14 px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums text-primary-foreground">
						{formatCompactNumber(xp.total)}
					</span>
				</span>
			{/if}
		</button>

		{#if showUserMenu}
			<div
				bind:this={menuRef}
				class="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
			>
				<a
					href={`/stats/${$user.id}`}
					onclick={() => (showUserMenu = false)}
					class="block border-b border-border px-4 py-3 transition hover:bg-muted/70"
				>
					<p class="truncate text-sm font-medium text-foreground">
						{$user.user_metadata?.name ?? $user.email ?? 'User'}
					</p>
					{#if $user.email}
						<p class="truncate text-xs text-muted-foreground">{$user.email}</p>
					{/if}
				</a>

				<button
					onclick={() => {
						showUserMenu = false;
						settingsDialogOpen = true;
					}}
					class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
				>
					<SettingsIcon class="size-4" />
					<span>Settings</span>
				</button>

				<a
					href={`/stats/${$user.id}`}
					onclick={() => (showUserMenu = false)}
					class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
				>
					<BarChart3Icon class="size-4" />
					<span>My stats</span>
				</a>

				<button
					onclick={handleSignOut}
					class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
				>
					<LogOutIcon class="size-4" />
					<span>Sign Out</span>
				</button>
			</div>
		{/if}
	</div>
{:else}
	<div class="flex items-center gap-2">
		<AuthDialog bind:open={authDialogOpen}>
			<SheetTrigger>
				<button
					class="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
					aria-label="Sign In"
				>
					<UserIcon class="size-5" />
				</button>
			</SheetTrigger>
		</AuthDialog>
		<span class="text-xs font-medium text-muted-foreground">{m.help_tip_login()}</span>
	</div>
{/if}

<SettingsDialog bind:open={settingsDialogOpen} />

<style>
	/* Close menu when clicking outside */
	:global(body) {
		position: relative;
	}
</style>
