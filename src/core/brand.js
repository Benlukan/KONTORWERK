/* ═══════════════ MARKE: Logo, App-Icon, Modul-Symbole (Vektor) ═══════════════
 * Nach Davids Entwurf: Haus (Kontor) über sechs farbigen Modul-Kacheln auf Nachtblau.
 * Reine Funktionen ohne DOM – werden in der App und von tools/brand.mjs (Icons, Startbild) benutzt.
 */

export const NAVY = ['#00407f', '#001436'];

/** Farbe (oben → unten) und weißes Symbol je Modul, Symbol im Raster 0–100 */
export const GLYPHS = {
  wawi: {c: ['#1683e0', '#0458bd'], g: (k) => `
    <path d="M50 16 L83 33 L50 50 L17 33 Z" fill="#fff"/>
    <path d="M17 38 L47 53 L47 86 L17 70 Z" fill="#fff"/>
    <path d="M53 53 L83 38 L83 70 L53 86 Z" fill="#fff"/>
    <path d="M33 24.5 L66 41.5 L66 52" stroke="${k}" stroke-width="6" fill="none" stroke-linejoin="round"/>
    <path d="M24 60 L24 66 M31 64 L31 70" stroke="${k}" stroke-width="3.5" stroke-linecap="round"/>`},
  dokumente: {c: ['#5bb8ea', '#2c8fd6'], g: (k) => `
    <path d="M26 14 H60 L76 30 V82 a4 4 0 0 1 -4 4 H26 a4 4 0 0 1 -4 -4 V18 a4 4 0 0 1 4 -4 Z" fill="#fff"/>
    <path d="M60 14 V30 H76" fill="#dbe9f6"/>
    <path d="M33 40 H60 M33 52 H66 M33 64 H66 M33 76 H54" stroke="${k}" stroke-width="5.5" stroke-linecap="round"/>`},
  versand: {c: ['#26b5ae', '#0f857c'], g: (k) => `
    <rect x="10" y="28" width="50" height="38" rx="5" fill="#fff"/>
    <path d="M62 38 H78 L90 52 V66 H62 Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <path d="M67 43 H76 L83 52 H67 Z" fill="${k}"/>
    <circle cx="30" cy="70" r="10" fill="#fff" stroke="${k}" stroke-width="4"/>
    <circle cx="74" cy="70" r="10" fill="#fff" stroke="${k}" stroke-width="4"/>`},
  ecommerce: {c: ['#6d45c6', '#4a2a9e'], g: () => `
    <path d="M12 24 H25 L34 62 H74 L84 36 H29" stroke="#fff" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="40" cy="77" r="7" fill="#fff"/><circle cx="69" cy="77" r="7" fill="#fff"/>`},
  produktion: {c: ['#ff9a2e', '#ee6400'], g: () => `
    <rect x="18" y="54" width="16" height="28" rx="3" fill="#fff"/>
    <rect x="42" y="38" width="16" height="44" rx="3" fill="#fff"/>
    <rect x="66" y="18" width="16" height="64" rx="3" fill="#fff"/>`},
  buchhaltung: {c: ['#fdc62a', '#f0a000'], g: (k) => coins(k, [[32, 70], [32, 57]], [[64, 66], [64, 53], [64, 40], [64, 27]], 19)},
  lohn: {c: ['#5c6573', '#3b424d'], g: (k) => `
    <circle cx="40" cy="30" r="13" fill="#fff"/>
    <path d="M14 78 C14 56 26 48 40 48 C50 48 56 52 60 56 L60 78 Z" fill="#fff"/>
    ${coins(k, [], [[72, 76], [72, 64], [72, 52]], 17)}`},
  kern: {c: ['#1c4f9c', '#0b2a63'], g: () => houseGlyph()}
};

function coins(k, left, right, rx = 15) {
  const ry = rx * 0.42;
  const one = ([cx, cy]) => `<path d="M${cx - rx} ${cy} v9 a${rx} ${ry} 0 0 0 ${2 * rx} 0 v-9" fill="#fff" stroke="${k}" stroke-width="3"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${k}" stroke-width="3"/>`;
  return [...left, ...right].map(one).join('');
}
function houseGlyph() {
  return `<path d="M18 80 V44 L50 22 L82 44 V80" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="32" y="48" width="15" height="13" rx="2" fill="#fff"/><rect x="53" y="48" width="15" height="13" rx="2" fill="#fff"/>
    <rect x="32" y="65" width="15" height="13" rx="2" fill="#fff"/><rect x="53" y="65" width="15" height="13" rx="2" fill="#fff"/>`;
}

let gid = 0;
/** Eine farbige Kachel mit Symbol als <g>, Raster 0–100 → (x, y, Größe) */
function tileG(id, x, y, size) {
  const t = GLYPHS[id], k = t.c[1], n = 'kwt' + (gid++);
  return `<g transform="translate(${x} ${y}) scale(${size / 100})">
    <defs><linearGradient id="${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c[0]}"/><stop offset="1" stop-color="${t.c[1]}"/></linearGradient></defs>
    <rect width="100" height="100" rx="20" fill="url(#${n})"/>
    <g transform="translate(10 10) scale(.8)">${t.g(k)}</g></g>`;
}

/** Modul-Symbol als eigenständiges SVG (für Listen, Kacheln) */
export function moduleIcon(id, px = 40) {
  if (!GLYPHS[id]) return '';
  return `<svg class="kw-ico" width="${px}" height="${px}" viewBox="0 0 100 100" aria-hidden="true">${tileG(id, 0, 0, 100)}</svg>`;
}

const ICON_TILES = ['wawi', 'dokumente', 'versand', 'ecommerce', 'produktion', 'buchhaltung'];
/** Haus + sechs Kacheln im Raster 1024, optional verkleinert um die Mitte (für adaptive Icons) */
function houseAndTiles(scale = 1, stroke = '#fff') {
  const S = 216, G = 18, x0 = 170, y0 = 420;
  const tiles = ICON_TILES.map((id, i) => tileG(id, x0 + (i % 3) * (S + G), y0 + Math.floor(i / 3) * (S + G), S)).join('');
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M120 870 V405 L512 160 L904 405 V870" stroke="${stroke}" stroke-width="62" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${tiles}</g>`;
}
const navyDefs = id => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY[0]}"/><stop offset="1" stop-color="${NAVY[1]}"/></linearGradient></defs>`;

/** App-Icon: abgerundetes Nachtblau-Quadrat (rounded=false → volle Fläche) */
export function appIconSvg({rounded = true, size = 1024} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${navyDefs('kwnavy')}
    <rect width="1024" height="1024" rx="${rounded ? 230 : 0}" fill="url(#kwnavy)"/>${houseAndTiles(rounded ? 0.86 : 0.78)}</svg>`;
}
/** Adaptives Android-Icon: Vordergrund (transparent, in der sicheren Zone) und Hintergrund */
export const iconForegroundSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${houseAndTiles(0.8)}</svg>`; // capacitor-assets setzt selbst 16,7 % Rand (sichere Zone)
export const iconBackgroundSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${navyDefs('kwbg')}<rect width="1024" height="1024" fill="url(#kwbg)"/></svg>`;
/** Bildmarke ohne Hintergrund für helle Flächen (Haus in Nachtblau) */
export const markSvg = (px = 40) => `<svg width="${px}" height="${px}" viewBox="70 110 884 800" aria-hidden="true">${houseAndTiles(1, NAVY[1])}</svg>`;
