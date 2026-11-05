// Erzeugt die Marken-Dateien als SVG (assets/branding/) – danach: python3 tools/render_brand.py
import {writeFileSync, mkdirSync} from 'node:fs';
import {appIconSvg, iconForegroundSvg, iconBackgroundSvg, moduleIcon, markSvg, GLYPHS} from '../src/core/brand.js';
const out = new URL('../assets/branding/', import.meta.url);
mkdirSync(out, {recursive: true});
const w = (n, s) => writeFileSync(new URL(n, out), s);
w('icon.svg', appIconSvg());
w('icon-full.svg', appIconSvg({rounded: false}));
w('icon-foreground.svg', iconForegroundSvg());
w('icon-background.svg', iconBackgroundSvg());
w('mark.svg', markSvg(800).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
for (const id of Object.keys(GLYPHS)) w(`modul-${id}.svg`, moduleIcon(id, 256).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
console.log('ok');
