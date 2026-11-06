/* ═══════════════ CSV-IMPORT: gemeinsame Helfer (Bankabgleich, Etsy) ═══════════════
 * Liest UTF-8 oder Windows-1252, erkennt das Trennzeichen und versteht deutsche wie englische
 * Zahlen- und Datumsformate („1.234,56 €“, „€1,234.56“, „31.10.2026“, „10/31/26“, „October 31, 2026“).
 */

export function splitCsv(text, sep) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(x => x.trim()));
}

export function decode(buf) {
  const u = new TextDecoder('utf-8').decode(buf);
  return u.includes('�') ? new TextDecoder('windows-1252').decode(buf) : u.replace(/^﻿/, '');
}
export const readBuf = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(f); });
export const readText = async f => decode(new Uint8Array(await readBuf(f)));

/** Trennzeichen raten und Zeilen liefern (leere Zeilen entfernt) */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).slice(0, 40);
  const sep = [';', ',', '\t'].map(s => [s, lines.reduce((a, l) => a + l.split(s).length, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  return splitCsv(text, sep).filter(r => r.some(Boolean));
}

/** Betrag in Cent; NaN, wenn keiner erkennbar ist („--“, leer) */
export function parseBetrag(s) {
  if (s == null) return NaN;
  s = String(s).replace(/−/g, '-').replace(/[€$£\s ]|EUR|USD|GBP/g, '');
  if (!s || /^-+$/.test(s)) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-|-$/.test(s)) neg = true;
  s = s.replace(/^[+-]+|[+-]+$/g, '');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > ld) s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (ld > lc) s = /\.\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(/[.,]/g, '');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
  const n = Math.round(parseFloat(s) * 100);
  return isNaN(n) ? NaN : neg ? -n : n;
}

const MON = {jan: 1, feb: 2, febr: 2, mar: 3, mär: 3, maer: 3, mrz: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12};
const monNr = w => { w = w.toLowerCase().replace(/\.$/, ''); return MON[w] || MON[w.slice(0, 4)] || MON[w.slice(0, 3)] || 0; };
const iso = (y, m, d) => { y = +y; if (y < 100) y += 2000; if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };

/** Datum → YYYY-MM-DD. us: Schrägstrich-Daten als Monat/Tag/Jahr lesen (Etsy-Exporte) */
export function parseDatum(s, us) {
  s = String(s || '').trim(); if (!s) return null;
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s); if (m) return iso(m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return iso(m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) { let a = +m[1], b = +m[2]; if (!us || a > 12) [a, b] = [b, a]; return iso(m[3], a, b); }
  m = /^([A-Za-zÄÖÜäöü]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s); if (m && monNr(m[1])) return iso(m[3], monNr(m[1]), +m[2]);   // October 31, 2026
  m = /^(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]+)\.?,?\s+(\d{4})/.exec(s); if (m && monNr(m[2])) return iso(m[3], monNr(m[2]), +m[1]); // 31. Oktober 2026 / 31 Oct, 2026
  return null;
}

/** Spaltenname vereinheitlichen: klein, nur Buchstaben/Ziffern */
export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

/** Kurzer, stabiler Hash (für Dubletten und feste ids über Geräte hinweg) */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
