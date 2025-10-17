<script lang="ts">
  import type { Writable } from 'svelte/store';
  import Switch from '$lib/components/ui/Switch.svelte';
  import * as m from '$lib/paraglide/messages';
  import { sortLabels } from '$lib/tv/utils';
  import type { SortBy } from '$lib/tv/types';
  import { isPerformanceMode } from '$lib/tv/store';

  export let searchQuery: Writable<string>;
  export let showPaid: Writable<boolean>;
  export let sortBy: Writable<SortBy>;

  function clearSearch() {
    searchQuery.set('');
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery.set(target.value);
  }

  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    sortBy.set(target.value as SortBy);
  }

  let performanceMode = false;
  $: performanceMode = $isPerformanceMode;

  const defaultContainerClass = 'rounded-3xl border border-white/10 bg-white/70 p-6 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65';
  const performanceContainerClass = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-none dark:border-slate-700/70 dark:bg-slate-900';
  $: containerClass = performanceMode ? performanceContainerClass : defaultContainerClass;

  const defaultLabelClass = 'flex items-center gap-3 select-none rounded-2xl border border-white/15 bg-white/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-200';
  const performanceLabelClass = 'flex items-center gap-3 select-none rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-gray-200';
  $: labelClass = performanceMode ? performanceLabelClass : defaultLabelClass;

  const defaultSelectClass = 'appearance-none w-full rounded-2xl border border-white/30 bg-white/50 px-4 py-3 pr-10 text-sm font-semibold uppercase tracking-[0.12em] text-gray-800 transition focus:border-[#e50914]/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-100';
  const performanceSelectClass = 'appearance-none w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-9 text-[13px] font-semibold uppercase tracking-[0.1em] text-gray-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100';
  $: selectClass = performanceMode ? performanceSelectClass : defaultSelectClass;
</script>

<div id="search" class="relative z-10 mx-auto mt-30 w-full max-w-5xl">
  <div class={containerClass}>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
      <form class="relative flex-1 min-w-[260px] group">
        <span class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-700 group-focus-within:text-[#e50914] dark:text-gray-400 dark:group-focus-within:text-[#f87171] transition-colors z-10">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
        </span>
        {#if $searchQuery}
          <button
            type="button"
            class="absolute inset-y-0 right-3 flex items-center rounded-md p-1 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:ring-offset-2 focus:ring-offset-white/40 dark:focus:ring-offset-slate-950/70 z-10"
            on:click={clearSearch}
            aria-label="Clear search"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
        <input
          value={$searchQuery}
          on:input={handleInput}
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder={m.tv_searchPlaceholder()}
          aria-label="Search content"
          class="h-12 w-full rounded-2xl border border-white/50 bg-white/60 pr-12 text-sm text-gray-900 placeholder-gray-600 shadow-sm transition focus:border-[#e50914]/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-gray-100 dark:placeholder-gray-400"
          style="padding-left: 3rem;"
        />
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center lg:justify-end lg:pl-6">
  <label class={labelClass}>
          <span>{m.tv_showPaid()}</span>
          <Switch
            checked={$showPaid}
            ariaLabel={m.tv_showPaid()}
            on:change={(event) => showPaid.set(event.detail)}
          />
        </label>

        <div class="relative min-w-[170px]">
          <select
            value={$sortBy}
            on:change={handleSortChange}
            class={selectClass}
          >
            {#each Object.entries(sortLabels) as [value, label]}
              <option value={value}>{label}</option>
            {/each}
          </select>
          <span class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-600 dark:text-gray-300">▾</span>
        </div>
      </div>
    </div>
  </div>
</div>
