/* ═══════════════ PDF: Rechnung, Angebot, Lieferschein, Gutschrift (A4, angelehnt an DIN 5008) ═══════════════
 * Pflichtangaben einer Rechnung (§ 14 UStG): Name/Anschrift beider Seiten, Steuernummer, Rechnungsdatum,
 * fortlaufende Nummer, Menge und Art, Leistungsdatum, Entgelt, bei Kleinunternehmern der Hinweis auf § 19 UStG.
 */
import {jsPDF} from 'jspdf';
import {ART, deDay, faellig, lineSum, absenderSnapshot, empfLines} from './shared.js';

const L = 25, R = 190, W = R - L;            // Ränder (mm)
const FOOT = 273, BOTTOM = 262;               // Fußzeile, letzte Tabellenzeile
const money = c => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
const qty = n => String(Math.round(n * 1000) / 1000).replace('.', ',');
// Zeichen, die die Standardschrift (WinAnsi) nicht kennt, ersetzen
const clean = s => String(s || '').replace(/[−]/g, '-').replace(/[‐-‒]/g, '-').replace(/[  ]/g, ' ').replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ€„“”‚‘’–—…•™]/g, '');

export async function docPdf(d) {
  const A = ART[d.art], abs = d.absender || absenderSnapshot(), klein = d.festgeschrieben ? !!d.klein : !!abs.klein;
  const ohnePreise = d.art === 'lieferschein';
  const pdf = new jsPDF({unit: 'mm', format: 'a4', compress: true});
  pdf.setProperties({title: `${A.name} ${d.nr || '(Entwurf)'}`, author: abs.name || abs.inhaber || '', creator: 'KONTORWERK'});
  const font = (size, style = 'normal', gray = 30) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.setTextColor(gray); };
  const text = (s, x, y, o) => pdf.text(clean(s), x, y, o);
  const adr = String(abs.adresse || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  // Entwurf: Wasserzeichen zuerst zeichnen, damit es hinter dem Inhalt liegt
  const watermark = () => { if (d.festgeschrieben) return; font(80, 'bold'); pdf.setTextColor(240, 242, 246); text('ENTWURF', 45, 215, {angle: 40}); };
  const newPage = () => { pdf.addPage(); watermark(); };
  watermark();

  /* ─── Kopf ─── */
  let logoH = 0;
  if (abs.logo) {
    try {
      const p = pdf.getImageProperties(abs.logo), h = Math.min(22, 50 * p.height / p.width), w = h * p.width / p.height;
      pdf.addImage(abs.logo, abs.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', R - w, 14, w, h); logoH = h;
    } catch (e) { /* Logo nicht lesbar – ohne weiter */ }
  }
  font(15, 'bold', 20); text(abs.name || abs.inhaber || '', L, 22);
  font(8.5, 'normal', 90);
  const head = [abs.name && abs.inhaber ? abs.inhaber : '', ...adr, [abs.telefon, abs.email].filter(Boolean).join(' · ')].filter(Boolean);
  head.forEach((s, i) => text(s, L, 27 + i * 3.8));

  /* ─── Anschrift ─── */
  font(7, 'normal', 110);
  const back = [abs.name || abs.inhaber, ...adr].filter(Boolean).join(' · ');
  text(back, L, 50); pdf.setDrawColor(180); pdf.setLineWidth(0.15); pdf.line(L, 51, L + Math.min(85, pdf.getTextWidth(clean(back))), 51);
  font(10.5, 'normal', 20);
  empfLines(d.empf || {}).forEach((s, i) => text(s, L, 57 + i * 4.8));

  /* ─── Infoblock rechts ─── */
  const info = [[A.nrLabel, d.nr || 'Entwurf'], [`${A.name}sdatum`, deDay(d.datum)]];
  if (d.art !== 'angebot' && d.leistung) info.push([d.art === 'lieferschein' ? 'Lieferdatum' : 'Leistungsdatum', deDay(d.leistung)]);
  if (d.art === 'rechnung') info.push(['Fällig am', deDay(faellig(d))]);
  if (d.art === 'angebot' && d.gueltigBis) info.push(['Gültig bis', deDay(d.gueltigBis)]);
  if (d.kundenNr) info.push(['Kundennr.', d.kundenNr]);
  if (d.bezugNr) info.push(['Bezug', d.bezugNr]);
  let iy = Math.max(57, 14 + logoH + 8);
  info.forEach(([l, v]) => { font(8.5, 'normal', 100); text(l, 130, iy); font(8.5, 'bold', 30); text(v, R, iy, {align: 'right'}); iy += 4.6; });

  /* ─── Titel, Anrede, Einleitung ─── */
  let y = Math.max(100, iy + 10);
  font(15, 'bold', 20); text(`${A.name}${d.nr ? ' ' + d.nr : ''}`, L, y);
  if (d.status === 'storniert') { font(11, 'bold'); pdf.setTextColor(200, 30, 30); text('STORNIERT' + (d.stornoNr ? ' durch ' + d.stornoNr : ''), R, y, {align: 'right'}); }
  y += 7;
  if (d.betreff) { font(10, 'bold', 30); text(d.betreff, L, y); y += 6; }
  font(10, 'normal', 30);
  const e = d.empf || {};
  const anrede = e.name && !e.firma ? `Guten Tag ${e.name},` : 'Sehr geehrte Damen und Herren,';
  y += 2; text(anrede, L, y); y += 6;
  const para = s => { if (!s) return; pdf.splitTextToSize(clean(s), W).forEach(line => { y = brk(y, 5); text(line, L, y); y += 4.8; }); y += 2; };
  para(d.einleitung);

  /* ─── Tabelle ─── */
  const X = {pos: L + 1.5, text: L + 10, menge: ohnePreise ? R - 2 : 128, preis: 158, sum: R - 2};
  const textW = (ohnePreise ? X.menge - 24 : 108) - X.text;
  const header = () => {
    pdf.setFillColor(238, 241, 246); pdf.rect(L, y - 4.2, W, 6.4, 'F');
    font(8.5, 'bold', 40);
    text('Pos.', X.pos, y); text('Bezeichnung', X.text, y); text('Menge', X.menge, y, {align: 'right'});
    if (!ohnePreise) { text('Einzelpreis', X.preis, y, {align: 'right'}); text('Gesamt', X.sum, y, {align: 'right'}); }
    y += 6.5;
  };
  function brk(yy, need) {
    if (yy + need <= BOTTOM) return yy;
    newPage(); y = 28; return y;
  }
  y += 3; header();
  (d.positionen || []).forEach((p, i) => {
    font(9.5, 'normal', 30);
    const lines = pdf.splitTextToSize(clean(p.text), textW), h = lines.length * 4.3 + 2.2;
    if (y + h > BOTTOM) { newPage(); y = 28; header(); font(9.5, 'normal', 30); }
    text(String(i + 1), X.pos, y);
    lines.forEach((ln, k) => text(ln, X.text, y + k * 4.3));
    text(`${qty(p.menge)} ${p.einheit || ''}`.trim(), X.menge, y, {align: 'right'});
    if (!ohnePreise) { text(money(p.preis), X.preis, y, {align: 'right'}); text(money(lineSum(p)), X.sum, y, {align: 'right'}); }
    y += h; pdf.setDrawColor(225); pdf.setLineWidth(0.1); pdf.line(L, y - 3, R, y - 3);
  });

  /* ─── Summen ─── */
  if (!ohnePreise) {
    y = brk(y + 2, 22);
    pdf.setDrawColor(60); pdf.setLineWidth(0.35); pdf.line(120, y - 2.5, R, y - 2.5);
    font(11, 'bold', 20); text(d.art === 'gutschrift' ? 'Gutschriftbetrag' : 'Gesamtbetrag', 122, y + 2); text(money(d.total || 0), X.sum, y + 2, {align: 'right'});
    y += 8;
    font(8.5, 'normal', 70);
    if (klein) { text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', L, y); y += 5; }
    else {
      const by = {}; (d.positionen || []).forEach(p => { const r = p.tax ?? 19; by[r] = (by[r] || 0) + lineSum(p); });
      Object.keys(by).sort((a, b) => b - a).forEach(r => { const g = by[r], t = Math.round(g - g / (1 + r / 100)); text(`Im Betrag enthaltene Umsatzsteuer ${r} %: ${money(t)} (netto ${money(g - t)})`, L, y); y += 4.5; });
      y += 1;
    }
  }

  /* ─── Zahlung / Gültigkeit / Schluss ─── */
  font(10, 'normal', 30); y += 3;
  if (d.art === 'rechnung') {
    if (d.status === 'bezahlt' && d.bezahltAm) para(`Der Rechnungsbetrag wurde am ${deDay(d.bezahltAm)} beglichen. Vielen Dank!`);
    else if (d.status === 'storniert') para('Diese Rechnung wurde storniert.');
    else if (!+d.zielTage) para(`Zahlbar sofort ohne Abzug.${abs.iban ? ' Bitte überweisen Sie den Betrag auf das unten genannte Konto. Verwendungszweck: ' + (d.nr || '') : ''}`);
    else para(`Bitte überweisen Sie den Betrag bis zum ${deDay(faellig(d))} ohne Abzug${abs.iban ? ' auf das unten genannte Konto' : ''}. Verwendungszweck: ${d.nr || ''}`);
  }
  if (d.art === 'angebot' && d.gueltigBis) para(`Dieses Angebot ist gültig bis ${deDay(d.gueltigBis)}.`);
  if (d.art === 'gutschrift' && d.stornoVon) para(`Die Rechnung ${d.bezugNr || ''} ist damit vollständig ausgeglichen.`);
  para(d.schluss);
  y = brk(y + 2, 12);
  text('Mit freundlichen Grüßen', L, y); y += 6;
  font(10, 'bold', 30); text(abs.inhaber || abs.name || '', L, y);

  /* ─── Fußzeile, Seitenzahlen, Entwurf ─── */
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(L, FOOT, R, FOOT);
    font(7, 'normal', 110);
    const c1 = [abs.name || abs.inhaber, abs.name && abs.inhaber ? 'Inhaber: ' + abs.inhaber : '', ...adr].filter(Boolean);
    const c2 = [abs.telefon && 'Tel. ' + abs.telefon, abs.email, abs.web].filter(Boolean);
    const c3 = [abs.taxNo && 'Steuernr. ' + abs.taxNo, abs.bankName || (abs.iban ? 'Bankverbindung' : ''), abs.bankInhaber && 'Inhaber: ' + abs.bankInhaber, abs.iban && 'IBAN ' + abs.iban, abs.bic && 'BIC ' + abs.bic].filter(Boolean);
    c1.slice(0, 5).forEach((s, k) => text(s, L, FOOT + 4 + k * 3.2));
    c2.slice(0, 5).forEach((s, k) => text(s, 85, FOOT + 4 + k * 3.2));
    c3.slice(0, 5).forEach((s, k) => text(s, 138, FOOT + 4 + k * 3.2));
    if (n > 1) text(`Seite ${i} von ${n}`, R, 290, {align: 'right'});
  }
  return pdf.output('blob');
}
