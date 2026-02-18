<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import {
		Sheet as SheetRoot,
		SheetContent,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import Button from '$lib/components/ui/Button.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import PrivacyPolicyDialog from '$lib/components/PrivacyPolicyDialog.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const supportedLocales = ['en', 'nl', 'ja'] as const;
	type AuthLocale = (typeof supportedLocales)[number];

	type AuthView = 'sign_in' | 'sign_up' | 'forgotten_password';
	let currentView: AuthView = $state('sign_in');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let marketingOptIn = $state(true);
	let privacyDialogOpen = $state(false);

	const SUPABASE_AUTH_COPY: Record<
		AuthLocale,
		{
			title: string;
			fallback: string;
		}
	> = {
		en: {
			title: 'Sign In',
			fallback:
				'Authentication is not configured. Please set up your Supabase environment variables.'
		},
		nl: {
			title: 'Inloggen',
			fallback: 'Authenticatie is niet geconfigureerd. Stel je Supabase-omgevingsvariabelen in.'
		},
		ja: {
			title: 'サインイン',
			fallback: '認証が設定されていません。Supabase環境変数を設定してください。'
		}
	};

	const COPY = {
		en: {
			signIn: {
				title: 'Sign In',
				email: 'Email address',
				password: 'Your password',
				button: 'Sign in',
				loadingButton: 'Signing in…',
				switchToSignUp: "Don't have an account? Sign up",
				forgotPassword: 'Forgot your password?'
			},
			signUp: {
				title: 'Sign Up',
				email: 'Email address',
				password: 'Create a password',
				button: 'Sign up',
				loadingButton: 'Signing up…',
				switchToSignIn: 'Already have an account? Sign in',
				marketingOptIn:
					'Send me news and updates about JumpFlix, new content additions, and parkour-related updates',
				privacyPolicy: 'Privacy Policy',
				confirmation: 'Check your email for the confirmation link'
			},
			forgotPassword: {
				title: 'Reset Password',
				email: 'Email address',
				button: 'Send reset instructions',
				loadingButton: 'Sending…',
				switchToSignIn: 'Back to sign in',
				confirmation: 'Check your email for the password reset link'
			}
		},
		nl: {
			signIn: {
				title: 'Inloggen',
				email: 'E-mailadres',
				password: 'Je wachtwoord',
				button: 'Inloggen',
				loadingButton: 'Bezig met inloggen…',
				switchToSignUp: 'Nog geen account? Registreren',
				forgotPassword: 'Wachtwoord vergeten?'
			},
			signUp: {
				title: 'Account aanmaken',
				email: 'E-mailadres',
				password: 'Kies een wachtwoord',
				button: 'Account aanmaken',
				loadingButton: 'Account aanmaken…',
				switchToSignIn: 'Heb je al een account? Inloggen',
				marketingOptIn:
					'Stuur mij nieuws en updates over JumpFlix, nieuwe content en parkour-gerelateerde updates',
				privacyPolicy: 'Privacybeleid',
				confirmation: 'Controleer je e-mail voor de bevestigingslink'
			},
			forgotPassword: {
				title: 'Wachtwoord resetten',
				email: 'E-mailadres',
				button: 'Stuur reset-instructies',
				loadingButton: 'Verzenden…',
				switchToSignIn: 'Terug naar inloggen',
				confirmation: 'Controleer je e-mail voor de resetlink'
			}
		},
		ja: {
			signIn: {
				title: 'サインイン',
				email: 'メールアドレス',
				password: 'パスワード',
				button: 'サインイン',
				loadingButton: 'サインイン中…',
				switchToSignUp: 'アカウントをお持ちでない方はサインアップ',
				forgotPassword: 'パスワードをお忘れですか？'
			},
			signUp: {
				title: 'サインアップ',
				email: 'メールアドレス',
				password: 'パスワードを作成',
				button: 'サインアップ',
				loadingButton: 'サインアップ中…',
				switchToSignIn: 'すでにアカウントをお持ちの方はサインイン',
				marketingOptIn:
					'JumpFlixに関するニュース、新しいコンテンツ追加、パルクール関連の最新情報を受け取る',
				privacyPolicy: 'プライバシーポリシー',
				confirmation: '確認リンクについてメールをご確認ください'
			},
			forgotPassword: {
				title: 'パスワードリセット',
				email: 'メールアドレス',
				button: 'リセット手順を送信',
				loadingButton: '送信中…',
				switchToSignIn: 'サインインに戻る',
				confirmation: 'パスワードリセットリンクについてメールをご確認ください'
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
	const copy = $derived(COPY[locale]);

	async function handleSignIn() {
		if (!supabase) return;
		loading = true;
		try {
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
			const successMessage =
				locale === 'nl'
					? 'Succesvol ingelogd!'
					: locale === 'ja'
						? 'サインインしました！'
						: 'Successfully signed in!';
			toast.success(successMessage);
			open = false;
			email = '';
			password = '';
		} catch (error: any) {
			toast.error(error.message || 'An error occurred');
		} finally {
			loading = false;
		}
	}

	async function handleSignUp() {
		if (!supabase) return;
		loading = true;
		try {
			// Store marketing preference in user metadata
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					emailRedirectTo:
						typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
					data: {
						marketing_opt_in: marketingOptIn
					}
				}
			});
			if (error) throw error;

			toast.success(copy.signUp.confirmation);
			currentView = 'sign_in';
			email = '';
			password = '';
			marketingOptIn = true;
		} catch (error: any) {
			toast.error(error.message || 'An error occurred');
		} finally {
			loading = false;
		}
	}

	async function handleForgotPassword() {
		if (!supabase) return;
		loading = true;
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : ''
			});
			if (error) throw error;
			toast.success(copy.forgotPassword.confirmation);
			currentView = 'sign_in';
			email = '';
		} catch (error: any) {
			toast.error(error.message || 'An error occurred');
		} finally {
			loading = false;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (currentView === 'sign_in') {
			handleSignIn();
		} else if (currentView === 'sign_up') {
			handleSignUp();
		} else if (currentView === 'forgotten_password') {
			handleForgotPassword();
		}
	}

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
				{currentView === 'sign_in'
					? copy.signIn.title
					: currentView === 'sign_up'
						? copy.signUp.title
						: copy.forgotPassword.title}
			</SheetTitle>
		</SheetHeader>

		<div class="flex-1 overflow-y-auto p-4">
			{#if supabase}
				<form onsubmit={handleSubmit} class="space-y-4">
					<!-- Email Field -->
					<div class="space-y-2">
						<label for="email" class="text-sm font-medium">
							{currentView === 'sign_in'
								? copy.signIn.email
								: currentView === 'sign_up'
									? copy.signUp.email
									: copy.forgotPassword.email}
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							disabled={loading}
							placeholder={currentView === 'sign_in'
								? copy.signIn.email
								: currentView === 'sign_up'
									? copy.signUp.email
									: copy.forgotPassword.email}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
						/>
					</div>

					<!-- Password Field (not shown in forgot password) -->
					{#if currentView !== 'forgotten_password'}
						<div class="space-y-2">
							<label for="password" class="text-sm font-medium">
								{currentView === 'sign_in' ? copy.signIn.password : copy.signUp.password}
							</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								required
								disabled={loading}
								placeholder={currentView === 'sign_in'
									? copy.signIn.password
									: copy.signUp.password}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
							/>
						</div>
					{/if}

					<!-- Marketing Opt-in (only on sign up) -->
					{#if currentView === 'sign_up'}
						<div class="space-y-2">
							<div class="flex items-start gap-3 rounded-md border border-border p-3">
								<div class="pt-0.5">
									<Switch
										bind:checked={marketingOptIn}
										disabled={loading}
										ariaLabel={copy.signUp.marketingOptIn}
									/>
								</div>
								<button
									type="button"
									class="flex-1 text-left text-sm"
									disabled={loading}
									onclick={() => (marketingOptIn = !marketingOptIn)}
								>
									{copy.signUp.marketingOptIn}
								</button>
							</div>
							<p class="px-1 text-xs text-muted-foreground">
								By signing up, you agree to our
								<button
									type="button"
									class="inline cursor-pointer underline hover:text-foreground"
									onclick={() => (privacyDialogOpen = true)}
								>
									{copy.signUp.privacyPolicy}
								</button>
							</p>
						</div>
					{/if}

					<!-- Submit Button -->
					<Button type="submit" disabled={loading} className="w-full">
						{#if loading}
							{currentView === 'sign_in'
								? copy.signIn.loadingButton
								: currentView === 'sign_up'
									? copy.signUp.loadingButton
									: copy.forgotPassword.loadingButton}
						{:else}
							{currentView === 'sign_in'
								? copy.signIn.button
								: currentView === 'sign_up'
									? copy.signUp.button
									: copy.forgotPassword.button}
						{/if}
					</Button>

					<!-- Toggle Links -->
					<div class="space-y-2 text-center text-sm">
						{#if currentView === 'sign_in'}
							<button
								type="button"
								class="text-primary hover:underline"
								onclick={() => (currentView = 'sign_up')}
								disabled={loading}
							>
								{copy.signIn.switchToSignUp}
							</button>
							<br />
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground hover:underline"
								onclick={() => (currentView = 'forgotten_password')}
								disabled={loading}
							>
								{copy.signIn.forgotPassword}
							</button>
						{:else if currentView === 'sign_up'}
							<button
								type="button"
								class="text-primary hover:underline"
								onclick={() => (currentView = 'sign_in')}
								disabled={loading}
							>
								{copy.signUp.switchToSignIn}
							</button>
						{:else}
							<button
								type="button"
								class="text-primary hover:underline"
								onclick={() => (currentView = 'sign_in')}
								disabled={loading}
							>
								{copy.forgotPassword.switchToSignIn}
							</button>
						{/if}
					</div>
				</form>
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					{authCopy.fallback}
				</p>
			{/if}
		</div>
	</SheetContent>
</SheetRoot>

<PrivacyPolicyDialog bind:open={privacyDialogOpen} />
