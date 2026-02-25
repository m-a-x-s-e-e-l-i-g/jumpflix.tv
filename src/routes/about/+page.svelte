<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { withUtm } from '$lib/utils';
</script>

<svelte:head>
	<title>About JUMPFLIX</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl p-4 md:p-8">
	<div
		class="secret-achievement jf-surface mt-[50px] mb-6 overflow-hidden rounded-3xl border border-primary/30 p-6 md:p-8"
	>
		<div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="jf-display text-xl text-foreground md:text-3xl">{m.about_secretTitle()}</p>
				<p class="mt-2 text-sm text-muted-foreground md:text-base">
					{m.about_secretHint()}
				</p>
			</div>

			<img
				src="/images/jumpflix-secret.webp"
				alt=""
				loading="lazy"
				decoding="async"
				class="h-28 w-auto shrink-0 self-end object-contain md:h-32 md:self-auto"
			/>
		</div>
	</div>

	<div class="jf-surface mb-6 rounded-3xl p-6 md:p-8">
		<a
			href="/"
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>{m.about_backToCatalog()}</span>
		</a>

		<h1 class="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{m.about_title()}</h1>
		<p class="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
			{m.about_subtitle()}
		</p>
	</div>

	<div class="jf-surface-soft rounded-3xl p-6 md:p-8">
		<div class="max-w-3xl space-y-6 text-sm leading-7 text-foreground md:text-base">
			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">
				What did it evolve from?
			</h2>
			<p>
				It actually evolved from
				<a
					href="https://pkfr.nl"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
					>pkfr.nl</a
				>
				— a Dutch community site I built to document and centralize parkour in the Netherlands. My friend
				Koen had this massive playlist of everything he thought was cool. I had another playlist with
				basically everything ever created in NL that was shared in Dutch WhatsApp groups. Between those
				two playlists, we kind of had a living archive.
			</p>
			<p>But playlists don’t feel like a home. They needed a space.</p>

			<p>
				At first, I wanted to build an endless live stream — like a 24/7 parkour TV channel. Just
				press play and let it roll. But then I realized… I haven’t watched TV in years. I don’t even
				own one.
			</p>
			<p>What I actually love is streaming films.</p>

			<p>
				I’ve always loved the Popcorn Time catalog view. I love Stremio’s interface. I love how
				things darken when you’ve watched them. The structured “films and series” approach. The
				feeling of browsing something cinematic instead of scrolling social media.
			</p>
			<p>So I rebuilt that feeling — but for parkour.</p>
			<p>
				It didn’t start with a plan. It just started existing because I like coding, I like parkour,
				and I love films.
			</p>
			<p>Sometimes that’s enough.</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">Why JUMPFLIX?</h2>
			<p>
				I separated the project from <a
					href="https://pkfr.nl"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
					>pkfr.nl</a
				> (I like separating my codebases anyway), and I realized this shouldn’t just be Dutch-focused.
				The idea was bigger.
			</p>
			<p>I love buying domain names, so I grabbed the first thing that popped into my head.</p>
			<p class="jf-display text-lg md:text-xl">JUMPFLIX was born.</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">
				What belongs in the catalog?
			</h2>
			<p>
				I just started listing everything I liked and knew about, then expanded it. The rule became
				simple: if it has quality and hard work, it belongs.
			</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">Why popcorn?</h2>
			<p>
				The popcorn inspiration also became literal. Popcorn can jump insanely high compared to its
				size. No legs. No arms. That’s wild. Imagine how high it could jump if it had legs and arms.
			</p>
			<p class="jf-display text-lg md:text-xl">Boom. Logo.</p>

			<p>
				Since then I’ve been building it almost daily, every evening, for the past couple of months.
				Winter helps — when it’s dark and wet outside, it’s coding season.
			</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">
				What’s the bigger vision?
			</h2>

			<ul class="list-disc space-y-2 pl-5 text-muted-foreground">
				<li>A structured, permanent archive of parkour films worldwide</li>
				<li>Projects organized as films + series — not random uploads</li>
				<li>
					Discovery feeds that match taste, not trends
					<div class="mt-2 space-y-1">
						<div>– You like tech + precision? Click.</div>
						<div>– You like big sends + street chaos? Click.</div>
						<div>– You like crews, cities, eras? Click.</div>
					</div>
				</li>
				<li>Watch tracking that respects long-form: progress, rewatches, favorites, lists</li>
				<li>Curation by people: ratings + short reviews that explain why it matters</li>
				<li>History + context: timelines, creators, teams/crews, locations, soundtracks</li>
			</ul>
			<p class="text-muted-foreground">
				Not short-form dopamine. Not algorithm chaos. A museum for the work.
			</p>

			<p>
				I want everything archived in a beautiful, fast UI — the same vibe as when you sit down to
				watch a movie.
			</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">
				What nerdy features should exist?
			</h2>
			<ul class="list-disc space-y-2 pl-5 text-muted-foreground">
				<li>
					Spot markers on the playback scrubber, so you can see every location used in a video (in
					collab with <a
						href={withUtm('https://parkour.spot', { campaign: 'parkour.spot' })}
						target="_blank"
						rel="noopener noreferrer"
						class="text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
						>Parkour.Spot</a
					>)
				</li>
				<li>
					<span aria-hidden="true">✓</span> Automatic song scraping so you can search videos by song
					name
				</li>
			</ul>

			<p>
				All code is open source. I’ll publish database backups too, so the project won’t just vanish
				if I ever get a life sentence for trespassing or breaking walls. I want it to be permanent.
			</p>

			<p>
				Right now I’m focused on listing the projects that EVERYONE has to see — the stuff people
				actually put sweat into. 10+ minutes, real edits, real effort.
			</p>

			<p>
				I’m not building this for vlog-style or short-form scroll content. This is for the hard
				work.
			</p>

			<h2 class="pt-2 text-xl font-semibold tracking-tight md:text-2xl">Why does it matter?</h2>
			<p>
				Because right now everyone is focused on Instagram. Endless insane clips. Constant dopamine.
				And then two days later? Forgotten.
			</p>
			<p>Saved films matter. Long-form projects matter. That’s legacy. Not instant likes.</p>
			<p>
				When you Google “parkour films” you’ll see the same handful of projects over and over. It’s
				been like that for years.
			</p>
			<p>But that’s not the full picture.</p>
			<p>
				I want people to see the real parkour. The deep cuts. The addictive wall-touching stuff. The
				projects that shaped styles but never got algorithm love.
			</p>
			<p class="jf-display text-lg md:text-xl">
				This is about preservation. This is about culture.
			</p>
			<p class="text-muted-foreground">
				Not social media. Not algorithm chaos. More like: a cinematic museum for parkour.
			</p>
		</div>
	</div>

	<div class="jf-surface mt-6 rounded-3xl p-6 md:mt-8 md:p-8">
		<div class="text-center">
			<h2 class="text-2xl font-semibold tracking-tight md:text-4xl">About Me</h2>
			<div class="mx-auto mt-3 h-1 w-24 rounded bg-foreground/90" aria-hidden="true"></div>
		</div>

		<div class="mt-8 grid gap-8 md:grid-cols-2 md:items-start">
			<div class="space-y-6 text-sm leading-7 text-muted-foreground md:text-base">
				<p class="text-foreground">
					I&apos;m Max — a web developer, creator, and parkour athlete from Bergen op Zoom 🇳🇱.
				</p>
				<p>
					I spend most of my time building digital tools, coding ideas into reality, and enjoying
					life offline through parkour, photography, and creative side projects under the name
					<span class="font-semibold text-foreground">MAXmade</span>.
				</p>
				<p>
					I like to keep things simple, fast, and fun — whether it&apos;s in code or daily life.
				</p>
				<p>
					For the curious:
					<a
						href="https://www.maxmade.nl"
						target="_blank"
						rel="noopener noreferrer"
						class="ml-1 font-medium text-foreground underline decoration-muted-foreground/60 underline-offset-4 transition hover:decoration-foreground"
						>MAXmade.nl</a
					>
				</p>

				<img
					src="/images/signature-max.svg"
					alt="Max signature"
					class="mt-8 h-12 w-auto opacity-90"
					loading="lazy"
				/>
			</div>

			<div class="space-y-3">
				<div class="overflow-hidden rounded-2xl border border-border bg-background/40">
					<div class="aspect-video">
						<video autoplay muted loop playsinline preload="metadata" class="h-full w-full object-cover">
							<source src="/images/parkour.mp4" type="video/mp4" />
						</video>
					</div>
				</div>
				<p class="text-xs text-muted-foreground">{m.about_thisIsMe()}</p>
			</div>
		</div>
	</div>
</div>

<style>
	.secret-achievement {
		position: relative;
		isolation: isolate;
	}

	.secret-achievement::before {
		content: '';
		position: absolute;
		inset: -22%;
		pointer-events: none;
		background:
			radial-gradient(
				640px circle at 18% 30%,
				color-mix(in oklch, var(--primary) 28%, transparent),
				transparent 62%
			),
			radial-gradient(
				560px circle at 82% 10%,
				color-mix(in oklch, var(--primary) 20%, transparent),
				transparent 58%
			),
			radial-gradient(
				720px circle at 55% 120%,
				color-mix(in oklch, var(--foreground) 8%, transparent),
				transparent 55%
			),
			linear-gradient(
				135deg,
				color-mix(in oklch, var(--primary) 10%, transparent),
				transparent 48%,
				color-mix(in oklch, var(--primary) 7%, transparent)
			);
		opacity: 0.95;
		animation: secret-pulse 7.5s ease-in-out infinite;
	}

	.secret-achievement::after {
		content: '';
		position: absolute;
		inset: -65%;
		pointer-events: none;
		background: linear-gradient(
			110deg,
			transparent 40%,
			color-mix(in oklch, var(--foreground) 22%, transparent) 50%,
			transparent 60%
		);
		filter: blur(10px);
		mix-blend-mode: overlay;
		opacity: 0;
		transform: translateX(-60%) rotate(12deg);
		animation: secret-sheen 3.1s ease-in-out infinite;
	}

	@keyframes secret-pulse {
		0%,
		100% {
			transform: translate3d(0, 0, 0) scale(1);
			opacity: 0.9;
		}
		50% {
			transform: translate3d(0, -1%, 0) scale(1.02);
			opacity: 1;
		}
	}

	@keyframes secret-sheen {
		0% {
			opacity: 0;
			transform: translateX(-60%) rotate(12deg);
		}
		18% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.5;
		}
		82% {
			opacity: 0.35;
		}
		100% {
			opacity: 0;
			transform: translateX(60%) rotate(12deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.secret-achievement::before,
		.secret-achievement::after {
			animation: none;
		}
	}
</style>
