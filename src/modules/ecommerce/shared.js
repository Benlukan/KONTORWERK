/* ═══════════════ E-COMMERCE: Shops, Etsy-Import, Bestand ═══════════════
 * Etsy-Dateien (Shop-Manager → Einstellungen → Optionen → Daten herunterladen / Finanzen → Monatsabrechnung):
 *   Bestellungen (EtsySoldOrders*.csv)       → bestellung   (Käufer, Anschrift, Summen, Versanddatum)
 *   Bestellte Artikel (EtsySoldOrderItems*)  → bestellung.positionen + shopartikel
 *   Angebote (EtsyListingsDownload*.csv)     → shopartikel  (Etsy-Bestand und Preis)
 *   Monatsabrechnung (etsy_statement_*.csv)  → shopposten   (Grundlage der Buchhaltung)
 * Alle ids sind aus Shop + Etsy-Nummer abgeleitet: Liest ein zweites Gerät dieselbe Datei ein, entstehen keine Doppelten.
 */
import {uid} from '../../core/util.js';
import {T, K, get, put, saveSettings} from '../../core/db.js';
import {parseCsv, parseBetrag, parseDatum, norm, hash} from '../../core/csvimport.js';
import {prodById, addMove} from '../wawi/shared.js';

/* ─── Shops ─── */
export const shops = () => K.settings.shops;
export const shopById = id => K.settings.shops.find(s => s.id === id);
export const shopName = id => (shopById(id) || {}).name || 'Shop';
export const istDigital = id => (shopById(id) || {}).art === 'digital';
export function saveShop(s) {
  if (!s.id) { s.id = 's' + uid(); K.settings.shops.push(s); }
  else { const i = K.settings.shops.findIndex(x => x.id === s.id); if (i >= 0) K.settings.shops[i] = s; else K.settings.shops.push(s); }
  saveSettings(); return s;
}
export function deleteShop(id) { K.settings.shops = K.settings.shops.filter(s => s.id !== id); saveSettings(); }
export const shopHatDaten = id => T.bestellung.some(o => o.shopId === id) || T.shopposten.some(p => p.shopId === id) || T.shopartikel.some(a => a.shopId === id);

/* ─── Bestellungen ─── */
export const STATUS = {offen: ['Offen', 'warn'], versendet: ['Versendet', 'ok'], erledigt: ['Erledigt', 'ok'], storniert: ['Storniert', 'gray']};
/** Umsatz einer Bestellung für dich (ohne Steuer, die Etsy beim Käufer einzieht) */
export const umsatzVon = o => o.status === 'storniert' ? 0 : o.umsatz || 0;
export const offeneBestellungen = () => T.bestellung.filter(o => o.status === 'offen' && !istDigital(o.shopId));

const normTitel = s => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9äöüß]+/g, ' ').trim();
export const artikelKey = (sku, titel) => sku ? 's:' + sku.toLowerCase() : 't:' + normTitel(titel);
/** Passendes Produkt: gleiche Artikelnummer, sonst gleicher Name */
export function findeProdukt(sku, titel) {
  if (sku) { const p = T.produkt.find(x => x.sku && x.sku.toLowerCase() === sku.toLowerCase()); if (p) return p.id; }
  const t = normTitel(titel); if (!t) return null;
  const p = T.produkt.find(x => normTitel(x.name) === t);
  return p ? p.id : null;
}

/** Bestand für die verknüpften Positionen abbuchen (einmal je Position). Liefert die Zahl der Buchungen. */
export function bucheBestand(o) {
  const shop = shopById(o.shopId);
  if (!shop || shop.art === 'digital' || shop.bestand === false || o.ohneBestand || o.status === 'storniert') return 0;
  let n = 0;
  (o.positionen || []).forEach(p => {
    if (p.gebucht || !p.produktId) return;
    const pr = prodById(p.produktId); if (!pr || !pr.trackStock) return;
    pr.stock -= p.menge || 1; put('produkt', pr); addMove(pr.id, -(p.menge || 1), 'etsy', `${shop.name} #${o.orderId}`, o.id);
    p.gebucht = true; n++;
  });
  if (n) put('bestellung', o);
  return n;
}
/** Stornieren: Status setzen und abgebuchten Bestand zurückbuchen */
export function storniere(o) {
  (o.positionen || []).forEach(p => {
    if (!p.gebucht) return;
    const pr = prodById(p.produktId);
    if (pr && pr.trackStock) { pr.stock += p.menge || 1; put('produkt', pr); addMove(pr.id, p.menge || 1, 'storno', `Storno ${shopName(o.shopId)} #${o.orderId}`, o.id); }
    p.gebucht = false;
  });
  o.status = 'storniert'; put('bestellung', o);
}
/** Position mit einem Produkt verknüpfen – merkt sich die Zuordnung für künftige Bestellungen */
export function verknuepfe(o, pos, produktId) {
  pos.produktId = produktId || null;
  const a = get('shopartikel', 'ea-' + hash(o.shopId + '|' + artikelKey(pos.sku, pos.titel)));
  if (a) { a.produktId = produktId || null; put('shopartikel', a); }
  put('bestellung', o);
  return produktId ? bucheBestand(o) : 0;
}

/* ─── Datei erkennen ─── */
export const ARTEN = {
  artikel: 'Angebote (Etsy-Bestand)', bestellungen: 'Bestellungen', positionen: 'Bestellte Artikel', abrechnung: 'Monatsabrechnung'
};
const REIHENFOLGE = ['artikel', 'bestellungen', 'positionen', 'abrechnung'];
function erkenne(header) {
  const h = new Set(header.map(norm));
  if (h.has('transactionid') && h.has('itemname')) return 'positionen';
  if (h.has('orderid') && (h.has('ordervalue') || h.has('ordertotal'))) return 'bestellungen';
  if ((h.has('type') && h.has('net')) || (h.has('typ') && h.has('netto'))) return 'abrechnung';
  if (h.has('title') && h.has('quantity') && h.has('price')) return 'artikel';
  return null;
}
/** Text einer CSV-Datei → {art, header, rows} oder {art:null} */
export function analysiere(text) {
  const rows = parseCsv(text);
  for (let i = 0; i < Math.min(rows.length, 5); i++) { const art = erkenne(rows[i]); if (art) return {art, header: rows[i], rows: rows.slice(i + 1)}; }
  return {art: null};
}
export const sortiere = list => list.sort((a, b) => REIHENFOLGE.indexOf(a.art) - REIHENFOLGE.indexOf(b.art));

const spalten = header => { const m = {}; header.forEach((h, i) => { const k = norm(h); if (!(k in m)) m[k] = i; }); return (r, ...keys) => { for (const k of keys) if (k in m && r[m[k]] != null && r[m[k]] !== '') return r[m[k]]; return ''; }; };
const cent = v => { const n = parseBetrag(v); return isNaN(n) ? null : n; };
const c0 = v => cent(v) || 0;

/** Artikel im Shop-Katalog anlegen/aktualisieren */
function artikel(shopId, sku, titel, extra) {
  const key = artikelKey(sku, titel), id = 'ea-' + hash(shopId + '|' + key);
  const a = get('shopartikel', id) || {id, shopId, key, titel, sku: sku || '', produktId: null};
  Object.assign(a, {titel: titel || a.titel, sku: sku || a.sku}, extra || {});
  if (!a.produktId) a.produktId = findeProdukt(a.sku, a.titel);
  put('shopartikel', a);
  return a;
}

function bestellung(shopId, orderId) {
  const id = 'eb-' + hash(shopId + '|' + orderId), ex = get('bestellung', id);
  return ex ? {o: ex, neu: false} : {o: {id, shopId, orderId, positionen: [], status: istDigital(shopId) ? 'erledigt' : 'offen'}, neu: true};
}
function status(o, etsyStatus, versendetAm) {
  if (/cancel|storn/i.test(etsyStatus || '')) return 'storniert';
  if (o.status === 'storniert' || o.status === 'erledigt') return o.status;
  if (versendetAm) return 'versendet';
  return o.status || 'offen';
}

/**
 * Eine erkannte Datei einlesen.
 * bestand: 'offen' (nur noch nicht versendete Bestellungen abbuchen) | 'alle' | 'keine'
 */
export function importiere(f, shopId, bestand) {
  const col = spalten(f.header), r = {art: f.art, neu: 0, aktualisiert: 0, bestand: 0, uebersprungen: 0};
  const touched = new Map();
  const merkNeu = (o, neu) => {
    if (neu) { r.neu++; if (bestand === 'keine' || (bestand !== 'alle' && (o.versendetAm || o.status !== 'offen'))) o.ohneBestand = true; }
    else if (!touched.has(o.id)) r.aktualisiert++;
    touched.set(o.id, o);
  };

  if (f.art === 'artikel') {
    f.rows.forEach(x => {
      const titel = col(x, 'title'); if (!titel) return;
      const ex = get('shopartikel', 'ea-' + hash(shopId + '|' + artikelKey(col(x, 'sku'), titel)));
      artikel(shopId, col(x, 'sku'), titel, {etsyMenge: parseInt(col(x, 'quantity'), 10) || 0, preis: cent(col(x, 'price')), imAngebot: true, stand: Date.now()});
      ex ? r.aktualisiert++ : r.neu++;
    });
    return r;
  }

  if (f.art === 'bestellungen') {
    f.rows.forEach(x => {
      const oid = col(x, 'orderid'); if (!oid) return;
      const {o, neu} = bestellung(shopId, oid);
      const warenwert = c0(col(x, 'ordervalue')), rabatt = c0(col(x, 'discountamount')), vrabatt = c0(col(x, 'shippingdiscount')), versand = c0(col(x, 'shipping')), steuer = c0(col(x, 'salestax')), summe = c0(col(x, 'ordertotal'));
      const versendetAm = parseDatum(col(x, 'dateshipped'), true);
      Object.assign(o, {
        datum: parseDatum(col(x, 'saledate', 'orderdate'), true) || o.datum, kaeufer: col(x, 'buyer', 'buyeruserid') || o.kaeufer || '',
        name: col(x, 'fullname') || [col(x, 'firstname'), col(x, 'lastname')].filter(Boolean).join(' ') || o.name || '',
        adresse: {strasse: [col(x, 'street1'), col(x, 'street2')].filter(Boolean).join(', '), plz: col(x, 'shipzipcode'), ort: col(x, 'shipcity'), region: col(x, 'shipstate'), land: col(x, 'shipcountry')},
        anzahl: parseInt(col(x, 'numberofitems'), 10) || o.anzahl || 0, waehrung: col(x, 'currency') || 'EUR', zahlart: col(x, 'paymentmethod', 'paymenttype'),
        warenwert, rabatt: rabatt + vrabatt, versand, steuer, summe, gebuehrKarte: c0(col(x, 'cardprocessingfees')), netto: cent(col(x, 'ordernet')),
        umsatz: warenwert ? warenwert - rabatt - vrabatt + versand : summe - steuer, ausBestellliste: true,
        versendetAm: versendetAm || o.versendetAm || null, etsyStatus: col(x, 'status')
      });
      o.status = status(o, o.etsyStatus, o.versendetAm);
      if (o.status === 'storniert') storniere(o); else put('bestellung', o);
      merkNeu(o, neu);
    });
  }

  if (f.art === 'positionen') {
    f.rows.forEach(x => {
      const oid = col(x, 'orderid'), tid = col(x, 'transactionid'); if (!oid || !tid) return;
      const {o, neu} = touched.has('eb-' + hash(shopId + '|' + oid)) ? {o: touched.get('eb-' + hash(shopId + '|' + oid)), neu: false} : bestellung(shopId, oid);
      const titel = col(x, 'itemname'), sku = col(x, 'sku'), a = artikel(shopId, sku, titel, {listingId: col(x, 'listingid')});
      let p = o.positionen.find(y => y.tid === tid);
      if (!p) { p = {tid, produktId: a.produktId, gebucht: false}; o.positionen.push(p); }
      Object.assign(p, {listingId: col(x, 'listingid'), titel, sku, menge: parseInt(col(x, 'quantity'), 10) || 1, preis: c0(col(x, 'price')), variante: col(x, 'variations')});
      if (!p.produktId) p.produktId = a.produktId;
      if (!o.ausBestellliste) {
        const versendetAm = parseDatum(col(x, 'dateshipped'), true);
        Object.assign(o, {datum: parseDatum(col(x, 'saledate'), true) || o.datum, kaeufer: col(x, 'buyer') || o.kaeufer || '', name: col(x, 'shipname') || o.name || '',
          adresse: {strasse: [col(x, 'shipaddress1'), col(x, 'shipaddress2')].filter(Boolean).join(', '), plz: col(x, 'shipzipcode'), ort: col(x, 'shipcity'), region: col(x, 'shipstate'), land: col(x, 'shipcountry')},
          versand: c0(col(x, 'ordershipping')), steuer: c0(col(x, 'ordersalestax')), waehrung: col(x, 'currency') || 'EUR', versendetAm: versendetAm || o.versendetAm || null});
        o.rabatt = Math.max(o.rabatt || 0, c0(col(x, 'discountamount')) + c0(col(x, 'shippingdiscount')));
        o.warenwert = o.positionen.reduce((s, y) => s + y.preis * y.menge, 0);
        o.umsatz = o.warenwert - (o.rabatt || 0) + (o.versand || 0);
        o.status = status(o, '', o.versendetAm);
      }
      put('bestellung', o);
      merkNeu(o, neu);
    });
  }
  touched.forEach(o => { r.bestand += bucheBestand(o); });

  if (f.art === 'abrechnung') {
    const seen = {};
    f.rows.forEach(x => {
      const datum = parseDatum(col(x, 'date', 'datum'), true); if (!datum) return;
      const typ = col(x, 'type', 'typ'), titel = col(x, 'title', 'titel'), info = col(x, 'info');
      let betrag = cent(col(x, 'amount', 'betrag')), gebuehr = cent(col(x, 'feestaxes', 'gebührensteuern', 'gebuehrensteuern', 'fees')), netto = cent(col(x, 'net', 'netto'));
      if (betrag == null && netto == null) { const m = /(?:€|EUR|\$)\s?-?[\d.,]*\d|-?[\d.,]*\d\s?(?:€|EUR)/.exec(titel); if (m) betrag = cent(m[0]); }
      const base = [shopId, datum, typ, titel, info, betrag, gebuehr, netto].join('|'); seen[base] = (seen[base] || 0) + 1;
      const id = 'ep-' + hash(base + '#' + seen[base]);
      if (get('shopposten', id)) { r.uebersprungen++; return; }
      put('shopposten', {id, shopId, datum, typ, titel, info, betrag, gebuehr, netto, waehrung: col(x, 'currency', 'währung') || 'EUR', steuerInfo: col(x, 'taxdetails', 'steuerdetails'), override: ''});
      r.neu++;
    });
  }
  return r;
}

export const ergebnisText = r => {
  if (r.art === 'abrechnung') return `${r.neu} neue Zeilen${r.uebersprungen ? `, ${r.uebersprungen} schon vorhanden` : ''}`;
  if (r.art === 'artikel') return `${r.neu} neue, ${r.aktualisiert} aktualisierte Angebote`;
  return `${r.neu} neue, ${r.aktualisiert} aktualisierte Bestellungen${r.bestand ? `, ${r.bestand}× Bestand abgebucht` : ''}`;
};
