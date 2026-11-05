import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {readFileSync, writeFileSync} from 'node:fs';

// Alte Android-WebViews (vor Chrome 61) führen <script type="module"> gar nicht aus.
// Deshalb wird das Bundle als klassisches Skript (IIFE) ans Ende von <body> gesetzt.
function classicScript() {
  return {
    name: 'kw-classic-script',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const f = new URL('./www/index.html', import.meta.url);
      let html = readFileSync(f, 'utf8'), code = null;
      html = html.replace(/<script type="module"[^>]*>([\s\S]*?)<\/script>/, (_, c) => { code = c; return ''; });
      if (code == null) throw new Error('kw-classic-script: Bundle-Skript nicht gefunden');
      html = html.replace('</body>', () => `<script>${code}</script>\n</body>`);
      writeFileSync(f, html);
    }
  };
}

// Baut eine einzige www/index.html (JS + CSS eingebettet) – läuft im Browser, als PWA und in der Android-App.
// Schriften, Icons, Manifest und Service Worker kommen unverändert aus public/.
const stub = new URL('./src/stubs/empty.js', import.meta.url).pathname;
export default defineConfig({
  base: './',
  // jsPDF lädt diese Pakete nur für .html()/SVG – nicht gebraucht, hält die App klein
  resolve: {alias: {html2canvas: stub, dompurify: stub, canvg: stub}},
  plugins: [viteSingleFile(), classicScript()],
  // Ziel: auch alte Android-WebViews (ab Chrome 55, z. B. Tablets mit Android 7)
  build: {
    outDir: 'www', emptyOutDir: true, target: ['es2016', 'chrome55'], cssTarget: 'chrome55',
    modulePreload: false,
    rollupOptions: {output: {format: 'iife'}}
  }
});
