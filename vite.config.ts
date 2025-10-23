import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { vite as vidstack } from 'vidstack/plugins';

export default defineConfig({
	plugins: [
		tailwindcss(),
		vidstack({ include: /VideoPlayer\.svelte$/ }),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	],
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
});
