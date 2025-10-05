// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Google Cast API types
	interface Window {
		cast?: any;
		chrome?: any;
		__onGCastApiAvailable?: (isAvailable: boolean) => void;
	}
}

export {};
