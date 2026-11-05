/* Gemeinsame Helfer des Moduls Dokumente */
import {pad} from '../../core/util.js';
import {T, K} from '../../core/db.js';

/** Dokumentarten (liegen in der Tabelle „beleg“, neben den Bons) */
export const ART = {
  rechnung: {name: 'Rechnung', plural: 'Rechnungen', icon: '💶', status: ['entwurf', 'offen', 'bezahlt', 'storniert'], nrLabel: 'Rechnungsnr.', lager: true},
  angebot: {name: 'Angebot', plural: 'Angebote', icon: '📝', status: ['entwurf', 'offen', 'angenommen', 'abgelehnt'], nrLabel: 'Angebotsnr.'},
  lieferschein: {name: 'Lieferschein', plural: 'Lieferscheine', icon: '📦', status: ['entwurf', 'erstellt'], nrLabel: 'Lieferscheinnr.', lager: true, ohnePreise: false},
  gutschrift: {name: 'Gutschrift', plural: 'Gutschriften', icon: '↩️', status: ['entwurf', 'offen', 'erledigt'], nrLabel: 'Gutschriftnr.'}
};
export const ARTEN = Object.keys(ART);
export const STATUS = {
  entwurf: ['Entwurf', 'gray'], offen: ['offen', 'low'], bezahlt: ['bezahlt', 'ok'], storniert: ['storniert', 'out'],
  angenommen: ['angenommen', 'ok'], abgelehnt: ['abgelehnt', 'out'], erstellt: ['erstellt', 'ok'], erledigt: ['erledigt', 'ok']
};
export const statusBadge = d => { const [l, c] = STATUS[d.status] || [d.status, 'gray']; return `<span class="badge ${c}">${l}</span>`; };

export const EINHEITEN = ['Stk', 'Set', 'Paar', 'Std', 'pauschal', 'g', 'kg', 'm', 'l'];

export const DEFAULT_TEXTE = {
  rechnung: {einleitung: 'vielen Dank für Ihren Auftrag. Ich berechne Ihnen folgende Leistungen:', schluss: 'Vielen Dank für Ihr Vertrauen!'},
  angebot: {einleitung: 'vielen Dank für Ihre Anfrage. Gerne biete ich Ihnen Folgendes an:', schluss: 'Ich freue mich auf Ihren Auftrag.'},
  lieferschein: {einleitung: 'anbei erhalten Sie folgende Artikel:', schluss: ''},
  gutschrift: {einleitung: 'hiermit schreibe ich Ihnen folgende Beträge gut:', schluss: ''}
};
export const texte = art => ({...DEFAULT_TEXTE[art], ...(K.settings.docTexte[art] || {})});

/** Ausgangsdokumente (ohne Bons) */
export const docs = () => T.beleg.filter(b => ART[b.art]);
export const docById = id => T.beleg.find(b => b.id === id && ART[b.art]);

export const isoDay = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const parseDay = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
export const deDay = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };

/** Nächste fortlaufende Nummer je Art und Jahr, z. B. RE-2026-0007 (höchste bekannte + 1, auch über alle Geräte) */
export function nextNr(art, day) {
  const y = (day || isoDay(Date.now())).slice(0, 4), pre = `${K.settings.nrPrefix[art] || art.slice(0, 2).toUpperCase()}-${y}-`;
  const max = T.beleg.filter(b => b.art === art && b.nr && b.nr.startsWith(pre)).map(b => parseInt(b.nr.slice(pre.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return pre + String(max + 1).padStart(4, '0');
}

export const lineSum = p => Math.round((p.menge || 0) * (p.preis || 0));
export const docTotal = d => (d.positionen || []).reduce((a, p) => a + lineSum(p), 0);

/** Fälligkeitsdatum einer Rechnung (YYYY-MM-DD) */
export function faellig(d) {
  if (d.art !== 'rechnung') return null;
  const t = parseDay(d.datum) + (d.zielTage ?? K.settings.zahlungsziel) * 864e5; return isoDay(t);
}
export const ueberfaellig = d => d.art === 'rechnung' && d.status === 'offen' && faellig(d) < isoDay(Date.now());

/** Absenderdaten zum Zeitpunkt des Abschließens (bleiben im Dokument, auch wenn sich die Firmendaten ändern) */
export function absenderSnapshot() {
  const s = K.settings;
  return {name: s.shopName, inhaber: s.ownerName, adresse: s.address, email: s.email, telefon: s.phone, web: s.web, taxNo: s.taxNo,
    bankInhaber: s.bankInhaber, iban: s.iban, bic: s.bic, bankName: s.bankName, klein: !!s.klein, logo: s.logo};
}
export const empfLines = e => [e.firma, e.name, e.strasse, [e.plz, e.ort].filter(Boolean).join(' '), e.land && e.land !== 'Deutschland' ? e.land : ''].filter(Boolean);
export const empfLabel = e => e ? (e.firma || e.name || '—') : '—';
