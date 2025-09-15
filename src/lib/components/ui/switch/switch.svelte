<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { tv, type VariantProps } from "tailwind-variants";

	const switchVariants = tv({
		slots: {
			root: "group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
			thumb:
				"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
		},
		variants: {
			checked: {
				true: {
					root: "bg-primary",
					thumb: "translate-x-5",
				},
				false: {
					root: "bg-input",
					thumb: "translate-x-0",
				},
			},
		},
	});

	type $$Props = SwitchPrimitive.Props & VariantProps<typeof switchVariants>;

	let className: $$Props["class"] = undefined;
	export { className as class };
	export let checked: $$Props["checked"] = undefined;

	const { root, thumb } = switchVariants({ checked, class: className });
</script>

<SwitchPrimitive.Root bind:checked class={root()} {...$$restProps}>
	<SwitchPrimitive.Thumb class={thumb()} />
</SwitchPrimitive.Root>

<SwitchPrimitive.Root bind:checked class={root()} {...$$restProps}>
	<SwitchPrimitive.Thumb class={thumb()} />
</SwitchPrimitive.Root>