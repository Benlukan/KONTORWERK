/* ═══════════════ BANKABGLEICH: Kontoauszug (CSV) einlesen und zuordnen ═══════════════
 * Funktioniert mit den CSV-Exporten der meisten Banken (Sparkasse, Volksbank, DKB, ING, comdirect …) und PayPal.
 * Jeder Umsatz wird genau einer Sache zugeordnet: Rechnung bezahlt, Beleg aus dem Archiv, neue Buchung – oder ignoriert.
 */
import {$, $$, esc, eur, uid} from '../../core/util.js';
import {T, get, put, remove, flush} from '../../core/db.js';
import {toast, openModal, closeModal, wideModal} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {deDay, parseDay, docs} from '../dokumente/shared.js';
import {ZK, KAT} from './shared.js';
import {editBuchung} from './buchungen.js';

export const html = `
    <div class="card" style="margin-bottom:12px">
      <p class="muted" style="font-size:.82rem;line-height:1.5;margin-bottom:10px">Lade den Kontoauszug als CSV aus deinem Online-Banking (oder PayPal-Aktivitäten) und ordne die Umsätze zu. Bereits eingelesene Umsätze werden beim erneuten Import übersprungen.</p>
      <div class="row" style="margin:0"><div class="field" style="margin:0;flex:0 0 40%"><select class="input" id="bkKonto">${Object.entries(ZK).filter(([k]) => k !== 'kasse').map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label class="btn btn-primary btn-block">📥 CSV einlesen<input type="file" id="bkFile" accept=".csv,text/csv,text/plain" class="hidden"></label></div></div>
    </div>
    <div class="chips" id="bkFilter"></div>
    <div id="bkList"></div>`;

const st = {filter: 'offen'};

/* ─── CSV ─── */
function splitCsv(text, sep) {
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
const norm = s => s.toLowerCase().replace(/[^a-zäöüß]/g, '');
const COLS = {
  datum: ['buchungstag', 'buchungsdatum', 'datum', 'buchung', 'valuta', 'valutadatum', 'wertstellung'],
  betrag: ['betrag', 'betrageur', 'betraginclsteuer', 'umsatz', 'brutto', 'betragineur', 'umsatzineur'],
  soll: ['soll', 'sollbetrag', 'ausgang', 'belastung'], haben: ['haben', 'habenbetrag', 'eingang', 'gutschrift'],
  text: ['verwendungszweck', 'buchungstext', 'beschreibung', 'betreff', 'vorgang', 'umsatztext', 'hinweis'],
  partner: ['beguenstigterzahlungspflichtiger', 'begünstigterzahlungspflichtiger', 'namezahlungsbeteiligter', 'zahlungsempfänger', 'zahlungsempfaenger', 'auftraggeberempfänger', 'auftraggeber', 'empfänger', 'name', 'gegenkonto', 'auftraggeberbegünstigter']
};
function detect(header) {
  const h = header.map(norm), find = keys => { for (const k of keys) { const i = h.indexOf(k); if (i >= 0) return i; } for (const k of keys) { const i = h.findIndex(x => x.startsWith(k)); if (i >= 0) return i; } return -1; };
  return {datum: find(COLS.datum), betrag: find(COLS.betrag), soll: find(COLS.soll), haben: find(COLS.haben), text: find(COLS.text), partner: find(COLS.partner)};
}
function parseBetrag(s) {
  if (!s) return NaN; s = s.replace(/[€\s]|EUR/g, '');
  let neg = false; if (/^-|-$/.test(s)) neg = true; s = s.replace(/^[+-]|[+-]$/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Math.round(parseFloat(s) * 100); return isNaN(n) ? NaN : neg ? -n : n;
}
function parseDatum(s) {
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s || '');
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function decode(buf) {
  const u = new TextDecoder('utf-8').decode(buf);
  return u.includes('�') ? new TextDecoder('windows-1252').decode(buf) : u.replace(/^﻿/, '');
}
function readBuf(f) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(f); }); }

async function onFile(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const text = decode(new Uint8Array(await readBuf(f)));
  const lines = text.split(/\r?\n/).slice(0, 40);
  const sep = [';', ',', '\t'].map(s => [s, lines.reduce((a, l) => a + l.split(s).length, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = splitCsv(text, sep).filter(r => r.some(Boolean));
  const hi = rows.findIndex(r => { const d = detect(r); return d.datum >= 0 && (d.betrag >= 0 || d.soll >= 0 || d.haben >= 0); });
  if (hi < 0) return toast('Kopfzeile mit Datum und Betrag nicht gefunden', true);
  mapDialog(rows[hi], rows.slice(hi + 1), detect(rows[hi]), $('#bkKonto').value);
}

function mapDialog(header, data, map, konto) {
  const opt = (sel, none) => `${none ? `<option value="-1">— ${none} —</option>` : ''}${header.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Spalte ' + (i + 1))}</option>`).join('')}`;
  openModal('Kontoauszug einlesen', `
    <p class="muted" style="font-size:.82rem;margin-bottom:10px">${data.length} Zeilen gefunden. Prüfe die erkannten Spalten:</p>
    <div class="row"><div class="field"><label>Datum</label><select class="input" id="mDat">${opt(map.datum)}</select></div><div class="field"><label>Betrag</label><select class="input" id="mBet">${opt(map.betrag, 'Soll/Haben getrennt')}</select></div></div>
    <div class="row" id="mSH"><div class="field"><label>Soll (Ausgang)</label><select class="input" id="mSoll">${opt(map.soll, 'keine')}</select></div><div class="field"><label>Haben (Eingang)</label><select class="input" id="mHab">${opt(map.haben, 'keine')}</select></div></div>
    <div class="row"><div class="field"><label>Verwendungszweck</label><select class="input" id="mTxt">${opt(map.text, 'keine')}</select></div><div class="field"><label>Name / Partner</label><select class="input" id="mPar">${opt(map.partner, 'keine')}</select></div></div>
    <div class="muted" id="mPrev" style="font-size:.8rem"></div>`,
    `<button class="btn btn-primary" id="mOk">Einlesen</button>`);
  wideModal();
  const get_ = () => ({datum: +$('#mDat').value, betrag: +$('#mBet').value, soll: +$('#mSoll').value, haben: +$('#mHab').value, text: +$('#mTxt').value, partner: +$('#mPar').value});
  const parse = m => data.map(r => {
    const datum = parseDatum(r[m.datum]);
    let betrag = m.betrag >= 0 ? parseBetrag(r[m.betrag]) : (parseBetrag(r[m.haben]) || 0) - Math.abs(parseBetrag(r[m.soll]) || 0);
    return {datum, betrag, text: m.text >= 0 ? r[m.text] || '' : '', partner: m.partner >= 0 ? r[m.partner] || '' : ''};
  }).filter(x => x.datum && !isNaN(x.betrag) && x.betrag !== 0);
  const prev = () => { const m = get_(); $('#mSH').classList.toggle('hidden', m.betrag >= 0); const p = parse(m); $('#mPrev').innerHTML = p.length ? `${p.length} Umsätze erkannt, z. B.: ${deDay(p[0].datum)} · ${esc(p[0].partner)} · <b>${eur(p[0].betrag)}</b>` : '<span style="color:var(--danger)">Keine gültigen Umsätze – Spalten prüfen</span>'; };
  ['#mDat', '#mBet', '#mSoll', '#mHab', '#mTxt', '#mPar'].forEach(s => $(s).onchange = prev); prev();
  $('#mOk').onclick = () => {
    const p = parse(get_()); if (!p.length) return;
    const known = new Set(T.bankumsatz.map(b => b.hash)), seen = {};
    let neu = 0;
    p.forEach(x => {
      const base = [konto, x.datum, x.betrag, x.text, x.partner].join('|'); seen[base] = (seen[base] || 0) + 1;
      const hash = base + '#' + seen[base];
      if (known.has(hash)) return;
      put('bankumsatz', {id: uid(), hash, konto, datum: x.datum, betrag: x.betrag, text: x.text, partner: x.partner, status: 'offen'}); neu++;
    });
    flush(); closeModal(); toast(neu ? `${neu} neue Umsätze eingelesen` : 'Keine neuen Umsätze'); st.filter = 'offen'; render();
  };
}

/* ─── Liste & Zuordnung ─── */
export function renderBank() {
  const c = s => T.bankumsatz.filter(b => b.status === s).length;
  $('#bkFilter').innerHTML = [['offen', `Offen (${c('offen')})`], ['zugeordnet', `Zugeordnet (${c('zugeordnet')})`], ['ignoriert', `Ignoriert (${c('ignoriert')})`], ['alle', 'Alle']].map(([k, l]) => `<button class="chip ${st.filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('');
  $$('#bkFilter .chip').forEach(b => b.onclick = () => { st.filter = b.dataset.f; renderBank(); });
  const list = T.bankumsatz.filter(b => st.filter === 'alle' || b.status === st.filter).sort((a, b) => b.datum.localeCompare(a.datum));
  if (!T.bankumsatz.length) { $('#bkList').innerHTML = `<div class="card empty"><div>🏦</div><p>Noch kein Kontoauszug eingelesen.</p></div>`; return; }
  $('#bkList').innerHTML = list.length ? `<div class="list">${list.slice(0, 300).map(b => `<button class="li" data-id="${b.id}">
      <div class="li-thumb">${b.status === 'offen' ? '❔' : b.status === 'ignoriert' ? '➖' : '✅'}</div>
      <div class="li-main"><div class="li-title">${esc(b.partner || b.text || 'Umsatz')}</div><div class="li-sub">${deDay(b.datum)} · ${ZK[b.konto].name}${b.text && b.partner ? ' · ' + esc(b.text.slice(0, 80)) : ''}${b.zuordnung ? ' · ' + esc(b.zuordnung) : ''}</div></div>
      <div class="li-end"><b class="num" style="color:${b.betrag >= 0 ? 'var(--ok)' : 'var(--danger)'}">${b.betrag > 0 ? '+' : ''}${eur(b.betrag)}</b></div></button>`).join('')}</div>`
    : `<div class="card empty"><div>✅</div><p>Alles zugeordnet.</p></div>`;
  $$('#bkList [data-id]').forEach(el => el.onclick = () => zuordnen(el.dataset.id));
}

function vorschlaege(b) {
  const out = [], txt = (b.text + ' ' + b.partner).toLowerCase(), t0 = parseDay(b.datum);
  if (b.betrag > 0) {
    docs().filter(d => d.art === 'rechnung' && d.status === 'offen').forEach(d => {
      const nrHit = d.nr && txt.includes(d.nr.toLowerCase()), betragHit = d.total === b.betrag;
      if (nrHit || betragHit) out.push({score: (nrHit ? 2 : 0) + (betragHit ? 1 : 0), typ: 'rechnung', id: d.id, label: `Rechnung ${d.nr} · ${d.empf ? esc(d.empf.firma || d.empf.name) : ''} · ${eur(d.total)} bezahlt`});
    });
  } else {
    T.dokument.filter(d => d.betrag === -b.betrag && !d.bankId && Math.abs(parseDay(d.datum) - t0) <= 20 * 864e5)
      .forEach(d => out.push({score: 1, typ: 'archiv', id: d.id, label: `Beleg ${esc(d.partner || d.titel || '')} vom ${deDay(d.datum)} · ${eur(d.betrag)}`}));
  }
  return out.sort((a, c) => c.score - a.score).slice(0, 4);
}

function zuordnen(id) {
  const b = get('bankumsatz', id); if (!b) return;
  const v = b.status === 'offen' ? vorschlaege(b) : [];
  openModal(b.betrag >= 0 ? 'Zahlungseingang zuordnen' : 'Zahlungsausgang zuordnen', `
    <div class="doc-view"><div class="rr"><span>Datum</span><span>${deDay(b.datum)}</span></div><div class="rr"><span>Betrag</span><span><b>${eur(b.betrag)}</b></span></div>
    ${b.partner ? `<div class="rr"><span>Name</span><span>${esc(b.partner)}</span></div>` : ''}${b.text ? `<div class="rr"><span>Zweck</span><span style="text-align:right;max-width:70%">${esc(b.text)}</span></div>` : ''}
    <div class="rr"><span>Status</span><span>${esc(b.status)}${b.zuordnung ? ' – ' + esc(b.zuordnung) : ''}</span></div></div>
    ${b.status === 'offen' ? `${v.length ? `<div class="section-title">Vorschläge</div><div class="list">${v.map((x, i) => `<button class="li" data-v="${i}"><div class="li-thumb">${x.typ === 'rechnung' ? '💶' : '🗂️'}</div><div class="li-main"><div class="li-title">${x.label}</div></div></button>`).join('')}</div>` : ''}
    <div class="section-title">Neu buchen</div>
    <div class="doc-actions">${b.betrag > 0 ? `<button class="btn" data-n="einnahme">⬆️ Einnahme</button><button class="btn" data-n="einlage">Privateinlage</button>` : `<button class="btn" data-n="ausgabe">⬇️ Ausgabe</button><button class="btn" data-n="entnahme">Privatentnahme</button>`}<button class="btn" data-n="ignorieren">➖ Ignorieren (z. B. Umbuchung)</button></div>` : ''}`,
    b.status !== 'offen' ? `<button class="btn" id="bkReset">Zuordnung aufheben</button>` : '');
  $$('[data-v]').forEach(el => el.onclick = () => {
    const x = v[+el.dataset.v];
    if (x.typ === 'rechnung') {
      const d = docs().find(y => y.id === x.id);
      d.status = 'bezahlt'; d.bezahltAm = b.datum; d.zahlart = b.konto === 'paypal' ? 'PayPal' : 'Überweisung'; put('beleg', d);
      done(b, 'Rechnung ' + d.nr, {typ: 'rechnung', id: d.id});
    } else {
      const d = get('dokument', x.id); d.bankId = b.id; d.konto = b.konto; put('dokument', d);
      done(b, 'Beleg ' + (d.partner || d.titel || ''), {typ: 'archiv', id: d.id});
    }
  });
  $$('[data-n]').forEach(el => el.onclick = () => {
    const art = el.dataset.n;
    if (art === 'ignorieren') { b.status = 'ignoriert'; b.zuordnung = ''; put('bankumsatz', b); closeModal(); return render(); }
    closeModal();
    setTimeout(() => editBuchung(null, {datum: b.datum, art, kategorie: art === 'einnahme' ? 'umsatz' : art === 'ausgabe' ? (/(etsy|paypal|gebühr|gebuehr)/i.test(b.partner + b.text) ? 'gebuehren' : 'material') : art,
      konto: b.konto, betrag: Math.abs(b.betrag), text: (b.partner || b.text || '').slice(0, 60), quelle: 'bank:' + b.id}, saved => done(b, (KAT[saved.kategorie] || {}).name || 'Buchung', {typ: 'buchung', id: saved.id}, true)), 230);
  });
  if ($('#bkReset')) $('#bkReset').onclick = () => {
    const z = b.ziel || {};
    if (z.typ === 'buchung') {
      const x = get('buchung', z.id);
      if (x && x.festgeschrieben) return toast('Die Buchung ist festgeschrieben – bitte dort eine Gegenbuchung erstellen', true);
      if (x) remove('buchung', x.id);
    }
    if (z.typ === 'rechnung') { const d = docs().find(y => y.id === z.id); if (d && d.status === 'bezahlt' && d.bezahltAm === b.datum) { d.status = 'offen'; d.bezahltAm = null; d.zahlart = ''; put('beleg', d); } }
    if (z.typ === 'archiv') { const d = get('dokument', z.id); if (d) { d.bankId = null; put('dokument', d); } }
    b.status = 'offen'; b.zuordnung = ''; b.ziel = null; put('bankumsatz', b); closeModal(); render();
  };
}
function done(b, label, ziel, silent) {
  b.status = 'zugeordnet'; b.zuordnung = label; b.ziel = ziel; put('bankumsatz', b); flush();
  if (!silent) { closeModal(); toast('Zugeordnet: ' + label); }
  render();
}

export function initBank() { $('#bkFile').onchange = onFile; }
