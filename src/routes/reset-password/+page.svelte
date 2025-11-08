<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let isValidSession = $state(false);

	onMount(async () => {
		// Check if we have a valid session from the recovery link
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			toast.error('Invalid or expired reset link. Please request a new one.');
			goto('/');
			return;
		}
		isValidSession = true;
	});

	async function handleResetPassword(e: Event) {
		e.preventDefault();
		
		if (password !== confirmPassword) {
			toast.error('Passwords do not match');
			return;
		}

		if (password.length < 6) {
			toast.error('Password must be at least 10 characters');
			return;
		}

		loading = true;
		try {
			const { error } = await supabase.auth.updateUser({
				password: password
			});

			if (error) throw error;

			toast.success('Password updated successfully!');
			password = '';
			confirmPassword = '';
			
			// Redirect to home after a short delay
			setTimeout(() => {
				goto('/');
			}, 1000);
		} catch (error: any) {
			toast.error(error.message || 'Failed to update password');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password - JUMPFLIX</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isValidSession}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
			<h1 class="mb-6 text-center text-2xl font-bold text-foreground">Reset Your Password</h1>
			
			<form onsubmit={handleResetPassword} class="space-y-4">
				<div class="space-y-2">
					<label for="password" class="text-sm font-medium text-foreground">
						New Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						disabled={loading}
						placeholder="Enter new password"
						minlength="6"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
					/>
				</div>

				<div class="space-y-2">
					<label for="confirmPassword" class="text-sm font-medium text-foreground">
						Confirm Password
					</label>
					<input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
						required
						disabled={loading}
						placeholder="Confirm new password"
						minlength="6"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
					/>
				</div>

				<Button type="submit" disabled={loading} className="w-full">
					{loading ? 'Updating Password...' : 'Update Password'}
				</Button>
			</form>

			<p class="mt-4 text-center text-xs text-muted-foreground">
				Password must be at least 10 characters long
			</p>
		</div>
	</div>
{/if}
