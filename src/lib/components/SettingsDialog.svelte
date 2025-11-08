<script lang="ts">
	import { user } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabaseClient';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import Button from '$lib/components/ui/Button.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { open = $bindable(false), children } = $props<{
		open?: boolean;
		children?: any;
	}>();

	const locale = $derived(getLocale());
	
	let username = $state('');
	let marketingOptIn = $state(false);
	let loading = $state(true);
	let saving = $state(false);
	let showDeleteConfirm = $state(false);
	let deleteLoading = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let changingPassword = $state(false);

	const copy = {
		en: {
			title: 'Account Settings',
			profile: 'Profile',
			username: 'Display Name',
			usernamePlaceholder: 'Your display name',
			email: 'Email',
			emailNote: 'Email cannot be changed',
			security: 'Security',
			changePassword: 'Change Password',
			currentPassword: 'Current Password',
			currentPasswordPlaceholder: 'Enter current password',
			newPassword: 'New Password',
			newPasswordPlaceholder: 'Enter new password (min 10 characters)',
			confirmPassword: 'Confirm New Password',
			confirmPasswordPlaceholder: 'Re-enter new password',
			changePasswordButton: 'Update Password',
			changingPasswordButton: 'Updating...',
			passwordMismatch: 'Passwords do not match',
			passwordTooShort: 'Password must be at least 10 characters',
			passwordChangedSuccess: 'Password changed successfully',
			passwordChangeError: 'Failed to change password',
			preferences: 'Communication Preferences',
			marketingOptIn: 'Send me news and updates about JumpFlix, new content additions, and parkour-related updates',
			saveButton: 'Save Changes',
			savingButton: 'Saving...',
			dangerZone: 'Danger Zone',
			deleteAccount: 'Delete Account',
			deleteWarning: 'Once you delete your account, there is no going back. All your watch history and preferences will be permanently deleted.',
			deleteButton: 'Delete My Account',
			deleteConfirmTitle: 'Are you absolutely sure?',
			deleteConfirmText: 'This action cannot be undone. This will permanently delete your account and remove all your data from our servers.',
			cancelButton: 'Cancel',
			confirmDeleteButton: 'Yes, delete my account',
			deletingButton: 'Deleting...',
			savedSuccess: 'Settings saved successfully',
			deletedSuccess: 'Account deleted successfully',
			loadError: 'Failed to load preferences',
			saveError: 'Failed to save settings',
			deleteError: 'Failed to delete account'
		},
		nl: {
			title: 'Accountinstellingen',
			profile: 'Profiel',
			username: 'Weergavenaam',
			usernamePlaceholder: 'Je weergavenaam',
			email: 'E-mail',
			emailNote: 'E-mailadres kan niet worden gewijzigd',
			security: 'Beveiliging',
			changePassword: 'Wachtwoord wijzigen',
			currentPassword: 'Huidig wachtwoord',
			currentPasswordPlaceholder: 'Voer huidig wachtwoord in',
			newPassword: 'Nieuw wachtwoord',
			newPasswordPlaceholder: 'Voer nieuw wachtwoord in (min 10 tekens)',
			confirmPassword: 'Bevestig nieuw wachtwoord',
			confirmPasswordPlaceholder: 'Voer nieuw wachtwoord opnieuw in',
			changePasswordButton: 'Wachtwoord bijwerken',
			changingPasswordButton: 'Bijwerken...',
			passwordMismatch: 'Wachtwoorden komen niet overeen',
			passwordTooShort: 'Wachtwoord moet minimaal 10 tekens lang zijn',
			passwordChangedSuccess: 'Wachtwoord succesvol gewijzigd',
			passwordChangeError: 'Kan wachtwoord niet wijzigen',
			preferences: 'Communicatievoorkeuren',
			marketingOptIn: 'Stuur mij nieuws en updates over JumpFlix, nieuwe content en parkour-gerelateerde updates',
			saveButton: 'Wijzigingen opslaan',
			savingButton: 'Opslaan...',
			dangerZone: 'Gevaarlijke Zone',
			deleteAccount: 'Account verwijderen',
			deleteWarning: 'Als je je account verwijdert, is er geen weg terug. Al je kijkgeschiedenis en voorkeuren worden permanent verwijderd.',
			deleteButton: 'Verwijder mijn account',
			deleteConfirmTitle: 'Weet je het zeker?',
			deleteConfirmText: 'Deze actie kan niet ongedaan worden gemaakt. Dit zal je account permanent verwijderen en alle gegevens van onze servers verwijderen.',
			cancelButton: 'Annuleren',
			confirmDeleteButton: 'Ja, verwijder mijn account',
			deletingButton: 'Verwijderen...',
			savedSuccess: 'Instellingen succesvol opgeslagen',
			deletedSuccess: 'Account succesvol verwijderd',
			loadError: 'Kan voorkeuren niet laden',
			saveError: 'Kan instellingen niet opslaan',
			deleteError: 'Kan account niet verwijderen'
		}
	};

	const text = $derived(copy[locale as keyof typeof copy] || copy.en);

	async function loadPreferences() {
		if (!supabase || !$user) return;
		
		loading = true;
		try {
			// Load user metadata
			username = $user.user_metadata?.name || '';
			
			// Load preferences
			const { data, error } = await supabase
				.from('user_preferences')
				.select('marketing_opt_in')
				.eq('user_id', $user.id)
				.single();

			if (error) {
				// PGRST116 means no record exists yet, which is fine for new users
				if (error.code !== 'PGRST116') {
					console.error('Error loading preferences:', error);
					toast.error(text.loadError);
				}
			} else if (data) {
				marketingOptIn = data.marketing_opt_in;
			}
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		if (!supabase || !$user) return;
		
		saving = true;
		try {
			// Update user metadata (username)
			const { error: metadataError } = await supabase.auth.updateUser({
				data: { name: username }
			});

			if (metadataError) throw metadataError;

			// Update preferences
			const { error: prefError } = await supabase
				.from('user_preferences')
				.update({
					marketing_opt_in: marketingOptIn
				})
				.eq('user_id', $user.id);

			if (prefError) throw prefError;

			toast.success(text.savedSuccess);
		} catch (error: any) {
			console.error('Error saving settings:', error);
			toast.error(text.saveError);
		} finally {
			saving = false;
		}
	}

	async function deleteAccount() {
		if (!supabase || !$user) return;
		
		deleteLoading = true;
		try {
			// Delete user account (this will cascade delete all related data)
			const { error } = await supabase.rpc('delete_user_account');
			
			if (error) throw error;

			toast.success(text.deletedSuccess);
			
			// Sign out and redirect to home
			await supabase.auth.signOut();
			open = false;
		} catch (error: any) {
			console.error('Error deleting account:', error);
			toast.error(text.deleteError);
		} finally {
			deleteLoading = false;
			showDeleteConfirm = false;
		}
	}

	async function changePassword() {
		if (!supabase || !$user) return;
		
		// Validate passwords
		if (newPassword !== confirmNewPassword) {
			toast.error(text.passwordMismatch);
			return;
		}

		if (newPassword.length < 6) {
			toast.error(text.passwordTooShort);
			return;
		}

		changingPassword = true;
		try {
			// Supabase requires re-authentication for password changes
			// First, verify current password by attempting to sign in
			const { error: signInError } = await supabase.auth.signInWithPassword({
				email: $user.email!,
				password: currentPassword
			});

			if (signInError) {
				toast.error('Current password is incorrect');
				return;
			}

			// Now update the password
			const { error } = await supabase.auth.updateUser({
				password: newPassword
			});

			if (error) throw error;

			toast.success(text.passwordChangedSuccess);
			
			// Clear password fields
			currentPassword = '';
			newPassword = '';
			confirmNewPassword = '';
		} catch (error: any) {
			console.error('Error changing password:', error);
			toast.error(text.passwordChangeError);
		} finally {
			changingPassword = false;
		}
	}

	// Load preferences when dialog opens
	$effect(() => {
		if (open && $user) {
			loadPreferences();
		}
	});
</script>

<DialogRoot bind:open>
	{@render children?.()}
	
	<DialogContent class="max-h-[85vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{text.title}</DialogTitle>
		</DialogHeader>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		{:else}
			<div class="space-y-6">
				<!-- Profile Section -->
				<section class="space-y-3">
					<h3 class="text-sm font-semibold">{text.profile}</h3>
					
					<div class="space-y-3 rounded-lg border border-border bg-card p-3">
						<div class="space-y-1.5">
							<label for="username" class="text-xs font-medium">
								{text.username}
							</label>
							<input
								id="username"
								type="text"
								bind:value={username}
								placeholder={text.usernamePlaceholder}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="email" class="text-xs font-medium">
								{text.email}
							</label>
							<input
								id="email"
								type="email"
								value={$user?.email || ''}
								disabled
								class="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
							/>
							<p class="text-xs text-muted-foreground">{text.emailNote}</p>
						</div>
					</div>
				</section>

				<!-- Security Section -->
				<section class="space-y-3">
					<h3 class="text-sm font-semibold">{text.security}</h3>
					
					<div class="space-y-3 rounded-lg border border-border bg-card p-3">
						<h4 class="text-xs font-medium">{text.changePassword}</h4>
						
						<div class="space-y-1.5">
							<label for="currentPassword" class="text-xs font-medium">
								{text.currentPassword}
							</label>
							<input
								id="currentPassword"
								type="password"
								bind:value={currentPassword}
								placeholder={text.currentPasswordPlaceholder}
								disabled={changingPassword}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="newPassword" class="text-xs font-medium">
								{text.newPassword}
							</label>
							<input
								id="newPassword"
								type="password"
								bind:value={newPassword}
								placeholder={text.newPasswordPlaceholder}
								disabled={changingPassword}
								minlength="6"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="confirmNewPassword" class="text-xs font-medium">
								{text.confirmPassword}
							</label>
							<input
								id="confirmNewPassword"
								type="password"
								bind:value={confirmNewPassword}
								placeholder={text.confirmPasswordPlaceholder}
								disabled={changingPassword}
								minlength="6"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
							/>
						</div>

						<div class="flex justify-end">
							<Button 
								onclick={changePassword}
								disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
								variant="outline"
								size="xs"
							>
								{changingPassword ? text.changingPasswordButton : text.changePasswordButton}
							</Button>
						</div>
					</div>
				</section>

				<!-- Communication Preferences -->
				<section class="space-y-3">
					<h3 class="text-sm font-semibold">{text.preferences}</h3>
					
					<div class="space-y-2 rounded-lg border border-border bg-card p-3">
						<div class="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition">
							<div class="pt-0.5">
								<Switch bind:checked={marketingOptIn} ariaLabel={text.marketingOptIn} />
							</div>
							<button
								type="button"
								class="text-xs flex-1 text-left"
								onclick={() => marketingOptIn = !marketingOptIn}
							>
								{text.marketingOptIn}
							</button>
						</div>
					</div>
				</section>

				<!-- Save Button -->
				<div class="flex justify-end pt-2">
					<Button 
						onclick={saveSettings} 
						disabled={saving}
						variant="primary"
						size="sm"
					>
						{saving ? text.savingButton : text.saveButton}
					</Button>
				</div>

				<!-- Danger Zone -->
				<section class="space-y-3 pt-4 border-t border-border">
					<h3 class="text-sm font-semibold text-destructive">{text.dangerZone}</h3>
					
					<div class="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
						<div>
							<h4 class="text-xs font-medium text-destructive">{text.deleteAccount}</h4>
							<p class="text-xs text-muted-foreground mt-1">
								{text.deleteWarning}
							</p>
						</div>

						{#if !showDeleteConfirm}
							<Button 
								onclick={() => showDeleteConfirm = true}
								variant="destructive"
								size="xs"
							>
								{text.deleteButton}
							</Button>
						{:else}
							<div class="space-y-2 pt-1">
								<div class="rounded-md bg-background border border-destructive p-2">
									<p class="font-semibold text-xs">{text.deleteConfirmTitle}</p>
									<p class="text-xs text-muted-foreground mt-1">{text.deleteConfirmText}</p>
								</div>
								<div class="flex gap-2">
									<Button 
										onclick={() => showDeleteConfirm = false}
										variant="outline"
										size="xs"
										disabled={deleteLoading}
									>
										{text.cancelButton}
									</Button>
									<Button 
										onclick={deleteAccount}
										variant="destructive"
										size="xs"
										disabled={deleteLoading}
									>
										{deleteLoading ? text.deletingButton : text.confirmDeleteButton}
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</section>
			</div>
		{/if}
	</DialogContent>
</DialogRoot>
