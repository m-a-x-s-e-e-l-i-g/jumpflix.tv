<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '$lib/stores/authStore';
  import UserProfileButton from '$lib/components/UserProfileButton.svelte';
  import AdminMenuButton from '$lib/components/AdminMenuButton.svelte';
  import SearchIcon from '@lucide/svelte/icons/search';
  import HomeIcon from '@lucide/svelte/icons/home';
  import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
  
  let { isAdmin = false, onSearchClick, scrolled = false } = $props<{
    isAdmin: boolean;
    onSearchClick: () => void;
    scrolled: boolean;
  }>();
  
  const isStatsRoute = $derived(
    $page.url.pathname === '/stats' || $page.url.pathname.startsWith('/stats/')
  );
  const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));
</script>

<nav
  class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
  class:bg-black={scrolled}
  class:netflix-nav-gradient={!scrolled}
>
  <div class="flex items-center justify-between px-6 py-4">
    <!-- Left side: Logo and nav links -->
    <div class="flex items-center gap-8">
      <!-- Logo -->
      <a
        href="/"
        class="flex items-center gap-2 text-red-600 hover:text-red-500 transition-colors"
        aria-label="Go to homepage"
      >
        <img
          src="/images/jumpflix.webp"
          alt="JUMPFLIX"
          class="h-10 w-auto"
          width="31"
          height="39"
        />
        <span class="hidden md:block text-2xl font-black tracking-tight">JUMPFLIX</span>
      </a>
      
      <!-- Navigation links -->
      <div class="hidden md:flex items-center gap-6">
        {#if !isStatsRoute && !isAdminRoute}
          <a
            href="/"
            class="text-white hover:text-gray-300 transition-colors font-medium"
          >
            Home
          </a>
          <button
            onclick={onSearchClick}
            class="text-white hover:text-gray-300 transition-colors font-medium"
          >
            Browse
          </button>
        {/if}
        
        {#if isStatsRoute || isAdminRoute}
          <a
            href="/"
            class="text-white hover:text-gray-300 transition-colors font-medium flex items-center gap-2"
          >
            <HomeIcon class="w-4 h-4" />
            <span>Catalog</span>
          </a>
        {/if}
        
        {#if !isStatsRoute}
          <a
            href="/stats"
            class="text-white hover:text-gray-300 transition-colors font-medium flex items-center gap-2"
          >
            <BarChart3Icon class="w-4 h-4" />
            <span>Stats</span>
          </a>
        {/if}
      </div>
    </div>
    
    <!-- Right side: Search, Admin, Profile -->
    <div class="flex items-center gap-4">
      <!-- Search icon for mobile -->
      <button
        onclick={onSearchClick}
        class="md:hidden p-2 text-white hover:text-gray-300 transition-colors"
        aria-label="Search"
      >
        <SearchIcon class="w-6 h-6" />
      </button>
      
      <!-- Search icon for desktop -->
      <button
        onclick={onSearchClick}
        class="hidden md:block p-2 text-white hover:text-gray-300 transition-colors"
        aria-label="Search"
      >
        <SearchIcon class="w-6 h-6" />
      </button>
      
      <!-- Admin button -->
      {#if isAdmin && $user}
        <AdminMenuButton />
      {/if}
      
      <!-- User profile -->
      <UserProfileButton />
    </div>
  </div>
</nav>

<style>
  .netflix-nav-gradient {
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
  }
</style>
