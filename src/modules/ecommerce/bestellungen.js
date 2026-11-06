/* ═══════════════ BESTELLUNGEN (Etsy) + Import-Dialog ═══════════════ */
import {$, $$, esc, eur} from '../../core/util.js';
import {T, get, put, flush} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {isActive, mod} from '../../core/modules.js';
import {readText} from '../../core/csvimport.js';
import {deDay, isoDay} from '../dokumente/shared.js';
import {nextNr as kontaktNr} from '../kern/kontakte.js';
import {shops, shopById, shopName, istDigital, STATUS, umsatzVon, offeneBestellungen, verknuepfe, storniere, bucheBestand, analysiere, sortiere, importiere, ergebnisText, ARTEN} from './shared.js';
import {editShop} from './shops.js';

export const html = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" data-etsy-import>📥 Etsy-Dateien einlesen</button>
        <span class="muted" style="font-size:.78rem;flex:1;min-width:200px">Bestellungen, bestellte Artikel, Angebote und Monatsabrechnung – alle auf einmal möglich.</span>
      </div>
    </div>
    <div class="stats-grid" id="ebStats"></div>
    <div class="chips" id="ebShops" style="margin-top:12px"></div>
    <div class="chips" id="ebStatus"></div>
    <div class="search" style="margin-bottom:8px"><input class="input" id="ebSearch" placeholder="Name, Bestellnummer, Artikel…"></div>
    <div id="ebList"></div>`;

const st = {shop: '', status: 'offen', q: ''};
export const shopChips = (sel, cur, onPick) => {
  const el = $(sel); if (shops().length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = [['', 'Alle Shops'], ...shops().map(s => [s.id, (s.art === 'digital' ? '💾 ' : '🔨 ') + s.name])].map(([id, l]) => `<button class="chip ${cur === id ? 'active' : ''}" data-s="${id}">${esc(l)}</button>`).join('');
  $$(sel + ' .chip').forEach(b => b.onclick = () => onPick(b.dataset.s));
};
export function keinShop(sel) {
  $(sel).innerHTML = `<div class="card empty"><div>🛒</div><p>Lege zuerst deinen Etsy-Shop an. Bei mehreren Shops (z. B. digitale Produkte und Handgemachtes) legst du jeden einzeln an – sie werden getrennt ausgewertet.</p><button class="btn btn-primary" data-new-shop>＋ Shop anlegen</button></div>`;
  $$(sel + ' [data-new-shop]').forEach(b => b.onclick = () => editShop(null, () => render()));
}

const posTxt = o => (o.positionen || []).map(p => (p.menge > 1 ? p.menge + '× ' : '') + p.titel).join(', ');

export function renderBestellungen() {
  if (!shops().length) { $('#ebStats').innerHTML = ''; $('#ebShops').innerHTML = ''; $('#ebStatus').innerHTML = ''; return keinShop('#ebList'); }
  if (st.shop && !shopById(st.shop)) st.shop = '';
  const alle = T.bestellung.filter(o => !st.shop || o.shopId === st.shop);
  const m0 = isoDay(Date.now()).slice(0, 7), monat = alle.filter(o => (o.datum || '').startsWith(m0));
  const offen = alle.filter(o => o.status === 'offen' && !istDigital(o.shopId));
  $('#ebStats').innerHTML = `
    <div class="stat-card" style="--sc:var(--warn)"><div class="sc-label">Zu versenden</div><div class="sc-value">${offen.length}</div><div class="sc-sub">${offen.length ? 'älteste vom ' + deDay(offen.map(o => o.datum).sort()[0]) : 'alles raus'}</div></div>
    <div class="stat-card" style="--sc:#f1641e"><div class="sc-label">Umsatz diesen Monat</div><div class="sc-value">${eur(monat.reduce((a, o) => a + umsatzVon(o), 0))}</div><div class="sc-sub">${monat.filter(o => o.status !== 'storniert').length} Bestellungen</div></div>`;
  shopChips('#ebShops', st.shop, id => { st.shop = id; renderBestellungen(); });
  const c = s => alle.filter(o => o.status === s).length;
  $('#ebStatus').innerHTML = [['offen', `Offen (${c('offen')})`], ['versendet', `Versendet (${c('versendet')})`], ['erledigt', `Digital erledigt (${c('erledigt')})`], ['storniert', `Storniert (${c('storniert')})`], ['alle', 'Alle']]
    .filter(([k]) => k === 'alle' || k === 'offen' || c(k)).map(([k, l]) => `<button class="chip ${st.status === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('');
  $$('#ebStatus .chip').forEach(b => b.onclick = () => { st.status = b.dataset.f; renderBestellungen(); });
  if (!T.bestellung.length) {
    $('#ebList').innerHTML = `<div class="card empty"><div>📥</div><p>Noch keine Bestellungen eingelesen.<br>In Etsy: <b>Shop-Manager → Einstellungen → Optionen → Daten herunterladen</b>. Dort unter „Bestellungen“ die Dateien <b>Bestellungen</b> und <b>Bestellte Artikel</b> für einen Monat oder ein Jahr herunterladen und hier einlesen.</p></div>`;
    return;
  }
  const q = st.q.trim().toLowerCase();
  const list = alle.filter(o => st.status === 'alle' || o.status === st.status)
    .filter(o => !q || [o.orderId, o.name, o.kaeufer, posTxt(o)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || String(b.orderId).localeCompare(String(a.orderId)));
  $('#ebList').innerHTML = list.length ? `<div class="list">${list.slice(0, 300).map(o => {
    const [sl, sc] = STATUS[o.status] || [o.status, 'gray'], offenPos = (o.positionen || []).some(p => !p.produktId) && !istDigital(o.shopId);
    return `<button class="li" data-id="${o.id}"><div class="li-thumb">${istDigital(o.shopId) ? '💾' : o.status === 'offen' ? '📦' : o.status === 'storniert' ? '✖️' : '✅'}</div>
      <div class="li-main"><div class="li-title">${esc(o.name || o.kaeufer || 'Bestellung')} <span class="muted" style="font-weight:500">#${esc(o.orderId)}</span></div>
      <div class="li-sub">${deDay(o.datum)}${shops().length > 1 ? ' · ' + esc(shopName(o.shopId)) : ''} · ${esc(posTxt(o).slice(0, 70) || (o.anzahl ? o.anzahl + ' Artikel' : 'Artikel noch nicht eingelesen'))}${offenPos ? ' · <span style="color:var(--warn)">⚠️ nicht verknüpft</span>' : ''}</div></div>
      <div class="li-end"><b class="num">${eur(o.umsatz || 0)}</b><span class="badge ${sc}">${sl}</span></div></button>`;
  }).join('')}</div>` : `<div class="card empty"><div>🔍</div><p>Keine Bestellungen in dieser Ansicht.</p></div>`;
  $$('#ebList [data-id]').forEach(el => el.onclick = () => openBestellung(el.dataset.id));
}

/* ─── Detail ─── */
export function openBestellung(id) {
  const o = get('bestellung', id); if (!o) return;
  const digital = istDigital(o.shopId), a = o.adresse || {}, prods = [...T.produkt].filter(p => p.active || o.positionen.some(x => x.produktId === p.id)).sort((x, y) => x.name.localeCompare(y.name, 'de'));
  const anschrift = [o.name, a.strasse, [a.plz, a.ort].filter(Boolean).join(' '), a.region, a.land].filter(Boolean);
  const [sl, sc] = STATUS[o.status] || [o.status, 'gray'];
  openModal(`Bestellung #${o.orderId}`, `
    <div class="doc-view">
      <div class="rr"><span>Shop</span><span>${esc(shopName(o.shopId))}</span></div>
      <div class="rr"><span>Datum</span><span>${deDay(o.datum)}</span></div>
      <div class="rr"><span>Käufer</span><span>${esc(o.name || '')}${o.kaeufer ? ` <span class="muted">(${esc(o.kaeufer)})</span>` : ''}</span></div>
      <div class="rr"><span>Status</span><span><span class="badge ${sc}">${sl}</span>${o.versendetAm ? ' am ' + deDay(o.versendetAm) : ''}${o.tracking ? ' · ' + esc(o.tracking) : ''}</span></div>
    </div>
    ${!digital && anschrift.length > 1 ? `<div class="section-title">Lieferanschrift <button class="btn btn-sm" id="obCopy">📋 Kopieren</button></div><div class="card" style="font-size:.88rem;line-height:1.55;white-space:pre-line">${esc(anschrift.join('\n'))}</div>` : ''}
    <div class="section-title">Artikel</div>
    ${o.positionen.length ? `<div class="list">${o.positionen.map((p, i) => `<div class="li" style="cursor:default;flex-wrap:wrap">
      <div class="li-main" style="min-width:180px"><div class="li-title" style="font-size:.88rem">${p.menge}× ${esc(p.titel)}</div><div class="li-sub">${p.variante ? esc(p.variante) + ' · ' : ''}${p.sku ? 'Nr. ' + esc(p.sku) + ' · ' : ''}${eur(p.preis)}${p.gebucht ? ' · 📤 Bestand abgebucht' : ''}</div></div>
      ${digital ? '' : `<select class="input" data-pos="${i}" style="max-width:220px;font-size:.82rem" ${p.gebucht ? 'disabled' : ''}><option value="">— Produkt verknüpfen —</option>${prods.map(x => `<option value="${x.id}" ${x.id === p.produktId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`}</div>`).join('')}</div>`
      : `<p class="muted" style="font-size:.82rem">Die einzelnen Artikel stehen in der Etsy-Datei „Bestellte Artikel“. Lies sie ein, um Bestand und Produkte zu verknüpfen.</p>`}
    <div class="doc-view" style="margin-top:10px">
      ${o.warenwert ? `<div class="rr"><span>Warenwert</span><span>${eur(o.warenwert)}</span></div>` : ''}
      ${o.rabatt ? `<div class="rr"><span>Rabatt</span><span>−${eur(o.rabatt)}</span></div>` : ''}
      ${o.versand ? `<div class="rr"><span>Versand</span><span>${eur(o.versand)}</span></div>` : ''}
      <div class="rr"><span><b>Umsatz für dich</b></span><span><b>${eur(o.umsatz || 0)}</b></span></div>
      ${o.steuer ? `<div class="rr"><span>Steuer (zieht Etsy ein)</span><span class="muted">${eur(o.steuer)}</span></div>` : ''}
      ${o.netto != null ? `<div class="rr"><span>Netto laut Etsy</span><span class="muted">${eur(o.netto)}</span></div>` : ''}
    </div>
    <p class="muted" style="font-size:.75rem;line-height:1.5;margin-top:8px">Gebucht wird über die Etsy-Monatsabrechnung (Etsy-Konto) – so stimmen Einnahmen, Gebühren und Auszahlungen genau.</p>`,
    `<div class="doc-actions" style="width:100%">
      ${o.status === 'offen' && !digital ? `<button class="btn btn-primary" id="obShip">🚚 Versendet</button>` : ''}
      ${o.status === 'versendet' ? `<button class="btn" id="obReopen">↩ Wieder offen</button>` : ''}
      ${isActive('dokumente') && o.status !== 'storniert' ? `<button class="btn" id="obLs">📄 Lieferschein</button><button class="btn" id="obRe">💶 Rechnung</button>` : ''}
      <button class="btn" id="obKontakt">👤 Als Kontakt</button>
      ${o.status !== 'storniert' ? `<button class="btn btn-danger" id="obStorno">Stornieren</button>` : ''}
    </div>`);
  $$('[data-pos]').forEach(s => s.onchange = () => {
    const n = verknuepfe(o, o.positionen[+s.dataset.pos], s.value); flush();
    toast(n ? 'Verknüpft, Bestand abgebucht' : s.value ? 'Verknüpft' : 'Verknüpfung gelöst'); openBestellung(id); render();
  });
  if ($('#obCopy')) $('#obCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(anschrift.join('\n')).then(() => toast('Anschrift kopiert'), () => toast('Kopieren nicht möglich', true)); };
  if ($('#obShip')) $('#obShip').onclick = () => versendet(o);
  if ($('#obReopen')) $('#obReopen').onclick = () => { o.status = 'offen'; o.versendetAm = null; put('bestellung', o); openBestellung(id); render(); };
  if ($('#obStorno')) $('#obStorno').onclick = async () => {
    if (!await confirmBox('Bestellung stornieren?', 'Abgebuchter Bestand wird zurückgebucht. Die Erstattung selbst kommt mit der Etsy-Monatsabrechnung in die Buchhaltung.', 'Stornieren', true)) return;
    storniere(o); flush(); toast('Storniert'); render();
  };
  if ($('#obKontakt')) $('#obKontakt').onclick = () => {
    const ex = T.kontakt.find(k => k.etsy === o.kaeufer && o.kaeufer || (k.name === o.name && k.plz === (a.plz || '')));
    if (ex) return toast('Kontakt gibt es schon: ' + (ex.nr || ex.name));
    put('kontakt', {typ: 'kunde', nr: kontaktNr('kunde'), name: o.name || o.kaeufer, firma: '', strasse: a.strasse || '', plz: a.plz || '', ort: a.ort || '', land: a.land || '', email: '', telefon: '', notiz: `Etsy-Käufer ${o.kaeufer || ''}`.trim(), etsy: o.kaeufer || ''});
    toast('Kontakt angelegt');
  };
  const doc = art => () => {
    const D = mod('dokumente').api;
    closeModal();
    setTimeout(() => D.editDoc({art, status: 'entwurf', datum: isoDay(Date.now()), leistung: o.versendetAm || o.datum, zielTage: 0, gueltigBis: isoDay(Date.now() + 30 * 864e5), kontaktId: null, keinLager: true,
      empf: {name: o.name || '', firma: '', strasse: a.strasse || '', plz: a.plz || '', ort: a.ort || '', land: a.land || ''}, betreff: `Etsy-Bestellung #${o.orderId}`,
      einleitung: art === 'rechnung' ? `vielen Dank für deine Bestellung #${o.orderId} bei ${shopName(o.shopId)}. Der Betrag wurde bereits über Etsy bezahlt.` : `anbei deine Bestellung #${o.orderId}.`, schluss: '', notiz: 'aus Etsy-Bestellung ' + o.orderId,
      positionen: [...o.positionen.map(p => ({pid: p.produktId || null, text: p.titel + (p.variante ? ` (${p.variante})` : ''), menge: p.menge, einheit: 'Stk', preis: p.preis})),
        ...(o.versand ? [{pid: null, text: 'Versand', menge: 1, einheit: 'pauschal', preis: o.versand}] : []), ...(o.rabatt ? [{pid: null, text: 'Rabatt', menge: 1, einheit: 'pauschal', preis: -o.rabatt}] : [])]}, art), 230);
  };
  if ($('#obLs')) $('#obLs').onclick = doc('lieferschein');
  if ($('#obRe')) $('#obRe').onclick = doc('rechnung');
}

function versendet(o) {
  openModal('Als versendet markieren', `
    <div class="row"><div class="field"><label>Versanddatum</label><input class="input" type="date" id="vsDat" value="${isoDay(Date.now())}"></div>
    <div class="field"><label>Sendungsnummer</label><input class="input" id="vsNr" placeholder="optional"></div></div>
    <p class="muted" style="font-size:.78rem">Trag den Versand auch in Etsy ein, damit der Käufer benachrichtigt wird.</p>`,
    `<button class="btn btn-primary" id="vsOk">Speichern</button>`);
  $('#vsOk').onclick = () => { o.status = 'versendet'; o.versendetAm = $('#vsDat').value || isoDay(Date.now()); o.tracking = $('#vsNr').value.trim(); put('bestellung', o); closeModal(); toast('Versendet'); render(); };
}

/* ─── Import ─── */
export function openImport() {
  if (!shops().length) return editShop(null, () => openImport());
  openModal('Etsy-Dateien einlesen', `
    <div class="field"><label>Shop</label><select class="input" id="eiShop">${shops().map(s => `<option value="${s.id}">${esc(s.name)}${s.art === 'digital' ? ' (digital)' : ''}</option>`).join('')}</select></div>
    <div class="field" id="eiBestF"><label>Bestand abbuchen für neue Bestellungen</label><select class="input" id="eiBest">
      <option value="offen">nur noch nicht versendete (empfohlen)</option><option value="alle">alle eingelesenen</option><option value="keine">keine – nur ansehen</option></select></div>
    <label class="btn btn-primary btn-block">📂 CSV-Dateien auswählen<input type="file" id="eiFile" accept=".csv,text/csv,text/plain" multiple class="hidden"></label>
    <div id="eiRes" style="margin-top:12px"></div>
    <details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600;font-size:.85rem">Wo finde ich die Dateien?</summary>
      <div class="muted" style="font-size:.8rem;line-height:1.55;margin-top:6px">
      <b>Bestellungen</b> und <b>Bestellte Artikel</b>: Shop-Manager → Einstellungen → Optionen → Daten herunterladen → Bestellungen (CSV-Typ wählen, Monat oder ganzes Jahr).<br>
      <b>Angebote</b>: an derselben Stelle „Derzeit zum Verkauf stehende Angebote“ – liefert Etsy-Bestand und Preise.<br>
      <b>Monatsabrechnung</b>: Shop-Manager → Finanzen → Monatsabrechnungen → Monat wählen → CSV herunterladen. Sie bringt Verkäufe, Gebühren und Auszahlungen in die Buchhaltung.<br>
      Mehrfach einlesen ist kein Problem – Doppelte werden erkannt.</div></details>`, '');
  const upd = () => { $('#eiBestF').classList.toggle('hidden', istDigital($('#eiShop').value)); };
  $('#eiShop').onchange = upd; upd();
  $('#eiFile').onchange = async e => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    const shopId = $('#eiShop').value, bestand = $('#eiBest').value, out = [];
    const erkannt = [];
    for (const f of files) {
      try { const a = analysiere(await readText(f)); if (a.art) erkannt.push({...a, name: f.name}); else out.push(`<div class="alert warn" style="margin:0 0 6px">${esc(f.name)}: keine bekannte Etsy-Datei</div>`); }
      catch (err) { out.push(`<div class="alert danger" style="margin:0 0 6px">${esc(f.name)}: ${esc(err.message)}</div>`); }
    }
    sortiere(erkannt).forEach(f => { const r = importiere(f, shopId, bestand); out.push(`<div class="li" style="cursor:default"><div class="li-thumb">✅</div><div class="li-main"><div class="li-title" style="font-size:.85rem">${ARTEN[f.art]}</div><div class="li-sub">${esc(f.name)} · ${ergebnisText(r)}</div></div></div>`); });
    flush();
    $('#eiRes').innerHTML = `<div class="list">${out.join('')}</div>`;
    render();
  };
}

export function initBestellungen() {
  $('#ebSearch').oninput = e => { st.q = e.target.value; renderBestellungen(); };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-etsy-import]'); if (b) openImport(); });
}
export const badge = () => offeneBestellungen().length;
export {bucheBestand};
