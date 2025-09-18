<script lang="ts">
		import { Switch as SwitchPrimitive } from "bits-ui";
			import { cn } from "$lib/utils.js";

			// Minimal local props to avoid typing mismatches
			type $$Props = { class?: string; checked?: boolean };

			let className: $$Props["class"] = undefined;
			export { className as class };
			export let checked: $$Props["checked"] = undefined;

			const rootBase =
				"group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
			const thumbBase =
				"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform";

			$: rootClass = cn(rootBase, checked ? "bg-primary" : "bg-input", className);
			$: thumbClass = cn(thumbBase, checked ? "translate-x-5" : "translate-x-0");
</script>

		<SwitchPrimitive.Root bind:checked class={rootClass} {...$$restProps}>
			<SwitchPrimitive.Thumb class={thumbClass} />
</SwitchPrimitive.Root>