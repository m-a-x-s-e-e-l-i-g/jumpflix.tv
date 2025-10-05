<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';

	// bits-ui v2 exposes RootProps via Select exports
	type $$Props = SelectPrimitive.RootProps;
	// default to single-select unless overridden
	export let type: 'single' | 'multiple' = 'single';

	// Helper types for each variant
	type SingleProps = Extract<SelectPrimitive.RootProps, { type: 'single' }>;
	type MultipleProps = Extract<SelectPrimitive.RootProps, { type: 'multiple' }>;
</script>

{#if type === 'single'}
	<SelectPrimitive.Root type="single" {...$$restProps as any}>
		<slot />
	</SelectPrimitive.Root>
{:else}
	<SelectPrimitive.Root type="multiple" {...$$restProps as any}>
		<slot />
	</SelectPrimitive.Root>
{/if}
