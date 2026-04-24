<script lang="ts">
	type LegalSection = {
		id: string;
		title: string;
		body: string[];
		bullets?: string[];
	};

	const lastUpdated = 'April 24, 2026';

	const sections: LegalSection[] = [
		{
			id: 'acceptance',
			title: 'Acceptance of these terms',
			body: [
				'By accessing or using JUMPFLIX, you agree to these Terms of Service. If you do not agree, do not use the service.',
				'JUMPFLIX is an independent catalog and viewing experience built around long-form parkour videos and related community information.'
			]
		},
		{
			id: 'service',
			title: 'What JUMPFLIX provides',
			body: [
				'JUMPFLIX helps users discover, organize, and revisit parkour films, documentaries, series, and related material.',
				'Some content is embedded from or linked to third-party platforms such as YouTube or Vimeo. Those platforms may apply their own rules, availability limits, and privacy practices.'
			]
		},
		{
			id: 'accounts',
			title: 'Accounts and access',
			body: ['If you create an account, you are responsible for the activity on that account and for keeping your login credentials secure.'],
			bullets: [
				'Provide accurate sign-up information.',
				'Do not impersonate another person or organization.',
				'Do not share access in a way that harms the service or other users.',
				'Notify the operator if you believe your account has been compromised.'
			]
		},
		{
			id: 'acceptable-use',
			title: 'Acceptable use',
			body: ['You agree not to misuse JUMPFLIX.'],
			bullets: [
				'Do not interfere with the site, scrape it aggressively, or attempt to bypass access controls.',
				'Do not upload or submit unlawful, infringing, abusive, or misleading material.',
				'Do not use the service to harass others, distribute malware, or test exploits against the platform.',
				'Do not use automated tools in a way that degrades availability for other users.'
			]
		},
		{
			id: 'content',
			title: 'Content, ownership, and third-party rights',
			body: [
				'The JUMPFLIX site design, branding, copy, catalog structure, and original project material are protected by applicable intellectual property laws.',
				'Video rights remain with the original creators, publishers, and hosting platforms. JUMPFLIX does not claim ownership over third-party films or media simply because they are cataloged or embedded on the site.'
			]
		},
		{
			id: 'availability',
			title: 'Availability and changes',
			body: [
				'JUMPFLIX may change, pause, or remove features, content, and account access at any time. The service is provided on an ongoing best-effort basis and may evolve without notice.'
			]
		},
		{
			id: 'termination',
			title: 'Suspension or termination',
			body: [
				'Access may be suspended or terminated if these terms are violated, if the service is being protected from abuse, or if continuing access creates legal or operational risk.'
			]
		},
		{
			id: 'disclaimers',
			title: 'Disclaimers and liability',
			body: [
				'JUMPFLIX is provided as is and as available, without warranties that the site will always be uninterrupted, error-free, or suitable for a particular purpose.',
				'To the maximum extent permitted by law, the operator is not liable for indirect, incidental, special, consequential, or exemplary damages arising from your use of the service.'
			]
		},
		{
			id: 'updates',
			title: 'Updates to these terms',
			body: [
				'These terms may be revised from time to time. Continued use of JUMPFLIX after an update means you accept the revised version.'
			]
		}
	];
</script>

<svelte:head>
	<title>Terms of Service - JUMPFLIX</title>
	<meta
		name="description"
		content="Terms of Service for JUMPFLIX, covering account use, third-party video services, and platform rules."
	/>
</svelte:head>

<div class="mx-auto w-full max-w-5xl p-4 md:p-8">
	<div class="jf-surface mt-[50px] rounded-[2rem] border border-primary/25 p-6 md:p-8">
		<a
			href="/"
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>Back to catalog</span>
		</a>

		<div class="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
			<div class="max-w-3xl">
				<p class="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Legal</p>
				<h1 class="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Terms of Service</h1>
				<p class="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
					These terms describe the rules for using JUMPFLIX and the boundaries around accounts,
					content, and third-party services.
				</p>
			</div>

			<div class="rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
				<p class="text-[11px] uppercase tracking-[0.2em] text-foreground/70">Last updated</p>
				<p class="mt-1 font-medium text-foreground">{lastUpdated}</p>
			</div>
		</div>

		<div class="mt-6 flex flex-wrap gap-2">
			{#each sections as section}
				<a
					href={`#${section.id}`}
					class="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
				>
					{section.title}
				</a>
			{/each}
		</div>
	</div>

	<div class="mt-6 grid gap-6">
		{#each sections as section}
			<section id={section.id} class="jf-surface-soft scroll-mt-24 rounded-[2rem] p-6 md:p-8">
				<div class="max-w-3xl space-y-4 text-sm leading-7 text-foreground md:text-base">
					<h2 class="text-xl font-semibold tracking-tight md:text-2xl">{section.title}</h2>
					{#each section.body as paragraph}
						<p>{paragraph}</p>
					{/each}

					{#if section.bullets?.length}
						<ul class="space-y-2 pl-5 text-muted-foreground marker:text-primary/70">
							{#each section.bullets as bullet}
								<li>{bullet}</li>
							{/each}
						</ul>
					{/if}
				</div>
			</section>
		{/each}

		<section class="jf-surface rounded-[2rem] p-6 md:p-8">
			<div class="max-w-3xl space-y-4 text-sm leading-7 text-foreground md:text-base">
				<h2 class="text-xl font-semibold tracking-tight md:text-2xl">Related documents</h2>
				<p>
					Read the
					<a href="/privacy-policy" class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground">Privacy Policy</a>
					for details about account data, Google Analytics, and Google sign-in data handling.
				</p>
				<p class="text-muted-foreground">
					Questions about these terms can be raised through the
					<a
						href="https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
					>
						project repository
					</a>
					until a dedicated support address is published on JUMPFLIX.
				</p>
			</div>
		</section>
	</div>
</div>