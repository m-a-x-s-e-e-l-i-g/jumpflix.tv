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
	export let autoPlay = false;
	export let onClose: (() => void) | null = null;

	let mounted = false;
	let playerEl: MediaPlayerElement | null = null;
	let vidstackLoadPromise: Promise<void> | null = null;

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

	onDestroy(() => {
		cleanupGestures?.();
		cleanupGestures = null;
		cleanupAutoHide?.();
		cleanupAutoHide = null;
		cleanupProgressTracking?.();
		cleanupProgressTracking = null;
		cleanupPlaybackComplete?.();
		cleanupPlaybackComplete = null;
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

	let isIOSDevice = false;
	let youtubeEmbedUrl: string | null = null;
	let useYouTubeEmbedFallback = false;

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

	function isYouTubeUrl(value: string) {
		return YOUTUBE_DOMAIN.test(value);
	}

	function extractYouTubeVideoId(value: string): string | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		try {
			const url = new URL(trimmed);
			const host = url.hostname.toLowerCase();
			if (host === 'youtu.be') {
				const id = url.pathname.replace(/^\/+/, '').split('/')[0];
				return id || null;
			}
			if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
				const path = url.pathname;
				if (path === '/watch') {
					const id = url.searchParams.get('v');
					return id || null;
				}
				const embedMatch = path.match(/^\/(?:embed|shorts)\/([^/?#]+)/i);
				if (embedMatch) return embedMatch[1] || null;
			}
		} catch {
			// ignore
		}
		return null;
	}

	function buildYouTubeEmbedUrl(value: string, shouldAutoplay: boolean): string | null {
		if (!isYouTubeUrl(value)) return null;
		const videoId = extractYouTubeVideoId(value);
		if (!videoId) return null;
		const params = new URLSearchParams();
		params.set('playsinline', '1');
		params.set('rel', '0');
		params.set('modestbranding', '1');
		params.set('iv_load_policy', '3');
		if (shouldAutoplay) params.set('autoplay', '1');
		return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
	}

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

	$: youtubeEmbedUrl = resolvedSrc ? buildYouTubeEmbedUrl(resolvedSrc, autoPlay) : null;
	$: useYouTubeEmbedFallback = !!(
		mounted &&
		browser &&
		isIOSDevice &&
		resolvedSrc &&
		youtubeEmbedUrl
	);

	$: if (mounted && browser && !useYouTubeEmbedFallback) {
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
	$: shouldRender = mounted && browser && !!resolvedSrc;

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
		{#if useYouTubeEmbedFallback}
			<div class="youtube-fallback" data-youtube-fallback>
				{#if typeof onClose === 'function'}
					<div class="controls-top">
						<div class="controls-group top">
							<button
								type="button"
								class="player-close-button"
								aria-label="Close player"
								on:click={onClose}
							>
								<span class="icon" aria-hidden="true"><XIcon /></span>
							</button>
						</div>
					</div>
				{/if}
				<iframe
					class="youtube-iframe"
					src={youtubeEmbedUrl ?? undefined}
					title={playerTitle ?? 'YouTube player'}
					allow="autoplay; encrypted-media; picture-in-picture"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
				></iframe>
			</div>
		{:else}
			<media-player
				bind:this={playerEl}
				class="vidstack-player"
				src={resolvedSrc}
				title={playerTitle}
				poster={resolvedPoster}
				playsInline
				crossOrigin="anonymous"
				autoPlay
			>
				<media-provider data-no-controls></media-provider>

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
									on:click={onClose}
								>
									<span class="icon" aria-hidden="true"><XIcon /></span>
								</button>
							</media-controls-group>
						</div>
					{/if}
					<div class="controls-surface">
						<media-controls-group class="controls-group scrub">
							<media-time-slider
								class="time-slider"
								aria-label={title ? `Scrub through ${title}` : 'Scrub through video'}
							>
								<div class="slider-track" aria-hidden="true">
									<div class="slider-track-progress"></div>
									<div class="slider-track-fill"></div>
								</div>
								<div class="slider-thumb" aria-hidden="true"></div>
								<media-slider-preview class="slider-preview">
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

								<media-fullscreen-button class="control-button" aria-label="Toggle fullscreen">
									<span class="icon icon-enter"><Maximize2Icon /></span>
									<span class="icon icon-exit"><Minimize2Icon /></span>
								</media-fullscreen-button>
							</media-controls-group>
						</div>
					</div>
				</media-controls>
			</media-player>
		{/if}
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

	.youtube-fallback {
		inline-size: 100%;
		block-size: 100%;
		background: #000;
		position: relative;
	}

	.youtube-iframe {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		border: 0;
		display: block;
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

	.controls-row {
		display: flex;
		justify-content: space-between;
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
	}

	.time-slider .slider-track-fill,
	.volume-slider .slider-track-fill {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		inline-size: var(--slider-fill, 0%);
		background: linear-gradient(90deg, #60a5fa 0%, #c084fc 100%);
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
		opacity: 0;
		transition: opacity 200ms ease-in-out;
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
	:global(div.vds-blocker) {
		height: 100vh;
		pointer-events: auto !important;
	}

	:global(iframe.vds-vimeo) {
		height: initial;
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
			align-items: flex-start;
		}

		.controls-group.right {
			flex: 1 1 100%;
			justify-content: flex-start;
			gap: clamp(0.5rem, 2vw, 0.9rem);
		}

		:global(media-volume-slider.volume-slider) {
			inline-size: clamp(90px, 30vw, 140px);
		}
	}

	@media (max-width: 640px) {
		.vidstack-player {
			aspect-ratio: 16 / 9;
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
