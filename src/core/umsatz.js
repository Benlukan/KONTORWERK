/* ═══════════════ UMSATZ & KLEINUNTERNEHMER-GRENZEN (§ 19 UStG) ═══════════════
 * Seit 2025: Vorjahr höchstens 25.000 €, laufendes Jahr höchstens 100.000 € (netto).
 * Wird die 100.000-€-Grenze im laufenden Jahr überschritten, endet die Befreiung sofort.
 */
import {T, K} from './db.js';

export const GRENZE_VORJAHR = 2500000;   // Cent
export const GRENZE_LAUFEND = 10000000;  // Cent
export const WARN_AB = 0.8;
const UMSATZ_ARTEN = new Set(['bon', 'rechnung']);

export function umsatzJahr(y) {
  let inApp = 0;
  T.beleg.forEach(b => {
    if (!UMSATZ_ARTEN.has(b.art) || b.storno) return;
    if (new Date(b.ts).getFullYear() === y) inApp += b.total || 0;
  });
  const extra = K.settings.umsatzExtra[y] || 0;
  return {inApp, extra, total: inApp + extra};
}

/** Stufe für die Anzeige: ok | warn | danger */
export const stufe = (wert, grenze) => wert > grenze ? 'danger' : wert >= grenze * WARN_AB ? 'warn' : 'ok';
