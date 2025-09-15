<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	type $$Props = SelectPrimitive.TriggerProps;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<SelectPrimitive.Trigger
	class={cn(
		"flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
		className
	)}
	{...$$restProps}
>
	<slot />
	<svg class="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
	</svg>
</SelectPrimitive.Trigger>