import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { vite as vidstack } from 'vidstack/plugins';

export default defineConfig(({ mode }) => ({
	plugins: [
		tailwindcss(),
		vidstack({ include: /VideoPlayer\.svelte$/ }),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	],
	resolve: {
		dedupe: ['lit', 'lit-html', '@lit/reactive-element'],
		alias: {
			// Force all lit-html imports to use the same version
			'lit-html': 'lit-html'
		}
	},
	define:
		mode === 'production'
			? {}
			: {
					// Suppress Lit dev mode warnings in development
					'globalThis.litProdMode': 'true'
				},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-lucide': ['@lucide/svelte', 'lucide-svelte'],
					'vendor-sonner': ['svelte-sonner']
				}
			}
		}
	}
}));
