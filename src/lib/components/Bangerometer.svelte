<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { user as authUser } from '$lib/stores/authStore';
  import { scale, fade } from 'svelte/transition';
  import FlameIcon from '@lucide/svelte/icons/flame';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import ZapIcon from '@lucide/svelte/icons/zap';

  export let mediaId: number | string;
  export let initialRating: number | null = null;
  export let onRatingChange: ((rating: number) => Promise<void>) | null = null;
  export let onRatingDelete: (() => Promise<void>) | null = null;
  export let onAuthRequired: (() => void) | null = null;
  export let isWatched: boolean = false;
  export let averageRating: number = 0;
  export let ratingCount: number = 0;
  export let startExpanded: boolean = false;

  let rating = initialRating || 0;
  let savedRating: number | null = initialRating ?? null;
  let lastInitialRating = initialRating;
  let isDragging = false;
  let isExpanded = startExpanded;
  
  // Track previous mediaId to detect changes
  let previousMediaId = mediaId;
  let isHovering = false;
  let sliderElement: HTMLDivElement;
  let shake = false;
  let explosionParticles: Array<{ id: number; x: number; y: number; delay: number; vx: number; vy: number }> = [];
  let particleId = 0;
  let screenShake = false;
  let glowIntensity = 0;

  // Reset visual state when switching between different media items
  $: if (mediaId !== previousMediaId) {
    previousMediaId = mediaId;
    lastInitialRating = initialRating;
    savedRating = initialRating ?? null;
    rating = initialRating ?? 0;
    explosionParticles = [];
    shake = false;
    isExpanded = startExpanded;
  }

  $: if (startExpanded && !isExpanded) {
    isExpanded = true;
  }

  $: if (initialRating !== lastInitialRating) {
    lastInitialRating = initialRating;
    const normalizedInitial = initialRating ?? null;
    savedRating = normalizedInitial;
    if (!isDragging) {
      rating = normalizedInitial ?? 0;
    }
  }

  function toggleExpanded() {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    if (!isWatched) {
      toast.error('Please mark as watched before rating');
      return;
    }
    isExpanded = !isExpanded;
  }

  $: isAuthenticated = Boolean($authUser);
  $: intensity = rating / 10; // 0 to 1
  $: bangerLevel = getBangerLevel(rating);
  $: hasUserRating = savedRating !== null && savedRating > 0;
  let isRemovingRating = false;

  function getBangerLevel(r: number): string {
    if (r === 0) return 'Not rated';
    if (r <= 3) return 'Not it';
    if (r <= 5) return 'Mid';
    if (r <= 7) return 'Pretty good';
    if (r <= 9) return 'Banger!';
    return '🔥 ABSOLUTE BANGER! 🔥';
  }

  function getGradientColor(intensity: number): string {
    if (intensity <= 0) return 'from-gray-700 to-gray-600';
    if (intensity <= 0.3) return 'from-blue-600 to-blue-500';
    if (intensity <= 0.5) return 'from-yellow-600 to-yellow-500';
    if (intensity <= 0.7) return 'from-orange-600 to-orange-500';
    if (intensity <= 0.9) return 'from-red-600 to-red-500';
    return 'from-red-600 via-orange-500 to-yellow-400';
  }

  function handleInteractionStart(e: MouseEvent | TouchEvent) {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    if (!isWatched) {
      toast.error('Please mark as watched before rating');
      return;
    }
    isDragging = true;
    handleMove(e);
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    if (!isDragging || !sliderElement) return;

    const rect = sliderElement.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newRating = Math.max(1, Math.min(10, Math.round((x / rect.width) * 10)));

    if (newRating !== rating) {
      rating = newRating;
      triggerEffects(x, rect.width);
    }
  }

  function handleInteractionEnd() {
    if (isDragging && isAuthenticated && rating > 0) {
      isDragging = false;
      saveRating();
    }
    isDragging = false;
  }

  function triggerEffects(x: number, width: number) {
    // Camera shake effect - more intense at higher ratings
    shake = true;
    glowIntensity = rating / 10;
    setTimeout(() => (shake = false), 200);

    // Epic screen shake at max rating
    if (rating === 10) {
      screenShake = true;
      setTimeout(() => (screenShake = false), 500);
    }

    // Create explosion particles at high ratings
    if (rating >= 7) {
      const particleCount = rating >= 10 ? 12 : rating >= 9 ? 8 : 5;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
        const speed = rating >= 10 ? 2.5 : 1.5;
        explosionParticles = [
          ...explosionParticles,
          {
            id: particleId++,
            x: (x / width) * 100,
            y: 50,
            delay: i * (rating >= 10 ? 30 : 50),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed
          }
        ];
      }
      // Clean up old particles
      setTimeout(() => {
        explosionParticles = explosionParticles.slice(-20);
      }, 1200);
    }
  }

  async function saveRating() {
    if (!onRatingChange || rating === 0) return;
    
    try {
      await onRatingChange(rating);
      savedRating = rating;
      toast.success(`Rated ${rating}/10 - ${bangerLevel}`);
    } catch (error) {
      console.error('Failed to save rating:', error);
      toast.error('Failed to save rating. Please try again.');
    }
  }

  async function handleRemoveRating() {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    if (!onRatingDelete || isRemovingRating) return;
    isRemovingRating = true;
    try {
      await onRatingDelete();
      savedRating = null;
      rating = 0;
      toast.success('Rating removed');
    } catch (error) {
      console.error('Failed to remove rating:', error);
      toast.error('Failed to remove rating. Please try again.');
    } finally {
      isRemovingRating = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isAuthenticated) {
      if (e.key === 'Enter' || e.key === ' ') {
        onAuthRequired?.();
      }
      return;
    }

    if (!isWatched) {
      if (e.key === 'Enter' || e.key === ' ') {
        toast.error('Please mark as watched before rating');
      }
      return;
    }

    let newRating = rating;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      newRating = Math.min(10, rating + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      newRating = Math.max(1, rating - 1);
      e.preventDefault();
    } else if (e.key >= '0' && e.key <= '9') {
      const num = parseInt(e.key);
      newRating = num === 0 ? 10 : num;
      e.preventDefault();
    }

    if (newRating !== rating && newRating >= 1 && newRating <= 10) {
      rating = newRating;
      saveRating();
    }
  }

  onMount(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => handleMove(e);
    const handleGlobalEnd = () => handleInteractionEnd();

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  });
</script>

<div class="banger-meter-container {shake ? 'shake' : ''} {screenShake ? 'screen-shake' : ''}" class:authenticated={isAuthenticated} class:has-rating={hasUserRating} class:collapsed={!isExpanded} class:epic-mode={rating >= 10}>
  <!-- Epic Glow Effect for Maximum Rating -->
  {#if rating >= 10 && isExpanded}
    <div class="epic-glow" transition:fade={{ duration: 300 }}></div>
  {/if}
  
  <!-- Collapsed View: Shows Average Rating -->
  {#if !isExpanded}
    <button
      type="button"
      class="collapsed-view"
      on:click={toggleExpanded}
      aria-label={isAuthenticated ? 'Expand to rate this content' : 'Sign in to rate this content'}
    >
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <FlameIcon class="w-5 h-5 text-orange-500" />
          <h3 class="text-sm font-semibold text-gray-200">Bangerometer</h3>
        </div>
        <div class="flex items-center gap-3">
          {#if averageRating > 0 && ratingCount > 0}
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span class="text-xl font-bold text-orange-400">{averageRating.toFixed(1)}</span>
              <span class="text-xs text-gray-400">({ratingCount})</span>
            </div>
          {:else}
            <span class="text-sm text-gray-400">No ratings yet</span>
          {/if}
          {#if isAuthenticated}
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          {:else}
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          {/if}
        </div>
      </div>
    </button>
  {:else}
  <!-- Expanded View: Interactive Rating Slider -->
  <div class="expanded-view">
  <div class="mb-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <FlameIcon class="w-5 h-5 text-orange-500" />
      <h3 class="text-sm font-semibold text-gray-200">Bangerometer</h3>
      {#if hasUserRating && isAuthenticated}
        <span class="text-xs text-orange-400 font-medium">(Your rating)</span>
      {/if}
    </div>
        <div class="flex items-center gap-2">
    {#if rating > 0}
      <div class="flex items-center gap-2">
        <span class="text-2xl font-bold text-white">{rating}</span>
        <span class="text-sm text-gray-400">/10</span>
      </div>
    {/if}
    {#if hasUserRating && onRatingDelete}
      <button
        type="button"
        class="clear-rating-btn"
        on:click|stopPropagation={handleRemoveRating}
        title="Remove rating"
        aria-label="Remove rating"
        disabled={isRemovingRating}
      >
        <Trash2Icon class="w-4 h-4" />
      </button>
    {/if}
    <button
      type="button"
      on:click={toggleExpanded}
      class="collapse-btn"
      title="Collapse"
      aria-label="Collapse rating meter"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
      </svg>
    </button>
    </div>
  </div>

  <div
    class="slider-container"
    class:authenticated={isAuthenticated && isWatched}
    bind:this={sliderElement}
    on:mousedown={handleInteractionStart}
    on:touchstart={handleInteractionStart}
    on:mouseenter={() => (isHovering = true)}
    on:mouseleave={() => (isHovering = false)}
    on:keydown={handleKeyDown}
    role="slider"
    tabindex="0"
    aria-valuemin="1"
    aria-valuemax="10"
    aria-valuenow={rating || 1}
    aria-label="Rate this content from 1 to 10"
    aria-disabled={!isAuthenticated || !isWatched}
  >
    <!-- Background track -->
    <div class="slider-track">
      <!-- Filled portion with gradient -->
      <div
        class="slider-fill bg-gradient-to-r {getGradientColor(intensity)} transition-all duration-300"
        style:width="{intensity * 100}%"
        style:box-shadow="{rating >= 9 ? '0 0 30px rgba(249, 115, 22, 0.8), 0 0 60px rgba(249, 115, 22, 0.4)' : '0 0 20px rgba(249, 115, 22, 0.4)'}"
      >
        <!-- Flame icons that appear as rating increases -->
        {#if rating >= 7}
          <div class="flames-container">
            {#each Array(Math.floor(rating / 2.5)) as _, i}
              <div
                class="flame {rating >= 10 ? 'mega-flame' : ''}"
                style:left="{10 + (i * 15)}%"
                transition:scale={{ duration: 300 }}
              >
                <FlameIcon class="w-{rating >= 10 ? '6' : '4'} h-{rating >= 10 ? '6' : '4'} text-yellow-300 drop-shadow-glow" />
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Lightning bolts for epic ratings -->
        {#if rating >= 9}
          <div class="lightning-container">
            {#each Array(rating === 10 ? 3 : 1) as _, i}
              <div
                class="lightning"
                style:left="{30 + (i * 30)}%"
                transition:scale={{ duration: 200 }}
              >
                <ZapIcon class="w-5 h-5 text-yellow-200" />
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Explosion particles -->
      {#each explosionParticles as particle (particle.id)}
        <div
          class="explosion-particle"
          style:left="{particle.x}%"
          style:top="{particle.y}%"
          style:animation-delay="{particle.delay}ms"
          style:--tx="{particle.vx * 30}px"
          style:--ty="{particle.vy * 30}px"
          transition:fade={{ duration: 1000 }}
        >
          {#if rating >= 10}
            <SparklesIcon class="w-5 h-5 text-yellow-300 animate-spin" />
          {:else if rating >= 8}
            <ZapIcon class="w-4 h-4 text-orange-400" />
          {:else}
            <div class="w-3 h-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-full"></div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Thumb/handle -->
    {#if rating > 0}
      <div
        class="slider-thumb {rating >= 10 ? 'epic-thumb' : ''}"
        style:left="calc({intensity * 100}% - 12px)"
        transition:scale={{ duration: 200 }}
      >
        {#if rating >= 10}
          <div class="thumb-glow epic-glow-pulse"></div>
          <div class="thumb-burst"></div>
        {:else if rating >= 8}
          <div class="thumb-glow"></div>
        {/if}
      </div>
    {/if}

    <!-- Interactive overlay for better touch target -->
    <div class="slider-overlay"></div>
  </div>

  <!-- Rating label -->
  <div class="mt-3 text-center">
    <p class="text-sm font-medium {rating >= 9 ? 'text-orange-400 font-bold animate-pulse' : 'text-gray-400'} transition-colors {rating === 10 ? 'text-lg' : ''}">
      {#if !isAuthenticated}
        Sign in to rate
      {:else if !isWatched}
        Mark as watched to rate
      {:else}
        {bangerLevel}
      {/if}
    </p>
  </div>
  </div>
  {/if}
</div>

<style>
  .banger-meter-container {
    position: relative;
    padding: 1rem;
    background: rgba(17, 24, 39, 0.6);
    border-radius: 12px;
    border: 1px solid rgba(75, 85, 99, 0.3);
    overflow: visible;
    transition: all 0.3s ease;
  }

  .banger-meter-container.authenticated:hover {
    background: rgba(17, 24, 39, 0.8);
    border-color: rgba(249, 115, 22, 0.4);
  }

  .banger-meter-container.has-rating {
    border-color: rgba(249, 115, 22, 0.5);
    background: rgba(17, 24, 39, 0.75);
  }

  .banger-meter-container.has-rating:hover {
    border-color: rgba(249, 115, 22, 0.6);
  }

  .banger-meter-container.collapsed {
    padding: 0;
    background: transparent;
    border: none;
  }

  .collapsed-view {
    width: 100%;
    padding: 0.875rem 1rem;
    background: rgba(17, 24, 39, 0.6);
    border: 1px solid rgba(75, 85, 99, 0.3);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
  }

  .collapsed-view:hover {
    background: rgba(17, 24, 39, 0.8);
    border-color: rgba(249, 115, 22, 0.4);
    transform: translateY(-1px);
  }

  .collapsed-view:active {
    transform: translateY(0);
  }

  .expanded-view {
    animation: expandIn 0.3s ease-out;
  }

  @keyframes expandIn {
    from {
      opacity: 0;
      transform: scaleY(0.8);
    }
    to {
      opacity: 1;
      transform: scaleY(1);
    }
  }

  .collapse-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(75, 85, 99, 0.3);
    color: rgba(156, 163, 175, 1);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .collapse-btn:hover {
    background: rgba(75, 85, 99, 0.5);
    color: rgba(229, 231, 235, 1);
  }

  .collapse-btn:active {
    transform: scale(0.95);
  }

  .clear-rating-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(248, 113, 113, 0.18);
    color: rgba(248, 113, 113, 1);
    border: 1px solid rgba(248, 113, 113, 0.35);
    transition: all 0.2s ease;
  }

  .clear-rating-btn:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.28);
    color: rgba(254, 226, 226, 1);
    border-color: rgba(248, 113, 113, 0.6);
  }

  .clear-rating-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .banger-meter-container.shake {
    animation: shake 0.2s ease-in-out;
  }

  .banger-meter-container.screen-shake {
    animation: screenShake 0.5s ease-in-out;
  }

  .banger-meter-container.epic-mode {
    border-color: rgba(249, 115, 22, 0.9);
    background: rgba(17, 24, 39, 0.95);
    box-shadow: 0 0 40px rgba(249, 115, 22, 0.5), 0 0 80px rgba(249, 115, 22, 0.3);
  }

  .epic-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.3), transparent 70%);
    border-radius: 32px;
    pointer-events: none;
    animation: epicPulse 2s ease-in-out infinite;
    z-index: -1;
  }

  @keyframes epicPulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px) rotate(-0.5deg); }
    75% { transform: translateX(4px) rotate(0.5deg); }
  }

  @keyframes screenShake {
    0%, 100% { transform: translate(0, 0) rotate(0); }
    10% { transform: translate(-8px, 2px) rotate(-1deg); }
    20% { transform: translate(8px, -2px) rotate(1deg); }
    30% { transform: translate(-8px, 2px) rotate(-1deg); }
    40% { transform: translate(8px, -2px) rotate(1deg); }
    50% { transform: translate(-8px, 2px) rotate(-1deg); }
    60% { transform: translate(8px, -2px) rotate(1deg); }
    70% { transform: translate(-4px, 1px) rotate(-0.5deg); }
    80% { transform: translate(4px, -1px) rotate(0.5deg); }
    90% { transform: translate(-2px, 0.5px) rotate(-0.25deg); }
  }

  .slider-container {
    position: relative;
    height: 48px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  .slider-container:not(.authenticated) {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .slider-container.authenticated:focus {
    outline: 2px solid rgba(249, 115, 22, 0.5);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .slider-track {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 24px;
    background: linear-gradient(90deg, rgba(55, 65, 81, 0.8), rgba(75, 85, 99, 0.6));
    border-radius: 12px;
    overflow: visible;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .slider-fill {
    position: relative;
    height: 100%;
    border-radius: 12px;
    overflow: visible;
    transition: box-shadow 0.3s ease;
  }

  .flames-container {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 48px;
    pointer-events: none;
  }

  .flame {
    position: absolute;
    animation: flicker 0.4s ease-in-out infinite alternate;
  }

  .mega-flame {
    animation: megaFlicker 0.3s ease-in-out infinite alternate, floatUp 1.5s ease-in-out infinite;
  }

  .lightning-container {
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 40px;
    pointer-events: none;
  }

  .lightning {
    position: absolute;
    animation: lightning 0.5s ease-in-out infinite;
  }

  @keyframes lightning {
    0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
    25% { opacity: 0.4; transform: scale(1.2) rotate(-10deg); }
    50% { opacity: 1; transform: scale(0.9) rotate(10deg); }
    75% { opacity: 0.6; transform: scale(1.1) rotate(-5deg); }
  }

  @keyframes flicker {
    0% { transform: translateY(0) scale(1); opacity: 0.8; }
    100% { transform: translateY(-3px) scale(1.15); opacity: 1; }
  }

  @keyframes megaFlicker {
    0% { transform: translateY(0) scale(1); opacity: 0.9; }
    100% { transform: translateY(-5px) scale(1.3); opacity: 1; }
  }

  @keyframes floatUp {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .explosion-particle {
    position: absolute;
    pointer-events: none;
    animation: explode 1s ease-out forwards;
    z-index: 10;
    filter: drop-shadow(0 0 4px currentColor);
  }

  @keyframes explode {
    0% {
      transform: translate(0, 0) scale(0) rotate(0deg);
      opacity: 1;
    }
    50% {
      opacity: 1;
      transform: translate(calc(var(--tx) * 0.5), calc(var(--ty) * 0.5)) scale(1.2) rotate(180deg);
    }
    100% {
      transform: translate(var(--tx), var(--ty)) scale(0.5) rotate(360deg);
      opacity: 0;
    }
  }

  .slider-thumb {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #fff, #f3f4f6);
    border: 3px solid #f97316;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 4px rgba(249, 115, 22, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: grab;
    z-index: 5;
  }

  .slider-thumb.epic-thumb {
    width: 28px;
    height: 28px;
    border-width: 4px;
    background: linear-gradient(135deg, #fef3c7, #fbbf24, #f97316);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 6px rgba(249, 115, 22, 0.3), 0 0 30px rgba(249, 115, 22, 0.6);
    animation: epicThumbPulse 0.8s ease-in-out infinite;
  }

  @keyframes epicThumbPulse {
    0%, 100% { transform: translateY(-50%) scale(1); }
    50% { transform: translateY(-50%) scale(1.15); }
  }

  .slider-thumb:active {
    cursor: grabbing;
    transform: translateY(-50%) scale(1.2);
  }

  .slider-thumb.epic-thumb:active {
    transform: translateY(-50%) scale(1.3);
  }

  .thumb-glow {
    position: absolute;
    top: -6px;
    left: -6px;
    right: -6px;
    bottom: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.6), transparent);
    animation: pulse-glow 1s ease-in-out infinite;
  }

  .epic-glow-pulse {
    animation: epicGlowPulse 0.6s ease-in-out infinite;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.9), rgba(251, 191, 36, 0.6), transparent);
  }

  .thumb-burst {
    position: absolute;
    top: -10px;
    left: -10px;
    right: -10px;
    bottom: -10px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.4), transparent);
    animation: burst 1.2s ease-in-out infinite;
  }

  @keyframes burst {
    0% { transform: scale(0.8); opacity: 0.8; }
    50% { transform: scale(1.5); opacity: 0.4; }
    100% { transform: scale(2); opacity: 0; }
  }

  @keyframes pulse-glow {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.3); opacity: 0.9; }
  }

  @keyframes epicGlowPulse {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.6); opacity: 1; }
  }

  .slider-overlay {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    bottom: -12px;
  }

  .drop-shadow-glow {
    filter: drop-shadow(0 0 8px rgba(253, 224, 71, 0.9)) drop-shadow(0 0 12px rgba(249, 115, 22, 0.6));
  }
</style>
