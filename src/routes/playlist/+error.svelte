<script lang="ts">
	import { page } from '$app/stores';
	import ErrorPage from '$lib/components/ErrorPage.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<ErrorPage
	status={$page.status}
	message={$page.error?.message}
	title={$page.status === 404 ? m.error_playlist_404_title() : undefined}
	{...$page.status === 404 && { message: m.error_playlist_404_description() }}
/>
