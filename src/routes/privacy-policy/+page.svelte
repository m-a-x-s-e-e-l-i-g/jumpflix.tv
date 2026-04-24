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
			id: 'overview',
			title: 'What this policy covers',
			body: [
				'This Privacy Policy explains what personal data JUMPFLIX collects, how that data is used, and what choices you have when you use the site.',
				'JUMPFLIX is a community-rooted catalog and viewing experience for long-form parkour videos. The service is operated as an independent project and this policy applies to your use of www.jumpflix.tv.'
			]
		},
		{
			id: 'collect',
			title: 'What we collect',
			body: ['The data we collect depends on how you use the site.'],
			bullets: [
				'Account data: if you create an account, we process your email address and authentication data through Supabase.',
				'Google login data: if you sign in with Google, we receive the email address, first name, and last name that Google shares for your account.',
				'Viewing activity: watch history, progress, ratings, reviews, and other account activity you create inside JUMPFLIX.',
				'Communication preferences: whether you opt in to product news, catalog updates, or related parkour updates.',
				'Usage analytics: Google Analytics collects information such as pages viewed, approximate location, browser and device details, referral source, and interaction events.'
			]
		},
		{
			id: 'use',
			title: 'How we use your data',
			body: ['We use personal data to run and improve the service.'],
			bullets: [
				'To create and secure accounts and let you sign in.',
				'To save watch progress, ratings, reviews, and other account features.',
				'To understand how people use JUMPFLIX so the product can be improved.',
				'To send optional emails only when you asked to receive updates.',
				'To detect abuse, investigate problems, and protect the service.'
			]
		},
		{
			id: 'sharing',
			title: 'Who we share data with',
			body: ['JUMPFLIX does not sell your personal data. Data is shared only with services needed to operate the product.'],
			bullets: [
				'Supabase for authentication and database infrastructure.',
				'Google for analytics and, where used, Google login.',
				'YouTube and Vimeo when you play embedded or linked video content.',
				'Hosting and delivery providers that help serve the site securely.'
			]
		},
		{
			id: 'choices',
			title: 'Your choices and rights',
			body: [
				'You can stop using the service at any time, unsubscribe from optional emails, and request account deletion or correction of personal data connected to your account.',
				'You can also limit analytics through your browser settings, ad/privacy controls, or Google tools that apply to Google Analytics.'
			]
		},
		{
			id: 'retention',
			title: 'Retention and security',
			body: [
				'We keep account and activity data for as long as it is needed to operate JUMPFLIX, comply with legal obligations, resolve disputes, or enforce our terms.',
				'We use reasonable technical and organizational safeguards, but no online system can promise absolute security.'
			]
		},
		{
			id: 'changes',
			title: 'Policy changes',
			body: [
				'This policy may be updated as the product changes. The latest version will always be posted on this page with the updated date shown above.'
			]
		}
	];
</script>

<svelte:head>
	<title>Privacy Policy - JUMPFLIX</title>
	<meta
		name="description"
		content="Privacy policy for JUMPFLIX, including Google Analytics usage and the account data collected for email and Google sign-in."
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
				<h1 class="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Privacy Policy</h1>
				<p class="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
					This page explains what JUMPFLIX collects, why it is collected, and how that data is used.
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
				<h2 class="text-xl font-semibold tracking-tight md:text-2xl">Questions or requests</h2>
				<p>
					If you need to request deletion, correction, or access to account data, use the project contact
					channel published in the
					<a
						href="https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
					>
						GitHub repository
					</a>
					until a dedicated support address is published on JUMPFLIX.
				</p>
				<p class="text-muted-foreground">
					See also <a href="/terms-of-service" class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground">Terms of Service</a>.
				</p>
			</div>
		</section>
	</div>
</div>