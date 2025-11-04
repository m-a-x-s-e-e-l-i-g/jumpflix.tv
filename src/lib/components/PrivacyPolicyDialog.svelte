<script lang="ts">
	import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '$lib/components/ui/dialog';
	import { getLocale } from '$lib/paraglide/runtime.js';
	
	let { open = $bindable(false), children } = $props<{
		open?: boolean;
		children?: any;
	}>();
	
	const locale = $derived(getLocale());
</script>

<DialogRoot bind:open>
	{@render children?.()}
	
	<DialogContent class="max-h-[80vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{locale === 'nl' ? 'Privacybeleid' : 'Privacy Policy'}</DialogTitle>
			<DialogDescription class="text-xs">
				{locale === 'nl' ? 'Laatst bijgewerkt: 4 november 2025' : 'Last updated: November 4, 2025'}
			</DialogDescription>
		</DialogHeader>
		
		<div class="space-y-4 text-sm">
			{#if locale === 'nl'}
				<div>
					<h3 class="font-semibold mb-2">1. Welke gegevens verzamelen we?</h3>
					<p class="text-muted-foreground mb-2">Bij JumpFlix verzamelen we de volgende gegevens:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li><strong class="text-foreground">Accountgegevens:</strong> E-mailadres en wachtwoord (versleuteld)</li>
						<li><strong class="text-foreground">Kijkgeschiedenis:</strong> Welke video's je hebt bekeken en je voortgang</li>
						<li><strong class="text-foreground">Communicatievoorkeuren:</strong> Je keuze om wel of geen updates te ontvangen</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">2. Hoe gebruiken we je gegevens?</h3>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>Je toegang geven tot JumpFlix en je kijkvoortgang opslaan</li>
						<li>Je account beveiligen</li>
						<li>Nieuws over nieuwe parkour-video's en updates sturen (alleen als je daarvoor hebt gekozen)</li>
						<li>Onze service verbeteren</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">3. Marketing en communicatie</h3>
					<p class="text-muted-foreground mb-2">Bij het aanmaken van je account kun je ervoor kiezen om nieuws en updates te ontvangen over:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>Nieuwe films en series op JumpFlix</li>
						<li>Updates over het platform</li>
						<li>Parkour-gerelateerde inhoud</li>
					</ul>
					<p class="text-muted-foreground mt-2">
						Je kunt je op elk moment afmelden via de afmeldlink in elke e-mail of door je voorkeuren aan te passen in je accountinstellingen.
					</p>
				</div>

				<div>
					<h3 class="font-semibold mb-2">4. Gegevens delen</h3>
					<p class="text-muted-foreground mb-2">We verkopen je gegevens nooit aan derden. We delen alleen gegevens met:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li><strong class="text-foreground">Supabase:</strong> Voor authenticatie en database-hosting</li>
						<li><strong class="text-foreground">Vimeo/YouTube:</strong> Voor het afspelen van video's</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">5. Je rechten</h3>
					<p class="text-muted-foreground mb-2">Je hebt het recht om:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>Toegang te krijgen tot je persoonlijke gegevens</li>
						<li>Je gegevens te laten corrigeren</li>
						<li>Je gegevens te laten verwijderen</li>
						<li>Bezwaar te maken tegen verwerking van je gegevens</li>
						<li>Je communicatievoorkeuren aan te passen</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">6. Beveiliging</h3>
					<p class="text-muted-foreground">
						We nemen de beveiliging van je gegevens serieus en gebruiken industriestandaard beveiligingsmaatregelen, waaronder versleuteling en beveiligde authenticatie.
					</p>
				</div>
			{:else}
				<div>
					<h3 class="font-semibold mb-2">1. What data do we collect?</h3>
					<p class="text-muted-foreground mb-2">At JumpFlix, we collect the following data:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li><strong class="text-foreground">Account information:</strong> Email address and password (encrypted)</li>
						<li><strong class="text-foreground">Watch history:</strong> Which videos you've watched and your progress</li>
						<li><strong class="text-foreground">Communication preferences:</strong> Your choice to receive or not receive updates</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">2. How do we use your data?</h3>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>Provide you access to JumpFlix and save your watch progress</li>
						<li>Secure your account</li>
						<li>Send news about new parkour videos and updates (only if you opted in)</li>
						<li>Improve our service</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">3. Marketing and communication</h3>
					<p class="text-muted-foreground mb-2">When creating your account, you can choose to receive news and updates about:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>New movies and series on JumpFlix</li>
						<li>Platform updates</li>
						<li>Parkour-related content</li>
					</ul>
					<p class="text-muted-foreground mt-2">
						You can unsubscribe at any time via the unsubscribe link in each email or by adjusting your preferences in your account settings.
					</p>
				</div>

				<div>
					<h3 class="font-semibold mb-2">4. Data sharing</h3>
					<p class="text-muted-foreground mb-2">We never sell your data to third parties. We only share data with:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li><strong class="text-foreground">Supabase:</strong> For authentication and database hosting</li>
						<li><strong class="text-foreground">Vimeo/YouTube:</strong> For video playback</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">5. Your rights</h3>
					<p class="text-muted-foreground mb-2">You have the right to:</p>
					<ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
						<li>Access your personal data</li>
						<li>Have your data corrected</li>
						<li>Have your data deleted</li>
						<li>Object to processing of your data</li>
						<li>Update your communication preferences</li>
					</ul>
				</div>

				<div>
					<h3 class="font-semibold mb-2">6. Security</h3>
					<p class="text-muted-foreground">
						We take the security of your data seriously and use industry-standard security measures, including encryption and secure authentication.
					</p>
				</div>
			{/if}
		</div>
	</DialogContent>
</DialogRoot>
