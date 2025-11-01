<script lang="ts">
  import type { Writable } from 'svelte/store';
  import Switch from '$lib/components/ui/Switch.svelte';
  import * as m from '$lib/paraglide/messages';
  import { sortLabels } from '$lib/tv/utils';
  import type { SortBy } from '$lib/tv/types';

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

  const containerClass = 'tv-search-surface';
  const labelClass = 'tv-search-toggle';
  const selectClass = 'tv-search-select';
</script>

<div id="tv-search-controls" class="relative z-10 mx-auto mt-30 w-full max-w-5xl">
  <div class={containerClass}>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
      <form class="relative flex-1 min-w-[260px] group" on:submit|preventDefault>
        <span class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#f87171] transition-colors z-10">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
        </span>
        {#if $searchQuery}
          <button
            type="button"
            class="absolute inset-y-0 right-3 flex items-center rounded-md p-1 text-gray-400 transition-colors hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:ring-offset-2 focus:ring-offset-slate-950/70 z-10"
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
          class="h-12 w-full rounded-2xl border border-white/10 bg-slate-900/80 pr-12 text-sm text-gray-100 placeholder-gray-400 shadow-sm transition focus:border-[#e50914]/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]/70"
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
          <span class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-300">▾</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .tv-search-surface {
    position: relative;
    border-radius: 28px;
    padding: 1.5rem;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.68));
    box-shadow:
      0 35px 100px -50px rgba(2, 6, 23, 0.8),
      0 18px 50px -38px rgba(2, 6, 23, 0.65);
    overflow: hidden;
  }

  .tv-search-surface::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(130deg, rgba(59, 130, 246, 0.18), rgba(244, 114, 182, 0.14));
    opacity: 0.85;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  .tv-search-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.66));
    padding: 0.75rem 1rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(226, 232, 240, 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .tv-search-toggle:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 30px -22px rgba(2, 6, 23, 0.55);
  }

  .tv-search-select {
    appearance: none;
    width: 100%;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: linear-gradient(150deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.76));
    padding: 0.65rem 2.6rem 0.65rem 1rem;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.11em;
    color: rgba(226, 232, 240, 0.95);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .tv-search-select:focus {
    outline: none;
    border-color: rgba(244, 114, 182, 0.55);
    box-shadow: 0 0 0 3px rgba(244, 114, 182, 0.15);
  }

  @media (max-width: 640px) {
    .tv-search-surface {
      padding: 1.25rem;
      border-radius: 24px;
    }

    .tv-search-select {
      border-radius: 16px;
    }
  }
</style>
