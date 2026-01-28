<script lang="ts">
  import {
    Dialog as DialogRoot,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
  } from '$lib/components/ui/dialog';
  import Bangerometer from '$lib/components/Bangerometer.svelte';
  import AuthDialog from '$lib/components/AuthDialog.svelte';
  import type { Movie } from '$lib/tv/types';
  import { getUserRating, getMediaRatingSummary, saveRating, deleteRating } from '$lib/ratings';
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    dispatchRatingUpdated,
    RATING_UPDATED_EVENT,
    type RatingUpdatedDetail
  } from '$lib/rating-events';

  let {
    open = $bindable(false),
    movie = null
  } = $props<{ open?: boolean; movie?: Movie | null }>();

  const dispatch = createEventDispatcher<{
    ratingSaved: {
      movieId: string | number;
      rating: number | null;
      summary: { averageRating: number; ratingCount: number };
    }
  }>();

  let showAuthDialog = $state(false);
  let loading = $state(false);
  let userRating = $state<number | null>(null);
  let ratingSummary = $state<{ averageRating: number; ratingCount: number }>({
    averageRating: 0,
    ratingCount: 0
  });
  let requestToken = 0;
  let lastLoadedId: string | number | null = null;

  onMount(() => {
    const handleRatingUpdated = (event: Event) => {
      const detail = (event as CustomEvent<RatingUpdatedDetail>).detail;
      syncFromRatingEvent(detail);
    };
    window.addEventListener(RATING_UPDATED_EVENT, handleRatingUpdated as EventListener);
    return () => {
      window.removeEventListener(RATING_UPDATED_EVENT, handleRatingUpdated as EventListener);
    };
  });

  $effect(() => {
    if (!open) {
      requestToken += 1;
      showAuthDialog = false;
    }
  });

  $effect(() => {
    if (open && movie?.id) {
      const targetId = movie.id;
      if (lastLoadedId !== targetId) {
        lastLoadedId = targetId;
        void loadRatingState(targetId);
      }
    } else if (!open) {
      lastLoadedId = null;
    }
  });

  async function loadRatingState(targetId: number | string) {
    const currentRequest = ++requestToken;
    loading = true;
    try {
      const [user, summary] = await Promise.all([
        getUserRating(targetId),
        getMediaRatingSummary(targetId)
      ]);
      if (currentRequest !== requestToken) return;
      userRating = user;
      ratingSummary = summary ?? { averageRating: 0, ratingCount: 0 };
    } catch (error) {
      if (currentRequest !== requestToken) return;
      console.error('Failed to load rating info', error);
      userRating = null;
      ratingSummary = { averageRating: 0, ratingCount: 0 };
    } finally {
      if (currentRequest === requestToken) {
        loading = false;
      }
    }
  }

  async function handleRatingChange(rating: number) {
    if (!movie) return;
    try {
      await saveRating(movie.id, rating);
      userRating = rating;
      const updatedSummary = await getMediaRatingSummary(movie.id);
      if (updatedSummary) {
        ratingSummary = updatedSummary;
      }
      const numericId = Number(movie.id);
      if (Number.isFinite(numericId)) {
        dispatchRatingUpdated({
          mediaId: numericId,
          rating,
          averageRating: ratingSummary.averageRating,
          ratingCount: ratingSummary.ratingCount
        });
      }
      dispatch('ratingSaved', {
        movieId: movie.id,
        rating,
        summary: updatedSummary ?? ratingSummary
      });
    } catch (error) {
      console.error('Failed to save rating', error);
    }
  }

  async function handleRatingDelete() {
    if (!movie) return;
    try {
      await deleteRating(movie.id);
      userRating = null;
      const updatedSummary = await getMediaRatingSummary(movie.id);
      ratingSummary = updatedSummary ?? { averageRating: 0, ratingCount: 0 };
      const numericId = Number(movie.id);
      if (Number.isFinite(numericId)) {
        dispatchRatingUpdated({
          mediaId: numericId,
          rating: null,
          averageRating: ratingSummary.averageRating,
          ratingCount: ratingSummary.ratingCount
        });
      }
      dispatch('ratingSaved', {
        movieId: movie.id,
        rating: null,
        summary: ratingSummary
      });
    } catch (error) {
      console.error('Failed to delete rating', error);
    }
  }

  function syncFromRatingEvent(detail?: RatingUpdatedDetail) {
    if (!detail || !movie) return;
    const numericId = Number(movie.id);
    if (!Number.isFinite(numericId) || detail.mediaId !== numericId) return;
    userRating = detail.rating ?? null;
    if (detail.averageRating !== undefined && detail.ratingCount !== undefined) {
      ratingSummary = {
        averageRating: detail.averageRating,
        ratingCount: detail.ratingCount
      };
    } else if (open) {
      void loadRatingState(movie.id);
    }
  }

</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-xl space-y-5">
    <DialogHeader>
      <DialogTitle>Rate {movie?.title ?? 'this film'}</DialogTitle>
      <DialogDescription>
        Share your Bangerometer score so others know if it's worth a rewatch.
      </DialogDescription>
    </DialogHeader>

    {#if movie}
      <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/10 p-3">
        {#if movie?.thumbnail}
          <img
            src={movie.thumbnail}
            alt={movie.title ? `${movie.title} poster` : 'Movie poster'}
            width="64"
            height="96"
            class="h-20 w-14 rounded-md object-cover"
            loading="lazy"
            decoding="async"
          />
        {/if}
        <div class="min-w-0">
          <p class="text-sm font-semibold text-foreground line-clamp-2">{movie.title}</p>
          {#if movie.duration}
            <p class="text-xs text-muted-foreground mt-0.5">{movie.duration}</p>
          {/if}
          {#if movie.year}
            <p class="text-xs text-muted-foreground">{movie.year}</p>
          {/if}
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="py-8 text-center text-sm text-muted-foreground">Loading your Bangerometer…</div>
    {:else if movie}
      <Bangerometer
        mediaId={movie.id}
        initialRating={userRating}
        averageRating={ratingSummary.averageRating}
        ratingCount={ratingSummary.ratingCount}
        isWatched={true}
        onRatingChange={handleRatingChange}
        onRatingDelete={handleRatingDelete}
        onAuthRequired={() => (showAuthDialog = true)}
        startExpanded={true}
      />
    {:else}
      <p class="text-sm text-muted-foreground">Pick a movie to rate.</p>
    {/if}

  </DialogContent>
</DialogRoot>

<AuthDialog bind:open={showAuthDialog} />
