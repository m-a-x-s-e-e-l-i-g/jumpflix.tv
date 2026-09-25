import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

/** Only measure public discovery pages; never send query strings or account routes. */
export function metricPage(path: string): string | null {
	const normalized = path.replace(/^\/(nl|ja)(?=\/|$)/, '') || '/';
	if (normalized === '/') return 'catalog';
	if (/^\/collections\/[^/]+$/.test(normalized)) return 'collection';
	if (/^\/movie\/[^/]+$/.test(normalized)) return 'movie';
	if (/^\/series\/[^/]+\/seasons\/\d+\/episodes\/\d+$/.test(normalized)) return 'episode';
	if (/^\/series\/[^/]+$/.test(normalized)) return 'series';
	if (/^\/people\/[^/]+$/.test(normalized)) return 'person';
	return null;
}

export function startWebVitals() {
	if (!['www.jumpflix.tv', 'jumpflix.tv'].includes(location.hostname)) return;
	const path = location.pathname;
	const pageType = metricPage(path);
	if (!pageType) return;
	const send = ({ name, value, delta, id, rating }: Metric) => {
		const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
		gtag?.('event', name, {
			value: Math.round(name === 'CLS' ? delta * 1000 : delta),
			metric_value: value,
			metric_delta: delta,
			metric_id: id,
			metric_rating: rating,
			page_type: pageType,
			page_location: location.origin + path,
			non_interaction: true
		});
	};
	onCLS(send);
	onINP(send);
	onLCP(send);
}
