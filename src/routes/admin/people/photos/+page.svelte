<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	let { data, form } = $props();
	let query = $state('');
	let missingOnly = $state(true);
	let page = $state(0);
	let busy = $state<string | null>(null);
	let importing = $state(false);
	let stopRequested = $state(false);
	let importMessage = $state('');
	const importable = $derived(
		data.people.filter((person) => !person.photo && person.handles.length === 1)
	);
	async function importMissing() {
		if (busy || importing || !data.migrationReady || !data.instagramReady) return;
		const queue = [...importable];
		importing = true;
		stopRequested = false;
		let added = 0;
		let failed = 0;
		try {
			for (const person of queue) {
				if (stopRequested) break;
				busy = person.slug;
				importMessage = `Importing ${added + failed + 1} of ${queue.length} · ${person.name}`;
				const payload = new FormData();
				payload.set('slug', person.slug);
				payload.set('method', 'instagram');
				payload.set('handle', person.handles[0]);
				try {
					const response = await fetch('?/save', {
						method: 'POST',
						body: payload,
						headers: { 'x-sveltekit-action': 'true' }
					});
					const result = deserialize(await response.text());
					if (result.type === 'success') added++;
					else {
						failed++;
						if (result.type !== 'failure' || result.data?.stopImport) stopRequested = true;
					}
				} catch {
					failed++;
					stopRequested = true;
				}
			}
			importMessage = `${added} ${added === 1 ? 'photo' : 'photos'} added${failed ? ` · ${failed} need a retry or upload` : ''}${stopRequested ? ' · stopped' : ''}.`;
			await invalidateAll();
		} finally {
			busy = null;
			importing = false;
		}
	}
	const missing = $derived(data.people.filter((person) => !person.photo).length);
	const filtered = $derived(
		data.people.filter(
			(person) =>
				(!missingOnly || !person.photo) &&
				`${person.name} ${person.handles.join(' ')}`.toLowerCase().includes(query.toLowerCase())
		)
	);
	const pages = $derived(Math.max(1, Math.ceil(filtered.length / 25)));
	const currentPage = $derived(Math.min(page, pages - 1));
	const visible = $derived(filtered.slice(currentPage * 25, (currentPage + 1) * 25));
</script>

<svelte:head><title>Athlete photos · Jumpflix admin</title></svelte:head>
<div class="mx-auto w-full max-w-5xl px-6 pt-24 pb-16">
	<p class="jf-label">Admin desk</p>
	<h1 class="mt-2 text-3xl font-semibold text-white">Athlete photos</h1>
	<p class="mt-3 text-sm text-white/60">
		{data.people.length - missing}
		{data.people.length - missing === 1 ? 'photo' : 'photos'} added · {missing} still missing
	</p>
	<p class="mt-2 max-w-2xl text-sm text-white/60">
		Import from a saved Instagram handle, or upload a photo. Photos appear on the athlete’s page.
	</p>
	{#if !data.migrationReady}
		<p class="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
			Profile photos need the database migration before saving. Apply the migration from the profile
			photo setup guide.
		</p>
	{/if}
	{#if data.migrationReady && !data.instagramReady}
		<p class="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
			Instagram imports need API setup. Photo uploads are available. See the profile photo setup
			guide in the repository.
		</p>
	{/if}
	{#if form?.message}
		<p role="status" class="mt-5 rounded-xl border border-white/10 p-4 text-sm text-white/80">
			{form.message}
		</p>
	{/if}
	<div class="mt-5 flex flex-wrap items-center gap-3">
		<button
			onclick={importMissing}
			disabled={!data.migrationReady ||
				!data.instagramReady ||
				!importable.length ||
				busy !== null ||
				importing}
			class="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-35"
			>Import missing photos ({importable.length})</button
		>
		{#if importing}<button
				onclick={() => (stopRequested = true)}
				disabled={stopRequested}
				class="text-sm text-white/60 underline disabled:opacity-35"
				>{stopRequested ? 'Stopping…' : 'Stop after this photo'}</button
			>{/if}
		{#if importMessage}<p role="status" class="text-sm text-white/70">{importMessage}</p>{/if}
	</div>
	<p class="mt-2 text-xs text-white/45">
		Imports athletes with one saved handle. Choose a handle below for athletes with several
		accounts.
	</p>
	<div class="mt-7 flex flex-wrap items-center gap-4">
		<label class="w-full min-w-0 sm:flex-1"
			><span class="sr-only">Search athletes</span><input
				type="search"
				placeholder="Search name or Instagram…"
				bind:value={query}
				oninput={() => (page = 0)}
				class="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white"
			/></label
		>
		<label class="flex items-center gap-2 text-sm text-white/70"
			><input type="checkbox" bind:checked={missingOnly} onchange={() => (page = 0)} /> Missing photos
			only</label
		>
	</div>
	<div class="mt-5 divide-y divide-white/10">
		{#each visible as person (person.slug)}
			<div class="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
				<div class="flex min-w-0 flex-1 items-center gap-4">
					<PersonAvatar name={person.name} src={person.photo} />
					<div class="min-w-0">
						<a
							href={resolve('/people/[slug]', { slug: person.slug })}
							class="font-medium text-white hover:underline">{person.name}</a
						>
						<p class="mt-1 text-xs text-white/45">
							{person.photo
								? `Photo added${person.source === 'instagram' ? ' from Instagram' : ''}`
								: 'No photo yet'}
						</p>
					</div>
				</div>
				<div class="flex flex-col gap-3 sm:w-80">
					{#if person.handles.length}
						<form
							method="POST"
							action="?/save"
							use:enhance={() => {
								busy = person.slug;
								return async ({ update }) => {
									try {
										await update();
									} finally {
										busy = null;
									}
								};
							}}
							class="flex gap-2"
						>
							<input type="hidden" name="slug" value={person.slug} /><input
								type="hidden"
								name="method"
								value="instagram"
							/>
							<select
								name="handle"
								aria-label={`Instagram handle for ${person.name}`}
								class="min-w-0 flex-1 rounded-lg border border-white/15 bg-background px-2 py-2 text-sm text-white/80"
								>{#each person.handles as handle (handle)}<option value={handle}>@{handle}</option
									>{/each}</select
							>
							<button
								disabled={!data.migrationReady || !data.instagramReady || busy !== null}
								class="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-35"
								>{busy === person.slug ? 'Saving…' : person.photo ? 'Refresh' : 'Import'}</button
							>
						</form>
					{:else}<p class="text-xs text-white/45">No Instagram handle saved</p>{/if}
					<form
						method="POST"
						action="?/save"
						enctype="multipart/form-data"
						use:enhance={() => {
							busy = person.slug;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									busy = null;
								}
							};
						}}
						class="flex items-center gap-2"
					>
						<input type="hidden" name="slug" value={person.slug} /><input
							type="hidden"
							name="method"
							value="upload"
						/>
						<input
							type="file"
							name="photo"
							accept="image/jpeg,image/png,image/webp"
							required
							aria-label={`Upload photo for ${person.name}`}
							class="min-w-0 flex-1 text-xs text-white/60 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-2 file:text-white/80"
						/>
						<button
							disabled={!data.migrationReady || busy !== null}
							class="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-35"
							>Upload</button
						>
					</form>
				</div>
			</div>
		{:else}<p class="py-12 text-sm text-white/60">
				{missingOnly && !missing
					? 'All athlete photos are added.'
					: 'No athletes match this search.'}
			</p>{/each}
	</div>
	<div class="mt-6 flex items-center justify-between gap-3 text-sm text-white/60">
		<button
			disabled={currentPage === 0 || busy !== null}
			onclick={() => (page = currentPage - 1)}
			class="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">Previous</button
		><span>Page {currentPage + 1} of {pages}</span><button
			disabled={currentPage === pages - 1 || busy !== null}
			onclick={() => (page = currentPage + 1)}
			class="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">Next</button
		>
	</div>
	<p class="mt-6 text-xs text-white/40">JPEG, PNG or WebP · up to 5 MB · cropped to a square</p>
</div>
