<script lang="ts">
	let {
		text = 'XPop',
		class: className = '',
		iconClass = 'size-4',
		textClass = '',
		overlayClass = 'text-[7px]'
	}: {
		text?: string;
		class?: string;
		iconClass?: string;
		textClass?: string;
		overlayClass?: string;
	} = $props();
</script>

<span class={`inline-flex items-center gap-1.5 align-middle ${className}`.trim()}>
	<span class={`relative inline-flex shrink-0 items-center justify-center ${iconClass}`.trim()}>
		<img
			src="/images/popcorn.svg"
			alt=""
			class="h-full w-full object-contain"
			decoding="async"
			draggable="false"
		/>
		<span
			class={`absolute inset-0 flex items-center justify-center leading-none font-black tracking-[-0.04em] text-[rgba(92,43,0,0.92)] ${overlayClass}`.trim()}
		>
			XP
		</span>
	</span>
	{#if text}
		<span class={`min-w-0 ${textClass}`.trim()}>{text}</span>
	{/if}
</span>