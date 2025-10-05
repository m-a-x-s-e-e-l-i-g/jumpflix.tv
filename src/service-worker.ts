/// <reference lib="webworker" />
// SvelteKit Service Worker for precaching and faster reloads
// Strategies:
// - Precache build + static files (cache-first)
// - Runtime cache images/icons with stale-while-revalidate
// - Navigation: network-first with offline fallback to root when unavailable

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const APP_CACHE = `app-${version}`;
const STATIC_CACHE = `static-${version}`;
const IMAGE_CACHE = 'images-v1';

// Everything we know at build time
const PRECACHE_URLS = new Set<string>([...build, ...files, ...prerendered]);

self.addEventListener('install', (event) => {
	// Skip waiting so new SW activates immediately
	self.skipWaiting();
	event.waitUntil(
		(async () => {
			const cache = await caches.open(APP_CACHE);
			// Best-effort add all precache entries; ignore individual failures
			await cache.addAll(Array.from(PRECACHE_URLS));
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Enable navigation preload when available for faster SSR responses
			try {
				const reg = self.registration as any;
				if (reg && typeof reg.navigationPreload?.enable === 'function') {
					await reg.navigationPreload.enable();
				}
			} catch {}

			// Cleanup old caches
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((k) => ![APP_CACHE, STATIC_CACHE, IMAGE_CACHE].includes(k))
					.map((k) => caches.delete(k))
			);

			await self.clients.claim();
		})()
	);
});

function isSameOrigin(url: URL) {
	return url.origin === self.location.origin;
}

function isStaticAsset(url: URL) {
	// SvelteKit build assets live under /_app and everything from /files is copied verbatim
	return url.pathname.startsWith('/_app/') || PRECACHE_URLS.has(url.pathname);
}

function isRuntimeImage(url: URL) {
	if (!isSameOrigin(url)) return false;
	// Cache site images and icons aggressively
	return (
		url.pathname.startsWith('/images/') ||
		url.pathname.startsWith('/icons/') ||
		url.pathname.endsWith('.webp') ||
		url.pathname.endsWith('.png') ||
		url.pathname.endsWith('.jpg') ||
		url.pathname.endsWith('.jpeg') ||
		url.pathname.endsWith('.svg')
	);
}

// Stale-while-revalidate helper
async function staleWhileRevalidate(cacheName: string, request: Request): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const networkPromise = fetch(request)
		.then((response) => {
			// Only cache successful, basic/opaque responses
			if (response && (response.ok || response.type === 'opaque')) {
				cache.put(request, response.clone()).catch(() => {});
			}
			return response;
		})
		.catch(() => undefined as unknown as Response);

	return cached ?? (await networkPromise) ?? new Response(null, { status: 504 });
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);

	// Only handle GET
	if (req.method !== 'GET') return;

	// Static precached assets -> cache-first
	if (isStaticAsset(url)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(STATIC_CACHE);
				const cached = await cache.match(req);
				if (cached) return cached;
				const res = await fetch(req);
				if (res && res.ok) await cache.put(req, res.clone());
				return res;
			})()
		);
		return;
	}

	// Runtime images/icons -> SWR
	if (isRuntimeImage(url)) {
		event.respondWith(staleWhileRevalidate(IMAGE_CACHE, req));
		return;
	}

	// Navigations -> network-first with offline fallback
	if (req.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					// Use navigation preload if available
					const anyEvent = event as unknown as { preloadResponse?: Promise<Response | undefined> };
					const preload = anyEvent.preloadResponse ? await anyEvent.preloadResponse : undefined;
					if (preload) return preload;

					const res = await fetch(req);
					if (res) return res;
				} catch {}
				// Fallback to cached root (SPA shell)
				const cache = await caches.open(APP_CACHE);
				return (
					(await cache.match('/')) ||
					new Response('Offline', { status: 503, statusText: 'Offline' })
				);
			})()
		);
		return;
	}
});
