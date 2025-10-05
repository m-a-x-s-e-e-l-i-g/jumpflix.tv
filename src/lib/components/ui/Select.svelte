<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	export let value: string = '';
	export let options: { value: string; label: string }[] = [];
	export let placeholder = 'Select';
	export let ariaLabel = 'Select';
	export let className = '';
	const dispatch = createEventDispatcher<{ change: string }>();
	function onChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		dispatch('change', value);
	}
</script>

<div class={`relative inline-block ${className}`}>
	<select
		class="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm transition focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none dark:border-gray-600 dark:bg-gray-800"
		bind:value
		aria-label={ariaLabel}
		on:change={onChange}
	>
		{#if placeholder && !value}
			<option value="" disabled selected hidden>{placeholder}</option>
		{/if}
		{#each options as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
	<div
		class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500 dark:text-gray-400"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
			><path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M19 9l-7 7-7-7"
			/></svg
		>
	</div>
</div>
