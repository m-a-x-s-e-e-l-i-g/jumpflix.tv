<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import PlayIcon from 'lucide-svelte/icons/play';
	import PauseIcon from 'lucide-svelte/icons/pause';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import VolumeXIcon from 'lucide-svelte/icons/volume-x';
	import Volume2Icon from 'lucide-svelte/icons/volume-2';
	import Maximize2Icon from 'lucide-svelte/icons/maximize-2';
	import Minimize2Icon from 'lucide-svelte/icons/minimize-2';
	import SkipBackIcon from 'lucide-svelte/icons/skip-back';
	import SkipForwardIcon from 'lucide-svelte/icons/skip-forward';
	import XIcon from 'lucide-svelte/icons/x';
	import AirplayIcon from 'lucide-svelte/icons/airplay';
	import CastIcon from 'lucide-svelte/icons/cast';
	import SpotChapterSuggestionDialog from '$lib/tv/SpotChapterSuggestionDialog.svelte';
	import type { VideoTrack } from '$lib/tv/types';
	import { parseTimecodeToSeconds } from '$lib/utils/timecode';
	import { getParkourSpotUrl } from '$lib/utils';
	import * as m from '$lib/paraglide/messages';
	import {
		updateWatchProgress,
		getResumePosition,
		flushWatchHistoryNow
	} from '$lib/tv/watchHistory';

	const dispatch = createEventDispatcher<{
		playbackCompleted: { mediaId: string | null; mediaType: 'movie' | 'series' | 'episode' };
	}>();

	export let src: string | null = null;
	export let title: string | null = null;
	export let poster: string | null = null;
	export let keySeed: string | number = '';
	export let mediaId: number | null = null;
	export let mediaType: 'movie' | 'series' | null = null;
	export let tracks: VideoTrack[] | null | undefined = undefined;
	export let autoPlay = false;
	export let onClose: (() => void) | null = null;

	let mounted = false;
	let playerEl: MediaPlayerElement | null = null;
	let playbackKey: string | null = null;
	let spotChaptersTrackSrc: string | null = null;
	let spotChaptersTrackEl: HTMLTrackElement | null = null;
	let spotChaptersRefreshToken = 0;
	let spotChaptersRetryCount = 0;
	let spotChaptersRetryKey: string | null = null;
	let nowPlayingTrackLabel: string | null = null;
	let nowPlayingSpotLabel: string | null = null;
	let nowPlayingTrackHref: string | null = null;
	let nowPlayingSpotHref: string | null = null;
	type TrackStartEntry = { startSeconds: number; label: string; href: string };
	let sortedTracks: TrackStartEntry[] = [];
	let disableTrackPill = false;
	let cleanupNowPlaying: (() => void) | null = null;

	$: playbackKey = keySeed ? String(keySeed) : null;
	$: spotChaptersTrackSrc =
		mediaId && mediaType && (mediaType === 'movie' || !!playbackKey)
			?
				`/api/spot-chapters/vtt?mediaId=${encodeURIComponent(String(mediaId))}&mediaType=${encodeURIComponent(mediaType)}${playbackKey ? `&playbackKey=${encodeURIComponent(playbackKey)}` : ''}&r=${encodeURIComponent(String(spotChaptersRefreshToken))}`
			: null;

	function enableSpotChaptersTrack(trackEl: HTMLTrackElement | null) {
		if (!browser || !trackEl) return;
		try {
			// Some browsers keep chapter tracks disabled unless explicitly enabled.
			// Vidstack reads cues from text tracks, so we force it to load.
			const track = trackEl.track;
			if (track && track.kind === 'chapters' && track.mode === 'disabled') {
				track.mode = 'hidden';
			}
		} catch {
			// no-op
		}
	}

	function scheduleSpotChaptersRetry(reason: string) {
		if (!browser) return;
		const key = `${keySeed}:${spotChaptersTrackSrc ?? ''}`;
		if (spotChaptersRetryKey !== key) {
			spotChaptersRetryKey = key;
			spotChaptersRetryCount = 0;
		}
		if (spotChaptersRetryCount >= 1) return;
		spotChaptersRetryCount += 1;
		setTimeout(() => {
			// If the user has navigated away or the src changed, don't spam refreshes.
			if (spotChaptersRetryKey !== key) return;
			spotChaptersRefreshToken += 1;
		}, reason === 'error' ? 500 : 1000);
	}

	$: if (browser && spotChaptersTrackEl) {
		enableSpotChaptersTrack(spotChaptersTrackEl);
	}

	$: if (browser && spotChaptersTrackSrc) {
		// Reset retry state when the track URL changes.
		const key = `${keySeed}:${spotChaptersTrackSrc}`;
		if (spotChaptersRetryKey !== key) {
			spotChaptersRetryKey = key;
			spotChaptersRetryCount = 0;
		}
	}

	function getTrackStartSeconds(track: VideoTrack): number | null {
		if (typeof track?.startAtSeconds === 'number' && Number.isFinite(track.startAtSeconds)) {
			return Math.max(0, track.startAtSeconds);
		}
		const parsed = parseTimecodeToSeconds(track?.startTimecode ?? '');
		if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) return parsed;
		return null;
	}

	function isTrackStartEntry(value: TrackStartEntry | null): value is TrackStartEntry {
		return Boolean(value);
	}

	function spotifySearchUrl(query: string): string {
		return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
	}

	function getTrackHref(track: VideoTrack, fallbackQuery: string): string {
		const direct = String(track?.song?.spotifyUrl ?? '').trim();
		if (direct) return direct;
		const id = String(track?.song?.spotifyTrackId ?? '').trim();
		if (id) return `https://open.spotify.com/track/${encodeURIComponent(id)}`;
		return spotifySearchUrl(fallbackQuery);
	}

	$: {
		const list = Array.isArray(tracks) ? tracks : [];
		sortedTracks = list
			.map((t) => {
				const startSeconds = getTrackStartSeconds(t);
				if (startSeconds === null) return null;
				const artist = String(t?.song?.artist ?? '').trim();
				const title = String(t?.song?.title ?? '').trim();
				const label = [artist, title].filter(Boolean).join(' — ').trim();
				if (!label) return null;
				const href = getTrackHref(t, label);
				return { startSeconds, label, href } satisfies TrackStartEntry;
			})
			.filter(isTrackStartEntry)
			.sort((a, b) => a.startSeconds - b.startSeconds);
	}

	$: disableTrackPill = sortedTracks.filter((t) => Math.floor(t.startSeconds) === 0).length > 1;
	$: if (disableTrackPill) {
		nowPlayingTrackLabel = null;
		nowPlayingTrackHref = null;
	}

	function getActiveTrackEntry(seconds: number): TrackStartEntry | null {
		if (!sortedTracks.length) return null;
		for (let i = 0; i < sortedTracks.length; i++) {
			const t = sortedTracks[i];
			const nextStart = sortedTracks[i + 1]?.startSeconds ?? Number.POSITIVE_INFINITY;
			if (seconds >= t.startSeconds && seconds < nextStart) {
				return t;
			}
		}
		return null;
	}

	type ActiveSpot = {
		label: string;
		spotId: string | null;
		href: string | null;
		spotChapterId: number | null;
		startSeconds: number;
		endSeconds: number;
	};

	let activeSpotChapterId: number | null = null;
	let activeSpotStartSeconds: number | null = null;
	let activeSpotEndSeconds: number | null = null;
	let activeSpotSpotId: string | null = null;
	let isChangingSpot = false;
	let spotSuggestionTriggerTitle = 'Suggest spot';
	let spotSuggestionTriggerAriaLabel = 'Suggest a parkour spot (chapter)';

	function parkourSpotUrl(spotId: string): string {
		return getParkourSpotUrl(spotId);
	}

	function getActiveSpot(player: MediaPlayerElement): ActiveSpot | null {
		const list = (player as any)?.textTracks as TextTrackList | undefined;
		if (!list || typeof list.length !== 'number') return null;
		const expectedLabel = m.tv_spots();
		let chaptersTrack: TextTrack | null = null;
		for (let i = 0; i < list.length; i++) {
			const t = list[i];
			if (t && t.kind === 'chapters' && (t.label === expectedLabel || t.label === 'Spots')) {
				chaptersTrack = t;
				break;
			}
		}
		if (!chaptersTrack) {
			for (let i = 0; i < list.length; i++) {
				const t = list[i];
				if (t && t.kind === 'chapters') {
					chaptersTrack = t;
					break;
				}
			}
		}
		if (!chaptersTrack) return null;
		const cues = chaptersTrack.cues;
		if (!cues || typeof cues.length !== 'number') return null;
		const time = Number(player.currentTime);
		if (!Number.isFinite(time)) return null;
		for (let i = 0; i < cues.length; i++) {
			const cue = cues[i] as any;
			if (!cue) continue;
			if (time >= cue.startTime && time < cue.endTime) {
				const label = String(cue.text ?? '').replace(/[\r\n]+/g, ' ').trim();
				const rawId = String(cue.id ?? '').trim();
				// Format: chapter:<spotChapterId>:spot:<spotId>:<n>
				let spotId: string | null = null;
				let spotChapterId: number | null = null;
				if (rawId.startsWith('chapter:')) {
					const parts = rawId.split(':');
					const chapterCandidate = Number(parts[1]);
					if (Number.isFinite(chapterCandidate)) spotChapterId = chapterCandidate;
					const spotIndex = parts.findIndex((p) => p === 'spot');
					if (spotIndex >= 0) {
						const idCandidate = parts[spotIndex + 1];
						spotId = typeof idCandidate === 'string' ? idCandidate.trim() : null;
					}
				}
				if (!spotId && rawId.startsWith('spot:')) {
					spotId = rawId.slice(5).split(':')[0]?.trim?.() || null;
				}
				const href = spotId ? parkourSpotUrl(spotId) : null;
				const startSeconds = Number.isFinite(cue.startTime) ? Math.max(0, Math.floor(cue.startTime)) : 0;
				const rawEnd = Number.isFinite(cue.endTime) ? Math.max(0, Math.ceil(cue.endTime)) : startSeconds;
				const endSeconds = Math.max(startSeconds + 1, rawEnd);
				return label
					? { label, spotId: spotId || null, href, spotChapterId, startSeconds, endSeconds }
					: null;
			}
		}
		return null;
	}

	function setupNowPlaying(player: MediaPlayerElement) {
		if (!browser) return () => {};
		let lastUpdate = 0;
		const update = () => {
			const now = performance.now();
			if (now - lastUpdate < 200) return;
			lastUpdate = now;
			const t = Number(player.currentTime);
			if (!Number.isFinite(t)) return;
			const nextTrack = disableTrackPill ? null : getActiveTrackEntry(t);
			const nextTrackLabel = nextTrack?.label ?? null;
			const nextTrackHref = nextTrack?.href ?? null;
			if (nextTrackLabel !== nowPlayingTrackLabel) nowPlayingTrackLabel = nextTrackLabel;
			if (nextTrackHref !== nowPlayingTrackHref) nowPlayingTrackHref = nextTrackHref;
			const nextSpot = getActiveSpot(player);
			const nextSpotLabel = nextSpot?.label ?? null;
			const nextSpotHref = nextSpot?.href ?? null;
			const nextSpotChapterId = nextSpot?.spotChapterId ?? null;
			const nextSpotStartSeconds = nextSpot ? nextSpot.startSeconds : null;
			const nextSpotEndSeconds = nextSpot ? nextSpot.endSeconds : null;
			const nextSpotId = nextSpot?.spotId ?? null;
			if (nextSpotLabel !== nowPlayingSpotLabel) nowPlayingSpotLabel = nextSpotLabel;
			if (nextSpotHref !== nowPlayingSpotHref) nowPlayingSpotHref = nextSpotHref;
			if (nextSpotChapterId !== activeSpotChapterId) activeSpotChapterId = nextSpotChapterId;
			if (nextSpotStartSeconds !== activeSpotStartSeconds) activeSpotStartSeconds = nextSpotStartSeconds;
			if (nextSpotEndSeconds !== activeSpotEndSeconds) activeSpotEndSeconds = nextSpotEndSeconds;
			if (nextSpotId !== activeSpotSpotId) activeSpotSpotId = nextSpotId;
		};
		player.addEventListener('time-update', update);
		player.addEventListener('seeked', update);
		player.addEventListener('duration-change', update);
		update();
		return () => {
			player.removeEventListener('time-update', update);
			player.removeEventListener('seeked', update);
			player.removeEventListener('duration-change', update);
		};
	}

	$: isChangingSpot = Boolean(activeSpotChapterId);
	$: spotSuggestionTriggerTitle = isChangingSpot ? 'Change spot' : 'Suggest spot';
	$: spotSuggestionTriggerAriaLabel = isChangingSpot
		? 'Change the current parkour spot (chapter)'
		: 'Suggest a parkour spot (chapter)';

	function seekToSeconds(seconds: number) {
		if (!browser || !playerEl) return;
		try {
			playerEl.currentTime = Math.max(0, Number(seconds) || 0);
		} catch {}
	}
	let vidstackLoadPromise: Promise<void> | null = null;
	let vidstackReady = false;

	type RemoteControl = {
		setTarget?: (target: EventTarget | null) => void;
		setPlayer?: (player: MediaPlayerElement | null) => void;
		togglePaused?: (trigger?: Event) => void;
		toggleFullscreen?: (target?: string, trigger?: Event) => void;
		changePlaybackRate?: (rate: number, trigger?: Event) => void;
		play?: (trigger?: Event) => void;
		pause?: (trigger?: Event) => void;
		enterFullscreen?: (target?: string, trigger?: Event) => void;
		exitFullscreen?: (target?: string, trigger?: Event) => void;
	} & Record<string, unknown>;

	const DOUBLE_CLICK_DELAY = 220;
	const LONG_PRESS_DELAY = 350;
	const SLOW_MOTION_RATE = 0.3;
	const CONTROLS_HIDE_DELAY = 2000;
	const SPEED_RAMP_DURATION = 250; // ms - duration for speed transition
	const SPEED_RAMP_RATE_TOLERANCE = 0.01; // minimum rate difference to trigger ramping

	let cleanupGestures: (() => void) | null = null;
	let cleanupAutoHide: (() => void) | null = null;
	let cleanupProgressTracking: (() => void) | null = null;
	let cleanupPlaybackComplete: (() => void) | null = null;
	let cleanupSpotChaptersTrackEvents: (() => void) | null = null;
	let controlsEl: HTMLElement | null = null;
	let hideControlsTimer: ReturnType<typeof setTimeout> | null = null;
	let controlsVisible = true;
	let controlsFocusWithin = false;
	let pointerOverControls = false;
	let pointerActiveOnControls = false;
	let autoHidePlayer: MediaPlayerElement | null = null;
	let isPaused = true;
	const MOBILE_VIEWPORT_QUERY = '(max-width: 640px)';
	const FULL_VOLUME = 1;
	const VOLUME_TOLERANCE = 1e-3;

	let isMobileViewport = false;
	let mobileQuery: MediaQueryList | null = null;
	let cleanupMobileQuery: (() => void) | null = null;
	let controlsJustShown = false;
	let isLongPressSlowMotionActive = false;
	let speedRampAnimationId: number | null = null;

	// Watch progress tracking
	let lastProgressUpdate = 0;
	let hasResumed = false;
	let isSeeking = false;
	type PendingProgressSnapshot = {
		mediaId: string;
		type: 'movie' | 'series' | 'episode';
		position: number;
		duration: number;
	};
	let pendingProgress: PendingProgressSnapshot | null = null;
	let progressCommitTimer: ReturnType<typeof setTimeout> | null = null;
	let progressCommitDeadline = 0;
	const PROGRESS_UPDATE_INTERVAL = 5000; // Update every 5 seconds
	const PROGRESS_COMMIT_DELAY_MS = 250;

	async function ensureVidstackLoaded() {
		if (!browser) return;
		if (!vidstackLoadPromise) {
			vidstackLoadPromise = Promise.all([
				import('vidstack/player'),
				import('vidstack/player/layouts/default'),
				import('vidstack/icons'),
				import('vidstack/player/styles/default/theme.css'),
				import('vidstack/player/styles/default/layouts/video.css')
			]).then(() => undefined);
		}
		await vidstackLoadPromise;
		vidstackReady = true;
	}

	$: if (browser && playerEl) {
		cleanupGestures?.();
		cleanupGestures = setupGestureHandlers(playerEl);
	} else if (!browser || !playerEl) {
		cleanupGestures?.();
		cleanupGestures = null;
	}

	$: if (browser && playerEl && controlsEl) {
		cleanupAutoHide?.();
		cleanupAutoHide = setupControlAutoHide(playerEl, controlsEl);
	} else if (!browser || !playerEl || !controlsEl) {
		cleanupAutoHide?.();
		cleanupAutoHide = null;
	}

	$: if (browser && playerEl) {
		cleanupProgressTracking?.();
		cleanupProgressTracking = setupProgressTracking(playerEl);
	} else if (!browser || !playerEl) {
		cleanupProgressTracking?.();
		cleanupProgressTracking = null;
	}

	$: if (browser && playerEl) {
		cleanupPlaybackComplete?.();
		cleanupPlaybackComplete = setupPlaybackCompletion(playerEl);
	} else if (!browser || !playerEl) {
		cleanupPlaybackComplete?.();
		cleanupPlaybackComplete = null;
	}

	$: if (browser && playerEl) {
		cleanupNowPlaying?.();
		cleanupNowPlaying = setupNowPlaying(playerEl);
	} else if (!browser || !playerEl) {
		cleanupNowPlaying?.();
		cleanupNowPlaying = null;
		nowPlayingTrackLabel = null;
		nowPlayingSpotLabel = null;
		nowPlayingTrackHref = null;
		nowPlayingSpotHref = null;
	}

	function setupSpotChaptersTrackEvents(trackEl: HTMLTrackElement) {
		enableSpotChaptersTrack(trackEl);
		const onLoad = () => {
			enableSpotChaptersTrack(trackEl);
		};
		const onError = () => {
			scheduleSpotChaptersRetry('error');
		};
		trackEl.addEventListener('load', onLoad);
		trackEl.addEventListener('error', onError);
		return () => {
			trackEl.removeEventListener('load', onLoad);
			trackEl.removeEventListener('error', onError);
		};
	}

	$: if (browser && spotChaptersTrackEl && spotChaptersTrackSrc) {
		cleanupSpotChaptersTrackEvents?.();
		cleanupSpotChaptersTrackEvents = setupSpotChaptersTrackEvents(spotChaptersTrackEl);
	} else if (!browser || !spotChaptersTrackEl || !spotChaptersTrackSrc) {
		cleanupSpotChaptersTrackEvents?.();
		cleanupSpotChaptersTrackEvents = null;
	}

	onDestroy(() => {
		cleanupSpotChaptersTrackEvents?.();
		cleanupSpotChaptersTrackEvents = null;
		cleanupNowPlaying?.();
		cleanupNowPlaying = null;
		cleanupGestures?.();
		cleanupGestures = null;
		cleanupAutoHide?.();
		cleanupAutoHide = null;
		cleanupProgressTracking?.();
		cleanupProgressTracking = null;
		cleanupPlaybackComplete?.();
		cleanupPlaybackComplete = null;
		nowPlayingTrackLabel = null;
		nowPlayingSpotLabel = null;
		nowPlayingTrackHref = null;
		nowPlayingSpotHref = null;
		cleanupMobileQuery?.();
		cleanupMobileQuery = null;
		mobileQuery = null;
		cancelSpeedRamp();
		flushPendingProgressSnapshot();
		void flushWatchHistoryNow();
	});

	/**
	 * Cubic ease-in-out easing function for smooth speed transitions.
	 * @param t - Normalized time value from 0 to 1
	 * @returns Eased progress value from 0 to 1
	 * Creates smooth acceleration at start and deceleration at end
	 */
	function easeInOutCubic(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	function cancelSpeedRamp() {
		if (speedRampAnimationId !== null) {
			cancelAnimationFrame(speedRampAnimationId);
			speedRampAnimationId = null;
		}
	}

	// Smoothly ramp playback rate from current to target over SPEED_RAMP_DURATION ms
	function rampPlaybackRate(
		player: MediaPlayerElement,
		remote: RemoteControl | null,
		targetRate: number
	) {
		if (!browser) {
			cancelSpeedRamp();
			return;
		}

		cancelSpeedRamp();

		const startRate = getPlaybackRate(player);
		const rateDelta = targetRate - startRate;

		// If the difference is negligible, just set it directly
		if (Math.abs(rateDelta) < SPEED_RAMP_RATE_TOLERANCE) {
			setPlaybackRate(player, remote, targetRate);
			return;
		}

		const startTime = performance.now();

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / SPEED_RAMP_DURATION, 1);
			const easedProgress = easeInOutCubic(progress);
			const currentRate = startRate + rateDelta * easedProgress;

			setPlaybackRate(player, remote, currentRate);

			if (progress < 1) {
				speedRampAnimationId = requestAnimationFrame(animate);
			} else {
				speedRampAnimationId = null;
				// Ensure we hit the exact target rate
				setPlaybackRate(player, remote, targetRate);
			}
		};

		speedRampAnimationId = requestAnimationFrame(animate);
	}

	// Watch progress tracking helpers
	function getMediaId(): string | null {
		if (!keySeed) return null;
		// Use the full keySeed as the mediaId (format: "movie:id:yt:videoId" or "series:id:ep:episodeId")
		return String(keySeed);
	}

	function getMediaType(): 'movie' | 'series' | 'episode' {
		if (!keySeed) return 'movie';
		// Convert to string and determine type based on keySeed prefix or src structure
		const seedStr = String(keySeed);
		if (seedStr.includes(':ep:')) return 'episode';
		if (seedStr.startsWith('series:')) return 'series';
		if (seedStr.startsWith('movie:')) return 'movie';
		// Fallback: check if src contains common series patterns
		if (src && (src.includes('/series/') || src.includes('/episode/'))) return 'episode';
		return 'movie';
	}

	function cancelProgressCommitTimer() {
		if (!progressCommitTimer) return;
		clearTimeout(progressCommitTimer);
		progressCommitTimer = null;
		progressCommitDeadline = 0;
	}

	function commitPendingProgressSnapshot() {
		if (!pendingProgress) return;
		const snapshot = pendingProgress;
		pendingProgress = null;
		updateWatchProgress(snapshot.mediaId, snapshot.type, snapshot.position, snapshot.duration);
		lastProgressUpdate = Date.now();
	}

	function flushPendingProgressSnapshot() {
		cancelProgressCommitTimer();
		commitPendingProgressSnapshot();
	}

	function scheduleProgressCommit(delayMs = PROGRESS_COMMIT_DELAY_MS) {
		if (!pendingProgress) return;
		if (!browser) {
			flushPendingProgressSnapshot();
			return;
		}
		const targetDelay = Math.max(PROGRESS_COMMIT_DELAY_MS, delayMs);
		const targetTimestamp = Date.now() + targetDelay;
		if (progressCommitTimer) {
			if (progressCommitDeadline <= targetTimestamp) {
				return;
			}
			clearTimeout(progressCommitTimer);
		}
		progressCommitDeadline = targetTimestamp;
		progressCommitTimer = setTimeout(() => {
			progressCommitTimer = null;
			progressCommitDeadline = 0;
			commitPendingProgressSnapshot();
		}, targetDelay);
	}

	function clampTime(value: number, duration: number) {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(value, duration));
	}

	function trackProgress(player: MediaPlayerElement, options?: { force?: boolean }) {
		if (!browser) return;
		const mediaId = getMediaId();
		if (!mediaId) return;

		const safeDuration = Number.isFinite(player.duration) ? Number(player.duration) : 0;
		if (safeDuration <= 0) return;

		const position = clampTime(Number(player.currentTime ?? 0), safeDuration);
		const snapshot: PendingProgressSnapshot = {
			mediaId,
			type: getMediaType(),
			position,
			duration: safeDuration
		};

		if (isSeeking && !options?.force) {
			pendingProgress = snapshot;
			return;
		}

		const now = Date.now();
		const elapsedSincePersist = now - lastProgressUpdate;
		if (!options?.force && elapsedSincePersist < PROGRESS_UPDATE_INTERVAL) {
			pendingProgress = snapshot;
			const remaining = PROGRESS_UPDATE_INTERVAL - elapsedSincePersist;
			scheduleProgressCommit(remaining);
			return;
		}

		pendingProgress = snapshot;
		if (options?.force) {
			flushPendingProgressSnapshot();
		} else {
			scheduleProgressCommit();
		}
	}

	function setupProgressTracking(player: MediaPlayerElement) {
		if (!browser) return () => {};
		const mediaId = getMediaId();
		if (!mediaId) return () => {};
		isSeeking = false;
		const doc = player.ownerDocument ?? document;
		const win = doc.defaultView ?? window;

		const handleTimeUpdate = () => {
			trackProgress(player);
		};

		const handleProgressPause = () => {
			trackProgress(player, { force: true });
		};

		const handleProgressEnded = () => {
			trackProgress(player, { force: true });
		};

		// Handle duration change (when metadata loads)
		const handleDurationChange = () => {
			if (!hasResumed && player.duration > 0) {
				const resumePos = getResumePosition(mediaId, player.duration);
				if (resumePos !== null) {
					player.currentTime = resumePos;
				}
				hasResumed = true;
			}
		};

		// Handle can-play event for resume
		const handleCanPlay = () => {
			if (!hasResumed && player.duration > 0) {
				const resumePos = getResumePosition(mediaId, player.duration);
				if (resumePos !== null) {
					player.currentTime = resumePos;
				}
				hasResumed = true;
			}
		};

		const handleSeeking = () => {
			isSeeking = true;
			cancelProgressCommitTimer();
		};

		const handleSeeked = () => {
			isSeeking = false;
			trackProgress(player);
		};

		const handleVisibilityChange = () => {
			if (doc.visibilityState === 'hidden') {
				flushPendingProgressSnapshot();
			}
		};

		const handlePageHide = () => {
			flushPendingProgressSnapshot();
		};

		player.addEventListener('time-update', handleTimeUpdate);
		player.addEventListener('pause', handleProgressPause);
		player.addEventListener('ended', handleProgressEnded);
		player.addEventListener('duration-change', handleDurationChange);
		player.addEventListener('can-play', handleCanPlay);
		player.addEventListener('seeking', handleSeeking);
		player.addEventListener('seeked', handleSeeked);
		doc.addEventListener('visibilitychange', handleVisibilityChange);
		win?.addEventListener('pagehide', handlePageHide);

		// Try to resume immediately if duration is already available
		if (player.duration > 0 && !hasResumed) {
			const resumePos = getResumePosition(mediaId, player.duration);
			if (resumePos !== null) {
				player.currentTime = resumePos;
			}
			hasResumed = true;
		}

		return () => {
			player.removeEventListener('time-update', handleTimeUpdate);
			player.removeEventListener('pause', handleProgressPause);
			player.removeEventListener('ended', handleProgressEnded);
			player.removeEventListener('duration-change', handleDurationChange);
			player.removeEventListener('can-play', handleCanPlay);
			player.removeEventListener('seeking', handleSeeking);
			player.removeEventListener('seeked', handleSeeked);
			doc.removeEventListener('visibilitychange', handleVisibilityChange);
			win?.removeEventListener('pagehide', handlePageHide);
			isSeeking = false;
			flushPendingProgressSnapshot();
		};
	}

	function setupPlaybackCompletion(player: MediaPlayerElement) {
		if (!browser) return () => {};
		let lastEmit = 0;
		const handleEnded = () => {
			const now = Date.now();
			if (now - lastEmit < 200) return;
			lastEmit = now;
			dispatch('playbackCompleted', {
				mediaId: getMediaId(),
				mediaType: getMediaType()
			});
		};
		player.addEventListener('ended', handleEnded);
		return () => {
			player.removeEventListener('ended', handleEnded);
		};
	}

	function setupGestureHandlers(player: MediaPlayerElement) {
		if (!browser) return () => {};
		const remote = getRemote(player);
		const resolveRemote = () => getRemote(player) ?? remote;
		const doc = player.ownerDocument ?? document;
		const controls = player.querySelector('media-controls');
		remote?.setPlayer?.(player);
		remote?.setTarget?.(player);

		// Add click handler to media-provider for YouTube/Vimeo video area
		const provider = player.querySelector('media-provider');
		let providerClickHandler: ((event: Event) => void) | null = null;
		if (provider) {
			providerClickHandler = (event: Event) => {
				event.stopPropagation();
				if (suppressNextClick) {
					suppressNextClick = false;
					return;
				}
				// On mobile, if controls were just shown, don't toggle playback
				if (isMobileViewport && controlsJustShown) {
					controlsJustShown = false;
					return;
				}
				const providerRemote =
					(provider as unknown as { remoteControl?: RemoteControl })?.remoteControl ?? null;
				const activeRemote = resolveRemote() ?? providerRemote;
				togglePlayback(player, activeRemote);
			};
			provider.addEventListener('click', providerClickHandler);
		}

		let clickTimer: number | null = null;
		let longPressTimer: number | null = null;
		let longPressActive = false;
		let suppressNextClick = false;
		let handledDoubleInClick = false;
		let activePointerId: number | null = null;
		let previousPlaybackRate = getPlaybackRate(player);
		let spaceSlowTimer: number | null = null;
		let spaceSlowActive = false;
		let previousSpacePlaybackRate = getPlaybackRate(player);

		const clearClickTimer = () => {
			if (clickTimer !== null) {
				clearTimeout(clickTimer);
				clickTimer = null;
			}
		};

		const clearLongPressTimer = () => {
			if (longPressTimer !== null) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		};

		const finishLongPress = () => {
			const wasActive = longPressActive;
			longPressActive = false;
			isLongPressSlowMotionActive = false;
			clearLongPressTimer();
			if (wasActive) {
				rampPlaybackRate(player, resolveRemote(), previousPlaybackRate);
			}
		};

		const shouldHandle = (event: MouseEvent | PointerEvent) => {
			if (event.defaultPrevented) return false;
			return !isEventFromControls(event);
		};

		const onClick = (event: MouseEvent) => {
			if (!isPrimaryClick(event) || !shouldHandle(event)) return;

			if (suppressNextClick) {
				suppressNextClick = false;
				clearClickTimer();
				return;
			}

			if (event.detail === 1) {
				clearClickTimer();
				clickTimer = window.setTimeout(() => {
					// On mobile, if controls were just shown, don't toggle playback
					if (isMobileViewport && controlsJustShown) {
						controlsJustShown = false;
						return;
					}
					togglePlayback(player, resolveRemote());
				}, DOUBLE_CLICK_DELAY);
			} else if (event.detail === 2) {
				handledDoubleInClick = true;
				clearClickTimer();
				toggleFullscreen(player, resolveRemote());
			}
		};

		const onDblClick = (event: MouseEvent) => {
			if (!isPrimaryClick(event) || !shouldHandle(event)) return;

			if (handledDoubleInClick) {
				handledDoubleInClick = false;
				return;
			}

			clearClickTimer();
			toggleFullscreen(player, resolveRemote());
		};

		const onPointerDown = (event: PointerEvent) => {
			if (!isPrimaryPointer(event) || !shouldHandle(event)) return;

			activePointerId = event.pointerId;
			handledDoubleInClick = false;
			previousPlaybackRate = getPlaybackRate(player);
			longPressActive = false;
			suppressNextClick = false;
			clearClickTimer();
			clearLongPressTimer();

			longPressTimer = window.setTimeout(() => {
				longPressTimer = null;
				longPressActive = true;
				isLongPressSlowMotionActive = true;
				controlsVisible = false;
				suppressNextClick = true;
				if (Math.abs(previousPlaybackRate - SLOW_MOTION_RATE) > 1e-3) {
					rampPlaybackRate(player, resolveRemote(), SLOW_MOTION_RATE);
				}
			}, LONG_PRESS_DELAY);
		};

		const onPointerUp = (event: PointerEvent) => {
			if (activePointerId === null || event.pointerId !== activePointerId) return;
			activePointerId = null;
			finishLongPress();
		};

		const onPointerCancel = (event: PointerEvent) => {
			if (activePointerId === null || event.pointerId !== activePointerId) return;
			activePointerId = null;
			suppressNextClick = false;
			finishLongPress();
		};

		const onPointerLeave = (event: PointerEvent) => {
			if (activePointerId === null || event.pointerId !== activePointerId) return;
			if (event.buttons === 0) {
				activePointerId = null;
				finishLongPress();
			}
		};

		const clearSpaceSlowTimer = () => {
			if (spaceSlowTimer !== null) {
				clearTimeout(spaceSlowTimer);
				spaceSlowTimer = null;
			}
		};

		const stopSpaceSlowMotion = () => {
			if (!spaceSlowActive) return;
			const activeRemote = resolveRemote();
			const targetRate = previousSpacePlaybackRate;
			if (Math.abs(getPlaybackRate(player) - targetRate) > 1e-3) {
				rampPlaybackRate(player, activeRemote, targetRate);
			}
			spaceSlowActive = false;
			isLongPressSlowMotionActive = false;
		};

		const isSpaceKey = (key: string) => key === ' ' || key === 'Spacebar' || key === 'Space';

		const shouldHandleSpaceKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return false;
			const target = event.target as HTMLElement | null;
			if (!target) return true;
			const tagName = target.tagName;
			if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return false;
			if (target.isContentEditable) return false;
			if (controls && controls.contains(target)) return false;
			if (target.closest('[data-jumpflix-gesture-ignore="true"]')) return false;
			return true;
		};

		const onSpaceKeyDown = (event: KeyboardEvent) => {
			if (!isSpaceKey(event.key) || !shouldHandleSpaceKey(event)) return;

			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();

			if (event.repeat) {
				return;
			}

			if (spaceSlowActive || spaceSlowTimer !== null) {
				return;
			}

			previousSpacePlaybackRate = getPlaybackRate(player);
			spaceSlowTimer = window.setTimeout(() => {
				spaceSlowTimer = null;
				const activeRemote = resolveRemote();
				if (Math.abs(previousSpacePlaybackRate - SLOW_MOTION_RATE) > 1e-3) {
					rampPlaybackRate(player, activeRemote, SLOW_MOTION_RATE);
				}
				spaceSlowActive = true;
				isLongPressSlowMotionActive = true;
				controlsVisible = false;
			}, LONG_PRESS_DELAY);
		};

		const onSpaceKeyUp = (event: KeyboardEvent) => {
			if (!isSpaceKey(event.key) || !shouldHandleSpaceKey(event)) return;

			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();

			if (spaceSlowTimer !== null) {
				clearSpaceSlowTimer();
				togglePlayback(player, resolveRemote());
				return;
			}

			if (spaceSlowActive) {
				stopSpaceSlowMotion();
			}
		};

		player.addEventListener('click', onClick);
		player.addEventListener('dblclick', onDblClick);
		player.addEventListener('pointerdown', onPointerDown);
		player.addEventListener('pointerup', onPointerUp);
		player.addEventListener('pointercancel', onPointerCancel);
		player.addEventListener('pointerleave', onPointerLeave);
		doc.addEventListener('keydown', onSpaceKeyDown, true);
		doc.addEventListener('keyup', onSpaceKeyUp, true);

		return () => {
			clearClickTimer();
			finishLongPress();
			activePointerId = null;
			suppressNextClick = false;
			handledDoubleInClick = false;
			clearSpaceSlowTimer();
			stopSpaceSlowMotion();
			cancelSpeedRamp();
			doc.removeEventListener('keydown', onSpaceKeyDown, true);
			doc.removeEventListener('keyup', onSpaceKeyUp, true);
			remote?.setTarget?.(null);
			player.removeEventListener('click', onClick);
			player.removeEventListener('dblclick', onDblClick);
			player.removeEventListener('pointerdown', onPointerDown);
			player.removeEventListener('pointerup', onPointerUp);
			player.removeEventListener('pointercancel', onPointerCancel);
			player.removeEventListener('pointerleave', onPointerLeave);
			if (provider && providerClickHandler) {
				provider.removeEventListener('click', providerClickHandler);
			}
		};
	}

	function clearHideControlsTimer() {
		if (hideControlsTimer !== null) {
			clearTimeout(hideControlsTimer);
			hideControlsTimer = null;
		}
	}

	function shouldAutoHide() {
		if (!browser) return false;
		if (!autoHidePlayer) return false;
		const mediaEl = autoHidePlayer.querySelector('video, audio') as HTMLMediaElement | null;
		const currentlyPaused = getPausedState(autoHidePlayer, mediaEl);
		if (currentlyPaused) return false;
		if (controlsFocusWithin) return false;
		if (pointerOverControls) return false;
		if (pointerActiveOnControls) return false;
		return true;
	}

	function scheduleHideControls() {
		if (!browser) return;
		clearHideControlsTimer();
		if (!shouldAutoHide()) return;
		hideControlsTimer = setTimeout(() => {
			if (shouldAutoHide()) {
				controlsVisible = false;
			}
		}, CONTROLS_HIDE_DELAY);
	}

	function showControls() {
		if (!browser) return;
		if (isLongPressSlowMotionActive) return;
		const wasHidden = !controlsVisible;
		controlsVisible = true;
		if (wasHidden && isMobileViewport) {
			controlsJustShown = true;
		}
		scheduleHideControls();
	}

	function markControlsInteractionEnd() {
		pointerActiveOnControls = false;
		scheduleHideControls();
	}

	function setupControlAutoHide(player: MediaPlayerElement, controls: HTMLElement) {
		if (!browser) return () => {};

		autoHidePlayer = player;
		pointerOverControls = false;
		pointerActiveOnControls = false;
		controlsFocusWithin = controls.matches(':focus-within');
		controlsVisible = true;
		clearHideControlsTimer();

		const doc = player.ownerDocument ?? document;
		const resolveMediaEl = () => player.querySelector('video, audio') as HTMLMediaElement | null;

		type PlayerWithSubscribe = MediaPlayerElement & {
			subscribe?: (callback: (state: { paused?: boolean }) => void) => unknown;
		};

		let cleanupStateSubscription: (() => void) | null = null;

		const applyPausedState = (nextPaused?: boolean) => {
			const resolved =
				typeof nextPaused === 'boolean' ? nextPaused : getPausedState(player, resolveMediaEl());

			if (resolved === isPaused) {
				return;
			}

			isPaused = resolved;

			if (isPaused) {
				clearHideControlsTimer();
				controlsVisible = true;
			} else {
				showControls();
			}
		};

		applyPausedState(getPausedState(player, resolveMediaEl()));
		showControls();

		const handlePointerActivity = () => {
			showControls();
		};

		const handlePointerLeavePlayer = () => {
			scheduleHideControls();
		};

		const handleControlsPointerEnter = () => {
			pointerOverControls = true;
			showControls();
		};

		const handleControlsPointerLeave = () => {
			pointerOverControls = false;
			scheduleHideControls();
		};

		const handleControlsPointerDown = () => {
			pointerActiveOnControls = true;
			showControls();
		};

		const handleControlsPointerUp = () => {
			markControlsInteractionEnd();
		};

		const handleDocumentPointerUp = () => {
			if (pointerActiveOnControls) {
				markControlsInteractionEnd();
			}
		};

		const handleFocusIn = () => {
			controlsFocusWithin = true;
			showControls();
		};

		const runAfterFocusChange = (fn: () => void) => {
			if (typeof queueMicrotask === 'function') {
				queueMicrotask(fn);
			} else {
				setTimeout(fn, 0);
			}
		};

		const handleFocusOut = () => {
			runAfterFocusChange(() => {
				const active = doc.activeElement as Node | null;
				controlsFocusWithin = !!(active && controls.contains(active));
				if (!controlsFocusWithin) {
					scheduleHideControls();
				}
			});
		};

		const keyboardTriggerKeys = new Set([
			' ',
			'Spacebar',
			'Space',
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
			'MediaPlayPause',
			'MediaStop',
			'MediaTrackNext',
			'MediaTrackPrevious'
		]);
		const keyboardTriggerLetters = new Set(['k', 'j', 'l', 'f', 'm']);

		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
					return;
				}
			}

			const key = event.key;
			const lower = key.length === 1 ? key.toLowerCase() : key;
			if (
				keyboardTriggerKeys.has(key) ||
				keyboardTriggerKeys.has(lower) ||
				keyboardTriggerLetters.has(lower)
			) {
				showControls();
			}
		};

		const handlePlay = () => {
			applyPausedState(false);
		};

		const handlePause = () => {
			applyPausedState(true);
		};

		const handleEnded = () => {
			applyPausedState(true);
			// Close player on mobile when video ends
			if (isMobileViewport && typeof onClose === 'function') {
				onClose();
			}
		};

		const playerWithSubscribe = player as PlayerWithSubscribe;
		const maybeUnsubscribe = playerWithSubscribe.subscribe?.(({ paused }) => {
			applyPausedState(paused);
		});

		if (typeof maybeUnsubscribe === 'function') {
			cleanupStateSubscription = () => {
				maybeUnsubscribe();
			};
		}

		const mutationObserver = new MutationObserver(() => {
			const mediaEl = resolveMediaEl();
			const nextPaused = getPausedState(player, mediaEl);
			if (nextPaused !== isPaused) {
				applyPausedState(nextPaused);
			}
		});

		mutationObserver.observe(player, { attributes: true, attributeFilter: ['data-paused'] });

		const mediaEl = resolveMediaEl();
		if (mediaEl) {
			mediaEl.addEventListener('play', handlePlay);
			mediaEl.addEventListener('playing', handlePlay);
			mediaEl.addEventListener('pause', handlePause);
			mediaEl.addEventListener('ended', handleEnded);
		}

		player.addEventListener('play', handlePlay);
		player.addEventListener('playing', handlePlay);
		player.addEventListener('pause', handlePause);
		player.addEventListener('ended', handleEnded);
		player.addEventListener('pointermove', handlePointerActivity, { passive: true });
		player.addEventListener('pointerdown', handlePointerActivity);
		player.addEventListener('pointerenter', handlePointerActivity);
		player.addEventListener('pointerleave', handlePointerLeavePlayer);

		controls.addEventListener('pointerenter', handleControlsPointerEnter);
		controls.addEventListener('pointerleave', handleControlsPointerLeave);
		controls.addEventListener('pointerdown', handleControlsPointerDown);
		controls.addEventListener('pointerup', handleControlsPointerUp);
		controls.addEventListener('pointercancel', handleControlsPointerUp);
		controls.addEventListener('focusin', handleFocusIn);
		controls.addEventListener('focusout', handleFocusOut);

		doc.addEventListener('pointerup', handleDocumentPointerUp);
		doc.addEventListener('pointercancel', handleDocumentPointerUp);
		doc.addEventListener('keydown', handleKeyDown, true);

		return () => {
			mutationObserver.disconnect();
			clearHideControlsTimer();
			pointerOverControls = false;
			pointerActiveOnControls = false;
			controlsFocusWithin = false;
			if (autoHidePlayer === player) {
				autoHidePlayer = null;
			}

			if (mediaEl) {
				mediaEl.removeEventListener('play', handlePlay);
				mediaEl.removeEventListener('playing', handlePlay);
				mediaEl.removeEventListener('pause', handlePause);
				mediaEl.removeEventListener('ended', handleEnded);
			}

			player.removeEventListener('play', handlePlay);
			player.removeEventListener('playing', handlePlay);
			player.removeEventListener('pause', handlePause);
			player.removeEventListener('ended', handleEnded);
			player.removeEventListener('pointermove', handlePointerActivity);
			player.removeEventListener('pointerdown', handlePointerActivity);
			player.removeEventListener('pointerenter', handlePointerActivity);
			player.removeEventListener('pointerleave', handlePointerLeavePlayer);

			controls.removeEventListener('pointerenter', handleControlsPointerEnter);
			controls.removeEventListener('pointerleave', handleControlsPointerLeave);
			controls.removeEventListener('pointerdown', handleControlsPointerDown);
			controls.removeEventListener('pointerup', handleControlsPointerUp);
			controls.removeEventListener('pointercancel', handleControlsPointerUp);
			controls.removeEventListener('focusin', handleFocusIn);
			controls.removeEventListener('focusout', handleFocusOut);

			doc.removeEventListener('pointerup', handleDocumentPointerUp);
			doc.removeEventListener('pointercancel', handleDocumentPointerUp);
			doc.removeEventListener('keydown', handleKeyDown, true);
			cleanupStateSubscription?.();
			cleanupStateSubscription = null;
		};
	}

	function enforceMobileVolume(player: MediaPlayerElement) {
		const withVolume = player as unknown as { volume?: number; muted?: boolean };
		if (
			typeof withVolume.volume === 'number' &&
			Math.abs(withVolume.volume - FULL_VOLUME) > VOLUME_TOLERANCE
		) {
			withVolume.volume = FULL_VOLUME;
		}
		if (typeof withVolume.muted === 'boolean' && withVolume.muted) {
			withVolume.muted = false;
		}

		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		if (mediaEl) {
			if (Math.abs(mediaEl.volume - FULL_VOLUME) > VOLUME_TOLERANCE) {
				mediaEl.volume = FULL_VOLUME;
			}
			if (mediaEl.muted) {
				mediaEl.muted = false;
			}
		}
	}

	function isEventFromControls(event: MouseEvent | PointerEvent) {
		const path = event.composedPath();
		for (const node of path) {
			if (!(node instanceof HTMLElement)) continue;

			if (node.dataset.jumpflixGestureIgnore === 'true') {
				return true;
			}

			const tagName = node.tagName;
			if (
				tagName === 'MEDIA-CONTROLS-GROUP' ||
				tagName === 'MEDIA-TIME-SLIDER' ||
				tagName === 'MEDIA-VOLUME-SLIDER' ||
				tagName === 'MEDIA-PLAY-BUTTON' ||
				tagName === 'MEDIA-SEEK-BUTTON' ||
				tagName === 'MEDIA-MUTE-BUTTON' ||
				tagName === 'MEDIA-FULLSCREEN-BUTTON' ||
				tagName === 'MEDIA-AIRPLAY-BUTTON' ||
				tagName === 'MEDIA-GOOGLE-CAST-BUTTON'
			) {
				return true;
			}

			if (
				tagName === 'BUTTON' ||
				tagName === 'A' ||
				tagName === 'INPUT' ||
				tagName === 'SELECT' ||
				tagName === 'TEXTAREA'
			) {
				return true;
			}

			if (
				node.classList.contains('control-button') ||
				node.classList.contains('time-slider') ||
				node.classList.contains('volume-slider') ||
				node.classList.contains('player-close-button')
			) {
				return true;
			}

			const roleAttr = node.getAttribute('role');
			if (roleAttr === 'slider' || roleAttr === 'button') {
				return true;
			}
		}
		return false;
	}

	function togglePlayback(player: MediaPlayerElement, remote: RemoteControl | null) {
		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		const initialPaused = getPausedState(player, mediaEl);
		if (remote?.play && remote?.pause) {
			if (initialPaused) {
				remote.play();
			} else {
				remote.pause();
			}
		} else {
			togglePlaybackManually(mediaEl);
		}
	}

	function togglePlaybackManually(mediaEl: HTMLMediaElement | null) {
		if (!mediaEl) return;

		if (mediaEl.paused) {
			void mediaEl.play().catch(() => {});
		} else {
			mediaEl.pause();
		}
	}

	function getPausedState(player: MediaPlayerElement, mediaEl: HTMLMediaElement | null) {
		const withState = player as unknown as {
			state?: { paused?: boolean };
			paused?: boolean;
		};

		if (typeof withState.state?.paused === 'boolean') {
			return withState.state.paused;
		}

		if (typeof withState.paused === 'boolean') {
			return withState.paused;
		}

		return mediaEl?.paused ?? true;
	}

	function toggleFullscreen(player: MediaPlayerElement, remote: RemoteControl | null) {
		if (remote?.toggleFullscreen) {
			remote.toggleFullscreen('prefer-media');
			return;
		}

		const doc = player.ownerDocument ?? document;
		if (doc.fullscreenElement) {
			doc.exitFullscreen?.();
		} else {
			if (typeof player.requestFullscreen === 'function') {
				void player.requestFullscreen();
			} else {
				const mediaEl = player.querySelector('video, audio') as
					| HTMLVideoElement
					| HTMLAudioElement
					| null;
				void mediaEl?.requestFullscreen?.();
			}
		}
	}

	function setPlaybackRate(player: MediaPlayerElement, remote: RemoteControl | null, rate: number) {
		if (remote?.changePlaybackRate) {
			remote.changePlaybackRate(rate);
			return;
		}

		const target = player as unknown as { playbackRate?: number };
		if (typeof target.playbackRate === 'number' && !Number.isNaN(target.playbackRate)) {
			target.playbackRate = rate;
			return;
		}

		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		if (mediaEl) {
			mediaEl.playbackRate = rate;
		}
	}

	function getPlaybackRate(player: MediaPlayerElement) {
		const withState = player as unknown as {
			state?: { playbackRate?: number };
			playbackRate?: number;
		};

		const stateRate = withState.state?.playbackRate;
		if (typeof stateRate === 'number' && !Number.isNaN(stateRate)) {
			return stateRate;
		}

		const propRate = withState.playbackRate;
		if (typeof propRate === 'number' && !Number.isNaN(propRate)) {
			return propRate;
		}

		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		if (mediaEl && !Number.isNaN(mediaEl.playbackRate)) {
			return mediaEl.playbackRate;
		}

		return 1;
	}

	function getRemote(player: MediaPlayerElement | null) {
		return (player as unknown as { remoteControl?: RemoteControl })?.remoteControl ?? null;
	}

	function isPrimaryPointer(event: PointerEvent) {
		if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
			return event.button === 0;
		}
		return event.isPrimary ?? true;
	}

	function isPrimaryClick(event: MouseEvent) {
		return event.button === 0 || event.button === undefined;
	}
	const YOUTUBE_SHORT = /^youtube\/([^\s]+.*)$/i;
	const VIMEO_SHORT = /^vimeo\/([^\s]+.*)$/i;
	const YOUTUBE_DOMAIN =
		/^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
	const VIMEO_DOMAIN = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com/i;
	const HAS_PROTOCOL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

	let isIOSDevice = detectIOSDevice();
	let effectiveAutoPlay = false;

	function detectIOSDevice() {
		if (!browser) return false;
		try {
			const ua = navigator.userAgent ?? '';
			if (/iPad|iPhone|iPod/i.test(ua)) return true;
			// iPadOS 13+ reports as Mac; use touch points heuristic.
			const platform = (navigator as unknown as { platform?: string }).platform ?? '';
			const maxTouchPoints =
				(navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
			return platform === 'MacIntel' && maxTouchPoints > 1;
		} catch {
			return false;
		}
	}

	$: effectiveAutoPlay = !!autoPlay && !isIOSDevice;

	onMount(() => {
		mounted = true;
		isIOSDevice = detectIOSDevice();

		if (browser && typeof window !== 'undefined') {
			cleanupMobileQuery?.();
			const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
			mobileQuery = query;

			const handleMobileViewportChange = (event: MediaQueryListEvent) => {
				isMobileViewport = event.matches;
			};

			isMobileViewport = query.matches;

			if (typeof query.addEventListener === 'function') {
				query.addEventListener('change', handleMobileViewportChange);
				cleanupMobileQuery = () => {
					query.removeEventListener('change', handleMobileViewportChange);
				};
			} else {
				query.addListener(handleMobileViewportChange);
				cleanupMobileQuery = () => {
					query.removeListener(handleMobileViewportChange);
				};
			}
		}

		const body = typeof document !== 'undefined' ? document.body : null;
		body?.classList.add('hide-popcorn');
		return () => {
			body?.classList.remove('hide-popcorn');
			cleanupMobileQuery?.();
			cleanupMobileQuery = null;
			mobileQuery = null;
			try {
				if (playerEl) {
					playerEl.pause?.();
					playerEl.destroy?.();
				}
			} catch {
				/* no-op */
			}
		};
	});

	$: if (mounted && browser) {
		void ensureVidstackLoaded();
	}

	$: if (playerEl && isMobileViewport) {
		enforceMobileVolume(playerEl);
	}

	function ensureProtocol(url: string) {
		if (HAS_PROTOCOL.test(url)) return url;
		if (url.startsWith('//')) return `https:${url}`;
		return `https://${url.replace(/^\/+/u, '')}`;
	}

	function normalizeYouTube(value: string) {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		if (YOUTUBE_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
			return ensureProtocol(trimmed);
		}
		const [idPart, queryPart] = trimmed.split('?');
		const videoId = idPart.trim();
		if (!videoId) return undefined;
		try {
			const params = queryPart ? new URLSearchParams(queryPart) : null;
			const query = params?.toString() ?? '';
			return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${query ? `&${query}` : ''}`;
		} catch {
			return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
		}
	}

	function normalizeVimeo(value: string) {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		if (VIMEO_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
			return ensureProtocol(trimmed);
		}
		const [idPart, queryPart] = trimmed.split('?');
		const videoId = idPart.replace(/^\/+/u, '').trim();
		if (!videoId) return undefined;
		const suffix = queryPart ? `?${queryPart}` : '';
		return `https://vimeo.com/${videoId}${suffix}`;
	}

	// Accept short-hand provider prefixes and return full URLs Vidstack can recognise.
	function normalizeSource(raw: string | null) {
		if (!raw) return undefined;
		const trimmed = raw.trim();
		if (!trimmed) return undefined;

		const ytMatch = trimmed.match(YOUTUBE_SHORT);
		if (ytMatch) {
			return normalizeYouTube(ytMatch[1]);
		}

		const vimeoMatch = trimmed.match(VIMEO_SHORT);
		if (vimeoMatch) {
			return normalizeVimeo(vimeoMatch[1]);
		}

		if (YOUTUBE_DOMAIN.test(trimmed)) {
			return ensureProtocol(trimmed);
		}

		if (VIMEO_DOMAIN.test(trimmed)) {
			return ensureProtocol(trimmed);
		}

		return trimmed;
	}

	$: resolvedSrc = normalizeSource(src);
	$: resolvedPoster = poster ?? undefined;
	$: playerTitle = title ?? undefined;
	$: shouldRender = mounted && browser && !!resolvedSrc && vidstackReady;

	// Reset resume state when content changes
	$: if (keySeed) {
		flushPendingProgressSnapshot();
		lastProgressUpdate = 0;
		hasResumed = false;
		isSeeking = false;
	}
</script>

{#if shouldRender}
	{#key `${keySeed}:${resolvedSrc}`}
			<media-player
				bind:this={playerEl}
				class="vidstack-player"
				src={resolvedSrc}
				title={playerTitle}
				poster={resolvedPoster}
				playsInline
				crossOrigin="anonymous"
				autoplay={effectiveAutoPlay}
			>
				<media-provider data-no-controls>
					{#if spotChaptersTrackSrc}
						{#key spotChaptersTrackSrc}
							<track
								bind:this={spotChaptersTrackEl}
								kind="chapters"
								label={m.tv_spots()}
								src={spotChaptersTrackSrc}
								default
							/>
						{/key}
					{/if}
				</media-provider>

				{#if isIOSDevice && autoPlay && !effectiveAutoPlay && isPaused}
					<div class="ios-tap-to-play" aria-live="polite">
						<span class="ios-tap-to-play-pill">
							<PlayIcon aria-hidden="true" />
							<span>{m.tv_tapToPlay()}</span>
						</span>
					</div>
				{/if}

				{#if nowPlayingTrackLabel || nowPlayingSpotLabel}
					<div class="now-pills" aria-live="polite">
						{#if nowPlayingTrackLabel}
							<a
								class="now-pill now-pill-track"
								href={nowPlayingTrackHref || spotifySearchUrl(nowPlayingTrackLabel)}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Open on Spotify: ${nowPlayingTrackLabel}`}
								title="Open on Spotify"
							>
								<span class="now-pill-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
										<path
											fill="currentColor"
											d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5Zm4.82 15.174a.75.75 0 0 1-1.033.247c-2.83-1.73-6.395-2.122-10.598-1.165a.75.75 0 1 1-.332-1.462c4.566-1.04 8.48-.595 11.714 1.382a.75.75 0 0 1 .249 1.0Zm1.476-3.02a.9.9 0 0 1-1.238.296c-3.24-1.99-8.18-2.566-12.01-1.404a.9.9 0 0 1-.522-1.722c4.36-1.322 9.776-.68 13.48 1.596a.9.9 0 0 1 .29 1.234Zm.127-3.153C14.64 8.21 8.38 8 4.79 9.09a1.05 1.05 0 0 1-.61-2.01c4.13-1.255 11.0-1.01 15.36 1.58a1.05 1.05 0 1 1-1.07 1.84Z"
										/>
									</svg>
								</span>
								<span class="now-pill-text">{nowPlayingTrackLabel}</span>
							</a>
						{/if}
						{#if nowPlayingSpotLabel}
							<a
								class="now-pill now-pill-spot"
								href={nowPlayingSpotHref || '#'}
								target={nowPlayingSpotHref ? '_blank' : undefined}
								rel={nowPlayingSpotHref ? 'noopener noreferrer' : undefined}
								aria-label={m.tv_openOnParkourSpotAria({ label: nowPlayingSpotLabel })}
								title={m.tv_openOnParkourSpot()}
								data-disabled={nowPlayingSpotHref ? undefined : 'true'}
								onclick={(e) => {
									if (!nowPlayingSpotHref) e.preventDefault();
								}}
							>
								<img
									src="/icons/brand-parkour-dot-spot.svg"
									alt=""
									class="now-pill-icon now-pill-icon-parkour"
									aria-hidden="true"
								/>
								<span class="now-pill-text">{nowPlayingSpotLabel}</span>
							</a>
						{/if}
					</div>
				{/if}

				<media-controls
					class="player-controls"
					data-jumpflix-gesture-ignore="true"
					data-hidden={controlsVisible ? undefined : ''}
					bind:this={controlsEl}
				>
					{#if typeof onClose === 'function'}
						<div class="controls-top">
							<media-controls-group class="controls-group top">
								<button
									type="button"
									class="player-close-button"
									aria-label="Close player"
									data-jumpflix-gesture-ignore="true"
									onclick={onClose}
								>
									<span class="icon" aria-hidden="true"><XIcon /></span>
								</button>
							</media-controls-group>
						</div>
					{/if}
					<div class="controls-surface">
						<media-controls-group class="controls-group scrub">
							<media-time-slider
								class="time-slider vds-time-slider vds-slider"
								aria-label={title ? `Scrub through ${title}` : 'Scrub through video'}
							>
								<media-slider-chapters class="vds-slider-chapters slider-chapters" aria-hidden="true">
									<template>
										<div class="vds-slider-chapter slider-chapter">
											<div class="vds-slider-track slider-track"></div>
											<div class="vds-slider-track-fill vds-slider-track slider-track-fill"></div>
											<div class="vds-slider-progress vds-slider-track slider-track-progress"></div>
										</div>
									</template>
								</media-slider-chapters>
								<div class="slider-thumb" aria-hidden="true"></div>
								<media-slider-preview class="slider-preview">
									<div class="slider-chapter-title" data-part="chapter-title"></div>
									<media-slider-value class="slider-value"></media-slider-value>
								</media-slider-preview>
							</media-time-slider>
						</media-controls-group>

						<div class="controls-row">
							<media-controls-group class="controls-group left">
								<media-play-button class="control-button" aria-label="Toggle playback">
									<span class="icon icon-play"><PlayIcon /></span>
									<span class="icon icon-pause"><PauseIcon /></span>
									<span class="icon icon-replay"><RotateCcwIcon /></span>
								</media-play-button>

								<media-seek-button
									class="control-button"
									seconds={-10}
									aria-label="Jump back 10 seconds"
								>
									<span class="icon"><SkipBackIcon /></span>
									<span class="label">-10s</span>
								</media-seek-button>

								<media-seek-button
									class="control-button"
									seconds={10}
									aria-label="Jump forward 10 seconds"
								>
									<span class="icon"><SkipForwardIcon /></span>
									<span class="label">+10s</span>
								</media-seek-button>

								<div class="time-display" aria-hidden="true">
									<media-time type="current" class="time-value"></media-time>
									<span class="time-divider">/</span>
									<media-time type="duration" class="time-value"></media-time>
								</div>
							</media-controls-group>

							<media-controls-group class="controls-group right">
								{#if !isMobileViewport}
									<media-mute-button class="control-button" aria-label="Toggle mute">
										<span class="icon icon-muted"><VolumeXIcon /></span>
										<span class="icon icon-unmuted"><Volume2Icon /></span>
									</media-mute-button>

									<media-volume-slider class="volume-slider" aria-label="Adjust volume">
										<div class="slider-track" aria-hidden="true">
											<div class="slider-track-progress"></div>
											<div class="slider-track-fill"></div>
										</div>
										<div class="slider-thumb" aria-hidden="true"></div>
										<media-slider-preview class="slider-preview">
											<media-slider-value class="slider-value"></media-slider-value>
										</media-slider-preview>
									</media-volume-slider>
								{/if}

								<media-airplay-button
									class="control-button"
									aria-label="Stream via AirPlay"
									data-jumpflix-gesture-ignore="true"
								>
									<span class="icon"><AirplayIcon /></span>
								</media-airplay-button>

								<media-google-cast-button
									class="control-button"
									aria-label="Cast to device"
									data-jumpflix-gesture-ignore="true"
								>
									<span class="icon"><CastIcon /></span>
								</media-google-cast-button>

								<SpotChapterSuggestionDialog
									{mediaId}
									{mediaType}
									{playbackKey}
									getCurrentTimeSeconds={() => Number(playerEl?.currentTime ?? 0)}
									spotChapterId={activeSpotChapterId}
									initialSpotId={activeSpotSpotId}
									initialStartSeconds={activeSpotStartSeconds}
									initialEndSeconds={activeSpotEndSeconds}
									lockTimeRange={isChangingSpot}
									triggerClass="control-button"
									triggerAriaLabel={spotSuggestionTriggerAriaLabel}
									triggerTitle={spotSuggestionTriggerTitle}
									on:submitted={() => {
										spotChaptersRefreshToken += 1;
									}}
								/>

								<media-fullscreen-button class="control-button" aria-label="Toggle fullscreen">
									<span class="icon icon-enter"><Maximize2Icon /></span>
									<span class="icon icon-exit"><Minimize2Icon /></span>
								</media-fullscreen-button>
							</media-controls-group>
						</div>
					</div>
				</media-controls>
			</media-player>
	{/key}
{:else}
	<div class="player-loader" role="status" aria-live="polite">
		<span>Loading player…</span>
	</div>
{/if}

<style>
	.vidstack-player {
		inline-size: 100%;
		block-size: 100%;
		background: #000;
		position: relative;
	}

	:global(media-player.vidstack-player[data-view-type='video']) {
		aspect-ratio: auto;
	}

	:global(media-player.vidstack-player [data-media-provider] video) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	:global(media-player.vidstack-player [data-media-provider] iframe) {
		width: 100%;
		display: block;
	}

	:global(media-player.vidstack-player [data-media-provider] iframe.vds-youtube) {
		transition: height 180ms ease-in-out;
	}

	/*
	 * Vidstack's YouTube "no-controls" mode uses a large iframe height (e.g. 1000%) to push
	 * YouTube UI out of view. That hides YouTube chrome, but it also vertically crops the actual
	 * video ("zoomed in", chopped top/bottom).
	 *
	 * We keep Vidstack's crop while paused (so YouTube UI stays hidden) but undo it while playing
	 * so the video isn't chopped.
	 */
	:global(media-player.vidstack-player [data-media-provider] iframe:not(.vds-youtube[data-no-controls])) {
		height: 100%;
	}

	:global(
			media-player.vidstack-player:not([data-paused])
				[data-media-provider]
				iframe.vds-youtube[data-no-controls]
		) {
		height: 100% !important;
	}

	:global(media-player.vidstack-player:fullscreen),
	:global(media-player.vidstack-player:-webkit-full-screen),
	:global(media-player.vidstack-player[data-fullscreen]),
	:global(.vidstack-player[data-fullscreen]) {
		aspect-ratio: auto;
		inline-size: 100%;
		block-size: 100%;
		max-inline-size: 100%;
		max-block-size: 100%;
	}

	:global(media-player.vidstack-player:fullscreen video),
	:global(media-player.vidstack-player:-webkit-full-screen video) {
		object-fit: contain;
	}

	:global(.vidstack-player video:fullscreen),
	:global(.vidstack-player video:-webkit-full-screen) {
		object-fit: contain;
		inline-size: 100%;
		block-size: 100%;
		max-inline-size: 100%;
		max-block-size: 100%;
	}

	.player-loader {
		inline-size: 100%;
		block-size: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #020617;
		color: #cbd5f5;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.ios-tap-to-play {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: translateY(-3px);
		pointer-events: none;
		z-index: 1;
	}

	.ios-tap-to-play-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.65rem 1.05rem;
		border-radius: 9999px;
		background: #020617;
		border: 1px solid rgba(203, 213, 245, 0.25);
		color: #cbd5f5;
		font-size: 1rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.ios-tap-to-play-pill :global(svg) {
		inline-size: 1.1rem;
		block-size: 1.1rem;
	}
	.player-controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		opacity: 1;
		pointer-events: auto;
		transition: opacity 160ms ease-in-out;
		z-index: 2;
	}

	.player-controls::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(7, 15, 35, 0.05) 0%, rgba(7, 15, 35, 0.85) 100%);
		opacity: 0.85;
		transition: opacity 180ms ease-in-out;
		pointer-events: none;
	}

	.player-controls[data-hidden] {
		opacity: 0;
		pointer-events: none;
	}

	.player-controls[data-hidden]::before {
		opacity: 0;
	}

	.controls-top {
		position: absolute;
		inset-inline: clamp(0.9rem, 3vw, 1.75rem);
		top: clamp(0.9rem, 3vw, 1.75rem);
		display: flex;
		justify-content: flex-end;
		z-index: 2;
	}

	.controls-group.top {
		pointer-events: auto;
		margin: 0;
		gap: clamp(0.5rem, 1vw, 0.75rem);
	}

	.player-close-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: clamp(2.25rem, 2.9vw, 2.75rem);
		block-size: clamp(2.25rem, 2.9vw, 2.75rem);
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(10, 16, 40, 0.6);
		color: #f1f5f9;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			transform 140ms ease,
			color 140ms ease;
		cursor: pointer;
		box-shadow: 0 12px 28px rgba(10, 16, 40, 0.35);
	}

	.player-close-button .icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.player-close-button :global(svg) {
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	.player-close-button:hover,
	.player-close-button:focus-visible {
		background: rgba(46, 120, 255, 0.55);
		border-color: rgba(180, 217, 255, 0.75);
		transform: translateY(-1px);
	}

	.player-close-button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px rgba(24, 36, 84, 0.9),
			0 0 0 4px rgba(104, 183, 255, 0.6);
	}

	.controls-surface {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(0.75rem, 2vw, 1.25rem);
		width: 100%;
		z-index: 1;
	}

	.now-pills {
		position: absolute;
		top: max(0.75rem, env(safe-area-inset-top, 0px));
		left: max(0.75rem, env(safe-area-inset-left, 0px));
		display: flex;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0;
		pointer-events: none;
		z-index: 5;
	}

	.now-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		max-width: min(100%, 42rem);
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(10, 16, 40, 0.55);
		color: rgba(248, 250, 252, 0.9);
		font-size: 0.75rem;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		box-shadow: 0 10px 30px rgba(10, 16, 40, 0.25);
		text-decoration: none;
		pointer-events: auto;
		cursor: pointer;
	}

	.now-pill:hover {
		background: rgba(10, 16, 40, 0.7);
	}

	.now-pill[data-disabled='true'] {
		opacity: 0.6;
		cursor: default;
	}

	.now-pill-track {
		border-color: rgba(29, 185, 84, 0.35);
		background: rgba(29, 185, 84, 0.12);
		color: #1db954;
	}

	.now-pill-track:hover {
		background: rgba(29, 185, 84, 0.18);
	}

	.now-pill-spot {
		border-color: rgba(142, 207, 242, 0.35);
		background: rgba(142, 207, 242, 0.12);
		color: #8ecff2;
	}

	.now-pill-spot:hover {
		background: rgba(142, 207, 242, 0.18);
	}

	.now-pill-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 14px;
		height: 14px;
	}

	.now-pill-icon :global(svg) {
		width: 14px;
		height: 14px;
	}

	.now-pill-icon-parkour {
		width: 14px;
		height: 14px;
		filter: invert(1);
		opacity: 0.95;
	}

	.now-pill-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.controls-row {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		width: 100%;
		gap: clamp(0.75rem, 2vw, 1.5rem);
		flex-wrap: wrap;
		margin-block-end: max(clamp(0.65rem, 2vw, 1.5rem), env(safe-area-inset-bottom, 0px));
	}

	.controls-group {
		display: flex;
		align-items: center;
		gap: clamp(0.65rem, 1.4vw, 1.25rem);
		pointer-events: auto;
		margin: 0 10px;
	}

	.controls-group.scrub {
		pointer-events: auto;
	}

	.controls-group.left {
		flex: 1 1 auto;
		min-width: 0;
	}

	.controls-group.right {
		justify-content: flex-end;
		flex: 0 0 auto;
		margin-inline-start: auto;
	}

	.control-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		inline-size: clamp(2.5rem, 3.2vw, 2.9rem);
		block-size: clamp(2.5rem, 3.2vw, 2.9rem);
		border-radius: 0.85rem;
		border: 1px solid rgba(126, 160, 255, 0.25);
		background: rgba(10, 16, 40, 0.65);
		color: #f8fafc;
		transition:
			background 140ms ease,
			transform 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
		cursor: pointer;
		box-shadow: 0 10px 30px rgba(10, 16, 40, 0.35);
	}

	.control-button:hover,
	.control-button:focus-visible {
		background: rgba(46, 120, 255, 0.55);
		border-color: rgba(180, 217, 255, 0.75);
		transform: translateY(-1px);
	}

	.control-button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px rgba(24, 36, 84, 0.9),
			0 0 0 4px rgba(104, 183, 255, 0.6);
	}

	.control-button .icon {
		display: none;
		align-items: center;
		justify-content: center;
	}

	:global(media-airplay-button.control-button .icon),
	:global(media-google-cast-button.control-button .icon) {
		display: inline-flex;
	}

	:global(media-airplay-button.control-button[aria-hidden='true']),
	:global(media-google-cast-button.control-button[aria-hidden='true']) {
		display: none;
	}

	:global(media-airplay-button.control-button[data-active]),
	:global(media-google-cast-button.control-button[data-active]) {
		background: rgba(46, 120, 255, 0.55);
		border-color: rgba(180, 217, 255, 0.75);
	}

	:global(.control-button svg) {
		inline-size: 1.35rem;
		block-size: 1.35rem;
	}

	:global(media-play-button.control-button[data-paused] .icon-play),
	:global(media-play-button.control-button[data-ended] .icon-replay) {
		display: inline-flex;
	}

	:global(media-play-button.control-button:not([data-paused]):not([data-ended]) .icon-pause) {
		display: inline-flex;
	}

	:global(media-mute-button.control-button[data-muted] .icon-muted) {
		display: inline-flex;
	}

	:global(media-mute-button.control-button:not([data-muted]) .icon-unmuted) {
		display: inline-flex;
	}

	:global(media-fullscreen-button.control-button[data-active] .icon-exit) {
		display: inline-flex;
	}

	:global(media-fullscreen-button.control-button:not([data-active]) .icon-enter) {
		display: inline-flex;
	}

	.control-button .label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: rgba(226, 232, 240, 0.85);
	}

	.time-display {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-variant-numeric: tabular-nums;
		font-size: clamp(0.85rem, 1.3vw, 1rem);
		color: rgba(226, 232, 240, 0.9);
	}

	.time-divider {
		opacity: 0.65;
	}

	.time-value {
		min-width: 2.75ch;
		text-align: center;
	}

	:global(media-time-slider.time-slider) {
		width: 100%;
		display: block;
		--media-slider-track-height: 6px;
		position: relative;
	}

	.time-slider .slider-chapters {
		position: absolute;
		inset-inline: 0;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 0;
		inline-size: 100%;
		block-size: var(--media-slider-track-height, 6px);
		border-radius: 999px;
		overflow: hidden;
		pointer-events: none;
		z-index: 2;
	}

	.time-slider .slider-chapter {
		position: relative;
		block-size: 100%;
		min-inline-size: 1px;
		border-radius: 999px;
		overflow: hidden;
		/* Important: do NOT set flex/width here. Vidstack sets each chapter width inline. */
	}

	.time-slider .slider-track,
	.volume-slider .slider-track {
		position: relative;
		inline-size: 100%;
		block-size: var(--media-slider-track-height, 6px);
		background: rgba(148, 163, 215, 0.25);
		border-radius: 999px;
		overflow: hidden;
		pointer-events: none;
	}

	.time-slider .slider-track-progress,
	.volume-slider .slider-track-progress {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		inline-size: var(--slider-progress, 0%);
		background: rgba(255, 255, 255, 0.28);
		z-index: 1;
	}

	.time-slider .slider-chapter .slider-track-progress {
		inline-size: var(--chapter-progress, 0%);
	}

	.time-slider .slider-track-fill,
	.volume-slider .slider-track-fill {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		inline-size: var(--slider-fill, 0%);
		background: linear-gradient(90deg, #60a5fa 0%, #c084fc 100%);
		z-index: 2;
	}

	.time-slider .slider-chapter .slider-track-fill {
		inline-size: var(--chapter-fill, 0%);
	}

	.time-slider .slider-thumb,
	.volume-slider .slider-thumb {
		position: absolute;
		inline-size: var(--media-slider-thumb-size, 16px);
		block-size: var(--media-slider-thumb-size, 16px);
		border-radius: 999px;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.35);
		box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.18);
		transform: translate(-50%, -50%);
		inset-inline-start: var(--slider-fill, 0%);
		inset-block-start: 50%;
		pointer-events: none;
		z-index: 3;
		opacity: 0;
		transition: opacity 200ms ease-in-out;
	}
	:global(media-time-slider.time-slider [part='track']) {
		background: rgba(148, 163, 215, 0.45);
		height: var(--media-slider-track-height);
		border-radius: 999px;
		overflow: hidden;
	}

	:global(media-time-slider.time-slider [part='track-fill']) {
		background: linear-gradient(90deg, #60a5fa 0%, #c084fc 100%);
	}

	:global(media-time-slider.time-slider [part='track-progress']) {
		background: rgba(255, 255, 255, 0.28);
	}

	:global(media-time-slider.time-slider [part='thumb']) {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.4);
		box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.18);
		opacity: 0;
		transition: opacity 200ms ease-in-out;
	}

	:global(media-time-slider.time-slider[data-pointing] [part='thumb']) {
		opacity: 1;
	}

	:global(media-slider-preview.slider-preview) {
		background: rgba(15, 23, 42, 0.9);
		border-radius: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.4);
		padding: 0.25rem 0.6rem;
		box-shadow: 0 12px 24px rgba(10, 16, 36, 0.35);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		opacity: 0;
		transition: opacity 200ms ease-in-out;
	}

	:global(media-slider-preview.slider-preview [data-part='chapter-title']) {
		font-size: 0.75rem;
		line-height: 1.1;
		color: rgba(255, 255, 255, 0.9);
		max-width: 18rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(media-slider-preview.slider-preview[data-visible]) {
		opacity: 1;
	}

	:global(media-volume-slider.volume-slider) {
		--media-slider-height: 48px;
		--media-slider-track-height: 5px;
		--media-slider-thumb-size: 14px;
		--media-slider-track-bg: rgba(148, 163, 215, 0.3);
		--media-slider-track-fill-bg: linear-gradient(90deg, #facc15 0%, #f97316 100%);
		--media-slider-thumb-bg: #ffffff;
		--media-slider-thumb-border: 1px solid rgba(15, 23, 42, 0.35);
		inline-size: clamp(110px, 12vw, 160px);
		position: relative;
	}

	:global(media-volume-slider.volume-slider .vds-slider-thumb) {
		box-shadow: 0 0 0 5px rgba(250, 204, 21, 0.18);
		opacity: 0;
		transition: opacity 200ms ease-in-out;
	}

	:global(media-volume-slider.volume-slider[data-pointing] .vds-slider-thumb) {
		opacity: 1;
	}

	/* Prevent user from interacting with youtube/vimeo through iframe */
	:global(media-player.vidstack-player .vds-blocker) {
		height: 100% !important;
		width: 100% !important;
		aspect-ratio: auto !important;
		pointer-events: auto !important;
	}

	:global(iframe.vds-vimeo) {
		height: initial;
	}

	:global(media-player.vidstack-player[data-fullscreen] iframe.vds-vimeo),
	:global(media-player.vidstack-player:fullscreen iframe.vds-vimeo),
	:global(media-player.vidstack-player:-webkit-full-screen iframe.vds-vimeo) {
		height: 100%;
	}

	:global(media-volume-slider.volume-slider .vds-slider-preview) {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 0.45rem;
		padding: 0.2rem 0.5rem;
		opacity: 0;
		transition: opacity 200ms ease-in-out;
	}

	:global(media-volume-slider.volume-slider .vds-slider-preview[data-visible]) {
		opacity: 1;
	}

	@media (max-width: 840px) {
		.controls-row {
			flex-wrap: nowrap;
			overflow-x: auto;
			overflow-y: hidden;
			align-items: center;
		}

		.controls-group.right {
			flex: 0 0 auto;
			justify-content: flex-end;
			gap: clamp(0.45rem, 2vw, 0.9rem);
		}

		:global(media-volume-slider.volume-slider) {
			inline-size: clamp(90px, 30vw, 140px);
		}
	}

	@media (max-width: 640px) {
		.vidstack-player {
			aspect-ratio: auto;
		}

		.player-controls {
			padding: 0.65rem;
		}

		.controls-row {
			flex-wrap: nowrap;
			align-items: center;
			gap: clamp(0.5rem, 4vw, 1rem);
		}

		.controls-top {
			inset-inline: 0.65rem;
			top: 0.65rem;
		}

		.player-close-button {
			inline-size: 2.35rem;
			block-size: 2.35rem;
		}

		.controls-group.left {
			gap: 0.55rem;
		}

		.controls-group.right {
			flex: 0 0 auto;
			justify-content: flex-end;
			gap: clamp(0.45rem, 3vw, 0.75rem);
			margin-inline-start: auto;
		}

		.control-button {
			inline-size: auto;
			min-inline-size: 2.55rem;
			padding-inline: 0.6rem;
			block-size: 2.55rem;
			border-radius: 0.75rem;
		}

		.control-button .label {
			display: inline-flex;
		}

		:global(media-volume-slider.volume-slider) {
			display: none;
		}
	}
</style>
