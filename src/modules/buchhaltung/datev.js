/* ═══════════════ EXPORT: DATEV-Buchungsstapel (EXTF 700) und Paket für die Steuerberatung ═══════════════
 * Dateiname muss mit EXTF_ beginnen, Zeichensatz Windows-1252, Trennzeichen Semikolon, Zeilenende CR/LF.
 * Sachkonten nach SKR03 (Vorschlag, in den Einstellungen anpassbar), Sachkontenlänge 4.
 */
import {zipSync, strToU8} from 'fflate';
import {T, K, getFile} from '../../core/db.js';
import {csv, pad} from '../../core/util.js';
import {TOOL_CONFIG} from '../../core/config.js';
import {ART, docs, deDay} from '../dokumente/shared.js';
import {KAT, ZK, sachkonto, euer, KAT_EIN, KAT_AUS} from './shared.js';

/* Windows-1252 */
const CP = {'€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f};
export function cp1252(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i), ch = s[i]; out[i] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP[ch] || 0x3f; }
  return out;
}
const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const betrag = c => (Math.abs(c) / 100).toFixed(2).replace('.', ',');
const belegfeld = s => String(s || '').replace(/\s+/g, '-').replace(/[^A-Za-z0-9$&%*+\-/]/g, '').slice(0, 36);
const tag = d => d ? d.slice(8, 10) + d.slice(5, 7) : '';
const stamp = () => { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + String(d.getMilliseconds()).padStart(3, '0'); };

/** Buchungen im Zeitraum [von, bis] (YYYY-MM-DD, innerhalb eines Wirtschaftsjahres) */
export const buchungenIn = (von, bis) => T.buchung.filter(b => b.datum >= von && b.datum <= bis && b.betrag).sort((a, b) => a.datum.localeCompare(b.datum));

export function extfCsv(von, bis) {
  const dv = K.settings.datev, y = von.slice(0, 4);
  const head = ['"EXTF"', 700, 21, q('Buchungsstapel'), 13, stamp(), '', q('RE'), q(''), q(''), dv.berater || '', dv.mandant || '', y + (dv.wjBeginn || '0101'), 4,
    von.replace(/-/g, ''), bis.replace(/-/g, ''), q(`KONTORWERK ${von.slice(0, 7)}`), q('KW'), 1, 0, 0, q('EUR'), '', q(''), '', '', q('03'), '', '', q(''), q('')].join(';');
  const cols = 'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext';
  const rows = buchungenIn(von, bis).map(b => {
    const text = q(String(b.text || (KAT[b.kategorie] || {}).name || 'Umbuchung').slice(0, 60));
    // Umbuchung: Zielkonto im Soll, Herkunftskonto als Gegenkonto
    if (b.art === 'umbuchung') return [betrag(b.betrag), q(b.betrag > 0 ? 'S' : 'H'), q('EUR'), '', '', '', sachkonto(b.nach), sachkonto(b.konto), q(''), tag(b.datum), q(belegfeld(b.beleg)), q(''), '', text].join(';');
    // Geldkonto im Soll bei Zufluss (Einnahme/Einlage), im Haben bei Abfluss; negative Beträge kehren das um
    const zufluss = (b.art === 'einnahme' || b.art === 'einlage') === b.betrag > 0;
    return [betrag(b.betrag), q(zufluss ? 'S' : 'H'), q('EUR'), '', '', '', sachkonto(b.konto), sachkonto(b.kategorie), q(''), tag(b.datum), q(belegfeld(b.beleg)), q(''), '', text].join(';');
  });
  return [head, cols, ...rows].join('\r\n') + '\r\n';
}

export function buchungslisteCsv(von, bis) {
  const rows = [['Datum', 'Art', 'Kategorie', 'Sachkonto', 'Zahlungskonto', 'Betrag', 'Buchungstext', 'Beleg', 'Herkunft', 'Festgeschrieben']];
  buchungenIn(von, bis).forEach(b => rows.push([deDay(b.datum), b.art, (KAT[b.kategorie] || {}).name || b.kategorie, b.art === 'umbuchung' ? sachkonto(b.nach) : sachkonto(b.kategorie), (ZK[b.konto] || {}).name + (b.art === 'umbuchung' ? ' → ' + (ZK[b.nach] || {}).name : ''), (b.betrag < 0 ? '-' : '') + betrag(b.betrag), b.text, b.beleg, b.quelle ? b.quelle.split(':')[0] : 'manuell', b.festgeschrieben ? 'ja' : 'nein']));
  return csv(rows);
}

export function euerCsv(von, bis) {
  const r = euer(von, bis), rows = [['Bereich', 'Kategorie', 'Sachkonto', 'Betrag']];
  KAT_EIN.forEach(k => { if (r.ein[k]) rows.push(['Betriebseinnahmen', KAT[k].name, sachkonto(k), betrag(r.ein[k])]); });
  rows.push(['Betriebseinnahmen', 'Summe', '', betrag(r.einSum)]);
  KAT_AUS.forEach(k => { if (r.aus[k]) rows.push(['Betriebsausgaben', KAT[k].name, sachkonto(k), betrag(r.aus[k])]); });
  rows.push(['Betriebsausgaben', 'Summe', '', betrag(r.ausSum)]);
  rows.push(['Ergebnis', r.gewinn >= 0 ? 'Gewinn' : 'Verlust', '', (r.gewinn < 0 ? '-' : '') + betrag(r.gewinn)]);
  rows.push(['Privat', 'Entnahmen', sachkonto('entnahme'), betrag(r.entnahmen)], ['Privat', 'Einlagen', sachkonto('einlage'), betrag(r.einlagen)]);
  return csv(rows);
}

const safe = s => String(s || '').replace(/[^\wäöüÄÖÜß\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
const readBlob = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(new Uint8Array(fr.result)); fr.onerror = rej; fr.readAsArrayBuffer(b); });
const dataUrlBytes = u => { const raw = atob(u.slice(u.indexOf(',') + 1)); const a = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; };

/** ZIP mit Buchungsstapel, Listen, Belegen und Ausgangsrechnungen */
export async function steuerPaket(von, bis, onStep) {
  const tag_ = `${von}_bis_${bis}`, files = {};
  files[`EXTF_Buchungsstapel_${tag_}.csv`] = cp1252(extfCsv(von, bis));
  files['Buchungsliste.csv'] = strToU8(buchungslisteCsv(von, bis));
  files['EUER_Uebersicht.csv'] = strToU8(euerCsv(von, bis));
  const arch = T.dokument.filter(d => d.datum >= von && d.datum <= bis && d.dateiId);
  let i = 0;
  for (const d of arch) {
    if (onStep) onStep(`Beleg ${++i} von ${arch.length}`);
    const f = await getFile(d.dateiId).catch(() => null); if (!f) continue;
    const ext = f.mime === 'application/pdf' ? 'pdf' : 'jpg';
    let name = `Belege/${d.datum}_${safe(d.partner || d.titel || 'Beleg')}${d.betrag != null ? '_' + betrag(d.betrag).replace(',', '-') : ''}.${ext}`, n = 2;
    while (files[name]) name = name.replace(/(\.\w+)$/, `_${n++}$1`);
    files[name] = dataUrlBytes(f.data);
  }
  const ausgang = docs().filter(d => d.festgeschrieben && (d.art === 'rechnung' || d.art === 'gutschrift') && d.datum >= von && d.datum <= bis);
  if (ausgang.length) {
    const {docPdf} = await import('../dokumente/pdf.js');
    i = 0;
    for (const d of ausgang) { if (onStep) onStep(`${ART[d.art].name} ${++i} von ${ausgang.length}`); files[`Ausgangsrechnungen/${safe(d.nr)}.pdf`] = await readBlob(await docPdf(d)); }
  }
  const s = K.settings, r = euer(von, bis);
  files['LIESMICH.txt'] = strToU8([
    `Buchhaltungsdaten ${deDay(von)} – ${deDay(bis)}`, `${s.shopName || ''} ${s.ownerName ? '(' + s.ownerName + ')' : ''}`.trim(), `Steuernummer: ${s.taxNo || '–'}`, '',
    `Gewinnermittlung: Einnahmen-Überschuss-Rechnung, ${s.klein ? 'Kleinunternehmer nach § 19 UStG' : 'regelbesteuert'}`,
    `Betriebseinnahmen: ${betrag(r.einSum)} EUR`, `Betriebsausgaben: ${betrag(r.ausSum)} EUR`, `Ergebnis: ${r.gewinn < 0 ? '-' : ''}${betrag(r.gewinn)} EUR`, '',
    `EXTF_Buchungsstapel_*.csv  DATEV-Buchungsstapel (EXTF 700, Windows-1252, SKR03, Sachkontenlänge 4)`,
    `Buchungsliste.csv          alle Buchungen lesbar (UTF-8)`, `EUER_Uebersicht.csv        Summen je Kategorie`,
    `Belege/                    Eingangsbelege aus dem Belegarchiv (${arch.length})`, `Ausgangsrechnungen/         Rechnungen und Gutschriften (${ausgang.length})`, '',
    `Erstellt mit ${TOOL_CONFIG.name} v${TOOL_CONFIG.version} am ${new Date().toLocaleString('de-DE')}`
  ].join('\r\n'));
  return new Blob([zipSync(files, {level: 6})], {type: 'application/zip'});
}
