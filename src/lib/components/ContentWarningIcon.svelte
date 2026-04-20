<script lang="ts">
	import type { ContentWarning } from '$lib/tv/types';

	export let warning: ContentWarning;
	export let className = '';

	$: usesAssetViewBox = warning === 'sexual-content' || warning === 'strong-language';
	$: viewBox = usesAssetViewBox ? '0 -960 960 960' : '0 0 24 24';
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox={viewBox}
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	{#if !usesAssetViewBox}
		<path stroke="none" d="M0 0h24v24H0z" fill="none" />
	{/if}
	{#if warning === 'violence'}
		<path d="M2 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3" />
		<path d="M6 12l1 -5h5l3 5" />
		<path d="M21 9h-7.8" />
	{:else if warning === 'substances'}
		<path d="M13 3v8.416c.134 .059 .265 .123 .393 .193l3.607 -3.609l2 2l-3.608 3.608a5 5 0 1 1 -6.392 -2.192v-8.416h4" />
		<path d="M8 3h6" />
		<path d="M6.1 17h9.8" />
	{:else if warning === 'strong-language'}
		<path
			d="M360-280h240v-80H440v-80h160v-80H440v-80h160v-80H360v400ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"
			fill="currentColor"
			stroke="none"
		/>
	{:else if warning === 'sexual-content'}
		<path
			d="M191.5-651.5Q180-663 180-680t11.5-28.5Q203-720 220-720t28.5 11.5Q260-697 260-680t-11.5 28.5Q237-640 220-640t-28.5-11.5ZM400-80q-66 0-113-47t-47-113v-240q0-100 70-170t170-70h73q69 0 118 46.5T720-559q0 46-24.5 84.5T629-416q-32 15-50.5 44.5T560-307v67q0 67-46.5 113.5T400-80ZM291.5-731.5Q280-743 280-760v-20q0-17 11.5-28.5T320-820q17 0 28.5 11.5T360-780v20q0 17-11.5 28.5T320-720q-17 0-28.5-11.5Zm165 548Q480-207 480-240v-67q0-58 30.5-107t83.5-74q21-10 33.5-29.5T640-560q0-35-26-57.5T553-640h-73q-66 0-113 47t-47 113v240q0 33 23.5 56.5T400-160q33 0 56.5-23.5Zm-45-588Q400-783 400-800v-20q0-17 11.5-28.5T440-860q17 0 28.5 11.5T480-820v20q0 17-11.5 28.5T440-760q-17 0-28.5-11.5Zm120 0Q520-783 520-800v-40q0-17 11.5-28.5T560-880q17 0 28.5 11.5T600-840v40q0 17-11.5 28.5T560-760q-17 0-28.5-11.5Zm126 34Q640-755 640-780v-40q0-25 17.5-42.5T700-880q25 0 42.5 17.5T760-820v40q0 25-17.5 42.5T700-720q-25 0-42.5-17.5ZM400-480Z"
			fill="currentColor"
			stroke="none"
		/>
	{:else}
		<path d="M12 21a9 9 0 1 1 0 -18a9 9 0 0 1 0 18" />
		<path d="M9 10h-.01" />
		<path d="M15 10h-.01" />
		<path d="M8 16l1 -1l1.5 1l1.5 -1l1.5 1l1.5 -1l1 1" />
	{/if}
</svg>