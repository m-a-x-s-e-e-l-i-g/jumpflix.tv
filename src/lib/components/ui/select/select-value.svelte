<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	type $$Props = HTMLAttributes<HTMLSpanElement>;
	let className: $$Props['class'] = undefined;
	export { className as class };
</script>

<span class={cn('text-sm', className)} {...$$restProps}>
	<slot />
	<!-- Provide default slot fallback to show selected value via trigger content -->
</span>
