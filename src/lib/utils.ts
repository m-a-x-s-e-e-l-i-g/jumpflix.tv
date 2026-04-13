import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type UtmOptions = {
	source?: string;
	medium?: string;
	campaign?: string;
};

const DEFAULT_UTM: Required<UtmOptions> = {
	source: 'jumpflix.tv',
	medium: 'referral',
	campaign: 'external'
};

export function withUtm(url: string, options: UtmOptions = {}): string {
	if (!url) return url;
	const merged = { ...DEFAULT_UTM, ...options };

	const applyUtm = (parsed: URL) => {
		if (!parsed.searchParams.has('utm_source'))
			parsed.searchParams.set('utm_source', merged.source);
		if (!parsed.searchParams.has('utm_medium'))
			parsed.searchParams.set('utm_medium', merged.medium);
		if (!parsed.searchParams.has('utm_campaign'))
			parsed.searchParams.set('utm_campaign', merged.campaign);
	};

	try {
		const parsed = new URL(url);
		applyUtm(parsed);
		return parsed.toString();
	} catch {
		try {
			const parsed = new URL(url, 'https://www.jumpflix.tv');
			applyUtm(parsed);
			return parsed.toString();
		} catch {
			return url;
		}
	}
}

export function normalizeParkourSpotId(value: unknown): string | null {
	const raw = typeof value === 'string' ? value.trim() : '';
	if (!raw) return null;
	const PARKOUR_SPOT_ID_SEGMENT = /^[A-Za-z0-9_-]{8,}$/;

	const extractFromPathname = (pathname: string): string | null => {
		const parts = String(pathname ?? '')
			.split('/')
			.map((p) => p.trim())
			.filter(Boolean);
		const idx = parts.findIndex((p) => p === 'spot' || p === 'spots');
		const candidate = idx >= 0 ? parts[idx + 1] : null;
		const fallback = parts.at(-1) ?? null;
		const finalCandidate = candidate ?? fallback;
		if (!finalCandidate || !PARKOUR_SPOT_ID_SEGMENT.test(finalCandidate)) return null;
		try {
			return decodeURIComponent(finalCandidate);
		} catch {
			return finalCandidate;
		}
	};

	const extractParkourSpotUrl = (text: string): string | null => {
		const match = text.match(/(?:https?:\/\/)?(?:www\.)?parkour\.spot[^\s]*/i);
		return match?.[0] ?? null;
	};

	const parseCandidate = (candidate: string): string | null => {
		try {
			const parsed = new URL(candidate);
			if (!/(^|\.)parkour\.spot$/i.test(parsed.hostname)) return null;
			return extractFromPathname(parsed.pathname);
		} catch {
			return null;
		}
	};

	// Full URL (or protocol-relative-ish) forms.
	const rawUrl = extractParkourSpotUrl(raw) ?? raw;
	const fromRawUrl = parseCandidate(rawUrl);
	if (fromRawUrl) return fromRawUrl;

	if (rawUrl.includes('parkour.spot') && !/^https?:\/\//i.test(rawUrl)) {
		const fromSchemedUrl = parseCandidate(`https://${rawUrl.replace(/^\/\/+/, '')}`);
		if (fromSchemedUrl) return fromSchemedUrl;
	}

	// Path-ish forms: /spot(s)/<id> or .../spot(s)/<id>
	const m = raw.match(/(?:^|\/)(?:spot|spots)\/([^/?#]+)/i);
	if (m?.[1]) {
		try {
			return decodeURIComponent(m[1]);
		} catch {
			return m[1];
		}
	}

	// Assume it’s already an ID.
	return raw;
}

export function getParkourSpotUrl(spotIdOrUrl: unknown, options: UtmOptions = {}): string {
	const raw = typeof spotIdOrUrl === 'string' ? spotIdOrUrl.trim() : '';
	if (!raw) return '';

	const id = normalizeParkourSpotId(raw);
	if (id) {
		return withUtm(`https://parkour.spot/spot/${encodeURIComponent(id)}`,
			{ campaign: 'parkour.spot', ...options }
		);
	}

	// If we can’t extract an id but it’s a URL, return it with UTM.
	try {
		const parsed = new URL(raw);
		return withUtm(parsed.toString(), { campaign: 'parkour.spot', ...options });
	} catch {
		return withUtm(raw, { campaign: 'parkour.spot', ...options });
	}
}

export function getEmailLocalPart(value?: string | null): string | null {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const at = raw.indexOf('@');
	if (at <= 0) return null;
	const part = raw.slice(0, at).trim();
	return part || null;
}

export function getPublicUserName(params: {
	name?: string | null;
	email?: string | null;
}): string | null {
	const name = String(params.name ?? '').trim();
	if (name) {
		if (name.includes('@')) return getEmailLocalPart(name) ?? null;
		return name;
	}

	const email = String(params.email ?? '').trim();
	if (!email) return null;
	return getEmailLocalPart(email) ?? null;
}

export function getPublicUserNameOrFallback(
	params: { name?: string | null; email?: string | null },
	fallback: string
): string {
	return getPublicUserName(params) ?? fallback;
}

export function asTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function asSafeInt(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === 'number' ? value : Number(String(value));
	if (!Number.isFinite(n)) return null;
	const i = Math.floor(n);
	return i >= 0 ? i : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
