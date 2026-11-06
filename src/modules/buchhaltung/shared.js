/* ═══════════════ BUCHHALTUNG: Kategorien, Konten, automatische Buchungen ═══════════════
 * EÜR nach dem Zufluss-/Abflussprinzip: gebucht wird, wenn Geld fließt.
 * Quellen, aus denen Buchungen automatisch entstehen (Feld „quelle“):
 *   bon:<id>         Verkauf vor Ort (Einnahme am Verkaufstag; Storno → 0)
 *   zahlung:<id>     bezahlte Rechnung (Einnahme am Zahltag)
 *   erstattung:<id>  ausgezahlte Gutschrift (mindert die Einnahmen am Erledigt-Tag)
 *   archiv:<id>      Beleg aus dem Belegarchiv mit Betrag (Ausgabe/Einnahme am Belegdatum)
 *   bank:<id>        aus dem Bankabgleich direkt gebucht
 *   etsy:<id>        Zeile der Etsy-Monatsabrechnung (Verkauf, Erstattung, Gebühr, Werbung, Versand, Auszahlung)
 *   etsyg:<id>       Gebühren, die Etsy in derselben Zeile wie ein Verkauf ausweist
 * Art „umbuchung“: Geld wandert zwischen zwei eigenen Konten (konto → nach), z. B. Etsy-Auszahlung auf die Bank.
 * Sie zählt nicht zur EÜR.
 * Festgeschriebene Buchungen werden nie geändert: Abweichungen werden als Korrekturbuchung nachgetragen.
 */
import {T, K, put, remove} from '../../core/db.js';
import {isoDay} from '../dokumente/shared.js';

/** Kategorien mit Vorschlag für das Sachkonto (SKR03) – mit der Steuerberatung abstimmen */
export const KAT = {
  umsatz: {name: 'Umsatzerlöse (Kleinunternehmer)', typ: 'einnahme', konto: '8195'},
  sonst_ein: {name: 'Sonstige Einnahmen', typ: 'einnahme', konto: '2700'},
  material: {name: 'Material, Roh- und Hilfsstoffe', typ: 'ausgabe', konto: '3000'},
  waren: {name: 'Wareneinkauf', typ: 'ausgabe', konto: '3200'},
  porto: {name: 'Porto & Versand', typ: 'ausgabe', konto: '4910'},
  werbung: {name: 'Werbekosten', typ: 'ausgabe', konto: '4600'},
  gebuehren: {name: 'Gebühren & Geldverkehr', typ: 'ausgabe', konto: '4970'},
  buero: {name: 'Büro & Software', typ: 'ausgabe', konto: '4930'},
  fahrt: {name: 'Fahrtkosten', typ: 'ausgabe', konto: '4670'},
  gwg: {name: 'Werkzeug & geringwertige Wirtschaftsgüter', typ: 'ausgabe', konto: '4855'},
  sonstige: {name: 'Sonstige Betriebsausgaben', typ: 'ausgabe', konto: '4900'},
  entnahme: {name: 'Privatentnahme', typ: 'entnahme', konto: '1800'},
  einlage: {name: 'Privateinlage', typ: 'einlage', konto: '1890'}
};
export const KAT_EIN = Object.keys(KAT).filter(k => KAT[k].typ === 'einnahme');
export const KAT_AUS = Object.keys(KAT).filter(k => KAT[k].typ === 'ausgabe');
/** Zahlungskonten */
export const ZK = {kasse: {name: 'Kasse', konto: '1000'}, bank: {name: 'Bank', konto: '1200'}, paypal: {name: 'PayPal', konto: '1210'}, etsy: {name: 'Etsy-Guthaben', konto: '1360'}};
export const zkName = k => (ZK[k] || {}).name || k || '';
export const sachkonto = key => K.settings.konten[key] || (KAT[key] || ZK[key] || {}).konto || '';

/** Kategorien des Belegarchivs → Buchungskategorie */
export const ARCHIV_KAT = {
  'Material & Rohstoffe': 'material', 'Wareneinkauf': 'waren', 'Verpackung': 'material', 'Versandkosten': 'porto',
  'Gebühren (Etsy, PayPal …)': 'gebuehren', 'Werbung': 'werbung', 'Büro & Software': 'buero', 'Fahrtkosten': 'fahrt',
  'Werkzeug & Geräte': 'gwg', 'Sonstige Ausgabe': 'sonstige', 'Einnahme': 'umsatz'
};
const zkVonZahlart = z => /bar/i.test(z || '') ? 'kasse' : /paypal/i.test(z || '') ? 'paypal' : 'bank';
const zkVonBon = s => s.pay === 'bar' ? 'kasse' : /paypal/i.test(s.payNote || '') ? 'paypal' : 'bank';

/* ─── Etsy-Monatsabrechnung ─── */
const n_ = s => String(s || '').toLowerCase();
/** Was eine Zeile der Etsy-Abrechnung buchhalterisch ist (ohne Benutzer-Vorgabe) */
export function etsyArt(p) {
  const t = n_(p.typ), ti = n_(p.titel + ' ' + p.info);
  if (/deposit|auszahlung|einzahlung auf|überweisung|ueberweisung/.test(t) || /sent to your bank|auf dein bankkonto|an dein bankkonto/.test(ti)) return 'auszahlung';
  if (/^(sale|verkauf)/.test(t)) return 'verkauf';
  if (/refund|erstattung/.test(t)) return 'erstattung';
  if (/tax|steuer|vat|mwst|ust/.test(t)) return /buyer|käufer|kaeufer|paid by|collected|eingezogen|sales tax/.test(ti) && !/seller|verkäufer|verkaeufer|fee|gebühr|gebuehr/.test(ti) ? 'kaeufersteuer' : 'gebuehren';
  if (/marketing|werbung|ads/.test(t) || /etsy ads|offsite|anzeigen/.test(ti)) return 'werbung';
  if (/shipping|versand|postage|porto/.test(t) || /shipping label|versandetikett/.test(ti)) return 'porto';
  if (/^(payment|zahlung)/.test(t) && (p.netto || 0) > 0) return 'einzahlung';
  return 'gebuehren';
}
export const ETSY_ART = {
  verkauf: 'Verkauf → Einnahme', erstattung: 'Erstattung → mindert Einnahmen', auszahlung: 'Auszahlung → Umbuchung auf die Bank',
  einzahlung: 'Zahlung an Etsy → Umbuchung von der Bank', kaeufersteuer: 'Steuer des Käufers → nicht gebucht', ignorieren: 'nicht buchen'
};
export const etsyArtName = a => ETSY_ART[a] || (KAT[a] ? KAT[a].name + (KAT[a].typ === 'ausgabe' ? ' → Ausgabe' : ' → Einnahme') : a);
const postenNetto = p => p.netto != null ? p.netto : (p.betrag || 0) + (p.gebuehr || 0);
/** Buchungen, die aus einer Abrechnungszeile entstehen: [[quelle, Buchung], …] */
export function postenBuchungen(p) {
  const art = p.override || etsyArt(p), shop = (K.settings.shops.find(x => x.id === p.shopId) || {}).name || 'Etsy';
  const text = `${shop}: ${p.titel || p.typ}`.slice(0, 80), beleg = (p.info || '').slice(0, 36), base = {datum: p.datum, konto: 'etsy', text, beleg};
  const net = postenNetto(p);
  if (art === 'kaeufersteuer' || art === 'ignorieren') return [];
  if (art === 'verkauf' || art === 'erstattung') {
    const out = [['etsy:' + p.id, {...base, art: 'einnahme', kategorie: 'umsatz', betrag: p.betrag != null ? p.betrag : net}]];
    if (p.betrag != null && p.gebuehr) out.push(['etsyg:' + p.id, {...base, art: 'ausgabe', kategorie: 'gebuehren', betrag: -p.gebuehr, text: (shop + ': Gebühren ' + (p.titel || '')).slice(0, 80)}]);
    return out;
  }
  if (art === 'auszahlung') return [['etsy:' + p.id, {...base, art: 'umbuchung', kategorie: '', konto: 'etsy', nach: 'bank', betrag: Math.abs(net || p.betrag || 0), text: `${shop}: Auszahlung auf die Bank`}]];
  if (art === 'einzahlung') return [['etsy:' + p.id, {...base, art: 'umbuchung', kategorie: '', konto: 'bank', nach: 'etsy', betrag: Math.abs(net), text: `${shop}: Zahlung an Etsy`}]];
  const k = KAT[art] ? art : 'gebuehren';
  return [['etsy:' + p.id, {...base, art: KAT[k].typ, kategorie: k, betrag: KAT[k].typ === 'einnahme' ? net : -net}]];
}

/** Gewünschter Stand je Quelle (null/0 = keine Buchung) */
function soll() {
  const out = new Map();
  for (const b of T.beleg) {
    if (b.art === 'bon') {
      out.set('bon:' + b.id, {datum: isoDay(b.ts), betrag: b.storno ? 0 : b.total, art: 'einnahme', kategorie: 'umsatz', konto: zkVonBon(b), text: `Bon #${b.no}`, beleg: `Bon ${b.no}`});
    } else if (b.art === 'rechnung' && b.festgeschrieben) {
      out.set('zahlung:' + b.id, {datum: b.bezahltAm, betrag: b.bezahltAm ? b.total : 0, art: 'einnahme', kategorie: 'umsatz', konto: zkVonZahlart(b.zahlart), text: `Zahlung ${b.nr} ${b.empf ? (b.empf.firma || b.empf.name) : ''}`.trim(), beleg: b.nr});
    } else if (b.art === 'gutschrift' && b.festgeschrieben && b.erstattung) {
      out.set('erstattung:' + b.id, {datum: b.erledigtAm, betrag: b.erledigtAm ? -b.total : 0, art: 'einnahme', kategorie: 'umsatz', konto: zkVonZahlart(b.zahlart), text: `Erstattung ${b.nr}`, beleg: b.nr});
    }
  }
  for (const d of T.dokument) {
    const kat = ARCHIV_KAT[d.kategorie];
    if (!kat) continue;
    out.set('archiv:' + d.id, {datum: d.datum, betrag: d.betrag || 0, art: KAT[kat].typ, kategorie: kat, konto: d.konto || 'bank', text: [d.partner, d.titel].filter(Boolean).join(' – ') || 'Beleg', beleg: d.titel || ''});
  }
  for (const p of T.shopposten) postenBuchungen(p).forEach(([q, w]) => out.set(q, w));
  return out;
}

/** Buchungen aus den Quellen nachziehen (idempotent). Liefert die Anzahl geänderter Buchungen. */
export function syncBuchungen() {
  const want = soll(), byQ = new Map();
  T.buchung.forEach(b => { if (b.quelle && !b.quelle.startsWith('bank:') && b.art !== 'entnahme' && b.art !== 'einlage') (byQ.get(b.quelle) || byQ.set(b.quelle, []).get(b.quelle)).push(b); });
  let n = 0;
  // Quellen, die es nicht mehr gibt (gelöscht), auf 0 bringen
  byQ.forEach((_, q) => { if (!want.has(q)) want.set(q, {betrag: 0}); });
  want.forEach((w, q) => {
    const ist = byQ.get(q) || [], fest = ist.filter(b => b.festgeschrieben), lose = ist.filter(b => !b.festgeschrieben);
    const ziel = (w.betrag || 0) - fest.reduce((a, b) => a + b.betrag, 0);
    if (!lose.length) {
      if (!ziel || !w.datum && !fest.length) return;
      const tpl = fest[0] || w;
      put('buchung', {datum: fest.length ? isoDay(Date.now()) : w.datum, betrag: ziel, art: tpl.art || w.art, kategorie: tpl.kategorie || w.kategorie, konto: w.konto || tpl.konto, nach: w.nach || tpl.nach || null, text: (fest.length ? 'Korrektur: ' : '') + (w.text || tpl.text), beleg: w.beleg || tpl.beleg || '', quelle: q, auto: true, korrektur: !!fest.length});
      n++; return;
    }
    const [keep, ...extra] = lose;
    extra.forEach(b => { remove('buchung', b.id); n++; });
    if (!ziel) { remove('buchung', keep.id); n++; return; }
    const upd = fest.length ? {betrag: ziel} : {betrag: ziel, datum: w.datum, konto: w.konto, nach: w.nach || null, kategorie: w.kategorie, art: w.art, text: w.text, beleg: w.beleg || ''};
    if (Object.keys(upd).some(k => (keep[k] ?? null) !== (upd[k] ?? null))) { Object.assign(keep, upd); put('buchung', keep); n++; }
  });
  return n;
}

/* ─── Auswertungen ─── */
export const inJahr = (b, y) => (b.datum || '').startsWith(String(y));
/** Vorzeichen für Kontostände (Sicht des Kontos „konto“): Einnahme/Einlage +, Ausgabe/Entnahme/Umbuchung weg − */
export const wirkung = b => (b.art === 'einnahme' || b.art === 'einlage' ? 1 : -1) * b.betrag;
export function kontostand(zk, bis) {
  const start = K.settings.kontoStart[zk] || 0, ab = K.settings.kontoStartDatum || '';
  return start + T.buchung.filter(b => (b.konto === zk || b.nach === zk) && (!ab || b.datum >= ab) && (!bis || b.datum <= bis))
    .reduce((a, b) => a + (b.konto === zk ? wirkung(b) : 0) + (b.art === 'umbuchung' && b.nach === zk ? b.betrag : 0), 0);
}
/** EÜR je Kategorie für einen Zeitraum [von, bis] (YYYY-MM-DD) */
export function euer(von, bis) {
  const r = {ein: {}, aus: {}, einSum: 0, ausSum: 0, entnahmen: 0, einlagen: 0};
  T.buchung.forEach(b => {
    if (b.datum < von || b.datum > bis) return;
    if (b.art === 'einnahme') { r.ein[b.kategorie] = (r.ein[b.kategorie] || 0) + b.betrag; r.einSum += b.betrag; }
    else if (b.art === 'ausgabe') { r.aus[b.kategorie] = (r.aus[b.kategorie] || 0) + b.betrag; r.ausSum += b.betrag; }
    else if (b.art === 'entnahme') r.entnahmen += b.betrag;
    else if (b.art === 'einlage') r.einlagen += b.betrag;
  });
  r.gewinn = r.einSum - r.ausSum;
  return r;
}
export const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const monatsEnde = (y, m) => isoDay(new Date(y, m, 0, 12).getTime()); // m: 1–12
export const pm = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
