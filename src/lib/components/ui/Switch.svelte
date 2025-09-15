<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ change: boolean }>();
  export let checked: boolean = false;
  export let disabled: boolean = false;
  export let ariaLabel: string = 'Toggle';
  export let className: string = '';
  function toggle() { if (disabled) return; checked = !checked; dispatch('change', checked); }
  function onKey(e: KeyboardEvent) { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); toggle(); } }
</script>

<div
  role="switch"
  tabindex={disabled ? undefined : 0}
  aria-checked={checked}
  aria-label={ariaLabel}
  class={`relative inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none ${checked ? 'bg-primary' : 'bg-input'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
  on:click={toggle}
  on:keydown={onKey}
>
  <div class="absolute left-0 top-0 h-full w-full rounded-full border border-transparent focus-visible:ring-[3px]"></div>
  <div class="pointer-events-none block size-4 rounded-full bg-background shadow transform transition-transform" style={`translate: ${checked ? 'calc(100% - 2px)' : '0'}`}></div>
</div>

<style>
  :global(.dark) .bg-input { background-color: oklch(var(--input)); }
</style>
