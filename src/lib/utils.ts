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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
