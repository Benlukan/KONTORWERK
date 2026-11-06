/* ═══════════════ ETSY-KONTO: Monatsabrechnungen, Gebühren, Auszahlungen ═══════════════ */
import {$, $$, esc, eur} from '../../core/util.js';
import {T, put, remove, flush} from '../../core/db.js';
import {openModal, closeModal, toast, confirmBox} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {isActive} from '../../core/modules.js';
import {deDay} from '../dokumente/shared.js';
import {etsyArt, etsyArtName, ETSY_ART, KAT, KAT_AUS, monate, pm} from '../buchhaltung/shared.js';
import {shops, shopName} from './shared.js';
import {shopChips, keinShop} from './bestellungen.js';

export const html = `
    <div class="card" style="margin-bottom:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" data-etsy-import>📥 Monatsabrechnung einlesen</button>
      <span class="muted" style="font-size:.78rem;flex:1;min-width:200px">Shop-Manager → Finanzen → Monatsabrechnungen → CSV. Daraus entstehen die Buchungen: Verkäufe, Gebühren, Werbung, Versandetiketten und Auszahlungen.</span></div></div>
    <div class="stats-grid" id="ekStats"></div>
    <div class="chips" id="ekShops" style="margin-top:12px"></div>
    <div class="chips" id="ekYears"></div>
    <div class="list" id="ekMonate"></div>`;

const st = {shop: '', year: String(new Date().getFullYear())};
const art = p => p.override || etsyArt(p);
const net = p => p.netto != null ? p.netto : (p.betrag || 0) + (p.gebuehr || 0);
/** Summen einer Zeilenmenge: Verkäufe (nach Erstattungen), Kosten, Auszahlungen; netto = Bewegung ohne Auszahlungen */
function summen(list) {
  const r = {verkauf: 0, kosten: 0, auszahlung: 0, netto: 0};
  list.forEach(p => {
    const a = art(p), n = net(p);
    if (a !== 'auszahlung') r.netto += n;
    if (a === 'verkauf' || a === 'erstattung') { r.verkauf += p.betrag != null ? p.betrag : n; if (p.betrag != null && p.gebuehr) r.kosten -= p.gebuehr; }
    else if (a === 'auszahlung') r.auszahlung += Math.abs(n || p.betrag || 0);
    else if (a === 'einzahlung' || a === 'kaeufersteuer' || a === 'ignorieren') { /* neutral */ }
    else if (KAT[a] && KAT[a].typ === 'einnahme') r.verkauf += n;
    else r.kosten -= n;
  });
  return r;
}

export function renderKonto() {
  if (!shops().length) { ['#ekStats', '#ekShops', '#ekYears'].forEach(s => { $(s).innerHTML = ''; }); return keinShop('#ekMonate'); }
  const mine = T.shopposten.filter(p => !st.shop || p.shopId === st.shop);
  const jahr = mine.filter(p => p.datum.startsWith(st.year)), s = summen(jahr), ges = summen(mine);
  $('#ekStats').innerHTML = `
    <div class="stat-card" style="--sc:#f1641e"><div class="sc-label">Etsy-Guthaben</div><div class="sc-value">${eur(ges.netto - ges.auszahlung)}</div><div class="sc-sub">laut eingelesenen Abrechnungen</div></div>
    <div class="stat-card" style="--sc:var(--ok)"><div class="sc-label">Verkäufe ${st.year}</div><div class="sc-value">${eur(s.verkauf)}</div><div class="sc-sub">nach Erstattungen</div></div>
    <div class="stat-card" style="--sc:var(--danger)"><div class="sc-label">Etsy-Kosten ${st.year}</div><div class="sc-value">${eur(s.kosten)}</div><div class="sc-sub">${s.verkauf ? (s.kosten / s.verkauf * 100).toLocaleString('de-DE', {maximumFractionDigits: 1}) + ' % der Verkäufe' : 'Gebühren, Werbung, Versand'}</div></div>
    <div class="stat-card" style="--sc:var(--indigo)"><div class="sc-label">Ausgezahlt ${st.year}</div><div class="sc-value">${eur(s.auszahlung)}</div><div class="sc-sub">auf dein Bankkonto</div></div>`;
  shopChips('#ekShops', st.shop, id => { st.shop = id; renderKonto(); });
  const years = [...new Set([String(new Date().getFullYear()), ...T.shopposten.map(p => p.datum.slice(0, 4)), ...T.bestellung.map(o => (o.datum || '').slice(0, 4)).filter(Boolean)])].sort().reverse();
  $('#ekYears').innerHTML = years.map(y => `<button class="chip ${st.year === y ? 'active' : ''}" data-y="${y}">${y}</button>`).join('');
  $$('#ekYears .chip').forEach(b => b.onclick = () => { st.year = b.dataset.y; renderKonto(); });
  const now = new Date(), maxM = +st.year < now.getFullYear() ? 12 : +st.year === now.getFullYear() ? now.getMonth() + 1 : 0;
  const rows = [];
  for (let m = maxM; m >= 1; m--) {
    const pre = pm(st.year, m), list = mine.filter(p => p.datum.startsWith(pre)), ms = summen(list);
    const best = T.bestellung.filter(o => (!st.shop || o.shopId === st.shop) && (o.datum || '').startsWith(pre) && o.status !== 'storniert').length;
    const fehlt = fehlendeShops(pre).filter(id => !st.shop || id === st.shop);
    if (!list.length && !best) continue;
    rows.push(`<button class="li" data-m="${m}"><div class="li-thumb">${list.length ? (fehlt.length ? '⚠️' : '✅') : best ? '❔' : '➖'}</div>
      <div class="li-main"><div class="li-title">${monate[m - 1]} ${st.year}</div>
      <div class="li-sub">${list.length ? `Verkäufe ${eur(ms.verkauf)} · Kosten ${eur(ms.kosten)} · ausgezahlt ${eur(ms.auszahlung)}` : best ? `${best} Bestellung${best === 1 ? '' : 'en'}, aber noch keine Abrechnung eingelesen` : 'keine Daten'}${list.length && fehlt.length ? ' · Abrechnung fehlt für ' + fehlt.map(shopName).map(esc).join(', ') : ''}</div></div>
      ${list.length ? `<div class="li-end"><b class="num">${eur(ms.verkauf - ms.kosten)}</b></div>` : ''}</button>`);
  }
  $('#ekMonate').innerHTML = rows.join('') || `<div class="card empty"><div>💳</div><p>Für ${st.year} ist noch nichts eingelesen.</p></div>`;
  $$('#ekMonate [data-m]').forEach(b => b.onclick = () => openMonat(+b.dataset.m));
}

/** Shops mit Bestellungen im Monat, aber ohne Abrechnungszeilen */
export function fehlendeShops(pre) {
  const mit = new Set(T.bestellung.filter(o => (o.datum || '').startsWith(pre) && o.status !== 'storniert').map(o => o.shopId));
  return [...mit].filter(id => !T.shopposten.some(p => p.shopId === id && p.datum.startsWith(pre)));
}

const OPTS = ['verkauf', 'erstattung', 'auszahlung', 'einzahlung', ...KAT_AUS, 'sonst_ein', 'kaeufersteuer', 'ignorieren'];
function openMonat(m) {
  const pre = pm(st.year, m), list = T.shopposten.filter(p => (!st.shop || p.shopId === st.shop) && p.datum.startsWith(pre)).sort((a, b) => a.datum.localeCompare(b.datum));
  if (!list.length) return toast('Für diesen Monat ist noch keine Abrechnung eingelesen', true);
  const fest = isActive('buchhaltung') && T.buchung.some(b => b.festgeschrieben && b.datum.startsWith(pre) && /^etsy/.test(b.quelle || ''));
  openModal(`Etsy-Abrechnung ${monate[m - 1]} ${st.year}`, `
    <p class="muted" style="font-size:.8rem;line-height:1.5;margin-bottom:10px">So wird jede Zeile gebucht. Stimmt eine Einordnung nicht, ändere sie hier – die Buchung zieht automatisch nach${fest ? ' (bei festgeschriebenen Monaten als Korrekturbuchung)' : ''}.</p>
    <div class="list">${list.map(p => `<div class="li" style="cursor:default;flex-wrap:wrap">
      <div class="li-main" style="min-width:180px"><div class="li-title" style="font-size:.85rem">${esc(p.titel || p.typ)}</div><div class="li-sub">${deDay(p.datum)} · ${esc(p.typ)}${p.info ? ' · ' + esc(p.info) : ''}${shops().length > 1 && !st.shop ? ' · ' + esc(shopName(p.shopId)) : ''}</div></div>
      <div style="display:flex;gap:8px;align-items:center"><b class="num" style="color:${net(p) >= 0 ? 'var(--ok)' : 'var(--danger)'}">${eur(net(p))}</b>
      <select class="input" data-p="${p.id}" style="max-width:230px;font-size:.78rem"><option value="">Automatisch: ${esc(etsyArtName(etsyArt(p)))}</option>${OPTS.map(o => `<option value="${o}" ${p.override === o ? 'selected' : ''}>${esc(etsyArtName(o))}</option>`).join('')}</select></div></div>`).join('')}</div>`,
    `${fest ? '' : `<button class="btn btn-danger" id="ekDel">Monat entfernen</button>`}<button class="btn btn-primary" id="ekOk">Fertig</button>`);
  $$('[data-p]').forEach(sel => sel.onchange = () => { const p = list.find(x => x.id === sel.dataset.p); p.override = sel.value; put('shopposten', p); flush(); });
  $('#ekOk').onclick = () => { closeModal(); render(); };
  if ($('#ekDel')) $('#ekDel').onclick = async () => {
    if (!await confirmBox('Abrechnung entfernen?', `${list.length} Zeilen und ihre Buchungen werden entfernt. Du kannst die Datei danach neu einlesen.`, 'Entfernen', true)) return;
    list.forEach(p => remove('shopposten', p.id)); flush(); render();
  };
}

export const ETSY_ARTEN = ETSY_ART;
