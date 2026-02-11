<script lang="ts">
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import { m } from '$lib/paraglide/messages.js';
</script>

<a
	href="/about"
	aria-label={m.help_buttonLabel()}
	class="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
>
	<HelpCircleIcon class="size-5" />
</a>
