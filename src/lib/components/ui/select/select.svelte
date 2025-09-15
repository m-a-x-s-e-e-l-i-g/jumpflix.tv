<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";

	type $$Props = SelectPrimitive.Props;
	type $$Events = SelectPrimitive.Events;
</script>

<SelectPrimitive.Root {...$$restProps} on:valuechange>
	<slot />
</SelectPrimitive.Root>
