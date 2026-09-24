<script lang="ts">
	import { getContext, type ComponentProps } from 'svelte';
	import TvDetailPanel from './TvDetailPanel.svelte';

	const getProps = getContext<() => ComponentProps<typeof TvDetailPanel>>('jumpflix-detail-props');
	const props = $derived(getProps());
</script>

<TvDetailPanel {...props} />
