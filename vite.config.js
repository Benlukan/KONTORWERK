import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

// Baut eine einzige www/index.html (JS + CSS eingebettet) – läuft im Browser, als PWA und in der Android-App.
// Schriften, Icons, Manifest und Service Worker kommen unverändert aus public/.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {outDir: 'www', emptyOutDir: true, target: 'es2020'}
});
