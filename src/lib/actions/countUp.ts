import { browser } from '$app/environment';
import { CountUp, type CountUpOptions } from 'countup.js';

export type CountUpParams = {
	value: number;
	options?: CountUpOptions;
};

export const countUp = (node: HTMLElement, params: CountUpParams) => {
	let instance: CountUp | null = null;
	let current = params;

	const renderFinalValue = () => {
		const options = current.options ?? {};
		const decimals = options.decimalPlaces ?? 0;
		node.textContent = new Intl.NumberFormat(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
			useGrouping: options.useGrouping ?? true
		}).format(current.value);
	};

	const run = () => {
		if (!browser) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			renderFinalValue();
			return;
		}

		instance?.reset();
		instance = new CountUp(node, current.value, {
			duration: 0.9,
			startVal: 0,
			useEasing: true,
			separator: ',',
			...current.options
		});

		if (instance.error) {
			renderFinalValue();
			return;
		}

		instance.start();
	};

	run();

	return {
		update(next: CountUpParams) {
			current = next;
			run();
		},
		destroy() {
			instance?.reset();
		}
	};
};