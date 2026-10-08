<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		buildInstagramResearchContext,
		mergeInstagramAccounts,
		parseInstagramFollowing,
		suggestInstagramAccounts,
		type InstagramAccount,
		type InstagramCredit,
		type InstagramPerson,
		type InstagramProfile
	} from '$lib/instagram/following';

	let {
		missingPeople,
		credits,
		profiles,
		tableReady
	}: {
		missingPeople: InstagramPerson[];
		credits: InstagramCredit[];
		profiles: InstagramProfile[];
		tableReady: boolean;
	} = $props();
	let accounts = $state<InstagramAccount[]>([]);
	let importedFiles = $state('');
	let importError = $state('');
	let importing = $state(false);
	let view = $state<'suggestions' | 'research'>('suggestions');
	let search = $state('');
	let page = $state(1);
	let selected = $state<Record<string, string>>({});
	let savingSlug = $state('');
	const suggestions = $derived(
		suggestInstagramAccounts(missingPeople, accounts, profiles, credits)
	);
	const context = $derived(buildInstagramResearchContext(credits, profiles, accounts));
	const suggestedPeople = $derived(
		missingPeople
			.filter((person) => suggestions[person.slug]?.length)
			.sort(
				(a, b) =>
					suggestions[b.slug][0].score - suggestions[a.slug][0].score ||
					a.name.localeCompare(b.name)
			)
	);
	const researchPeople = $derived(
		missingPeople
			.filter((person) => !suggestions[person.slug]?.length)
			.sort(
				(a, b) =>
					Number(context[b.slug]?.collaborators.some((person) => person.followed) ?? false) -
						Number(context[a.slug]?.collaborators.some((person) => person.followed) ?? false) ||
					(context[b.slug]?.collaborators.length ?? 0) -
						(context[a.slug]?.collaborators.length ?? 0) ||
					a.name.localeCompare(b.name)
			)
	);
	const matchingPeople = $derived(
		(view === 'suggestions' ? suggestedPeople : researchPeople).filter((person) => {
			const query = search.trim().toLowerCase();
			return (
				!query ||
				person.name.toLowerCase().includes(query) ||
				suggestions[person.slug]?.some((candidate) => candidate.handle.includes(query))
			);
		})
	);
	const pageCount = $derived(Math.max(1, Math.ceil(matchingPeople.length / 25)));
	const visiblePage = $derived(Math.min(page, pageCount));
	const visiblePeople = $derived(matchingPeople.slice((visiblePage - 1) * 25, visiblePage * 25));
	const importedHandles = $derived(new Set(accounts.map((account) => account.handle)));
	const knownInExport = $derived(
		profiles.filter((profile) =>
			profile.instagram_handles?.some((handle) => importedHandles.has(handle.toLowerCase()))
		).length
	);

	async function importFollowing(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (!files.length) return;
		importError = '';
		importing = true;
		try {
			if (
				files.some((file) => file.size > 5_000_000) ||
				files.reduce((sum, file) => sum + file.size, 0) > 10_000_000
			) {
				throw new Error('Choose following JSON files up to 5 MB each and 10 MB in total.');
			}
			const groups = await Promise.all(
				files.map(async (file) => {
					try {
						return parseInstagramFollowing(await file.text());
					} catch (error) {
						throw new Error(
							`${file.name}: ${error instanceof Error ? error.message : 'Could not read this file.'}`
						);
					}
				})
			);
			accounts = mergeInstagramAccounts(groups);
			importedFiles = files.map((file) => file.name).join(', ');
			selected = {};
			search = '';
			page = 1;
			view = 'suggestions';
		} catch (error) {
			importError = error instanceof Error ? error.message : 'Could not read this export.';
		} finally {
			importing = false;
			input.value = '';
		}
	}
</script>

<section class="jf-surface-soft mt-6 rounded-2xl p-5" aria-labelledby="following-heading">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="max-w-2xl">
			<h2 id="following-heading" class="text-lg font-medium text-white/90">
				Suggest from your following
			</h2>
			<p class="mt-1 text-sm leading-relaxed text-white/60">
				Export Followers and following from Instagram’s Accounts Center in JSON format. Unzip the
				download, then choose following.json or multiple following files.
			</p>
		</div>
		<div class="w-full sm:w-auto">
			<label for="instagram-following-file" class="block text-xs text-white/60"
				>Following JSON</label
			>
			<input
				id="instagram-following-file"
				type="file"
				accept=".json,application/json"
				multiple
				disabled={importing}
				onchange={importFollowing}
				class="mt-2 block w-full max-w-80 text-xs text-white/60 file:mr-3 file:rounded-full file:border file:border-white/20 file:bg-white/5 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white/85 hover:file:bg-white/10"
			/>
		</div>
	</div>
	<p class="mt-3 text-xs text-white/45">
		The file stays in this browser. Only handles you approve are saved.
	</p>
	{#if importError}<p role="alert" class="mt-3 text-sm break-words text-red-200">
			{importError}
		</p>{/if}
	{#if importing}<p role="status" class="mt-3 text-sm text-white/65">Reading your export…</p>{/if}

	{#if accounts.length}
		<div class="mt-5 border-t border-white/10 pt-4">
			<p class="text-xs break-words text-white/45">{importedFiles}</p>
			<p class="mt-1 text-sm text-white/75">
				{accounts.length} accounts imported · {knownInExport} saved {knownInExport === 1
					? 'profile'
					: 'profiles'} found
			</p>
			<p class="mt-2 max-w-3xl text-xs leading-relaxed text-white/55">
				Review each name match before saving. Shared film credits give us places to look, but do not
				confirm someone’s identity. Unrelated usernames go into the research list for the next
				browser pass.
			</p>
			<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap gap-2" aria-label="Suggestion view">
					<button
						type="button"
						aria-pressed={view === 'suggestions'}
						onclick={() => {
							view = 'suggestions';
							page = 1;
						}}
						class={`rounded-full border px-4 py-2 text-sm transition ${view === 'suggestions' ? 'border-white/25 bg-white/10 text-white/90' : 'border-white/10 text-white/55 hover:bg-white/5'}`}
						>Name suggestions ({suggestedPeople.length})</button
					>
					<button
						type="button"
						aria-pressed={view === 'research'}
						onclick={() => {
							view = 'research';
							page = 1;
						}}
						class={`rounded-full border px-4 py-2 text-sm transition ${view === 'research' ? 'border-white/25 bg-white/10 text-white/90' : 'border-white/10 text-white/55 hover:bg-white/5'}`}
						>Needs research ({researchPeople.length})</button
					>
				</div>
				<label class="min-w-0 text-xs text-white/60"
					>Find a person
					<input
						type="search"
						bind:value={search}
						oninput={() => (page = 1)}
						placeholder="Name or suggested handle"
						class="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#e50914] focus:outline-none"
					/>
				</label>
			</div>

			{#if !visiblePeople.length}
				<p class="py-6 text-sm text-white/60">
					{search.trim()
						? 'No people match this search.'
						: view === 'suggestions'
							? 'No name matches found. Open Needs research to start from known collaborators.'
							: 'Everyone remaining has a name suggestion to review.'}
				</p>
			{:else}
				<ul class="mt-4 divide-y divide-white/10">
					{#each visiblePeople as person (person.slug)}
						{@const candidates = suggestions[person.slug] ?? []}
						{@const research = context[person.slug]}
						{@const chosen =
							candidates.find((candidate) => candidate.handle === selected[person.slug]) ??
							candidates[0]}
						<li class="py-4">
							<div class="flex flex-wrap items-start justify-between gap-4">
								<div class="min-w-0 flex-1">
									<a
										href={resolve('/people/[slug]', { slug: person.slug })}
										class="text-sm font-medium text-white/90 hover:underline">{person.name}</a
									>
									{#if chosen}<p class="mt-1 text-xs text-white/60">
											{chosen.reason} · {chosen.strength === 'name'
												? 'name match'
												: 'possible match'}
										</p>{/if}
									{#if research?.films.length}
										<p class="mt-2 text-xs text-white/45">
											Credited in
											{#each research.films as film, index (film.url)}{index ? ' · ' : ' '}<a
													href={resolve(film.url as `/movie/${string}` | `/series/${string}`)}
													class="text-white/60 hover:underline">{film.title}</a
												>{/each}
										</p>
									{/if}
								</div>
								{#if chosen}
									<form
										method="POST"
										action="/admin/instagram?/quickAdd"
										class="flex w-full flex-wrap items-end gap-2 sm:w-auto"
										use:enhance={() => {
											savingSlug = person.slug;
											return async ({ update }) => {
												try {
													await update();
												} finally {
													savingSlug = '';
												}
											};
										}}
									>
										<input type="hidden" name="slug" value={person.slug} />
										<label class="w-full min-w-0 text-xs text-white/50 sm:w-auto sm:flex-1"
											>Candidate for {person.name}
											<select
												name="instagram_handle"
												value={chosen.handle}
												onchange={(event) => (selected[person.slug] = event.currentTarget.value)}
												class="mt-1 block w-full rounded-xl border border-white/20 bg-[#201a1a] px-3 py-2 text-sm text-white/90 focus:border-[#e50914] focus:outline-none"
											>
												{#each candidates as candidate (candidate.handle)}<option
														value={candidate.handle}>@{candidate.handle}</option
													>{/each}
											</select>
										</label>
										<a
											href={`https://www.instagram.com/${chosen.handle}/`}
											target="_blank"
											rel="noreferrer"
											class="rounded-full border border-white/20 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
											>Open profile</a
										>
										<button
											type="submit"
											disabled={!tableReady || Boolean(savingSlug)}
											class="rounded-full bg-[#e50914] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
											>{savingSlug === person.slug ? 'Saving…' : 'Approve handle'}</button
										>
									</form>
								{:else}
									<a
										href={`https://www.google.com/search?q=${encodeURIComponent(`${person.name} parkour Instagram ${research?.films[0]?.title ?? ''}`)}`}
										target="_blank"
										rel="noreferrer"
										class="rounded-full border border-white/15 px-3 py-2 text-xs text-white/65 hover:bg-white/5"
										>Search public profiles</a
									>
								{/if}
							</div>
							{#if research?.collaborators.length}
								<p class="mt-3 text-xs leading-relaxed text-white/50">
									Shared credits with
									{#each research.collaborators.slice(0, 3) as collaborator, index (collaborator.slug)}
										{index ? ' · ' : ' '}{collaborator.name}
										{#each collaborator.handles.slice(0, 2) as handle (handle)}
											<a
												href={`https://www.instagram.com/${handle}/`}
												target="_blank"
												rel="noreferrer"
												class="text-white/70 hover:underline">@{handle}</a
											>{/each}
										{collaborator.followed ? ' (in your export)' : ''}
									{/each}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if matchingPeople.length > 25}
				<nav
					aria-label="Following suggestion pages"
					class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/60"
				>
					<button
						type="button"
						disabled={visiblePage <= 1}
						onclick={() => (page = visiblePage - 1)}
						class="rounded-full border border-white/15 px-4 py-2 disabled:opacity-30"
						>Previous</button
					>
					<span class="order-first w-full text-center sm:order-none sm:w-auto"
						>Page {visiblePage} of {pageCount} · {matchingPeople.length} people</span
					>
					<button
						type="button"
						disabled={visiblePage >= pageCount}
						onclick={() => (page = visiblePage + 1)}
						class="rounded-full border border-white/15 px-4 py-2 disabled:opacity-30">Next</button
					>
				</nav>
			{/if}
		</div>
	{/if}
</section>
