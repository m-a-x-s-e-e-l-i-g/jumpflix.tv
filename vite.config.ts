import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { vite as vidstack } from 'vidstack/plugins';

export default defineConfig(({ mode }) => ({
	plugins: [
		tailwindcss(),
		vidstack({ include: /VideoPlayer\.svelte$/ }),
		sveltekit({
			adapter: adapter(),
			alias: { $lib: 'src/lib' },
			preprocess: vitePreprocess(),
			csrf: {
				// OAuth clients can use external origins. Site forms are checked in hooks.server.ts.
				trustedOrigins: ['*']
			},
			version: { pollInterval: 0 }
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
			urlPatterns: [
				{
					pattern: '/',
					localized: [
						['nl', '/nl'],
						['ja', '/ja'],
						['en', '/']
					]
				},
				{
					pattern: '/collections/:slug',
					localized: [
						['nl', '/nl/collections/:slug'],
						['ja', '/ja/collections/:slug'],
						['en', '/collections/:slug']
					]
				},
				{
					pattern: '/:path(.*)?',
					localized: [
						['en', '/:path(.*)?'],
						['nl', '/:path(.*)?'],
						['ja', '/:path(.*)?']
					]
				}
			]
		})
	],
	resolve: {
		dedupe: ['lit', 'lit-html', '@lit/reactive-element'],
		alias: {
			// Force all lit-html imports to use the same version
			'lit-html': 'lit-html'
		}
	},
	server: {
		allowedHosts: ['desktop-hucdjae.tailcb2363.ts.net']
	},
	define:
		mode === 'production'
			? {}
			: {
					// Suppress Lit dev mode warnings in development
					'globalThis.litProdMode': 'true'
				},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [{ name: 'vendor-sonner', test: /[\\/]node_modules[\\/]svelte-sonner[\\/]/ }]
				}
			}
		}
	}
}));
