/* ═══════════════ BUCHUNGEN & KONTEN (Journal) ═══════════════ */
import {$, $$, esc, eur, parseMoney, moneyIn} from '../../core/util.js';
import {T, get, put, remove, flush} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {isoDay, deDay} from '../dokumente/shared.js';
import {KAT, KAT_EIN, KAT_AUS, ZK, syncBuchungen, kontostand, wirkung, monate, pm} from './shared.js';

export const html = `
    <div class="stats-grid" id="bhKonten"></div>
    <div class="chips" id="bhYears" style="margin-top:12px"></div>
    <div class="row" style="margin-bottom:8px">
      <div class="field" style="margin:0"><select class="input" id="bhMonat"><option value="">Ganzes Jahr</option>${monate.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><select class="input" id="bhArt"><option value="">Alle Buchungen</option><option value="einnahme">Einnahmen</option><option value="ausgabe">Ausgaben</option><option value="privat">Privat (Entnahmen/Einlagen)</option></select></div>
      <div class="field" style="margin:0"><select class="input" id="bhKonto"><option value="">Alle Konten</option>${Object.entries(ZK).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></div>
    </div>
    <div class="search" style="margin-bottom:8px"><input class="input" id="bhSearch" placeholder="Text, Belegnummer, Kategorie…"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div class="muted" id="bhSum" style="font-size:.82rem"></div>
      <button class="btn btn-sm" id="bhLock">🔒 Monat festschreiben</button>
    </div>
    <div id="bhList"></div>
    <div class="pad-fab"></div>
    <button class="fab" id="bhFab">＋ Buchung</button>`;

const st = {year: String(new Date().getFullYear()), monat: '', art: '', konto: '', q: ''};
const QUELLE = {bon: 'Verkauf (Bon)', zahlung: 'Rechnung bezahlt', erstattung: 'Gutschrift ausgezahlt', archiv: 'Belegarchiv', bank: 'Bankabgleich'};
const quelleName = b => b.quelle ? QUELLE[b.quelle.split(':')[0]] || '' : 'manuell';
const katName = k => (KAT[k] || {}).name || k || '';

function filtered() {
  const pre = st.monat ? pm(st.year, st.monat) : st.year, q = st.q.trim().toLowerCase();
  return T.buchung.filter(b => (b.datum || '').startsWith(pre))
    .filter(b => !st.art || (st.art === 'privat' ? (b.art === 'entnahme' || b.art === 'einlage') : b.art === st.art))
    .filter(b => !st.konto || b.konto === st.konto)
    .filter(b => !q || [b.text, b.beleg, katName(b.kategorie), quelleName(b)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.erstellt || 0) - (a.erstellt || 0));
}

export function renderBuchungen() {
  const n = syncBuchungen(); if (n) flush();
  const heute = isoDay(Date.now());
  $('#bhKonten').innerHTML = Object.entries(ZK).map(([k, v], i) => {
    const s = kontostand(k, heute);
    return `<div class="stat-card" style="--sc:${['var(--ok)', 'var(--indigo)', 'var(--warn)'][i]}"><div class="sc-label">${v.name}</div><div class="sc-value" style="${s < 0 && k === 'kasse' ? 'color:var(--danger)' : ''}">${eur(s)}</div><div class="sc-sub">${k === 'kasse' && s < 0 ? '⚠️ Kasse darf nicht negativ sein' : 'Stand heute'}</div></div>`;
  }).join('');
  const years = [...new Set([String(new Date().getFullYear()), ...T.buchung.map(b => (b.datum || '').slice(0, 4)).filter(Boolean)])].sort().reverse();
  $('#bhYears').innerHTML = years.map(y => `<button class="chip ${st.year === y ? 'active' : ''}" data-y="${y}">${y}</button>`).join('');
  $$('#bhYears .chip').forEach(b => b.onclick = () => { st.year = b.dataset.y; renderBuchungen(); });
  const list = filtered();
  const ein = list.filter(b => b.art === 'einnahme').reduce((a, b) => a + b.betrag, 0), aus = list.filter(b => b.art === 'ausgabe').reduce((a, b) => a + b.betrag, 0);
  $('#bhSum').textContent = `${list.length} Buchung${list.length === 1 ? '' : 'en'} · Einnahmen ${eur(ein)} · Ausgaben ${eur(aus)} · Ergebnis ${eur(ein - aus)}`;
  const offenMonat = st.monat && T.buchung.some(b => (b.datum || '').startsWith(pm(st.year, st.monat)) && !b.festgeschrieben);
  $('#bhLock').classList.toggle('hidden', !offenMonat);
  if (!T.buchung.length) {
    $('#bhList').innerHTML = `<div class="card empty"><div>📒</div><p>Noch keine Buchungen.<br>Verkäufe, bezahlte Rechnungen und Belege mit Betrag erscheinen hier automatisch. Alles andere trägst du mit „＋ Buchung“ ein oder holst es über den Bankabgleich.</p></div>`;
    return;
  }
  $('#bhList').innerHTML = list.length ? `<div class="list">${list.slice(0, 400).map(b => {
    const w = wirkung(b);
    return `<button class="li" data-id="${b.id}"><div class="li-thumb">${b.art === 'einnahme' ? '⬆️' : b.art === 'ausgabe' ? '⬇️' : '👤'}</div>
      <div class="li-main"><div class="li-title">${esc(b.text || katName(b.kategorie))}</div><div class="li-sub">${deDay(b.datum)} · ${esc(katName(b.kategorie))} · ${ZK[b.konto] ? ZK[b.konto].name : ''}${b.beleg ? ' · ' + esc(b.beleg) : ''} · ${quelleName(b)}${b.festgeschrieben ? ' · 🔒' : ''}</div></div>
      <div class="li-end"><b class="num" style="color:${w >= 0 ? 'var(--ok)' : 'var(--danger)'}">${w > 0 ? '+' : ''}${eur(w)}</b></div></button>`;
  }).join('')}${list.length > 400 ? `<div class="li muted" style="justify-content:center;font-size:.8rem">… ${list.length - 400} weitere – Zeitraum eingrenzen</div>` : ''}</div>`
    : `<div class="card empty"><div>🔍</div><p>Keine Buchungen in dieser Ansicht.</p></div>`;
  $$('#bhList [data-id]').forEach(el => el.onclick = () => openBuchung(el.dataset.id));
}

/** Buchung anlegen/bearbeiten. vorgabe: Felder für eine neue Buchung (z. B. aus dem Bankabgleich) */
export function editBuchung(id, vorgabe, onSaved) {
  const b = id ? get('buchung', id) : {datum: isoDay(Date.now()), art: 'ausgabe', kategorie: 'material', konto: 'bank', betrag: null, text: '', beleg: '', ...(vorgabe || {})};
  const katOpts = art => (art === 'einnahme' ? KAT_EIN : art === 'ausgabe' ? KAT_AUS : [art]).map(k => `<option value="${k}" ${k === b.kategorie ? 'selected' : ''}>${esc(KAT[k].name)}</option>`).join('');
  openModal(id ? 'Buchung bearbeiten' : 'Neue Buchung', `
    <div class="segment" id="bArt">${[['einnahme', '⬆️ Einnahme'], ['ausgabe', '⬇️ Ausgabe'], ['entnahme', '👤 Entnahme'], ['einlage', '💰 Einlage']].map(([k, l]) => `<button data-a="${k}" class="${b.art === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="row"><div class="field"><label>Datum (Zahlung)</label><input class="input" type="date" id="bDat" value="${b.datum}"></div>
    <div class="field"><label>Betrag (€)</label><input class="input" id="bBet" inputmode="decimal" value="${moneyIn(b.betrag)}" placeholder="0,00" style="font-weight:700"></div></div>
    <div class="row"><div class="field"><label>Kategorie</label><select class="input" id="bKatSel">${katOpts(b.art)}</select></div>
    <div class="field" style="flex:0 0 34%"><label>Konto</label><select class="input" id="bKto">${Object.entries(ZK).map(([k, v]) => `<option value="${k}" ${k === b.konto ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div></div>
    <div class="field"><label>Buchungstext</label><input class="input" id="bTxt" value="${esc(b.text)}" placeholder="z. B. Etsy-Auszahlung Oktober"></div>
    <div class="field"><label>Belegnummer</label><input class="input" id="bBel" value="${esc(b.beleg)}" placeholder="optional"></div>
    ${b.art === 'entnahme' || b.art === 'einlage' ? '' : `<div class="muted" style="font-size:.75rem">Gebucht wird am Tag der Zahlung (Zufluss-/Abflussprinzip der EÜR).</div>`}`,
    `${id ? `<button class="btn btn-danger" id="bDelB">Löschen</button>` : ''}<button class="btn btn-primary" id="bSaveB">Speichern</button>`);
  let art = b.art;
  $$('#bArt button').forEach(x => x.onclick = () => {
    art = x.dataset.a; $$('#bArt button').forEach(y => y.classList.toggle('active', y === x));
    b.kategorie = art === 'einnahme' ? 'umsatz' : art === 'ausgabe' ? 'material' : art; $('#bKatSel').innerHTML = katOpts(art);
  });
  $('#bSaveB').onclick = () => {
    const v = parseMoney($('#bBet').value);
    if (isNaN(v) || v <= 0) return toast('Bitte Betrag eingeben', true);
    const data = {datum: $('#bDat').value || isoDay(Date.now()), art, kategorie: $('#bKatSel').value, konto: $('#bKto').value, betrag: v, text: $('#bTxt').value.trim(), beleg: $('#bBel').value.trim()};
    const saved = id ? put('buchung', Object.assign(b, data)) : put('buchung', {...b, ...data});
    closeModal(); toast('Gebucht'); if (onSaved) onSaved(saved); render();
  };
  if ($('#bDelB')) $('#bDelB').onclick = async () => {
    if (!await confirmBox('Buchung löschen?', 'Die Buchung wird gelöscht.', 'Löschen', true)) return;
    remove('buchung', id); render();
  };
}

function openBuchung(id) {
  const b = get('buchung', id); if (!b) return;
  if (!b.festgeschrieben && !b.auto) return editBuchung(id);
  openModal(b.text || katName(b.kategorie), `<div class="doc-view">
      <div class="rr"><span>Datum</span><span>${deDay(b.datum)}</span></div>
      <div class="rr"><span>Art</span><span>${esc(b.art)}</span></div>
      <div class="rr"><span>Betrag</span><span><b>${eur(b.betrag)}</b></span></div>
      <div class="rr"><span>Kategorie</span><span>${esc(katName(b.kategorie))}</span></div>
      <div class="rr"><span>Konto</span><span>${ZK[b.konto] ? ZK[b.konto].name : ''}</span></div>
      ${b.beleg ? `<div class="rr"><span>Beleg</span><span>${esc(b.beleg)}</span></div>` : ''}
      <div class="rr"><span>Herkunft</span><span>${quelleName(b)}${b.korrektur ? ' (Korrektur)' : ''}</span></div>
      <div class="rr"><span>Status</span><span>${b.festgeschrieben ? '🔒 festgeschrieben' : 'offen'}</span></div></div>
      <p class="muted" style="font-size:.8rem;line-height:1.5;margin-top:10px">${b.auto ? 'Diese Buchung entsteht automatisch. Änderungen machst du an der Quelle (Bon, Rechnung oder Beleg) – KONTORWERK zieht die Buchung nach' + (b.festgeschrieben ? ' und trägt bei festgeschriebenen Monaten eine Korrekturbuchung ein.' : '.') : 'Festgeschriebene Buchungen lassen sich nicht ändern. Für eine Korrektur erstellst du eine Gegenbuchung.'}</p>`,
    b.festgeschrieben && !b.auto ? `<button class="btn btn-danger" id="bGegen">↩ Gegenbuchung erstellen</button>` : '');
  if ($('#bGegen')) $('#bGegen').onclick = () => {
    const {id: _i, erstellt, geaendert, geraet, festgeschrieben, festTs, ...rest} = b;
    put('buchung', {...rest, betrag: -b.betrag, datum: isoDay(Date.now()), text: 'Storno: ' + (b.text || ''), korrektur: true});
    closeModal(); toast('Gegenbuchung erstellt'); render();
  };
}

async function lockMonth() {
  const pre = pm(st.year, st.monat), list = T.buchung.filter(b => (b.datum || '').startsWith(pre) && !b.festgeschrieben);
  if (!await confirmBox(`${monate[st.monat - 1]} ${st.year} festschreiben?`, `${list.length} Buchung${list.length === 1 ? '' : 'en'} werden festgeschrieben und sind danach unveränderbar (GoBD). Spätere Änderungen erscheinen als Korrekturbuchung.`, 'Festschreiben', true)) return;
  const ts = Date.now(); list.forEach(b => { b.festgeschrieben = true; b.festTs = ts; put('buchung', b); }); flush();
  toast(`${monate[st.monat - 1]} festgeschrieben`); render();
}

export function initBuchungen() {
  $('#bhMonat').onchange = e => { st.monat = e.target.value ? +e.target.value : ''; renderBuchungen(); };
  $('#bhArt').onchange = e => { st.art = e.target.value; renderBuchungen(); };
  $('#bhKonto').onchange = e => { st.konto = e.target.value; renderBuchungen(); };
  $('#bhSearch').oninput = e => { st.q = e.target.value; renderBuchungen(); };
  $('#bhFab').onclick = () => editBuchung();
  $('#bhLock').onclick = lockMonth;
}
