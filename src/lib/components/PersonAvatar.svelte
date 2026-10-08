<script lang="ts">
	let {
		name,
		src = null,
		large = false
	}: { name: string; src?: string | null; large?: boolean } = $props();
	let failed = $derived(!src);
	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase()
	);
</script>

<div
	class={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-white/45 ${large ? 'size-20 text-2xl sm:size-28 sm:text-3xl' : 'size-14 text-lg'}`}
>
	{#if src && !failed}
		<img
			{src}
			alt={`${name} profile`}
			width="512"
			height="512"
			class="size-full object-cover"
			loading={large ? 'eager' : 'lazy'}
			onerror={() => (failed = true)}
		/>
	{:else}
		<span aria-label={`${name} profile`}>{initials}</span>
	{/if}
</div>
