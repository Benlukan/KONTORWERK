/* Gemeinsame Helfer des Moduls Warenwirtschaft & Verkauf */
import {esc, soft} from '../../core/util.js';
import {T, K, get, put} from '../../core/db.js';

export const catById = id => id ? get('kategorie', id) : undefined;
export const prodById = id => id ? get('produkt', id) : undefined;
export const sortedCats = () => [...T.kategorie].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
/** Verkäufe vor Ort (Bons) */
export const bons = () => T.beleg.filter(b => b.art === 'bon');

export function stockState(p) {
  if (!p.trackStock) return 'na';
  if (p.stock <= 0) return 'out';
  if (p.stock <= (p.minStock ?? K.settings.minDefault)) return 'low';
  return 'ok';
}
export function addMove(pid, qty, type, note, ref) {
  put('lagerbewegung', {ts: Date.now(), pid, qty, type, note: note || '', ref: ref || null});
}
export const MOVE_LBL = {sale: '🧾 Verkauf', in: '📥 Zugang', out: '📤 Abgang', inv: '📋 Inventur', storno: '↩️ Storno', init: '✨ Anfangsbestand'};

export const photosOf = p => (p.photos && p.photos.length) ? p.photos : (p.img ? [{t: p.img, f: p.imgFull || p.img}] : []);
export function thumb(p) {
  const c = catById(p.catId);
  return `<div class="li-thumb ${p.img ? 'zoomable' : ''}" ${p.img ? `data-zoom="${p.id}"` : ''} style="background:${soft(p.color || (c && c.color) || '#009EB2')}">${p.img ? `<img src="${p.img}" alt="">` : esc(p.emoji || (c && c.emoji) || '📦')}</div>`;
}
export function stockBadge(p) {
  const st = stockState(p);
  if (st === 'na') return `<span class="badge gray">∞</span>`;
  return `<span class="badge ${st}">${p.stock} ${esc(p.unit || 'Stk')}</span>`;
}
export const payLabel = s => s.pay === 'bar' ? '💶 Bar' : s.pay === 'karte' ? '💳 Karte' : '📲 ' + (s.payNote || 'Sonstiges');
export const lowCount = () => T.produkt.filter(p => p.active && ['low', 'out'].includes(stockState(p))).length;
