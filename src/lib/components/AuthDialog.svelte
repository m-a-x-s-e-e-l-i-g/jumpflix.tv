<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { Sheet as SheetRoot, SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import { Auth } from '@supabase/auth-ui-svelte';
	import { ThemeSupa, type I18nVariables } from '@supabase/auth-ui-shared';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { onMount } from 'svelte';

	const supportedLocales = ['en', 'nl'] as const;
	type AuthLocale = (typeof supportedLocales)[number];

	const SUPABASE_AUTH_COPY: Record<
		AuthLocale,
		{
			title: string;
			fallback: string;
			localization: I18nVariables;
		}
	> = {
		en: {
			title: 'Sign In',
			fallback: 'Authentication is not configured. Please set up your Supabase environment variables.',
			localization: {
				sign_in: {
					email_label: 'Email address',
					password_label: 'Your password',
					email_input_placeholder: 'Your email address',
					password_input_placeholder: 'Your password',
					button_label: 'Sign in',
					loading_button_label: 'Signing in…',
					social_provider_text: 'Sign in with {{provider}}',
					link_text: "Don't have an account? Sign up"
				},
				sign_up: {
					email_label: 'Email address',
					password_label: 'Create a password',
					email_input_placeholder: 'Your email address',
					password_input_placeholder: 'Create a password',
					button_label: 'Sign up',
					loading_button_label: 'Signing up…',
					social_provider_text: 'Continue with {{provider}}',
					link_text: 'Already have an account? Sign in',
					confirmation_text: 'Check your email for the confirmation link'
				},
				magic_link: {
					email_input_label: 'Email address',
					email_input_placeholder: 'Your email address',
					button_label: 'Send magic link',
					loading_button_label: 'Sending magic link…',
					link_text: 'Send a magic link email',
					confirmation_text: 'Check your email for the magic link',
					empty_email_address: 'Please enter an email address'
				},
				forgotten_password: {
					email_label: 'Email address',
					email_input_placeholder: 'Your email address',
					button_label: 'Send reset password instructions',
					loading_button_label: 'Sending reset instructions…',
					link_text: 'Forgot your password?',
					confirmation_text: 'Check your email for the password reset link'
				},
				update_password: {
					password_label: 'New password',
					password_input_placeholder: 'Your new password',
					button_label: 'Update password',
					loading_button_label: 'Updating password…',
					confirmation_text: 'Your password has been updated'
				},
				verify_otp: {
					email_input_label: 'Email address',
					email_input_placeholder: 'Your email address',
					phone_input_label: 'Phone number',
					phone_input_placeholder: 'Your phone number',
					token_input_label: 'Token',
					token_input_placeholder: 'Your verification code',
					button_label: 'Verify token',
					loading_button_label: 'Signing in…'
				}
			}
		},
		nl: {
			title: 'Inloggen',
			fallback: 'Authenticatie is niet geconfigureerd. Stel je Supabase-omgevingsvariabelen in.',
			localization: {
				sign_in: {
					email_label: 'E-mailadres',
					password_label: 'Je wachtwoord',
					email_input_placeholder: 'Je e-mailadres',
					password_input_placeholder: 'Je wachtwoord',
					button_label: 'Inloggen',
					loading_button_label: 'Bezig met inloggen…',
					social_provider_text: 'Inloggen met {{provider}}',
					link_text: 'Nog geen account? Registreren'
				},
				sign_up: {
					email_label: 'E-mailadres',
					password_label: 'Kies een wachtwoord',
					email_input_placeholder: 'Je e-mailadres',
					password_input_placeholder: 'Kies een wachtwoord',
					button_label: 'Account aanmaken',
					loading_button_label: 'Account aanmaken…',
					social_provider_text: 'Aanmelden met {{provider}}',
					link_text: 'Heb je al een account? Inloggen',
					confirmation_text: 'Controleer je e-mail voor de bevestigingslink'
				},
				magic_link: {
					email_input_label: 'E-mailadres',
					email_input_placeholder: 'Je e-mailadres',
					button_label: 'Magic link sturen',
					loading_button_label: 'Magic link versturen…',
					link_text: 'Magic link e-mail verzenden',
					confirmation_text: 'Controleer je e-mail voor de magic link',
					empty_email_address: 'Vul een e-mailadres in'
				},
				forgotten_password: {
					email_label: 'E-mailadres',
					email_input_placeholder: 'Je e-mailadres',
					button_label: 'Stuur wachtwoordreset-instructies',
					loading_button_label: 'Instructies verzenden…',
					link_text: 'Wachtwoord vergeten?',
					confirmation_text: 'Controleer je e-mail voor de resetlink'
				},
				update_password: {
					password_label: 'Nieuw wachtwoord',
					password_input_placeholder: 'Je nieuwe wachtwoord',
					button_label: 'Wachtwoord bijwerken',
					loading_button_label: 'Wachtwoord bijwerken…',
					confirmation_text: 'Je wachtwoord is bijgewerkt'
				},
				verify_otp: {
					email_input_label: 'E-mailadres',
					email_input_placeholder: 'Je e-mailadres',
					phone_input_label: 'Telefoonnummer',
					phone_input_placeholder: 'Je telefoonnummer',
					token_input_label: 'Code',
					token_input_placeholder: 'Je verificatiecode',
					button_label: 'Code verifiëren',
					loading_button_label: 'Bezig met inloggen…'
				}
			}
		}
	};

	function resolveLocale(): AuthLocale {
		const runtimeLocale = getLocale();
		if (supportedLocales.includes(runtimeLocale as AuthLocale)) {
			return runtimeLocale as AuthLocale;
		}
		if (typeof document !== 'undefined') {
			const docLang = document.documentElement.getAttribute('lang');
			if (supportedLocales.includes(docLang as AuthLocale)) {
				return docLang as AuthLocale;
			}
		}
		return 'en';
	}

	let locale: AuthLocale = $state(resolveLocale());
	const authCopy = $derived(SUPABASE_AUTH_COPY[locale]);

	onMount(() => {
		if (typeof document === 'undefined') return;
		const updateLocale = () => {
			const next = resolveLocale();
			if (next !== locale) {
				locale = next;
			}
		};
		updateLocale();
		const observer = new MutationObserver(updateLocale);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['lang']
		});
		return () => observer.disconnect();
	});

	let { open = $bindable(false), children } = $props<{
		open?: boolean;
		children?: any;
	}>();
</script>

<SheetRoot bind:open>
	{@render children?.()}
	
	<SheetContent side="left" class="flex h-full flex-col p-0">
		<SheetHeader class="px-4 pt-4">
			<SheetTitle class="text-center text-2xl font-bold">
				{authCopy.title}
			</SheetTitle>
		</SheetHeader>
		
		<div class="flex-1 overflow-y-auto p-4">
			{#if supabase}
				{#key locale}
					<Auth
						supabaseClient={supabase}
						appearance={{
							theme: ThemeSupa,
							variables: {
								default: {
									colors: {
										brand: 'hsl(var(--primary))',
										brandAccent: 'hsl(var(--primary) / 0.9)',
										brandButtonText: 'hsl(var(--primary-foreground))',
										defaultButtonBackground: 'hsl(var(--secondary))',
										defaultButtonBackgroundHover: 'hsl(var(--secondary) / 0.8)',
										defaultButtonBorder: 'hsl(var(--border))',
										defaultButtonText: 'hsl(var(--secondary-foreground))',
										inputBackground: 'hsl(var(--background))',
										inputBorder: 'hsl(var(--border))',
										inputBorderHover: 'hsl(var(--primary))',
										inputBorderFocus: 'hsl(var(--primary))',
										inputText: 'hsl(var(--foreground))',
										inputPlaceholder: 'hsl(var(--muted-foreground))',
									},
									space: {
										buttonPadding: '12px 16px',
										inputPadding: '12px 16px',
									},
									borderWidths: {
										buttonBorderWidth: '1px',
										inputBorderWidth: '1px',
									},
									radii: {
										borderRadiusButton: 'var(--radius)',
										buttonBorderRadius: 'var(--radius)',
										inputBorderRadius: 'var(--radius)',
									},
								}
							},
							className: {
								button: 'font-medium transition-all',
								input: 'transition-colors'
							}
						}}
						localization={{ variables: authCopy.localization }}
						theme="dark"
						providers={[]}
						redirectTo={typeof window !== 'undefined' ? window.location.origin : ''}
					/>
				{/key}
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					{authCopy.fallback}
				</p>
			{/if}
		</div>
	</SheetContent>
</SheetRoot>
