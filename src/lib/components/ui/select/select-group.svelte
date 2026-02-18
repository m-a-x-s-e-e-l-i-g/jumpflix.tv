<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';

	type $$Props = SelectPrimitive.GroupProps;

	let className: $$Props['class'] = undefined;
	export { className as class };
</script>

<SelectPrimitive.Group class={className} {...$$restProps}>
	<slot />
</SelectPrimitive.Group>
