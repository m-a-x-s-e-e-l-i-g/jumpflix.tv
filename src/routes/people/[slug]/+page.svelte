<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';
	import { searchQuery, selectedFacets, showPaid, showWatched, sortBy } from '$lib/tv/store';

	let { data } = $props<{
		data: {
			name: string;
			slug: string;
			roles: { creator: boolean; athlete: boolean };
			instagramHandles: string[];
		};
	}>();

	let previousQuery: string | null = null;
	let previousFacets: any = null;
	let previousShowPaid: boolean | null = null;
	let previousShowWatched: boolean | null = null;
	let previousSortBy: any = null;

	const roleLabel = $derived(
		data.roles.creator && data.roles.athlete
			? 'Creator & Athlete'
			: data.roles.creator
				? 'Creator'
				: 'Athlete'
	);

	if (browser) {
		previousQuery = get(searchQuery);
		previousFacets = get(selectedFacets);
		previousShowPaid = get(showPaid);
		previousShowWatched = get(showWatched);
		previousSortBy = get(sortBy);
		searchQuery.set('');
		selectedFacets.set({});
		showPaid.set(true);
		showWatched.set(true);
		sortBy.set('default');
	}

	onDestroy(() => {
		if (previousQuery !== null) searchQuery.set(previousQuery);
		if (previousFacets !== null) selectedFacets.set(previousFacets);
		if (previousShowPaid !== null) showPaid.set(previousShowPaid);
		if (previousShowWatched !== null) showWatched.set(previousShowWatched);
		if (previousSortBy !== null) sortBy.set(previousSortBy);
	});

</script>

<svelte:head>
	<title>{data.name} — {roleLabel} — JUMPFLIX</title>
	<meta
		name="description"
		content={data.roles.creator && data.roles.athlete
			? `All films and series featuring or created by ${data.name}.`
			: data.roles.creator
				? `All films and series created by ${data.name}.`
				: `All films and series featuring ${data.name}.`}
	/>
	<link rel="canonical" href={`https://www.jumpflix.tv/people/${data.slug}/`} />
	<meta property="og:title" content={`${data.name} — ${roleLabel} — JUMPFLIX`} />
	<meta
		property="og:description"
		content={data.roles.creator && data.roles.athlete
			? `All films and series featuring or created by ${data.name}.`
			: data.roles.creator
				? `All films and series created by ${data.name}.`
				: `All films and series featuring ${data.name}.`}
	/>
	<meta property="og:url" content={`https://www.jumpflix.tv/people/${data.slug}/`} />
</svelte:head>

<!-- Content rendered in layout (TvPage uses data.content) -->
