<script lang="ts">
	import { cn } from "$lib/utils.js";

	let className: string | undefined = undefined;
	export { className as class };
</script>

<div class={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}>
	<slot />
</div>