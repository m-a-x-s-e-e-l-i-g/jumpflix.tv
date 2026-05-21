import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		csrf: {
			// OAuth token exchanges from external clients may omit or vary Origin.
			// We keep endpoint-aware CSRF checks in src/hooks.server.ts instead.
			checkOrigin: false,
			trustedOrigins: ['https://chatgpt.com', 'https://chat.openai.com']
		}
	}
};

export default config;
