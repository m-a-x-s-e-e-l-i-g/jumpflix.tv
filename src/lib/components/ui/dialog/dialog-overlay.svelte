<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { fade } from "svelte/transition";

	let {
		ref = $bindable(null),
		class: className,
		transition = fade,
		transitionConfig = { duration: 150 },
		...restProps
	}: DialogPrimitive.OverlayProps & {
		ref?: HTMLDivElement | null;
		transition?: typeof fade;
		transitionConfig?: Parameters<typeof fade>[1];
	} = $props();
</script>

<DialogPrimitive.Overlay
	bind:ref
	{transition}
	{transitionConfig}
	class={cn(
		"fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
		className
	)}
	{...restProps}
/>
