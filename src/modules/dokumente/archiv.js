/* ═══════════════ BELEGARCHIV: Eingangsbelege, Quittungen, sonstige Dokumente ═══════════════
 * Metadaten in der Tabelle „dokument“ (im Speicher, mit kleinem Vorschaubild),
 * die Datei selbst im Datei-Speicher (nur bei Bedarf geladen).
 */
import {$, $$, esc, eur, parseMoney, moneyIn, fmtDT} from '../../core/util.js';
import {T, get, put, remove, putFile, getFile, removeFile} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {openLightbox} from '../../core/lightbox.js';
import {render} from '../../core/shell.js';
import {downloadBinary, blobToDataUrl} from '../../core/files.js';
import {isoDay, deDay} from './shared.js';

export const KATEGORIEN = ['Material & Rohstoffe', 'Wareneinkauf', 'Verpackung', 'Versandkosten', 'Gebühren (Etsy, PayPal …)', 'Werbung', 'Büro & Software', 'Fahrtkosten', 'Werkzeug & Geräte', 'Sonstige Ausgabe', 'Einnahme', 'Vertrag / Sonstiges'];
const MAX_PDF = 10 * 1024 * 1024;

export const html = `
    <div class="chips" id="arYears"></div>
    <div class="row" style="margin-bottom:10px">
      <div class="field" style="margin:0"><div class="search"><input class="input" id="arSearch" placeholder="Lieferant, Titel, Notiz…"></div></div>
      <div class="field" style="margin:0;flex:0 0 46%"><select class="input" id="arKat"><option value="">Alle Kategorien</option>${KATEGORIEN.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
    </div>
    <div class="muted" id="arSum" style="font-size:.82rem;margin:0 2px 10px"></div>
    <div id="arList"></div>
    <div class="pad-fab"></div>
    <button class="fab" id="arFab">＋ Beleg</button>
    <input type="file" id="arFile" accept="image/*,application/pdf" class="hidden">
    <input type="file" id="arCam" accept="image/*" capture="environment" class="hidden">`;

const st = {year: String(new Date().getFullYear()), q: '', kat: ''};
const docsArch = () => T.dokument;

export function renderArchiv() {
  const years = [...new Set(docsArch().map(d => (d.datum || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  if (!years.includes(st.year) && st.year !== 'all') years.unshift(st.year);
  $('#arYears').innerHTML = [...years.map(y => [y, y]), ['all', 'Alle Jahre']].map(([k, l]) => `<button class="chip ${st.year === k ? 'active' : ''}" data-y="${k}">${l}</button>`).join('');
  $$('#arYears .chip').forEach(b => b.onclick = () => { st.year = b.dataset.y; renderArchiv(); });
  const q = st.q.trim().toLowerCase();
  const list = docsArch()
    .filter(d => st.year === 'all' || (d.datum || '').startsWith(st.year))
    .filter(d => !st.kat || d.kategorie === st.kat)
    .filter(d => !q || [d.titel, d.partner, d.notiz, d.kategorie, d.name].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.erstellt || 0) - (a.erstellt || 0));
  const aus = list.filter(d => d.kategorie !== 'Einnahme').reduce((a, d) => a + (d.betrag || 0), 0);
  const ein = list.filter(d => d.kategorie === 'Einnahme').reduce((a, d) => a + (d.betrag || 0), 0);
  $('#arSum').textContent = list.length ? `${list.length} Beleg${list.length === 1 ? '' : 'e'} · Ausgaben ${eur(aus)}${ein ? ' · Einnahmen ' + eur(ein) : ''}` : '';
  if (!docsArch().length) {
    $('#arList').innerHTML = `<div class="card empty"><div>🗂️</div><p>Noch keine Belege.<br>Fotografiere Quittungen und Rechnungen oder lade PDFs hoch – so liegt alles für die Steuerberatung bereit.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" id="arFirstCam">📷 Foto aufnehmen</button><button class="btn" id="arFirstFile">📎 Datei wählen</button></div></div>`;
    $('#arFirstCam').onclick = () => $('#arCam').click(); $('#arFirstFile').onclick = () => $('#arFile').click();
    return;
  }
  $('#arList').innerHTML = list.length ? `<div class="list">${list.map(d => `<button class="li" data-id="${d.id}">
      <div class="li-thumb">${d.thumb ? `<img class="arch-thumb" src="${d.thumb}" alt="">` : d.mime === 'application/pdf' ? '📄' : '🗂️'}</div>
      <div class="li-main"><div class="li-title">${esc(d.partner || d.titel || d.name || 'Beleg')}</div><div class="li-sub">${deDay(d.datum)}${d.kategorie ? ' · ' + esc(d.kategorie) : ''}${d.titel && d.partner ? ' · ' + esc(d.titel) : ''}</div></div>
      <div class="li-end">${d.betrag != null ? `<b class="num" style="${d.kategorie === 'Einnahme' ? 'color:var(--ok)' : ''}">${eur(d.betrag)}</b>` : ''}</div></button>`).join('')}</div>`
    : `<div class="card empty"><div>🔍</div><p>Keine Belege in dieser Ansicht.</p></div>`;
  $$('#arList [data-id]').forEach(b => b.onclick = () => openBeleg(b.dataset.id));
}

/* ─── Datei einlesen ─── */
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function shrink(dataUrl, max, q, type = 'image/jpeg') {
  const img = await loadImg(dataUrl); const s = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  const cx = cv.getContext('2d'); if (type === 'image/jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
  cx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL(type, q);
}
/** Bild auf eine handliche Größe bringen (lesbar, aber klein genug für Speicher und Abgleich) */
export const shrinkImage = shrink;

async function readFile(f) {
  const raw = await blobToDataUrl(f);
  if (f.type === 'application/pdf') {
    if (f.size > MAX_PDF) throw new Error('PDF ist größer als 10 MB');
    return {data: raw, mime: 'application/pdf', name: f.name, thumb: ''};
  }
  if (!/^image\//.test(f.type)) throw new Error('Nur Fotos oder PDFs');
  const [data, thumb] = await Promise.all([shrink(raw, 2000, 0.85), shrink(raw, 160, 0.7)]);
  return {data, mime: 'image/jpeg', name: (f.name || 'foto').replace(/\.\w+$/, '') + '.jpg', thumb};
}

async function onFile(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  toast('Beleg wird gelesen …');
  try { const r = await readFile(f); editBeleg(null, r); }
  catch (err) { toast(err.message || 'Datei konnte nicht gelesen werden', true); }
}

/* ─── Erfassen / Bearbeiten ─── */
function editBeleg(id, neu) {
  const d = id ? get('dokument', id) : {datum: isoDay(Date.now()), betrag: null, partner: '', kategorie: 'Material & Rohstoffe', titel: '', notiz: '', mime: neu.mime, name: neu.name, thumb: neu.thumb};
  const lieferanten = [...new Set(T.kontakt.filter(k => k.typ !== 'kunde').map(k => k.firma || k.name).concat(T.dokument.map(x => x.partner)).filter(Boolean))].sort();
  openModal(id ? 'Beleg bearbeiten' : 'Neuer Beleg', `
    ${neu && neu.mime !== 'application/pdf' ? `<img class="arch-prev" src="${neu.data}" alt="">` : neu ? `<div class="drop" style="margin-bottom:12px">📄 ${esc(neu.name)}</div>` : ''}
    <div class="row"><div class="field"><label>Belegdatum</label><input class="input" type="date" id="bDatum" value="${d.datum || ''}"></div>
    <div class="field"><label>Betrag (€)</label><input class="input" id="bBetrag" inputmode="decimal" value="${moneyIn(d.betrag)}" placeholder="optional"></div></div>
    <div class="field"><label>Lieferant / Aussteller</label><input class="input" id="bPartner" list="bPartners" value="${esc(d.partner)}" placeholder="z. B. Baumarkt, Etsy, Deutsche Post"><datalist id="bPartners">${lieferanten.map(l => `<option value="${esc(l)}">`).join('')}</datalist></div>
    <div class="field"><label>Kategorie</label><select class="input" id="bKat">${KATEGORIEN.map(k => `<option ${k === d.kategorie ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
    <div class="field"><label>Titel / Belegnummer</label><input class="input" id="bTitel" value="${esc(d.titel)}" placeholder="z. B. Rechnung 4711, Holz Eiche"></div>
    <div class="field"><label>Notiz</label><input class="input" id="bNotiz" value="${esc(d.notiz)}"></div>`,
    `${id ? `<button class="btn btn-danger" id="bDel">Löschen</button>` : ''}<button class="btn btn-primary" id="bOk">Speichern</button>`);
  $('#bOk').onclick = async () => {
    const braw = $('#bBetrag').value.trim(), betrag = braw ? parseMoney(braw) : null;
    if (braw && (isNaN(betrag) || betrag < 0)) return toast('Ungültiger Betrag', true);
    const meta = {datum: $('#bDatum').value || isoDay(Date.now()), betrag, partner: $('#bPartner').value.trim(), kategorie: $('#bKat').value, titel: $('#bTitel').value.trim(), notiz: $('#bNotiz').value.trim()};
    $('#bOk').disabled = true;
    try {
      if (id) { Object.assign(d, meta); put('dokument', d); }
      else {
        const f = await putFile({data: neu.data, mime: neu.mime, name: neu.name});
        put('dokument', {...meta, typ: 'eingang', dateiId: f.id, mime: neu.mime, name: neu.name, size: f.size, thumb: neu.thumb});
      }
      closeModal(); toast(id ? 'Gespeichert' : 'Beleg archiviert'); render();
    } catch (err) { $('#bOk').disabled = false; toast('Speichern fehlgeschlagen: ' + (err.message || err), true); }
  };
  if ($('#bDel')) $('#bDel').onclick = async () => {
    if (!await confirmBox('Beleg löschen?', 'Belege unterliegen einer mehrjährigen Aufbewahrungspflicht. Lösche nur, was du doppelt oder versehentlich erfasst hast.', 'Löschen', true)) return;
    if (d.dateiId) await removeFile(d.dateiId).catch(() => {});
    remove('dokument', d.id); render();
  };
}

async function openBeleg(id) {
  const d = get('dokument', id); if (!d) return;
  const isImg = /^image\//.test(d.mime || '');
  openModal(d.partner || d.titel || 'Beleg', `
    <div id="bPrev">${isImg ? `<div class="drop" style="margin-bottom:12px">Bild wird geladen …</div>` : `<div class="drop" style="margin-bottom:12px">📄 ${esc(d.name || 'PDF')}</div>`}</div>
    <div class="doc-view">
      <div class="rr"><span>Datum</span><span>${deDay(d.datum)}</span></div>
      ${d.betrag != null ? `<div class="rr"><span>Betrag</span><span><b>${eur(d.betrag)}</b></span></div>` : ''}
      ${d.partner ? `<div class="rr"><span>Lieferant</span><span>${esc(d.partner)}</span></div>` : ''}
      <div class="rr"><span>Kategorie</span><span>${esc(d.kategorie || '')}</span></div>
      ${d.titel ? `<div class="rr"><span>Titel</span><span>${esc(d.titel)}</span></div>` : ''}
      ${d.notiz ? `<div class="rr"><span>Notiz</span><span>${esc(d.notiz)}</span></div>` : ''}
      <div class="rr"><span>Archiviert</span><span>${fmtDT(d.erstellt)}</span></div>
    </div>`,
    `<button class="btn" id="bEdit">Bearbeiten</button><button class="btn btn-primary" id="bOpen">${isImg ? '📤 Teilen' : '📄 Öffnen / Teilen'}</button>`);
  $('#bEdit').onclick = () => { closeModal(); setTimeout(() => editBeleg(id), 230); };
  const f = d.dateiId ? await getFile(d.dateiId).catch(() => null) : null;
  if (!f) {
    $('#bPrev').innerHTML = `<div class="alert warn" style="margin:0 0 12px">Die Datei liegt noch nicht auf diesem Gerät – sie kommt mit dem nächsten Abgleich.</div>`;
    $('#bOpen').disabled = true; return;
  }
  if (isImg) { $('#bPrev').innerHTML = `<img class="arch-prev" src="${f.data}" alt="">`; $('#bPrev img').onclick = () => openLightbox(f.data, d.partner || d.titel || 'Beleg'); }
  $('#bOpen').onclick = () => downloadBinary(f.name || d.name || 'beleg', f.data, f.mime);
}

export function initArchiv() {
  $('#arSearch').oninput = e => { st.q = e.target.value; renderArchiv(); };
  $('#arKat').onchange = e => { st.kat = e.target.value; renderArchiv(); };
  $('#arFile').onchange = onFile; $('#arCam').onchange = onFile;
  $('#arFab').onclick = () => {
    openModal('Beleg hinzufügen', `<div class="pay-methods" style="grid-template-columns:repeat(2,1fr)"><button class="pay-m" id="arPickCam"><i>📷</i>Foto aufnehmen</button><button class="pay-m" id="arPickFile"><i>📎</i>Foto oder PDF wählen</button></div>`);
    $('#arPickCam').onclick = () => { closeModal(); $('#arCam').click(); };
    $('#arPickFile').onclick = () => { closeModal(); $('#arFile').click(); };
  };
}
