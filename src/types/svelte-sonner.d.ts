declare module 'svelte-sonner' {
	import type { SvelteComponent } from 'svelte';
	export const Toaster: typeof SvelteComponent;
	export const toast: {
		success: (msg: string, opts?: any) => void;
		error: (msg: string, opts?: any) => void;
		message: (msg: string, opts?: any) => void;
	};
}
