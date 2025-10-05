<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	type $$Props = SelectPrimitive.ItemProps;

	let className: $$Props['class'] = undefined;
	export { className as class };
	export let value: $$Props['value'];
</script>

<SelectPrimitive.Item
	class={cn(
		'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className
	)}
	{value}
	{...$$restProps}
>
	<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
		<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
				clip-rule="evenodd"
			/>
		</svg>
	</span>
	<slot />
</SelectPrimitive.Item>
