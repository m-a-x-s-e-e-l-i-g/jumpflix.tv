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
	import Button from '$lib/components/ui/Button.svelte';
	import type { ContentItem } from '$lib/tv/types';
	import { getUserRating, getMediaRatingSummary, saveRating, deleteRating } from '$lib/ratings';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { user as authUser } from '$lib/stores/authStore';
	import {
		dispatchRatingUpdated,
		RATING_UPDATED_EVENT,
		type RatingUpdatedDetail
	} from '$lib/rating-events';
	import { fetchUserReview, upsertReview } from '$lib/reviews';
	import { getPublicUserName } from '$lib/utils';

	let { open = $bindable(false), movie = null } = $props<{
		open?: boolean;
		movie?: ContentItem | null;
	}>();

	const dispatch = createEventDispatcher<{
		ratingSaved: {
			movieId: string | number;
			rating: number | null;
			summary: { averageRating: number; ratingCount: number };
		};
	}>();

	let showAuthDialog = $state(false);
	let loading = $state(false);
	let userRating = $state<number | null>(null);
	let ratingSummary = $state<{ averageRating: number; ratingCount: number }>({
		averageRating: 0,
		ratingCount: 0
	});

	const isAuthenticated = $derived(Boolean($authUser));

	let reviewPromptOpen = $state(false);
	let reviewText = $state('');
	let reviewSaving = $state(false);
	let reviewError = $state<string | null>(null);
	let existingReviewId = $state<number | null>(null);
	let reviewLoadedForMediaId: string | number | null = null;
	let reviewTextareaEl = $state<HTMLTextAreaElement | null>(null);
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
			reviewPromptOpen = false;
			reviewText = '';
			reviewError = null;
			existingReviewId = null;
			reviewLoadedForMediaId = null;
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

			if (isAuthenticated && $authUser?.id) {
				void loadMyReview(targetId, currentRequest);
			} else {
				existingReviewId = null;
				reviewText = '';
				reviewLoadedForMediaId = null;
			}
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

	async function loadMyReview(targetId: number | string, currentRequest: number) {
		try {
			if (!$authUser?.id) return;
			const review = await fetchUserReview(targetId, $authUser.id);
			if (currentRequest !== requestToken) return;
			reviewLoadedForMediaId = targetId;
			existingReviewId = review?.id ?? null;
			reviewText = review?.body ?? '';
			reviewError = null;
		} catch (error) {
			if (currentRequest !== requestToken) return;
			console.error('Failed to load review', error);
			reviewLoadedForMediaId = targetId;
			existingReviewId = null;
			reviewText = '';
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

			if (isAuthenticated) {
				reviewPromptOpen = true;
				if (reviewLoadedForMediaId !== movie.id && $authUser?.id) {
					await loadMyReview(movie.id, requestToken);
				}
				await tick();
				reviewTextareaEl?.focus();
			}
		} catch (error) {
			console.error('Failed to save rating', error);
		}
	}

	async function handleRatingDelete() {
		if (!movie) return;
		try {
			await deleteRating(movie.id);
			userRating = null;
			reviewPromptOpen = false;
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

	async function submitReview() {
		if (!movie || !isAuthenticated || !$authUser?.id) return;
		reviewSaving = true;
		reviewError = null;
		try {
			const saved = await upsertReview({
				mediaId: movie.id,
				userId: $authUser.id,
				body: reviewText
			});
			existingReviewId = saved.id;
			reviewText = saved.body;
			reviewPromptOpen = false;
		} catch (error: any) {
			reviewError = error?.message ?? 'Failed to post review';
		} finally {
			reviewSaving = false;
		}
	}

	async function openReviewPrompt() {
		if (!movie) return;
		reviewPromptOpen = true;
		if (reviewLoadedForMediaId !== movie.id && isAuthenticated && $authUser?.id) {
			await loadMyReview(movie.id, requestToken);
		}
		await tick();
		reviewTextareaEl?.focus();
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
			<DialogTitle>Rate {movie?.title ?? 'this title'}</DialogTitle>
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
					<p class="line-clamp-2 text-sm font-semibold text-foreground">{movie.title}</p>
					{#if movie.duration}
						<p class="mt-0.5 text-xs text-muted-foreground">{movie.duration}</p>
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

			{#if isAuthenticated && userRating}
				{#if reviewPromptOpen}
					<div class="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
						<div>
							<div class="text-sm font-medium text-foreground">Write a short review</div>
							<div class="mt-1 text-xs text-muted-foreground">
								Tell others why you gave it {userRating}/10.
							</div>
						</div>

						<textarea
							bind:this={reviewTextareaEl}
							bind:value={reviewText}
							rows="4"
							placeholder="What stood out? Would you recommend it?"
							class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
							disabled={reviewSaving}
						></textarea>

						{#if reviewError}
							<div class="text-xs text-destructive">{reviewError}</div>
						{/if}

						<div class="flex items-center justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={reviewSaving}
								onclick={() => (reviewPromptOpen = false)}
							>
								Skip
							</Button>
							<Button
								size="sm"
								disabled={reviewSaving || !reviewText.trim()}
								onclick={submitReview}
							>
								{existingReviewId ? 'Update review' : 'Post review'}
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex justify-end">
						<Button variant="outline" size="sm" onclick={openReviewPrompt}>Write a review</Button>
					</div>
				{/if}
			{/if}
		{:else}
			<p class="text-sm text-muted-foreground">Pick a movie to rate.</p>
		{/if}
	</DialogContent>
</DialogRoot>

<AuthDialog bind:open={showAuthDialog} />
