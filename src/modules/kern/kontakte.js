/* ═══════════════ KONTAKTE (Kunden & Lieferanten) ═══════════════ */
import {$, $$, esc, dayKey, csv} from '../../core/util.js';
import {T, get, put, remove} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {downloadFile} from '../../core/files.js';
import {render} from '../../core/shell.js';

export const html = `
    <div class="segment" id="ktSeg"><button data-seg="all" class="active">Alle</button><button data-seg="kunde">👤 Kunden</button><button data-seg="lieferant">🚚 Lieferanten</button></div>
    <div class="search" style="margin-bottom:10px"><input class="input" id="ktSearch" placeholder="Name, Firma, Ort oder E-Mail…"></div>
    <div id="ktList"></div>
    <div style="margin-top:12px"><button class="btn btn-sm" id="ktCsv">⬇ Kontakte als CSV</button></div>
    <div class="pad-fab"></div>
    <button class="fab" id="ktFab">＋ Kontakt</button>`;

const st = {seg: 'all', q: ''};
const TYP = {kunde: '👤 Kunde', lieferant: '🚚 Lieferant', beides: '🔁 Beides'};
const label = k => k.firma ? (k.name ? `${k.firma} · ${k.name}` : k.firma) : k.name;
const hay = k => [k.name, k.firma, k.ort, k.email, k.telefon, k.nr].join(' ').toLowerCase();

export function renderKontakte() {
  $$('#ktSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === st.seg));
  const q = st.q.trim().toLowerCase();
  const list = T.kontakt
    .filter(k => st.seg === 'all' || k.typ === st.seg || k.typ === 'beides')
    .filter(k => !q || hay(k).includes(q))
    .sort((a, b) => label(a).localeCompare(label(b), 'de'));
  if (!T.kontakt.length) {
    $('#ktList').innerHTML = `<div class="card empty"><div>📇</div><p>Noch keine Kontakte.<br>Leg Kunden und Lieferanten an – später erscheinen sie auf Rechnungen und Bestellungen.</p><button class="btn btn-primary" id="ktFirst">＋ Ersten Kontakt anlegen</button></div>`;
    $('#ktFirst').onclick = () => editKontakt();
    return;
  }
  $('#ktList').innerHTML = list.length ? `<div class="list">${list.map(k => `<button class="li" data-id="${k.id}">
      <div class="li-thumb">${k.typ === 'lieferant' ? '🚚' : '👤'}</div>
      <div class="li-main"><div class="li-title">${esc(label(k))}</div><div class="li-sub">${esc([k.nr, [k.plz, k.ort].filter(Boolean).join(' '), k.email || k.telefon].filter(Boolean).join(' · ')) || '&nbsp;'}</div></div>
      <div class="li-end"><span class="badge ${k.typ === 'lieferant' ? 'gray' : ''}">${TYP[k.typ] || ''}</span></div></button>`).join('')}</div>`
    : `<div class="card empty"><div>🔍</div><p>Keine Treffer.</p></div>`;
  $$('#ktList [data-id]').forEach(b => b.onclick = () => editKontakt(b.dataset.id));
}

export function nextNr(typ) {
  const pre = typ === 'lieferant' ? 'L' : 'K';
  const max = T.kontakt.map(k => k.nr || '').filter(n => n.startsWith(pre)).map(n => parseInt(n.slice(1), 10) || 0).reduce((a, b) => Math.max(a, b), 1000);
  return pre + (max + 1);
}

export function editKontakt(id) {
  const isNew = !id;
  const k = id ? get('kontakt', id) : {typ: st.seg === 'lieferant' ? 'lieferant' : 'kunde', name: '', firma: '', strasse: '', plz: '', ort: '', land: 'Deutschland', email: '', telefon: '', notiz: ''};
  if (!k) return;
  openModal(isNew ? 'Neuer Kontakt' : 'Kontakt bearbeiten', `
    <div class="segment" id="kTyp">${Object.entries(TYP).map(([v, l]) => `<button data-t="${v}" class="${k.typ === v ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="row"><div class="field"><label>Name</label><input class="input" id="kName" value="${esc(k.name)}" placeholder="Vor- und Nachname"></div>
    <div class="field"><label>Firma</label><input class="input" id="kFirma" value="${esc(k.firma)}" placeholder="optional"></div></div>
    <div class="field"><label>Straße & Hausnummer</label><input class="input" id="kStr" value="${esc(k.strasse)}"></div>
    <div class="row"><div class="field" style="flex:0 0 100px"><label>PLZ</label><input class="input" id="kPlz" value="${esc(k.plz)}" inputmode="numeric"></div>
    <div class="field"><label>Ort</label><input class="input" id="kOrt" value="${esc(k.ort)}"></div></div>
    <div class="field"><label>Land</label><input class="input" id="kLand" value="${esc(k.land)}"></div>
    <div class="row"><div class="field"><label>E-Mail</label><input class="input" id="kMail" type="email" value="${esc(k.email)}"></div>
    <div class="field"><label>Telefon</label><input class="input" id="kTel" type="tel" value="${esc(k.telefon)}"></div></div>
    <div class="field"><label>Notiz</label><textarea class="input" id="kNotiz" rows="2">${esc(k.notiz)}</textarea></div>
    ${k.nr ? `<div class="muted" style="font-size:.75rem">Kontakt-Nr. ${esc(k.nr)}</div>` : ''}`,
    `${!isNew ? `<button class="btn btn-danger" id="kDel">Löschen</button>` : ''}<button class="btn btn-primary" id="kOk">Speichern</button>`);
  let typ = k.typ;
  $$('#kTyp button').forEach(b => b.onclick = () => { typ = b.dataset.t; $$('#kTyp button').forEach(x => x.classList.toggle('active', x === b)); });
  if (isNew) setTimeout(() => $('#kName').focus(), 250);
  $('#kOk').onclick = () => {
    const data = {typ, name: $('#kName').value.trim(), firma: $('#kFirma').value.trim(), strasse: $('#kStr').value.trim(), plz: $('#kPlz').value.trim(), ort: $('#kOrt').value.trim(), land: $('#kLand').value.trim(), email: $('#kMail').value.trim(), telefon: $('#kTel').value.trim(), notiz: $('#kNotiz').value.trim()};
    if (!data.name && !data.firma) return toast('Bitte Name oder Firma eingeben', true);
    if (isNew) put('kontakt', {...data, nr: nextNr(typ)});
    else { Object.assign(k, data); put('kontakt', k); }
    closeModal(); toast(isNew ? 'Kontakt angelegt' : 'Gespeichert'); render();
  };
  if (!isNew) $('#kDel').onclick = async () => {
    if (!await confirmBox('Kontakt löschen?', `„${esc(label(k))}“ wird gelöscht.`, 'Löschen', true)) return;
    remove('kontakt', id); render();
  };
}

function exportCsv() {
  if (!T.kontakt.length) return toast('Keine Kontakte vorhanden', true);
  const rows = [['Nr.', 'Typ', 'Name', 'Firma', 'Straße', 'PLZ', 'Ort', 'Land', 'E-Mail', 'Telefon', 'Notiz']];
  T.kontakt.forEach(k => rows.push([k.nr || '', (TYP[k.typ] || '').replace(/^\S+ /, ''), k.name, k.firma, k.strasse, k.plz, k.ort, k.land, k.email, k.telefon, k.notiz]));
  downloadFile(`kontorwerk-kontakte-${dayKey(Date.now())}.csv`, csv(rows), 'text/csv');
}

export function initKontakte() {
  $$('#ktSeg button').forEach(b => b.onclick = () => { st.seg = b.dataset.seg; renderKontakte(); });
  $('#ktSearch').oninput = e => { st.q = e.target.value; renderKontakte(); };
  $('#ktFab').onclick = () => editKontakt();
  $('#ktCsv').onclick = exportCsv;
}
