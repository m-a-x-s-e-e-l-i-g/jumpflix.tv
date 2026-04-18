<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import PlayIcon from 'lucide-svelte/icons/play';
	import PauseIcon from 'lucide-svelte/icons/pause';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import SkipForwardIcon from 'lucide-svelte/icons/skip-forward';
	import VolumeXIcon from 'lucide-svelte/icons/volume-x';
	import Volume2Icon from 'lucide-svelte/icons/volume-2';
	import Maximize2Icon from 'lucide-svelte/icons/maximize-2';
	import Minimize2Icon from 'lucide-svelte/icons/minimize-2';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import XIcon from 'lucide-svelte/icons/x';
	import AirplayIcon from 'lucide-svelte/icons/airplay';
	import SpotChapterSuggestionDialog from '$lib/tv/SpotChapterSuggestionDialog.svelte';
	import { getPublicProviderLinkSource, resolveInlinePlaybackSource } from '$lib/tv/playback-source';
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
	export let onSkipNext: (() => void) | null = null;
	export let showSeekControls = true;
	export let enableSeekGestures = true;
	export let showSpotSuggestion = true;
	export let preservePlayerInstance = false;
	export let cornerBadge:
		| {
				eyebrow: string;
				title: string;
				poster?: string | null;
				siteLabel?: string;
		  }
		| null = null;

	let mounted = false;
	let playerEl: MediaPlayerElement | null = null;
	let playbackKey: string | null = null;
	let spotChaptersTrackSrc: string | null = null;
	let spotChaptersTrackEl: HTMLTrackElement | null = null;
	let spotChaptersRefreshToken = 0;
	let spotChaptersRetryCount = 0;
	let spotChaptersRetryKey: string | null = null;
	let spotCountryCodesById = new Map<string, string[]>();
	let spotCountryLookupKey: string | null = null;
	let spotCountryLookupToken = 0;
	let nowPlayingTrackLabel: string | null = null;
	let nowPlayingSpotLabel: string | null = null;
	let nowPlayingTrackHref: string | null = null;
	let nowPlayingSpotHref: string | null = null;
	let nowPlayingSpotCountryCode: string | null = null;
	type TrackStartEntry = { startSeconds: number; label: string; href: string | null };
	let sortedTracks: TrackStartEntry[] = [];
	let disableTrackPill = false;
	let cleanupNowPlaying: (() => void) | null = null;

	type SpotCountry = { code?: string | null; name?: string | null };
	type SpotChapterPayload = {
		spotId?: string | null;
		spot?: {
			countries?: SpotCountry[] | null;
		} | null;
	};

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

	async function loadSpotCountryCodes() {
		if (!browser || !mediaId || !mediaType || (mediaType === 'series' && !playbackKey)) {
			spotCountryCodesById = new Map();
			spotCountryLookupKey = null;
			return;
		}

		const requestKey = `${mediaId}:${mediaType}:${playbackKey ?? ''}`;
		spotCountryLookupKey = requestKey;
		const token = ++spotCountryLookupToken;

		try {
			const url = new URL('/api/spot-chapters', window.location.origin);
			url.searchParams.set('mediaId', String(mediaId));
			url.searchParams.set('mediaType', mediaType);
			if (playbackKey) url.searchParams.set('playbackKey', playbackKey);

			const res = await fetch(url.toString(), { cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error((data as any)?.error || 'Failed to load spot chapter countries');
			if (token !== spotCountryLookupToken || spotCountryLookupKey !== requestKey) return;

			const nextMap = new Map<string, string[]>();
			for (const chapter of Array.isArray(data?.chapters) ? (data.chapters as SpotChapterPayload[]) : []) {
				const spotId = typeof chapter?.spotId === 'string' ? chapter.spotId.trim() : '';
				if (!spotId) continue;
				const codes = Array.from(
					new Set(
						(chapter?.spot?.countries ?? [])
							.map((country) => String(country?.code ?? '').trim().toUpperCase())
							.filter((code) => /^[A-Z]{2}$/.test(code))
					)
				);
				if (codes.length) nextMap.set(spotId, codes);
			}

			spotCountryCodesById = nextMap;
		} catch {
			if (token !== spotCountryLookupToken || spotCountryLookupKey !== requestKey) return;
			spotCountryCodesById = new Map();
		}
	}

	$: if (browser && mediaId && mediaType && (mediaType === 'movie' || playbackKey)) {
		void loadSpotCountryCodes();
	} else {
		spotCountryCodesById = new Map();
		spotCountryLookupKey = null;
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

	function getTrackHref(track: VideoTrack): string | null {
		const direct = String(track?.song?.spotifyUrl ?? '').trim();
		if (direct) return direct;
		const id = String(track?.song?.spotifyTrackId ?? '').trim();
		if (id) return `https://open.spotify.com/track/${encodeURIComponent(id)}`;
		return null;
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
				const href = getTrackHref(t);
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
			const nextSpotCountryCode = nextSpotId ? spotCountryCodesById.get(nextSpotId)?.[0] ?? null : null;
			if (nextSpotLabel !== nowPlayingSpotLabel) nowPlayingSpotLabel = nextSpotLabel;
			if (nextSpotHref !== nowPlayingSpotHref) nowPlayingSpotHref = nextSpotHref;
			if (nextSpotCountryCode !== nowPlayingSpotCountryCode) nowPlayingSpotCountryCode = nextSpotCountryCode;
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
	$: nowPlayingSpotCountryCode = activeSpotSpotId ? spotCountryCodesById.get(activeSpotSpotId)?.[0] ?? null : null;
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

	function seekBySeconds(player: MediaPlayerElement, deltaSeconds: number) {
		const currentTime = Number(player.currentTime);
		if (!Number.isFinite(currentTime)) return;
		const duration = Number(player.duration);
		const nextTime = currentTime + deltaSeconds;
		const clampedTime =
			Number.isFinite(duration) && duration > 0
				? Math.min(Math.max(0, nextTime), duration)
				: Math.max(0, nextTime);
		try {
			player.currentTime = clampedTime;
		} catch {}
	}

	function clearTouchSkipFeedback() {
		if (touchSkipFeedbackTimer !== null) {
			clearTimeout(touchSkipFeedbackTimer);
			touchSkipFeedbackTimer = null;
		}
		touchSkipFeedbackVisible = false;
	}

	function showTouchSkipFeedback(deltaSeconds: number) {
		clearTouchSkipFeedback();
		touchSkipFeedbackDirection = deltaSeconds < 0 ? 'backward' : 'forward';
		touchSkipFeedbackSeconds = Math.abs(deltaSeconds);
		touchSkipFeedbackVisible = true;
		touchSkipFeedbackNonce += 1;
		touchSkipFeedbackTimer = setTimeout(() => {
			touchSkipFeedbackTimer = null;
			touchSkipFeedbackVisible = false;
		}, 700);
	}
	let vidstackLoadPromise: Promise<void> | null = null;
	let vidstackReady = false;

	type RemoteControl = {
		setTarget?: (target: EventTarget | null) => void;
		setPlayer?: (player: MediaPlayerElement | null) => void;
		togglePaused?: (trigger?: Event) => void;
		toggleFullscreen?: (target?: string, trigger?: Event) => void;
		changeVolume?: (volume: number, trigger?: Event) => void;
		changePlaybackRate?: (rate: number, trigger?: Event) => void;
		changeQuality?: (index: number, trigger?: Event) => void;
		requestAutoQuality?: (trigger?: Event) => void;
		play?: (trigger?: Event) => void;
		pause?: (trigger?: Event) => void;
		enterFullscreen?: (target?: string, trigger?: Event) => void;
		exitFullscreen?: (target?: string, trigger?: Event) => void;
	} & Record<string, unknown>;

	type SettingsQualityOption = {
		key: string;
		index: number;
		value: string;
		label: string;
		bitrateHint: string | null;
		sortValue: number;
		selected: boolean;
	};

	const DOUBLE_CLICK_DELAY = 220;
	const TOUCH_DOUBLE_TAP_DELAY = 320;
	const SKIP_SEEK_SECONDS = 5;
	const TOUCH_DOUBLE_TAP_SIDE_RATIO = 1 / 3;
	const LONG_PRESS_DELAY = 350;
	const SLOW_MOTION_RATE = 0.3;
	const CONTROLS_HIDE_DELAY = 2000;
	const SPEED_RAMP_DURATION = 250; // ms - duration for speed transition
	const SPEED_RAMP_RATE_TOLERANCE = 0.01; // minimum rate difference to trigger ramping

	let cleanupGestures: (() => void) | null = null;
	let cleanupAutoHide: (() => void) | null = null;
	let cleanupProgressTracking: (() => void) | null = null;
	let cleanupPlaybackComplete: (() => void) | null = null;
	let cleanupProviderParams: (() => void) | null = null;
	let cleanupYouTubeGateState: (() => void) | null = null;
	let cleanupSettingsMenuState: (() => void) | null = null;
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
	const MIN_VOLUME = 0;
	const FULL_VOLUME = 1;
	const WHEEL_VOLUME_DIVISOR = 1200;
	const MAX_WHEEL_VOLUME_DELTA = 0.12;
	const VOLUME_TOLERANCE = 1e-3;

	let isMobileViewport = false;
	let hasTouchInput = false;
	let mobileQuery: MediaQueryList | null = null;
	let cleanupMobileQuery: (() => void) | null = null;
	let controlsJustShown = false;
	let isLongPressSlowMotionActive = false;
	let speedRampAnimationId: number | null = null;
	let touchSkipFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
	let touchSkipFeedbackVisible = false;
	let touchSkipFeedbackDirection: 'backward' | 'forward' = 'forward';
	let touchSkipFeedbackSeconds = SKIP_SEEK_SECONDS;
	let touchSkipFeedbackNonce = 0;
	let settingsQualityOptions: SettingsQualityOption[] = [];
	let settingsQualityHint = 'Auto';
	let settingsAutoQuality = true;
	let settingsCanSelectQuality = false;
	let settingsShowAirPlay = false;
	let settingsShowCast = false;
	let settingsCastActive = false;
	let settingsAirPlayActive = false;
	let settingsYouTubeQualityLevels: string[] = [];
	let settingsYouTubePlaybackQuality: string | null = null;
	let activeProviderType: string | null = null;
	let youTubeGateVisible = false;
	let youTubeGateMode: 'open' | 'login' = 'open';
	let currentYouTubePublicUrl: string | null = null;

	const YOUTUBE_GATE_ERROR_CODES = new Set([2, 5, 100, 101, 150]);

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
				import('vidstack/player/ui'),
				import('vidstack/player/layouts/default'),
				import('vidstack/icons'),
				import('vidstack/player/styles/default/theme.css'),
				import('vidstack/player/styles/default/layouts/video.css')
			]).then(() => undefined);
		}
		await vidstackLoadPromise;
		vidstackReady = true;
	}

	const VIMEO_PROVIDER_PATCHED = Symbol('jumpflix:vimeo-provider-patched');
	const HLS_PROVIDER_PATCHED = Symbol('jumpflix:hls-provider-patched');

	type YouTubeMessageInfo = {
		availableQualityLevels?: string[];
		playbackQuality?: string;
		errorCode?: number;
		videoData?: {
			errorCode?: number;
			title?: string;
			video_id?: string;
		};
	};

	type YouTubeRawMessage = {
		event?: string;
		info?: YouTubeMessageInfo | number | null;
		errorCode?: number;
		reason?: string;
		[key: string]: unknown;
	};

	function getYouTubePublicUrl(value: string | null | undefined) {
		const playbackSource = resolveInlinePlaybackSource(value, { fallback: 'direct' });
		const publicSource = getPublicProviderLinkSource(playbackSource);
		return publicSource?.kind === 'youtube' ? publicSource.url : null;
	}

	function resetYouTubeGate() {
		youTubeGateVisible = false;
		youTubeGateMode = 'open';
	}

	function showYouTubeGate(mode: 'open' | 'login' = 'open') {
		youTubeGateVisible = true;
		youTubeGateMode = mode;
	}

	function getYouTubeMessageErrorCode(message: YouTubeRawMessage): number | null {
		if (typeof message.info === 'number' && Number.isFinite(message.info)) {
			return message.info;
		}

		const info = message.info && typeof message.info === 'object' ? message.info : null;
		const directCode = typeof message.errorCode === 'number' ? message.errorCode : null;
		const infoCode = typeof info?.errorCode === 'number' ? info.errorCode : null;
		const videoDataCode = typeof info?.videoData?.errorCode === 'number' ? info.videoData.errorCode : null;

		return videoDataCode ?? infoCode ?? directCode;
	}

	function getYouTubeGateMode(message: YouTubeRawMessage): 'open' | 'login' | null {
		const errorCode = getYouTubeMessageErrorCode(message);
		if (errorCode !== null && YOUTUBE_GATE_ERROR_CODES.has(errorCode)) {
			return 'open';
		}

		let haystack = '';
		try {
			haystack = JSON.stringify(message).toLowerCase();
		} catch {
			haystack = '';
		}

		if (
			haystack.includes('sign in') ||
			haystack.includes('signin') ||
			haystack.includes('login') ||
			haystack.includes('verify your age') ||
			haystack.includes('confirm your age') ||
			haystack.includes('age-restricted') ||
			haystack.includes('age restricted') ||
			haystack.includes('unusual traffic') ||
			haystack.includes('automated queries') ||
			haystack.includes('anti bot') ||
			haystack.includes('anti-bot') ||
			haystack.includes('bot check')
		) {
			return 'login';
		}

		if (
			haystack.includes('playback on other websites has been disabled') ||
			haystack.includes('embedding disabled') ||
			haystack.includes('not available on this app') ||
			haystack.includes('not available on this device') ||
			haystack.includes('watch on youtube')
		) {
			return 'open';
		}

		if (typeof message.event === 'string' && message.event.toLowerCase() === 'onerror') {
			return 'open';
		}

		return null;
	}

	function patchVimeoProviderBackground(provider: unknown) {
		const vimeoProvider = provider as {
			type?: unknown;
			buildParams?: (() => Record<string, unknown>) | undefined;
			iframe?: HTMLIFrameElement | undefined;
			[VIMEO_PROVIDER_PATCHED]?: boolean;
		};

		if (!vimeoProvider || vimeoProvider[VIMEO_PROVIDER_PATCHED]) return;
		if (vimeoProvider.type !== 'vimeo') return;
		if (typeof vimeoProvider.buildParams !== 'function') return;

		const originalBuildParams = vimeoProvider.buildParams.bind(vimeoProvider);
		vimeoProvider.buildParams = () => {
			const params = originalBuildParams();
			return { ...params, transparent: 0 };
		};

		try {
			const iframeSrc = vimeoProvider.iframe?.getAttribute('src') ?? '';
			if (iframeSrc) {
				const url = new URL(iframeSrc);
				url.searchParams.set('transparent', '0');
				vimeoProvider.iframe?.setAttribute('src', url.toString());
			}
		} catch {
			// no-op
		}
		vimeoProvider[VIMEO_PROVIDER_PATCHED] = true;
	}

	function patchHlsProviderLibrary(provider: unknown) {
		const hlsProvider = provider as {
			type?: unknown;
			library?: unknown;
			[HLS_PROVIDER_PATCHED]?: boolean;
		};

		if (!hlsProvider || hlsProvider[HLS_PROVIDER_PATCHED]) return;
		if (hlsProvider.type !== 'hls') return;

		hlsProvider.library = () => import('hls.js');
		hlsProvider[HLS_PROVIDER_PATCHED] = true;
	}

	function resetYouTubeQualityState() {
		settingsYouTubeQualityLevels = [];
		settingsYouTubePlaybackQuality = null;
	}

	function updateYouTubeQualityState(info: YouTubeMessageInfo | undefined, player?: MediaPlayerElement) {
		if (!info) return;

		let shouldSync = false;

		if (Array.isArray(info.availableQualityLevels)) {
			const nextLevels = info.availableQualityLevels
				.filter((level): level is string => typeof level === 'string' && level.trim().length > 0)
				.filter((level, index, array) => array.indexOf(level) === index)
				.filter((level) => level !== 'unknown');

			if (nextLevels.join('|') !== settingsYouTubeQualityLevels.join('|')) {
				settingsYouTubeQualityLevels = nextLevels;
				shouldSync = true;
			}
		}

		if (typeof info.playbackQuality === 'string' && info.playbackQuality !== 'unknown') {
			if (info.playbackQuality !== settingsYouTubePlaybackQuality) {
				settingsYouTubePlaybackQuality = info.playbackQuality;
				shouldSync = true;
			}
		}

		if (shouldSync && player) {
			syncSettingsMenuState(player);
		}
	}

	function patchYouTubeProviderQuality(provider: unknown, player: MediaPlayerElement) {
		const youTubeProvider = provider as {
			type?: unknown;
			onMessage?: ((message: YouTubeRawMessage, event: MessageEvent) => void) | undefined;
			postMessage?: ((message: Record<string, unknown>, target?: string) => void) | undefined;
		};

		if (!youTubeProvider || youTubeProvider.type !== 'youtube') {
			resetYouTubeQualityState();
			resetYouTubeGate();
			return () => {};
		}

		const originalOnMessage = youTubeProvider.onMessage?.bind(youTubeProvider);
		if (originalOnMessage) {
			youTubeProvider.onMessage = (message, event) => {
				const gateMode = getYouTubeGateMode(message);
				if (gateMode) {
					showYouTubeGate(gateMode);
				}
				const info = message?.info;
				updateYouTubeQualityState(
					info && typeof info === 'object' ? (info as YouTubeMessageInfo) : undefined,
					player
				);
				return originalOnMessage(message, event);
			};
		}

		youTubeProvider.postMessage?.({ event: 'command', func: 'getAvailableQualityLevels' });
		youTubeProvider.postMessage?.({ event: 'command', func: 'getPlaybackQuality' });

		return () => {
			if (originalOnMessage) {
				youTubeProvider.onMessage = originalOnMessage;
			}
			resetYouTubeQualityState();
			resetYouTubeGate();
		};
	}

	function setupProviderParams(player: MediaPlayerElement) {
		if (!browser) return () => {};

		let cleanupYouTubePatch: (() => void) | null = null;

		const patchProvider = (provider: unknown) => {
			activeProviderType =
				typeof (provider as { type?: unknown } | null)?.type === 'string'
					? ((provider as { type?: string }).type ?? null)
					: null;
			resetYouTubeGate();
			patchVimeoProviderBackground(provider);
			patchHlsProviderLibrary(provider);
			cleanupYouTubePatch?.();
			cleanupYouTubePatch = patchYouTubeProviderQuality(provider, player);
		};

		const onProviderChange = (event: Event) => {
			const detail = (event as CustomEvent).detail as unknown;
			patchProvider(detail);
		};

		player.addEventListener('provider-change', onProviderChange as EventListener);
		const initialProvider = (player as unknown as { provider?: unknown }).provider;
		patchProvider(initialProvider);

		return () => {
			activeProviderType = null;
			cleanupYouTubePatch?.();
			player.removeEventListener('provider-change', onProviderChange as EventListener);
		};
	}

	function setupYouTubeGateState(player: MediaPlayerElement) {
		if (!browser) return () => {};

		const hideGate = () => {
			if (activeProviderType === 'youtube') {
				resetYouTubeGate();
			}
		};

		const showGate = () => {
			if (activeProviderType === 'youtube') {
				showYouTubeGate('open');
			}
		};

		player.addEventListener('playing', hideGate);
		player.addEventListener('can-play', hideGate);
		player.addEventListener('error', showGate);

		return () => {
			player.removeEventListener('playing', hideGate);
			player.removeEventListener('can-play', hideGate);
			player.removeEventListener('error', showGate);
		};
	}

	function getQualitySortValue(quality: { height?: number; width?: number; id?: string | null }) {
		if (typeof quality.height === 'number' && Number.isFinite(quality.height) && quality.height > 0) {
			return quality.height;
		}

		const normalizedId = typeof quality.id === 'string' ? quality.id.trim().toLowerCase() : '';
		const presetMap: Record<string, number> = {
			tiny: 144,
			small: 240,
			medium: 360,
			large: 480,
			hd720: 720,
			hd1080: 1080,
			highres: 1440,
			max: 2160
		};

		if (normalizedId in presetMap) {
			return presetMap[normalizedId] ?? 0;
		}

		const hdMatch = normalizedId.match(/^hd(\d+)$/);
		if (hdMatch) {
			return Number(hdMatch[1]) || 0;
		}

		if (typeof quality.width === 'number' && Number.isFinite(quality.width) && quality.width > 0) {
			return quality.width;
		}

		return 0;
	}

	function formatQualityLabel(quality: { height?: number; width?: number; id?: string | null }) {
		if (typeof quality.height === 'number' && Number.isFinite(quality.height) && quality.height > 0) {
			return `${quality.height}p`;
		}

		const normalizedId = typeof quality.id === 'string' ? quality.id.trim().toLowerCase() : '';
		const presetLabelMap: Record<string, string> = {
			tiny: '144p',
			small: '240p',
			medium: '360p',
			large: '480p',
			hd720: '720p',
			hd1080: '1080p',
			highres: 'High Res',
			max: 'Max'
		};

		if (normalizedId in presetLabelMap) {
			return presetLabelMap[normalizedId] ?? 'Auto';
		}

		const hdMatch = normalizedId.match(/^hd(\d+)$/);
		if (hdMatch) {
			return `${hdMatch[1]}p`;
		}

		if (typeof quality.width === 'number' && Number.isFinite(quality.width) && quality.width > 0) {
			return `${quality.width}w`;
		}
		if (normalizedId) {
			return normalizedId.replace(/[-_]+/g, ' ');
		}
		return 'Auto';
	}

	function formatQualityBitrate(bitrate: number | null | undefined) {
		if (typeof bitrate !== 'number' || !Number.isFinite(bitrate) || bitrate <= 0) return null;
		const mbps = bitrate / 1_000_000;
		if (mbps >= 1) {
			return `${mbps >= 10 ? mbps.toFixed(0) : mbps.toFixed(1)} Mbps`;
		}
		return `${Math.round(bitrate / 1000)} kbps`;
	}

	function getSettingsQualityKey(parts: Array<string | number | null | undefined>) {
		return parts
			.map((part) => (part === null || part === undefined || part === '' ? '_' : String(part)))
			.join(':');
	}

	function getYouTubeQualityOptions(levels: string[], playbackQuality: string | null) {
		return levels
			.map((level, index) => ({
				key: getSettingsQualityKey(['youtube', level, index]),
				index,
				value: level,
				label: formatQualityLabel({ id: level }),
				bitrateHint: null,
				sortValue: getQualitySortValue({ id: level }),
				selected: level === playbackQuality
			}))
			.sort((left, right) => {
				if (right.sortValue !== left.sortValue) {
					return right.sortValue - left.sortValue;
				}
				return left.label.localeCompare(right.label);
			});
	}

	function getHighestQualityIndex(player: MediaPlayerElement) {
		let bestIndex = -1;
		let bestSortValue = -1;

		for (let index = 0; index < player.qualities.length; index += 1) {
			const quality = player.qualities[index];
			if (!quality) continue;

			const sortValue = getQualitySortValue(quality);
			if (sortValue > bestSortValue) {
				bestSortValue = sortValue;
				bestIndex = index;
			}
		}

		return bestIndex;
	}

	function preferHighestQuality(player: MediaPlayerElement) {
		const statefulPlayer = player as MediaPlayerElement & {
			autoQuality?: boolean;
			canSetQuality?: boolean;
		};
		const qualities = player.qualities;
		const canSelectQualities = qualities.length > 0
			? !qualities.readonly
			: Boolean(statefulPlayer.canSetQuality);

		if (!statefulPlayer.autoQuality || !canSelectQualities) return;
		if (qualities.length <= 1) return;

		const bestIndex = getHighestQualityIndex(player);
		if (bestIndex < 0) return;

		const bestQuality = qualities[bestIndex];
		if (bestQuality?.selected) return;

		const remote = getRemote(player);
		remote?.changeQuality?.(bestIndex);
	}

	function syncSettingsMenuState(player: MediaPlayerElement) {
		const statefulPlayer = player as MediaPlayerElement & {
			canAirPlay?: boolean;
			canGoogleCast?: boolean;
			canSetQuality?: boolean;
			isAirPlayConnected?: boolean;
			isGoogleCastConnected?: boolean;
			autoQuality?: boolean;
		};

		settingsAutoQuality = Boolean(statefulPlayer.autoQuality);
		settingsShowAirPlay = Boolean(
			statefulPlayer.canAirPlay || statefulPlayer.isAirPlayConnected
		);
		settingsShowCast = Boolean(
			statefulPlayer.canGoogleCast || statefulPlayer.isGoogleCastConnected
		);
		settingsAirPlayActive = Boolean(statefulPlayer.isAirPlayConnected);
		settingsCastActive = Boolean(statefulPlayer.isGoogleCastConnected);
		settingsCanSelectQuality = player.qualities.length > 0
			? !player.qualities.readonly
			: Boolean(statefulPlayer.canSetQuality);

		const qualities: SettingsQualityOption[] = [];
		for (let index = 0; index < player.qualities.length; index += 1) {
			const quality = player.qualities[index];
			if (!quality) continue;
			const fallbackValue = getSettingsQualityKey([
				quality.id,
				quality.height,
				quality.bitrate,
				index
			]);
			qualities.push({
				key: getSettingsQualityKey([
					'hls-or-native',
					quality.id,
					quality.height,
					quality.bitrate,
					index
				]),
				index,
				value:
					typeof quality.id === 'string' && quality.id.length > 0
						? quality.id
						: fallbackValue,
				label: formatQualityLabel(quality),
				bitrateHint: formatQualityBitrate(quality.bitrate),
				sortValue: getQualitySortValue(quality),
				selected: Boolean(quality.selected),
			});
		}

		qualities
			.sort((left, right) => {
				if (right.sortValue !== left.sortValue) {
					return right.sortValue - left.sortValue;
				}
				return left.label.localeCompare(right.label);
			});

		const fallbackYouTubeQualities = getYouTubeQualityOptions(
			settingsYouTubeQualityLevels,
			settingsYouTubePlaybackQuality
		);
		const resolvedQualities = qualities.length > 0 ? qualities : fallbackYouTubeQualities;
		if (qualities.length === 0 && fallbackYouTubeQualities.length > 0) {
			settingsCanSelectQuality = false;
		}

		settingsQualityOptions = resolvedQualities;
		const selectedQuality = resolvedQualities.find((quality) => quality.selected) ?? null;
		settingsQualityHint = qualities.length > 0 && settingsAutoQuality
			? selectedQuality?.label
				? `Auto (${selectedQuality.label})`
				: 'Auto'
			: selectedQuality?.label ?? 'Auto';
	}

	function setupSettingsMenuState(player: MediaPlayerElement) {
		if (!browser) return () => {};

		const sync = () => {
			preferHighestQuality(player);
			syncSettingsMenuState(player);
		};

		const qualities = player.qualities;
		player.addEventListener('provider-change', sync);
		player.addEventListener('can-play', sync);
		player.addEventListener('qualities-change', sync);
		player.addEventListener('quality-change', sync);
		player.addEventListener('remote-playback-change', sync);
		qualities.addEventListener('add', sync as EventListener);
		qualities.addEventListener('remove', sync as EventListener);
		qualities.addEventListener('change', sync as EventListener);
		qualities.addEventListener('auto-change', sync as EventListener);
		qualities.addEventListener('readonly-change', sync as EventListener);
		sync();

		return () => {
			player.removeEventListener('provider-change', sync);
			player.removeEventListener('can-play', sync);
			player.removeEventListener('qualities-change', sync);
			player.removeEventListener('quality-change', sync);
			player.removeEventListener('remote-playback-change', sync);
			qualities.removeEventListener('add', sync as EventListener);
			qualities.removeEventListener('remove', sync as EventListener);
			qualities.removeEventListener('change', sync as EventListener);
			qualities.removeEventListener('auto-change', sync as EventListener);
			qualities.removeEventListener('readonly-change', sync as EventListener);
		};
	}

	async function requestAirPlay(event?: Event) {
		if (!playerEl) return;
		try {
			await playerEl.requestAirPlay(event);
		} catch {
			// no-op
		}
	}

	async function requestGoogleCast(event?: Event) {
		if (!playerEl || !settingsShowCast) return;
		try {
			await playerEl.requestGoogleCast(event);
		} catch {
			// no-op
		}
	}

	function selectQualityOption(index: number, event?: Event) {
		if (!playerEl) return;
		if (!settingsCanSelectQuality) return;
		const provider = (playerEl as unknown as {
			provider?: {
				type?: string;
				postMessage?: (message: Record<string, unknown>, target?: string) => void;
			};
		}).provider;

		if (provider?.type === 'youtube' && playerEl.qualities.length === 0) {
			const option = settingsQualityOptions.find((quality) => quality.index === index);
			if (!option) return;

			provider.postMessage?.({
				event: 'command',
				func: 'setPlaybackQuality',
				args: [option.value]
			});
			settingsYouTubePlaybackQuality = option.value;
			syncSettingsMenuState(playerEl);
			return;
		}

		const remote = getRemote(playerEl);
		remote?.changeQuality?.(index < 0 ? -1 : index, event);
		syncSettingsMenuState(playerEl);
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
		cleanupProviderParams?.();
		cleanupProviderParams = setupProviderParams(playerEl);
	} else if (!browser || !playerEl) {
		cleanupProviderParams?.();
		cleanupProviderParams = null;
	}

	$: if (browser && playerEl) {
		cleanupYouTubeGateState?.();
		cleanupYouTubeGateState = setupYouTubeGateState(playerEl);
	} else if (!browser || !playerEl) {
		cleanupYouTubeGateState?.();
		cleanupYouTubeGateState = null;
		resetYouTubeGate();
	}

	$: if (browser && playerEl) {
		cleanupSettingsMenuState?.();
		cleanupSettingsMenuState = setupSettingsMenuState(playerEl);
	} else if (!browser || !playerEl) {
		cleanupSettingsMenuState?.();
		cleanupSettingsMenuState = null;
		settingsQualityOptions = [];
		settingsQualityHint = 'Auto';
		settingsAutoQuality = true;
		settingsCanSelectQuality = false;
		settingsShowAirPlay = false;
		settingsShowCast = false;
		settingsCastActive = false;
		settingsAirPlayActive = false;
		resetYouTubeQualityState();
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
		clearTouchSkipFeedback();
		cleanupSpotChaptersTrackEvents?.();
		cleanupSpotChaptersTrackEvents = null;
		cleanupNowPlaying?.();
		cleanupNowPlaying = null;
		cleanupSettingsMenuState?.();
		cleanupSettingsMenuState = null;
		cleanupProviderParams?.();
		cleanupProviderParams = null;
		cleanupYouTubeGateState?.();
		cleanupYouTubeGateState = null;
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

		// Add click handler to the provider area so direct video/HLS sources behave like embeds.
		const provider = player.querySelector('media-provider');
		let providerClickHandler: ((event: Event) => void) | null = null;
		if (provider) {
			providerClickHandler = (event: Event) => {
				event.stopPropagation();
				if (lastPointerType === 'touch') {
					return;
				}
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
		let lastPointerType: string | null = null;
		let lastPointerClientX = 0;
		let touchTapTimer: number | null = null;
		let pendingTouchSeekDelta = 0;
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

		const clearTouchTapTimer = () => {
			if (touchTapTimer !== null) {
				clearTimeout(touchTapTimer);
				touchTapTimer = null;
			}
			pendingTouchSeekDelta = 0;
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

		const getTouchDoubleTapSeekDelta = (event: MouseEvent) => {
			if (!enableSeekGestures) return 0;
			if (lastPointerType !== 'touch') return 0;
			const bounds = player.getBoundingClientRect();
			if (bounds.width <= 0) return 0;
			const clientX = Number.isFinite(lastPointerClientX) ? lastPointerClientX : event.clientX;
			const relativeX = clientX - bounds.left;
			if (relativeX <= bounds.width * TOUCH_DOUBLE_TAP_SIDE_RATIO) {
				return -SKIP_SEEK_SECONDS;
			}
			if (relativeX >= bounds.width * (1 - TOUCH_DOUBLE_TAP_SIDE_RATIO)) {
				return SKIP_SEEK_SECONDS;
			}
			return 0;
		};

		const onClick = (event: MouseEvent) => {
			if (!isPrimaryClick(event) || !shouldHandle(event)) return;
			if (lastPointerType === 'touch') return;

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
				const touchSeekDelta = getTouchDoubleTapSeekDelta(event);
				if (touchSeekDelta !== 0) {
					seekBySeconds(player, touchSeekDelta);
					return;
				}
				if (lastPointerType !== 'touch') {
					toggleFullscreen(player, resolveRemote());
				}
			}
		};

		const onDblClick = (event: MouseEvent) => {
			if (!isPrimaryClick(event) || !shouldHandle(event)) return;
			if (lastPointerType === 'touch') return;

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
			lastPointerType = event.pointerType || null;
			lastPointerClientX = event.clientX;
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
			const wasLongPress = longPressActive;
			finishLongPress();
			if (wasLongPress || !shouldHandle(event) || event.pointerType !== 'touch') return;

			const touchSeekDelta = getTouchDoubleTapSeekDelta(event as unknown as MouseEvent);
			if (touchTapTimer !== null) {
				const previousTouchSeekDelta = pendingTouchSeekDelta;
				clearTouchTapTimer();
				if (touchSeekDelta !== 0 && touchSeekDelta === previousTouchSeekDelta) {
					seekBySeconds(player, touchSeekDelta);
					showTouchSkipFeedback(touchSeekDelta);
				}
				return;
			}

			pendingTouchSeekDelta = touchSeekDelta;
			touchTapTimer = window.setTimeout(() => {
				touchTapTimer = null;
				pendingTouchSeekDelta = 0;
				if (isMobileViewport && controlsJustShown) {
					controlsJustShown = false;
					return;
				}
				togglePlayback(player, resolveRemote());
			}, TOUCH_DOUBLE_TAP_DELAY);
		};

		const onPointerCancel = (event: PointerEvent) => {
			if (activePointerId === null || event.pointerId !== activePointerId) return;
			activePointerId = null;
			clearTouchTapTimer();
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

		const onWheel = (event: WheelEvent) => {
			if (event.defaultPrevented || event.ctrlKey) return;

			event.preventDefault();
			showControls();

			if (isEventFromControls(event)) {
				return;
			}

			adjustVolumeFromWheel(player, resolveRemote(), event);
		};

		player.addEventListener('click', onClick);
		player.addEventListener('dblclick', onDblClick);
		player.addEventListener('pointerdown', onPointerDown);
		player.addEventListener('pointerup', onPointerUp);
		player.addEventListener('pointercancel', onPointerCancel);
		player.addEventListener('pointerleave', onPointerLeave);
		player.addEventListener('wheel', onWheel, { passive: false });
		doc.addEventListener('keydown', onSpaceKeyDown, true);
		doc.addEventListener('keyup', onSpaceKeyUp, true);

		return () => {
			clearClickTimer();
			clearTouchTapTimer();
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
			player.removeEventListener('wheel', onWheel);
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

	function isEventFromControls(event: MouseEvent | PointerEvent | WheelEvent) {
		const path = event.composedPath();
		for (const node of path) {
			if (!(node instanceof HTMLElement)) continue;

			if (node.dataset.jumpflixGestureIgnore === 'true') {
				return true;
			}

			const tagName = node.tagName;
			if (
				tagName === 'MEDIA-CONTROLS-GROUP' ||
				tagName === 'MEDIA-MENU' ||
				tagName === 'MEDIA-MENU-BUTTON' ||
				tagName === 'MEDIA-MENU-ITEMS' ||
				tagName === 'MEDIA-MENU-ITEM' ||
				tagName === 'MEDIA-QUALITY-RADIO-GROUP' ||
				tagName === 'MEDIA-RADIO' ||
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

	function getVolumeState(player: MediaPlayerElement) {
		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		const withState = player as unknown as {
			state?: { volume?: number; muted?: boolean };
			volume?: number;
			muted?: boolean;
		};

		const stateVolume = withState.state?.volume;
		if (typeof stateVolume === 'number' && !Number.isNaN(stateVolume)) {
			return {
				volume: Math.max(MIN_VOLUME, Math.min(FULL_VOLUME, stateVolume)),
				muted: Boolean(withState.state?.muted ?? withState.muted ?? mediaEl?.muted)
			};
		}

		const propVolume = withState.volume;
		if (typeof propVolume === 'number' && !Number.isNaN(propVolume)) {
			return {
				volume: Math.max(MIN_VOLUME, Math.min(FULL_VOLUME, propVolume)),
				muted: Boolean(withState.muted ?? mediaEl?.muted)
			};
		}

		return {
			volume: Math.max(MIN_VOLUME, Math.min(FULL_VOLUME, mediaEl?.volume ?? FULL_VOLUME)),
			muted: Boolean(mediaEl?.muted)
		};
	}

	function setVolume(player: MediaPlayerElement, remote: RemoteControl | null, volume: number, trigger?: Event) {
		const nextVolume = Math.max(MIN_VOLUME, Math.min(FULL_VOLUME, volume));
		const shouldMute = nextVolume <= VOLUME_TOLERANCE;
		const withVolume = player as unknown as { volume?: number; muted?: boolean };

		remote?.changeVolume?.(nextVolume, trigger);

		if (typeof withVolume.volume === 'number') {
			withVolume.volume = nextVolume;
		}
		if (typeof withVolume.muted === 'boolean') {
			withVolume.muted = shouldMute;
		}

		const mediaEl = player.querySelector('video, audio') as HTMLMediaElement | null;
		if (mediaEl) {
			mediaEl.volume = nextVolume;
			mediaEl.muted = shouldMute;
		}
	}

	function normalizeWheelDelta(event: WheelEvent) {
		if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
			return event.deltaY * 16;
		}
		if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			return event.deltaY * 160;
		}
		return event.deltaY;
	}

	function adjustVolumeFromWheel(
		player: MediaPlayerElement,
		remote: RemoteControl | null,
		event: WheelEvent
	) {
		const delta = normalizeWheelDelta(event);
		if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;

		const { volume, muted } = getVolumeState(player);
		const baseVolume = muted && volume <= VOLUME_TOLERANCE ? MIN_VOLUME : volume;
		const volumeDelta = Math.max(
			-MAX_WHEEL_VOLUME_DELTA,
			Math.min(MAX_WHEEL_VOLUME_DELTA, -delta / WHEEL_VOLUME_DIVISOR)
		);
		if (Math.abs(volumeDelta) < VOLUME_TOLERANCE) return;

		setVolume(player, remote, baseVolume + volumeDelta, event);
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
	const HLS_SHORT = /^hls\/([^\s]+.*)$/i;
	const YOUTUBE_DOMAIN =
		/^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
	const VIMEO_DOMAIN = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com/i;
	const HAS_PROTOCOL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;
	const HLS_TYPE = 'application/x-mpegurl' as const;

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

	function detectTouchInput() {
		if (!browser || typeof window === 'undefined') return false;
		try {
			const maxTouchPoints =
				(navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
			const hasCoarsePointer =
				window.matchMedia('(pointer: coarse)').matches ||
				window.matchMedia('(any-pointer: coarse)').matches;
			return hasCoarsePointer || maxTouchPoints > 0 || 'ontouchstart' in window;
		} catch {
			return false;
		}
	}

	$: effectiveAutoPlay = !!autoPlay && !isIOSDevice;

	onMount(() => {
		mounted = true;
		isIOSDevice = detectIOSDevice();
		hasTouchInput = detectTouchInput();

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
			try {
				return new URL(ensureProtocol(trimmed)).toString();
			} catch {
				return ensureProtocol(trimmed);
			}
		}
		const [idPart, queryPart] = trimmed.split('?');
		const videoId = idPart.replace(/^\/+/u, '').trim();
		if (!videoId) return undefined;
		try {
			const params = queryPart ? new URLSearchParams(queryPart) : null;
			const query = params?.toString() ?? '';
			return `https://player.vimeo.com/video/${encodeURIComponent(videoId)}${query ? `?${query}` : ''}`;
		} catch {
			return `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`;
		}
	}

	// Accept short-hand provider prefixes and return full URLs Vidstack can recognise.
	type PlayerSource = string | { src: string; type: typeof HLS_TYPE };

	function normalizeSource(raw: string | null): PlayerSource | undefined {
		if (!raw) return undefined;
		const trimmed = raw.trim();
		if (!trimmed) return undefined;

		const hlsMatch = trimmed.match(HLS_SHORT);
		if (hlsMatch) {
			const hlsSrc = hlsMatch[1]?.trim();
			return hlsSrc ? { src: hlsSrc, type: HLS_TYPE } : undefined;
		}

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

		if (/\.m3u8(?:$|[?#])/i.test(trimmed)) {
			return { src: trimmed, type: HLS_TYPE };
		}

		return trimmed;
	}

	$: resolvedSrc = normalizeSource(src);
	$: resolvedSrcKey =
		typeof resolvedSrc === 'string' ? resolvedSrc : resolvedSrc?.src ? `${resolvedSrc.src}:${resolvedSrc.type}` : '';
	$: resolvedPoster = poster ?? undefined;
	$: playerTitle = title ?? undefined;
	$: currentYouTubePublicUrl = getYouTubePublicUrl(src);
	$: shouldRender = mounted && browser && !!resolvedSrc && vidstackReady;
	$: renderKey = preservePlayerInstance ? 'stable-player' : `${keySeed}:${resolvedSrcKey}`;

	// Reset resume state when content changes
	$: if (keySeed) {
		flushPendingProgressSnapshot();
		lastProgressUpdate = 0;
		hasResumed = false;
		isSeeking = false;
		resetYouTubeGate();
	}
</script>

{#if shouldRender}
	{#key renderKey}
			<media-player
				bind:this={playerEl}
				class="vidstack-player"
				src={resolvedSrc}
				title={playerTitle}
				poster={resolvedPoster}
				preferNativeHLS={false}
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

				{#if enableSeekGestures && touchSkipFeedbackVisible}
					{#key touchSkipFeedbackNonce}
						<div class="touch-skip-feedback-layer" aria-hidden="true">
							<div
								class="touch-skip-feedback"
								class:touch-skip-feedback--backward={touchSkipFeedbackDirection === 'backward'}
								class:touch-skip-feedback--forward={touchSkipFeedbackDirection === 'forward'}
							>
								<div class="touch-skip-feedback-icon-strip">
									{#if touchSkipFeedbackDirection === 'backward'}
										<ChevronLeftIcon />
										<ChevronLeftIcon />
									{:else}
										<ChevronRightIcon />
										<ChevronRightIcon />
									{/if}
								</div>
								<span class="touch-skip-feedback-label"
									>{touchSkipFeedbackDirection === 'backward' ? '-' : '+'}{touchSkipFeedbackSeconds}s</span
								>
							</div>
						</div>
					{/key}
				{/if}

				{#if cornerBadge}
					<div class="player-corner-badge" aria-live="polite" data-jumpflix-gesture-ignore="true">
						{#if cornerBadge.poster}
							<img class="player-corner-badge__poster" src={cornerBadge.poster} alt="" />
						{/if}
						<div class="player-corner-badge__copy">
							<p class="player-corner-badge__eyebrow">{cornerBadge.eyebrow}</p>
							<h2 class="player-corner-badge__title">{cornerBadge.title}</h2>
							<div class="player-corner-badge__site">
								<img src="/icons/apple-touch-icon.png" alt="JUMPFLIX" class="player-corner-badge__logo" />
								<span>{cornerBadge.siteLabel ?? 'on jumpflix.tv'}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if youTubeGateVisible}
					<div
						class="youtube-fallback-gate"
						role="dialog"
						aria-live="assertive"
						aria-label={m.tv_youtubeGateDialogLabel()}
					>
						<div class="youtube-fallback-card" data-jumpflix-gesture-ignore="true">
							<p class="youtube-fallback-eyebrow">{m.tv_youtubeGateEyebrow()}</p>
							<h2 class="youtube-fallback-title">
								{#if youTubeGateMode === 'login'}
									{m.tv_youtubeGateTitleLogin()}
								{:else}
									{m.tv_youtubeGateTitleOpen()}
								{/if}
							</h2>
							<p class="youtube-fallback-copy">
								{#if youTubeGateMode === 'login'}
									{m.tv_youtubeGateCopyLogin()}
								{:else}
									{m.tv_youtubeGateCopyOpen()}
								{/if}
							</p>
							<div class="youtube-fallback-actions">
								{#if currentYouTubePublicUrl}
									<a
										class="youtube-fallback-primary"
										href={currentYouTubePublicUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{m.tv_openOnYouTube()}
									</a>
								{/if}
								{#if typeof onClose === 'function'}
									<button
										type="button"
										class="youtube-fallback-secondary"
										on:click={onClose}
									>
										{m.tv_close()}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				{#if nowPlayingTrackLabel || nowPlayingSpotLabel}
					<div class="now-pills" aria-live="polite">
						{#if nowPlayingTrackLabel}
								{#if nowPlayingTrackHref}
									<a
										class="now-pill now-pill-track"
										href={nowPlayingTrackHref}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={m.tv_openInSpotifyAria({ label: nowPlayingTrackLabel })}
										title={m.tv_openInSpotify()}
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
								{:else}
									<div
										class="now-pill now-pill-track-unlinked"
										aria-label={m.tv_trackNoSpotifyLinkAria({ label: nowPlayingTrackLabel })}
										title={m.tv_trackNoSpotifyLink()}
									>
										<span class="now-pill-text">{nowPlayingTrackLabel}</span>
									</div>
								{/if}
						{/if}
						{#if nowPlayingSpotLabel}
							<a
								class="now-pill now-pill-spot"
								href={nowPlayingSpotHref || '#'}
								target={nowPlayingSpotHref ? '_blank' : undefined}
								rel={nowPlayingSpotHref ? 'noopener noreferrer' : undefined}
								aria-label={m.tv_openOnParkourSpotAria({ label: nowPlayingSpotLabel })}
								aria-disabled={nowPlayingSpotHref ? undefined : 'true'}
								title={m.tv_openOnParkourSpot()}
								data-disabled={nowPlayingSpotHref ? undefined : 'true'}
								on:click={(e) => {
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
								{#if nowPlayingSpotCountryCode}
									<span class="now-pill-code">{nowPlayingSpotCountryCode}</span>
								{/if}
							</a>
						{/if}
					</div>
				{/if}

				<media-controls
					class="player-controls"
					data-jumpflix-gesture-ignore="true"
					data-hidden={controlsVisible && !youTubeGateVisible ? undefined : ''}
					bind:this={controlsEl}
				>
					{#if typeof onClose === 'function'}
						<div class="controls-top">
							<media-controls-group class="controls-group top">
								<button
									type="button"
									class="player-close-button"
									aria-label={m.tv_closePlayer()}
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
								class="time-slider vds-time-slider vds-slider"
								aria-label={title ? m.tv_scrubThroughTitle({ title }) : m.tv_scrubThroughVideo()}
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
								<media-play-button class="control-button" aria-label={m.tv_togglePlayback()}>
									<span class="icon icon-play"><PlayIcon /></span>
									<span class="icon icon-pause"><PauseIcon /></span>
									<span class="icon icon-replay"><RotateCcwIcon /></span>
								</media-play-button>


								{#if showSeekControls && !hasTouchInput}
									<media-seek-button
										class="control-button"
										seconds={-SKIP_SEEK_SECONDS}
										aria-label={m.tv_jumpBackSeconds({ seconds: SKIP_SEEK_SECONDS })}
									>
										<span class="label">-{SKIP_SEEK_SECONDS}s</span>
									</media-seek-button>

									<media-seek-button
										class="control-button"
										seconds={SKIP_SEEK_SECONDS}
										aria-label={m.tv_jumpForwardSeconds({ seconds: SKIP_SEEK_SECONDS })}
									>
										<span class="label">+{SKIP_SEEK_SECONDS}s</span>
									</media-seek-button>
								{/if}

								{#if typeof onSkipNext === 'function'}
									<button
										type="button"
										class="control-button control-button-skip-next"
										aria-label={m.tv_skipNextVideo()}
										data-jumpflix-gesture-ignore="true"
										on:click={onSkipNext}
									>
										<span class="icon"><SkipForwardIcon /></span>
										<span class="label">{m.tv_skip()}</span>
									</button>
								{/if}

								<div class="time-display" aria-hidden="true">
									<media-time type="current" class="time-value"></media-time>
									<span class="time-divider">/</span>
									<media-time type="duration" class="time-value"></media-time>
								</div>
							</media-controls-group>

							<media-controls-group class="controls-group right">
								{#if !isMobileViewport}
									<media-mute-button class="control-button" aria-label={m.tv_toggleMute()}>
										<span class="icon icon-muted"><VolumeXIcon /></span>
										<span class="icon icon-unmuted"><Volume2Icon /></span>
									</media-mute-button>

									<media-volume-slider class="volume-slider" aria-label={m.tv_adjustVolume()}>
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

								<media-menu
									class="player-settings-menu vds-menu"
									data-jumpflix-gesture-ignore="true"
								>
									<media-menu-button
										class="control-button vds-menu-button"
										aria-label={m.tv_playerSettings()}
										data-jumpflix-gesture-ignore="true"
									>
										<span class="icon"><SettingsIcon /></span>
									</media-menu-button>

									<media-menu-items
										class="vds-menu-items player-settings-menu-items"
										placement="top end"
										data-jumpflix-gesture-ignore="true"
									>
										{#if settingsQualityOptions.length > 0}
											<media-menu class="vds-menu player-settings-submenu">
												<media-menu-button
													class="vds-menu-item player-settings-submenu-button"
													aria-label={m.tv_videoQuality()}
													data-jumpflix-gesture-ignore="true"
												>
														<span class="vds-menu-item-label">{m.tv_quality()}</span>
													<span class="vds-menu-item-hint">{settingsQualityHint}</span>
													<ChevronRightIcon class="vds-menu-open-icon" />
													<ChevronLeftIcon class="vds-menu-close-icon" />
												</media-menu-button>

												<media-menu-items
													class="vds-menu-items player-settings-submenu-items"
													placement="left start"
													data-jumpflix-gesture-ignore="true"
												>
														{#if !settingsCanSelectQuality}
															<div
																class="settings-quality-note"
																data-jumpflix-gesture-ignore="true"
															>
																{m.tv_qualityManagedByProvider()}
															</div>
														{/if}
													{#each settingsQualityOptions as option (option.key)}
														<button
															type="button"
															class="vds-radio settings-quality-option"
															data-checked={option.selected ? '' : undefined}
															data-readonly={settingsCanSelectQuality ? undefined : ''}
															aria-checked={option.selected}
															role="menuitemradio"
															disabled={!settingsCanSelectQuality}
															data-jumpflix-gesture-ignore="true"
															on:click={(event) => selectQualityOption(option.index, event)}
														>
															<span class="vds-radio-label">{option.label}</span>
															{#if option.bitrateHint}
																<span class="vds-radio-hint">{option.bitrateHint}</span>
															{/if}
														</button>
													{/each}
												</media-menu-items>
											</media-menu>
										{/if}

										{#if settingsShowAirPlay}
											<button
												type="button"
												class="vds-menu-item settings-action settings-action-airplay"
												aria-label={m.tv_streamViaAirPlay()}
												data-active={settingsAirPlayActive ? '' : undefined}
												data-jumpflix-gesture-ignore="true"
												on:click={requestAirPlay}
											>
												<span class="icon"><AirplayIcon /></span>
												<span class="vds-menu-item-label">{m.tv_airplay()}</span>
											</button>
										{/if}

										{#if settingsShowCast}
											<button
												type="button"
												class="vds-menu-item settings-action settings-action-cast"
												aria-label={m.tv_castToDevice()}
												data-active={settingsCastActive ? '' : undefined}
												data-jumpflix-gesture-ignore="true"
												on:click={requestGoogleCast}
											>
												<span class="icon chromecast-icon" aria-hidden="true"></span>
												<span class="vds-menu-item-label">{m.tv_chromecast()}</span>
											</button>
										{/if}
									</media-menu-items>
								</media-menu>

								{#if showSpotSuggestion}
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
								{/if}

								<media-fullscreen-button class="control-button" aria-label={m.tv_toggleFullscreen()}>
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
		<span>{m.tv_loadingPlayer()}</span>
	</div>
{/if}

<style>
	.vidstack-player {
		inline-size: 100%;
		block-size: 100%;
		background: #000;
		position: relative;
		--player-surface: color-mix(in oklch, var(--card) 74%, transparent);
		--player-surface-strong: color-mix(in oklch, var(--card) 88%, var(--background) 12%);
		--player-surface-soft: color-mix(in oklch, var(--background) 64%, transparent);
		--player-border: color-mix(in oklch, var(--foreground) 16%, transparent);
		--player-border-strong: color-mix(in oklch, var(--foreground) 28%, transparent);
		--player-primary-soft: color-mix(in oklch, var(--primary) 18%, transparent);
		--player-primary-soft-strong: color-mix(in oklch, var(--primary) 28%, transparent);
		--player-primary-border: color-mix(in oklch, var(--primary) 46%, transparent);
		--player-primary-text: color-mix(in oklch, var(--primary-foreground) 96%, transparent);
		--player-text: color-mix(in oklch, var(--foreground) 96%, transparent);
		--player-text-muted: color-mix(in oklch, var(--muted-foreground) 88%, transparent);
		--player-shadow: 0 20px 48px -30px rgba(2, 6, 23, 0.92);
		--player-shadow-soft: 0 14px 34px -24px rgba(2, 6, 23, 0.88);
		--player-focus-ring:
			0 0 0 2px color-mix(in oklch, var(--background) 78%, transparent),
			0 0 0 4px color-mix(in oklch, var(--primary) 32%, transparent);
	}

	:global(media-player.vidstack-player) {
		background: #000 !important;
	}

	:global(media-player.vidstack-player [data-media-provider]) {
		background: #000 !important;
	}

	.player-corner-badge {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 18;
		display: flex;
		max-width: min(28rem, calc(100vw - 2rem));
		align-items: center;
		gap: 0.9rem;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 1rem;
		background: rgba(3, 7, 18, 0.72);
		backdrop-filter: blur(18px);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}

	.player-corner-badge__poster {
		width: 3.75rem;
		height: 5.25rem;
		flex: 0 0 auto;
		border-radius: 0.8rem;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.08);
	}

	.player-corner-badge__copy {
		min-width: 0;
	}

	.player-corner-badge__eyebrow {
		margin: 0 0 0.2rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(248, 250, 252, 0.68);
	}

	.player-corner-badge__title {
		margin: 0;
		font-size: clamp(1rem, 2vw, 1.2rem);
		font-weight: 700;
		line-height: 1.25;
		color: #f8fafc;
		text-wrap: balance;
	}

	.player-corner-badge__site {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.45rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: rgba(226, 232, 240, 0.88);
	}

	.player-corner-badge__logo {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 0.35rem;
		object-fit: cover;
		box-shadow: 0 6px 14px rgba(0, 0, 0, 0.28);
	}

	.control-button-skip-next {
		gap: 0.45rem;
	}

	@media (max-width: 640px) {
		.player-corner-badge {
			top: 0.75rem;
			right: 0.75rem;
			left: 0.75rem;
			max-width: none;
			padding: 0.75rem 0.85rem;
			gap: 0.75rem;
		}

		.player-corner-badge__poster {
			width: 3rem;
			height: 4.4rem;
		}
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

	:global(media-player.vidstack-player [data-media-provider] iframe.vds-vimeo) {
		background: #000;
	}

	:global(media-player.vidstack-player [data-media-provider] iframe.vds-youtube) {
		transition: height 100ms ease-in-out;
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

	.youtube-fallback-gate {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		background:
			radial-gradient(circle at top, rgba(220, 38, 38, 0.2), transparent 48%),
			rgba(2, 6, 23, 0.78);
		backdrop-filter: blur(10px);
		z-index: 12;
	}

	.youtube-fallback-card {
		width: min(100%, 34rem);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.25rem;
		border-radius: 1.25rem;
		border: 1px solid color-mix(in oklch, var(--primary) 24%, var(--foreground) 10%);
		background:
			radial-gradient(120% 110% at 12% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 62%),
			var(--player-surface-strong);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
	}

	.youtube-fallback-eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(254, 202, 202, 0.9);
	}

	.youtube-fallback-title {
		margin: 0;
		font-size: clamp(1.2rem, 2.8vw, 1.8rem);
		line-height: 1.15;
		color: #fff7ed;
		text-wrap: balance;
	}

	.youtube-fallback-copy {
		margin: 0;
		font-size: 0.96rem;
		line-height: 1.55;
		color: color-mix(in oklch, var(--foreground) 84%, transparent);
	}

	.youtube-fallback-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.15rem;
	}

	.youtube-fallback-primary,
	.youtube-fallback-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.85rem;
		padding: 0.8rem 1.1rem;
		border-radius: 0.9rem;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition:
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			background 180ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.youtube-fallback-primary {
		border: 1px solid var(--player-primary-border);
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--primary) 88%, black 12%),
			color-mix(in oklch, var(--chart-5) 72%, var(--primary) 28%)
		);
		color: var(--player-primary-text);
		box-shadow: 0 16px 38px -26px color-mix(in oklch, var(--primary) 55%, transparent);
	}

	.youtube-fallback-secondary {
		border: 1px solid var(--player-border);
		background: color-mix(in oklch, var(--background) 72%, transparent);
		color: var(--player-text);
	}

	.youtube-fallback-primary:hover,
	.youtube-fallback-primary:focus-visible,
	.youtube-fallback-secondary:hover,
	.youtube-fallback-secondary:focus-visible {
		transform: translateY(-1px);
		box-shadow: var(--player-shadow-soft);
	}

	.youtube-fallback-primary:active,
	.youtube-fallback-secondary:active {
		transform: translateY(0) scale(0.98);
	}

	.youtube-fallback-primary:focus-visible,
	.youtube-fallback-secondary:focus-visible {
		outline: none;
		box-shadow: var(--player-focus-ring), var(--player-shadow-soft);
	}

	.touch-skip-feedback-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.touch-skip-feedback {
		position: absolute;
		top: 50%;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		min-inline-size: clamp(5.5rem, 18vw, 7rem);
		padding: 0.9rem 1rem;
		border-radius: 1.35rem;
		background: color-mix(in oklch, var(--background) 78%, transparent);
		border: 1px solid var(--player-border);
		backdrop-filter: blur(10px);
		color: var(--player-text);
		transform: translateY(-50%);
		animation: touch-skip-feedback-pop 700ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.touch-skip-feedback--backward {
		left: clamp(1rem, 9vw, 5rem);
	}

	.touch-skip-feedback--forward {
		right: clamp(1rem, 9vw, 5rem);
	}

	.touch-skip-feedback-icon-strip {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		opacity: 0.92;
	}

	.touch-skip-feedback-icon-strip :global(svg) {
		inline-size: 1.35rem;
		block-size: 1.35rem;
		stroke-width: 2.35;
	}

	.touch-skip-feedback-label {
		font-size: 0.92rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@keyframes touch-skip-feedback-pop {
		0% {
			opacity: 0;
			transform: translateY(calc(-50% + 10px)) scale(0.9);
		}

		18% {
			opacity: 1;
			transform: translateY(-50%) scale(1);
		}

		78% {
			opacity: 1;
			transform: translateY(-50%) scale(1);
		}

		100% {
			opacity: 0;
			transform: translateY(calc(-50% - 6px)) scale(0.96);
		}
	}
	.player-controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		opacity: 1;
		pointer-events: auto;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
		z-index: 2;
	}

	.player-controls::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, transparent 46%, color-mix(in oklch, var(--background) 14%, transparent) 64%, color-mix(in oklch, var(--background) 68%, transparent) 100%),
			radial-gradient(120% 80% at 50% 100%, color-mix(in oklch, var(--foreground) 7%, transparent), transparent 72%);
		pointer-events: none;
		z-index: 0;
	}

	.player-controls[data-hidden] {
		opacity: 0;
		pointer-events: none;
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
		inline-size: clamp(2.75rem, 2.9vw, 3rem);
		block-size: clamp(2.75rem, 2.9vw, 3rem);
		border-radius: 999px;
		border: 1px solid var(--player-border);
		background: var(--player-surface-soft);
		color: var(--player-text);
		transition:
			background 180ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
		cursor: pointer;
		box-shadow: var(--player-shadow-soft);
		backdrop-filter: blur(14px) saturate(112%);
		-webkit-backdrop-filter: blur(14px) saturate(112%);
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
		background: linear-gradient(
			180deg,
			var(--player-primary-soft-strong),
			color-mix(in oklch, var(--card) 82%, transparent)
		);
		border-color: var(--player-primary-border);
		transform: translateY(-1px);
	}

	.player-close-button:focus-visible {
		outline: none;
		box-shadow: var(--player-focus-ring), var(--player-shadow-soft);
	}

	.player-close-button:active {
		transform: translateY(0) scale(0.98);
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
		right: max(0.75rem, env(safe-area-inset-right, 0px));
		display: flex;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0;
		max-inline-size: min(42rem, calc(100% - 5.75rem));
		pointer-events: none;
		z-index: 5;
	}

	.now-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		max-width: min(100%, 36rem);
		padding: 0.35rem 0.72rem;
		border-radius: 999px;
		border: 1px solid var(--player-border);
		background: color-mix(in oklch, var(--background) 70%, transparent);
		color: var(--player-text);
		font-size: 0.75rem;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		box-shadow: var(--player-shadow-soft);
		text-decoration: none;
		pointer-events: auto;
		cursor: pointer;
		backdrop-filter: blur(14px) saturate(112%);
		-webkit-backdrop-filter: blur(14px) saturate(112%);
		transition:
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			background 180ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.now-pill:hover,
	.now-pill:focus-visible {
		background: color-mix(in oklch, var(--card) 78%, transparent);
		border-color: var(--player-border-strong);
		transform: translateY(-1px);
	}

	.now-pill:focus-visible {
		outline: none;
		box-shadow: var(--player-focus-ring), var(--player-shadow-soft);
	}

	.now-pill:active {
		transform: translateY(0) scale(0.98);
	}

	.now-pill[data-disabled='true'] {
		opacity: 0.6;
		cursor: default;
	}

	.now-pill-track {
		border-color: color-mix(in oklch, #1db954 34%, var(--foreground) 10%);
		background: color-mix(in oklch, #1db954 14%, transparent);
		color: color-mix(in oklch, #1db954 82%, white 18%);
	}

	.now-pill-track:hover,
	.now-pill-track:focus-visible {
		background: color-mix(in oklch, #1db954 18%, transparent);
	}

	.now-pill-track-unlinked {
		border-color: color-mix(in oklch, #1db954 20%, transparent);
		background: color-mix(in oklch, #1db954 8%, transparent);
		color: color-mix(in oklch, #1db954 58%, transparent);
		cursor: default;
		pointer-events: none;
	}

	.now-pill-spot {
		border-color: color-mix(in oklch, #8ecff2 34%, var(--foreground) 10%);
		background: color-mix(in oklch, #8ecff2 14%, transparent);
		color: color-mix(in oklch, #8ecff2 82%, white 18%);
	}

	.now-pill-spot:hover,
	.now-pill-spot:focus-visible {
		background: color-mix(in oklch, #8ecff2 18%, transparent);
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

	.now-pill-code {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		min-width: 1.8rem;
		height: 1.25rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		border: 1px solid currentColor;
		background: rgba(255, 255, 255, 0.08);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		line-height: 1;
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
		inline-size: clamp(2.75rem, 3.2vw, 3rem);
		block-size: clamp(2.75rem, 3.2vw, 3rem);
		border-radius: 0.85rem;
		border: 1px solid var(--player-border);
		background: var(--player-surface-soft);
		color: var(--player-text);
		transition:
			background 180ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
		cursor: pointer;
		box-shadow: var(--player-shadow-soft);
		backdrop-filter: blur(14px) saturate(112%);
		-webkit-backdrop-filter: blur(14px) saturate(112%);
	}

	.control-button:hover,
	.control-button:focus-visible {
		background: linear-gradient(
			180deg,
			var(--player-primary-soft-strong),
			color-mix(in oklch, var(--card) 82%, transparent)
		);
		border-color: var(--player-primary-border);
		transform: translateY(-1px);
	}

	.control-button:focus-visible {
		outline: none;
		box-shadow: var(--player-focus-ring), var(--player-shadow-soft);
	}

	.control-button:active {
		transform: translateY(0) scale(0.98);
	}

	.control-button .icon {
		display: none;
		align-items: center;
		justify-content: center;
	}

	:global(media-airplay-button.control-button .icon),
	:global(media-google-cast-button.control-button .icon),
	:global(.player-settings-menu .vds-menu-button.control-button .icon),
	:global(.settings-action .icon) {
		display: inline-flex;
	}

	:global(media-google-cast-button.control-button)::before {
		content: '';
		display: inline-flex;
		inline-size: 1.35rem;
		block-size: 1.35rem;
		background-color: currentColor;
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 19l.01 0'/%3E%3Cpath d='M7 19a4 4 0 0 0 -4 -4'/%3E%3Cpath d='M11 19a8 8 0 0 0 -8 -8'/%3E%3Cpath d='M15 19h3a3 3 0 0 0 3 -3v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -2.8 2'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 19l.01 0'/%3E%3Cpath d='M7 19a4 4 0 0 0 -4 -4'/%3E%3Cpath d='M11 19a8 8 0 0 0 -8 -8'/%3E%3Cpath d='M15 19h3a3 3 0 0 0 3 -3v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -2.8 2'/%3E%3C/svg%3E") center / contain no-repeat;
	}

	:global(.settings-action-cast .chromecast-icon) {
		inline-size: 1.15rem;
		block-size: 1.15rem;
		background-color: currentColor;
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 19l.01 0'/%3E%3Cpath d='M7 19a4 4 0 0 0 -4 -4'/%3E%3Cpath d='M11 19a8 8 0 0 0 -8 -8'/%3E%3Cpath d='M15 19h3a3 3 0 0 0 3 -3v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -2.8 2'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 19l.01 0'/%3E%3Cpath d='M7 19a4 4 0 0 0 -4 -4'/%3E%3Cpath d='M11 19a8 8 0 0 0 -8 -8'/%3E%3Cpath d='M15 19h3a3 3 0 0 0 3 -3v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -2.8 2'/%3E%3C/svg%3E") center / contain no-repeat;
	}

	:global(media-airplay-button.control-button[aria-hidden='true']),
	:global(media-google-cast-button.control-button[aria-hidden='true']) {
		display: none;
	}

	:global(media-airplay-button.control-button[data-active]),
	:global(media-google-cast-button.control-button[data-active]) {
		background: linear-gradient(
			180deg,
			var(--player-primary-soft-strong),
			color-mix(in oklch, var(--card) 82%, transparent)
		);
		border-color: var(--player-primary-border);
	}

	:global(.player-settings-menu) {
		position: relative;
	}

	:global(.player-settings-menu .vds-menu-button.control-button[aria-expanded='true']) {
		background: linear-gradient(
			180deg,
			var(--player-primary-soft-strong),
			color-mix(in oklch, var(--card) 82%, transparent)
		);
		border-color: var(--player-primary-border);
	}

	:global(.player-settings-menu .player-settings-menu-items),
	:global(.player-settings-menu .player-settings-submenu-items) {
		--media-menu-bg: color-mix(in oklch, var(--card) 90%, var(--background) 10%);
		--media-menu-border: 1px solid var(--player-border);
		--media-menu-border-radius: 1rem;
		--media-menu-box-shadow: var(--player-shadow);
		--media-menu-item-hover-bg: var(--player-primary-soft);
		--media-menu-item-border-radius: 0.8rem;
		--media-menu-item-padding: 0.8rem 0.9rem;
		--media-menu-text-color: var(--player-text);
		--media-menu-hint-color: color-mix(in oklch, var(--muted-foreground) 84%, transparent);
		--media-menu-divider: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
		--media-menu-scrollbar-thumb-bg: color-mix(in oklch, var(--foreground) 20%, transparent);
		overflow-x: hidden;
		backdrop-filter: blur(18px);
	}

	:global(.player-settings-menu .player-settings-submenu-items) {
		padding-inline: 0.45rem;
	}

	:global(.player-settings-menu .player-settings-submenu-button) {
		display: flex;
		align-items: center;
		inline-size: 100%;
		gap: 0.7rem;
		font: inherit;
	}

	:global(.player-settings-menu .player-settings-submenu-button .vds-menu-item-label) {
		flex: 1 1 auto;
		min-width: 0;
		text-align: left;
	}

	:global(.player-settings-menu .player-settings-submenu-button .vds-menu-item-hint) {
		margin-left: auto;
		padding-inline-end: 0.2rem;
	}

	:global(.player-settings-menu .vds-menu-open-icon),
	:global(.player-settings-menu .vds-menu-close-icon) {
		flex: 0 0 auto;
	}

	:global(.player-settings-menu .settings-quality-option),
	:global(.player-settings-menu .settings-action) {
		appearance: none;
		-webkit-appearance: none;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		inline-size: 100%;
		box-sizing: border-box;
		padding: 0.8rem 1.15rem;
		gap: 0.7rem;
		font: inherit;
		text-align: left;
		background: transparent;
		color: inherit;
		border-radius: 0.85rem;
	}

	:global(.player-settings-menu .settings-quality-option) {
		font: inherit;
		margin: 0.1rem 0;
	}

	:global(.player-settings-menu .settings-quality-option[aria-checked='true']) {
		padding-left: 1.15rem;
	}

	:global(.player-settings-menu .settings-quality-option:disabled) {
		color: inherit;
	}

	:global(.player-settings-menu .settings-quality-note) {
		padding: 0.35rem 1.15rem 0.55rem;
		font-size: 0.76rem;
		line-height: 1.35;
		color: var(--player-text-muted);
		letter-spacing: 0.01em;
	}

	:global(.player-settings-menu .settings-quality-option .vds-radio-label),
	:global(.player-settings-menu .settings-action .vds-menu-item-label) {
		flex: 1 1 auto;
		min-width: 0;
		text-align: left;
	}

	:global(.player-settings-menu .settings-quality-option .vds-radio-hint) {
		flex: 0 0 auto;
		margin-left: auto;
		text-align: right;
	}

	:global(.player-settings-menu .settings-quality-option[data-checked]),
	:global(.player-settings-menu .settings-action-airplay[data-active]),
	:global(.player-settings-menu .settings-action-cast[data-active]) {
		background-color: var(--player-primary-soft);
	}

	:global(.player-settings-menu .settings-quality-option[data-readonly]) {
		cursor: default;
		opacity: 0.86;
	}

	:global(.player-settings-menu .settings-quality-option[data-readonly]:hover),
	:global(.player-settings-menu .settings-quality-option[data-readonly]:focus-visible) {
		background-color: transparent;
		transform: none;
	}

	:global(.player-settings-menu .settings-action),
	:global(.player-settings-menu .settings-quality-option) {
		border: 0;
		outline: none;
		transition:
			background-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(.player-settings-menu .settings-action:hover),
	:global(.player-settings-menu .settings-action:focus-visible),
	:global(.player-settings-menu .settings-quality-option:hover),
	:global(.player-settings-menu .settings-quality-option:focus-visible) {
		background-color: color-mix(in oklch, var(--primary) 16%, transparent);
	}

	:global(.player-settings-menu .settings-action:focus-visible),
	:global(.player-settings-menu .settings-quality-option:focus-visible) {
		box-shadow: inset 0 0 0 1px var(--player-primary-border);
	}

	:global(.player-settings-menu .settings-action:active),
	:global(.player-settings-menu .settings-quality-option:active) {
		transform: scale(0.99);
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
		color: var(--player-text-muted);
	}

	.time-display {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-variant-numeric: tabular-nums;
		font-size: clamp(0.85rem, 1.3vw, 1rem);
		color: var(--player-text);
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
		--media-slider-track-fill-height: var(--media-slider-track-height);
		--media-slider-track-progress-height: var(--media-slider-track-height);
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
		column-gap: 0;
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
		min-inline-size: 0;
		border-radius: 0;
		margin: 0;
		overflow: hidden;
		/* Important: do NOT set flex/width here. Vidstack sets each chapter width inline. */
	}

	/* Visible chapter separators without consuming width (no layout impact). */
	.time-slider .slider-chapter:not(:first-child)::before {
		content: '';
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		width: 1px;
		background: rgba(0, 0, 0, 0.75);
		z-index: 4;
		pointer-events: none;
	}

	/*
		Avoid cumulative “whitespace” when there are many chapters:
		- Don’t force a minimum chapter width (min-inline-size: 0)
		- Don’t round every tiny chapter segment (only the outer edges)
	*/
	.time-slider .slider-chapter .slider-track,
	.time-slider .slider-chapter .slider-track-fill,
	.time-slider .slider-chapter .slider-track-progress {
		border-radius: 0;
	}

	.time-slider .slider-chapter:first-child {
		border-top-left-radius: 999px;
		border-bottom-left-radius: 999px;
	}

	.time-slider .slider-chapter:last-child {
		border-top-right-radius: 999px;
		border-bottom-right-radius: 999px;
	}

	.time-slider .slider-chapter:first-child .slider-track,
	.time-slider .slider-chapter:first-child .slider-track-fill,
	.time-slider .slider-chapter:first-child .slider-track-progress {
		border-top-left-radius: 999px;
		border-bottom-left-radius: 999px;
	}

	.time-slider .slider-chapter:last-child .slider-track,
	.time-slider .slider-chapter:last-child .slider-track-fill,
	.time-slider .slider-chapter:last-child .slider-track-progress {
		border-top-right-radius: 999px;
		border-bottom-right-radius: 999px;
	}

	.time-slider .slider-track,
	.volume-slider .slider-track {
		position: relative;
		inline-size: 100%;
		block-size: var(--media-slider-track-height, 6px);
		background: color-mix(in oklch, var(--foreground) 18%, transparent);
		border-radius: 999px;
		overflow: hidden;
		pointer-events: none;
		top: 0;
		left: 0;
		transform: none;
	}

	.time-slider .slider-track-progress,
	.volume-slider .slider-track-progress {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		block-size: 100%;
		height: 100%;
		top: 0;
		left: 0;
		transform: none !important;
		inline-size: var(--slider-progress, 0%);
		background: color-mix(in oklch, var(--foreground) 26%, transparent);
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
		block-size: 100%;
		height: 100%;
		top: 0;
		left: 0;
		transform: none !important;
		inline-size: var(--slider-fill, 0%);
		background: linear-gradient(
			90deg,
			color-mix(in oklch, var(--primary) 84%, white 16%) 0%,
			color-mix(in oklch, var(--chart-5) 72%, white 28%) 100%
		);
		z-index: 2;
	}

	/* Vidstack sometimes sets reduced heights on fill/progress layers; force full-height. */
	.time-slider :global(.vds-slider-track-fill),
	.time-slider :global(.vds-slider-progress),
	.volume-slider :global(.vds-slider-track-fill),
	.volume-slider :global(.vds-slider-progress) {
		height: 100% !important;
		block-size: 100% !important;
		inset-block: 0 !important;
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
		background: var(--player-text);
		border: 1px solid color-mix(in oklch, var(--background) 42%, transparent);
		box-shadow: 0 0 0 6px color-mix(in oklch, var(--primary) 22%, transparent);
		transform: translate(-50%, -50%);
		inset-inline-start: var(--slider-fill, 0%);
		inset-block-start: 50%;
		pointer-events: none;
		z-index: 3;
		opacity: 0;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	:global(media-time-slider.time-slider [part='track']) {
		background: color-mix(in oklch, var(--foreground) 22%, transparent);
		height: var(--media-slider-track-height);
		border-radius: 999px;
		overflow: hidden;
	}

	:global(media-time-slider.time-slider [part='track-fill']) {
		background: linear-gradient(
			90deg,
			color-mix(in oklch, var(--primary) 84%, white 16%) 0%,
			color-mix(in oklch, var(--chart-5) 72%, white 28%) 100%
		);
		inset: 0 !important;
		top: 0 !important;
		bottom: 0 !important;
		height: 100% !important;
		block-size: 100% !important;
	}

	:global(media-time-slider.time-slider [part='track-progress']) {
		background: color-mix(in oklch, var(--foreground) 26%, transparent);
		inset: 0 !important;
		top: 0 !important;
		bottom: 0 !important;
		height: 100% !important;
		block-size: 100% !important;
	}

	:global(media-time-slider.time-slider [part='thumb']) {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		background: var(--player-text);
		border: 1px solid color-mix(in oklch, var(--background) 42%, transparent);
		box-shadow: 0 0 0 6px color-mix(in oklch, var(--primary) 22%, transparent);
		opacity: 0;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(media-time-slider.time-slider[data-pointing] [part='thumb']) {
		opacity: 1;
	}

	:global(media-slider-preview.slider-preview) {
		background: var(--player-surface-strong);
		border-radius: 0.5rem;
		border: 1px solid var(--player-border);
		padding: 0.25rem 0.6rem;
		box-shadow: var(--player-shadow-soft);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		opacity: 0;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(media-slider-preview.slider-preview [data-part='chapter-title']) {
		font-size: 0.75rem;
		line-height: 1.1;
		color: var(--player-text);
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
		--media-slider-track-fill-height: var(--media-slider-track-height);
		--media-slider-track-progress-height: var(--media-slider-track-height);
		--media-slider-thumb-size: 14px;
		--media-slider-track-bg: color-mix(in oklch, var(--foreground) 20%, transparent);
		--media-slider-track-fill-bg: linear-gradient(
			90deg,
			color-mix(in oklch, var(--chart-3) 82%, white 18%) 0%,
			color-mix(in oklch, var(--chart-5) 70%, white 30%) 100%
		);
		--media-slider-thumb-bg: var(--player-text);
		--media-slider-thumb-border: 1px solid color-mix(in oklch, var(--background) 42%, transparent);
		inline-size: clamp(110px, 12vw, 160px);
		position: relative;
	}

	:global(media-volume-slider.volume-slider .vds-slider-thumb) {
		box-shadow: 0 0 0 5px color-mix(in oklch, var(--chart-3) 24%, transparent);
		opacity: 0;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
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
		background: transparent !important;
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
		background: var(--player-surface-strong);
		border: 1px solid var(--player-border);
		border-radius: 0.45rem;
		padding: 0.2rem 0.5rem;
		opacity: 0;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.player-controls,
		.player-close-button,
		.now-pill,
		.control-button,
		.youtube-fallback-primary,
		.youtube-fallback-secondary,
		:global(.player-settings-menu .settings-action),
		:global(.player-settings-menu .settings-quality-option),
		.time-slider .slider-thumb,
		.volume-slider .slider-thumb,
		:global(media-time-slider.time-slider [part='thumb']),
		:global(media-slider-preview.slider-preview),
		:global(media-volume-slider.volume-slider .vds-slider-thumb),
		:global(media-volume-slider.volume-slider .vds-slider-preview) {
			transition: none;
		}

		.touch-skip-feedback {
			animation: none;
		}

		.player-close-button:hover,
		.player-close-button:focus-visible,
		.now-pill:hover,
		.now-pill:focus-visible,
		.control-button:hover,
		.control-button:focus-visible,
		.youtube-fallback-primary:hover,
		.youtube-fallback-primary:focus-visible,
		.youtube-fallback-secondary:hover,
		.youtube-fallback-secondary:focus-visible {
			transform: none;
		}
	}

	:global(media-volume-slider.volume-slider .vds-slider-preview[data-visible]) {
		opacity: 1;
	}

	@media (max-width: 840px) {
		.controls-row {
			flex-wrap: wrap;
			overflow: visible;
			align-items: center;
			gap: clamp(0.6rem, 1.8vw, 1rem);
		}

		.controls-group {
			margin-inline: 0;
			gap: clamp(0.5rem, 1.8vw, 0.9rem);
		}

		.controls-group.left {
			flex: 1 1 auto;
			min-width: 0;
		}

		.controls-group.right {
			flex: 1 1 auto;
			justify-content: flex-end;
			gap: clamp(0.45rem, 2vw, 0.9rem);
			min-width: 0;
		}

		:global(media-volume-slider.volume-slider) {
			inline-size: clamp(90px, 30vw, 140px);
		}
	}

	@media (max-width: 640px) {
		.vidstack-player {
			aspect-ratio: auto;
		}

		.now-pills {
			top: calc(max(0.65rem, env(safe-area-inset-top, 0px)) + 3rem);
			left: 0.65rem;
			right: 0.65rem;
			max-inline-size: calc(100% - 1.3rem);
		}

		.now-pill {
			max-width: 100%;
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
			inline-size: 2.75rem;
			block-size: 2.75rem;
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
			min-inline-size: 2.75rem;
			padding-inline: 0.6rem;
			block-size: 2.75rem;
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
