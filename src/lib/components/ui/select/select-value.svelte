<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	type $$Props = SelectPrimitive.ValueProps;
</script>

<SelectPrimitive.Value
	class={cn("text-sm", $$props.class)}
	{...$$restProps}
/>
