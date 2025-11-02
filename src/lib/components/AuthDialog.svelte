<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { Sheet as SheetRoot, SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import { Auth } from '@supabase/auth-ui-svelte';
	import { ThemeSupa } from '@supabase/auth-ui-shared';
	import * as m from '$lib/paraglide/messages';
	
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
				Sign In
			</SheetTitle>
		</SheetHeader>
		
		<div class="flex-1 overflow-y-auto p-4">
			{#if supabase}
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
							input: 'transition-colors',
						}
					}}
					theme="dark"
					providers={[]}
					redirectTo={typeof window !== 'undefined' ? window.location.origin : ''}
				/>
			{:else}
				<p class="text-center text-sm text-muted-foreground">
					Authentication is not configured. Please set up your Supabase environment variables.
				</p>
			{/if}
		</div>
	</SheetContent>
</SheetRoot>
