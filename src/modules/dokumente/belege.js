/* ═══════════════ AUSGANGSDOKUMENTE: Rechnung, Angebot, Lieferschein, Gutschrift ═══════════════
 * Entwurf → frei bearbeitbar, ohne Nummer.
 * Abschließen → fortlaufende Nummer, Absenderdaten werden eingefroren, danach unveränderbar (GoBD).
 * Korrektur einer Rechnung nur per Storno (erzeugt eine Storno-Gutschrift).
 */
import {$, $$, esc, eur, parseMoney, moneyIn, uid, fmtDT} from '../../core/util.js';
import {T, K, get, put, remove, flush} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox, wideModal} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {isActive} from '../../core/modules.js';
import {downloadBinary} from '../../core/files.js';
import {prodById, addMove} from '../wawi/shared.js';
import {ART, ARTEN, STATUS, EINHEITEN, statusBadge, texte, docs, docById, isoDay, parseDay, deDay, nextNr, lineSum, docTotal, faellig, ueberfaellig, absenderSnapshot, empfLabel} from './shared.js';

export const html = `
    <div class="chips" id="dkArt"></div>
    <div class="chips" id="dkStatus" style="margin-top:-4px"></div>
    <div class="search" style="margin-bottom:10px"><input class="input" id="dkSearch" placeholder="Nummer, Kunde oder Betreff…"></div>
    <div class="stats-grid" id="dkStats" style="margin-bottom:12px"></div>
    <div id="dkList"></div>
    <div class="pad-fab"></div>
    <button class="fab" id="dkFab">＋ Neues Dokument</button>`;

const st = {art: 'all', status: 'all', q: ''};

/* ─── Liste ─── */
export function renderBelege() {
  const all = docs();
  $('#dkArt').innerHTML = [['all', 'Alle'], ...ARTEN.map(a => [a, ART[a].icon + ' ' + ART[a].plural])].map(([k, l]) => `<button class="chip ${st.art === k ? 'active' : ''}" data-a="${k}">${l}</button>`).join('');
  $$('#dkArt .chip').forEach(b => b.onclick = () => { st.art = b.dataset.a; st.status = 'all'; renderBelege(); });
  const stats = st.art === 'all' ? ['entwurf', 'offen'] : ART[st.art].status;
  $('#dkStatus').innerHTML = [['all', 'Alle Status'], ...stats.map(s => [s, STATUS[s][0]]), ...(st.art === 'all' || st.art === 'rechnung' ? [['faellig', '⚠️ überfällig']] : [])]
    .map(([k, l]) => `<button class="chip ${st.status === k ? 'active' : ''}" data-s="${k}">${l}</button>`).join('');
  $$('#dkStatus .chip').forEach(b => b.onclick = () => { st.status = b.dataset.s; renderBelege(); });

  const offen = all.filter(d => d.art === 'rechnung' && d.status === 'offen'), faelligL = offen.filter(ueberfaellig);
  const y = new Date().getFullYear(), bezahlt = all.filter(d => d.art === 'rechnung' && d.status === 'bezahlt' && String(d.datum).startsWith(y));
  const sum = l => l.reduce((a, d) => a + (d.total || 0), 0);
  $('#dkStats').innerHTML = `
    <div class="stat-card" style="--sc:var(--warn)"><div class="sc-label">Offene Rechnungen</div><div class="sc-value">${eur(sum(offen))}</div><div class="sc-sub">${offen.length} Rechnung${offen.length === 1 ? '' : 'en'}</div></div>
    <div class="stat-card" style="--sc:var(--danger)"><div class="sc-label">Überfällig</div><div class="sc-value">${eur(sum(faelligL))}</div><div class="sc-sub">${faelligL.length} Rechnung${faelligL.length === 1 ? '' : 'en'}</div></div>
    <div class="stat-card" style="--sc:var(--ok)"><div class="sc-label">Bezahlt ${y}</div><div class="sc-value">${eur(sum(bezahlt))}</div><div class="sc-sub">${bezahlt.length} Rechnung${bezahlt.length === 1 ? '' : 'en'}</div></div>`;

  const q = st.q.trim().toLowerCase();
  let list = all.filter(d => st.art === 'all' || d.art === st.art);
  if (st.status === 'faellig') list = list.filter(ueberfaellig);
  else if (st.status !== 'all') list = list.filter(d => d.status === st.status);
  if (q) list = list.filter(d => [d.nr, d.betreff, d.empf && d.empf.name, d.empf && d.empf.firma, d.bezugNr].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.erstellt || 0) - (a.erstellt || 0));

  if (!all.length) {
    $('#dkList').innerHTML = `<div class="card empty"><div>📄</div><p>Noch keine Dokumente.<br>Schreib deine erste Rechnung oder ein Angebot.</p><button class="btn btn-primary" id="dkFirst">＋ Erstes Dokument</button></div>`;
    $('#dkFirst').onclick = newDialog; return;
  }
  $('#dkList').innerHTML = list.length ? `<div class="list">${list.map(d => `<button class="li" data-id="${d.id}">
      <div class="li-thumb">${ART[d.art].icon}</div>
      <div class="li-main"><div class="li-title">${d.nr ? esc(d.nr) : `<span class="muted">${ART[d.art].name} (Entwurf)</span>`} · ${esc(empfLabel(d.empf))}</div>
        <div class="li-sub">${deDay(d.datum)}${d.betreff ? ' · ' + esc(d.betreff) : ''}${d.bezugNr && !(d.betreff || '').includes(d.bezugNr) ? ' · zu ' + esc(d.bezugNr) : ''}</div></div>
      <div class="li-end"><b class="num">${eur(d.total || 0)}</b>${ueberfaellig(d) ? '<span class="badge out">überfällig</span>' : statusBadge(d)}</div></button>`).join('')}</div>`
    : `<div class="card empty"><div>🔍</div><p>Keine Dokumente in dieser Ansicht.</p></div>`;
  $$('#dkList [data-id]').forEach(b => b.onclick = () => openDoc(b.dataset.id));
}

export function openDoc(id) { const d = docById(id); if (!d) return; if (d.festgeschrieben) viewDoc(d); else editDoc(d); }

function newDialog() {
  openModal('Neues Dokument', `<div class="pay-methods" style="grid-template-columns:repeat(2,1fr)">${ARTEN.map(a => `<button class="pay-m" data-art="${a}"><i>${ART[a].icon}</i>${ART[a].name}</button>`).join('')}</div>`);
  $$('[data-art]').forEach(b => b.onclick = () => { closeModal(); setTimeout(() => editDoc(null, b.dataset.art), 230); });
}

/* ─── Editor (Entwurf) ─── */
function blank(art) {
  const t = texte(art);
  return {art, status: 'entwurf', datum: isoDay(Date.now()), leistung: isoDay(Date.now()), zielTage: K.settings.zahlungsziel, gueltigBis: isoDay(Date.now() + 30 * 864e5),
    kontaktId: null, empf: {name: '', firma: '', strasse: '', plz: '', ort: '', land: 'Deutschland'}, betreff: '', einleitung: t.einleitung, schluss: t.schluss, notiz: '', positionen: []};
}

export function editDoc(d, art) {
  const isNew = !d || !d.id;
  d = d ? JSON.parse(JSON.stringify(d)) : blank(art);
  const A = ART[d.art];
  const pos = d.positionen.map(p => ({...p, key: p.key || uid()}));
  const kontakte = [...T.kontakt].sort((a, b) => (a.typ === 'lieferant') - (b.typ === 'lieferant') || (a.firma || a.name).localeCompare(b.firma || b.name, 'de'));
  const prods = [...T.produkt].filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const e = d.empf || {};
  openModal(`${A.icon} ${A.name}${isNew ? ' – neu' : ' – Entwurf'}`, `
    <div class="field"><label>Empfänger</label><select class="input" id="dKontakt"><option value="">— Empfänger von Hand eingeben —</option>${kontakte.map(k => `<option value="${k.id}" ${k.id === d.kontaktId ? 'selected' : ''}>${esc(k.firma ? k.firma + (k.name ? ' · ' + k.name : '') : k.name)}${k.nr ? ' (' + esc(k.nr) + ')' : ''}</option>`).join('')}</select></div>
    <div class="row"><div class="field"><label>Name</label><input class="input" id="eName" value="${esc(e.name)}"></div><div class="field"><label>Firma</label><input class="input" id="eFirma" value="${esc(e.firma)}"></div></div>
    <div class="field"><label>Straße & Hausnummer</label><input class="input" id="eStr" value="${esc(e.strasse)}"></div>
    <div class="row"><div class="field" style="flex:0 0 100px"><label>PLZ</label><input class="input" id="ePlz" value="${esc(e.plz)}"></div><div class="field"><label>Ort</label><input class="input" id="eOrt" value="${esc(e.ort)}"></div><div class="field"><label>Land</label><input class="input" id="eLand" value="${esc(e.land)}"></div></div>
    <label class="switch" id="eSaveRow" style="padding-top:0"><div><b>Als Kontakt speichern</b><small>Empfänger zu den Kontakten hinzufügen</small></div><span class="toggle"><input type="checkbox" id="eSave"><span></span></span></label>
    <div class="row">
      <div class="field"><label>${A.name}sdatum</label><input class="input" type="date" id="dDatum" value="${d.datum}"></div>
      ${d.art !== 'angebot' ? `<div class="field"><label>${d.art === 'lieferschein' ? 'Lieferdatum' : 'Leistungsdatum'}</label><input class="input" type="date" id="dLeist" value="${d.leistung || d.datum}"></div>` : `<div class="field"><label>Gültig bis</label><input class="input" type="date" id="dGueltig" value="${d.gueltigBis || ''}"></div>`}
      ${d.art === 'rechnung' ? `<div class="field" style="flex:0 0 120px"><label>Zahlungsziel</label><select class="input" id="dZiel">${[0, 7, 10, 14, 30].map(n => `<option value="${n}" ${n === +d.zielTage ? 'selected' : ''}>${n ? n + ' Tage' : 'sofort'}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="field"><label>Betreff</label><input class="input" id="dBetreff" value="${esc(d.betreff)}" placeholder="z. B. Ihre Bestellung vom …"></div>
    <div class="field"><label>Einleitung</label><textarea class="input" id="dEin" rows="2">${esc(d.einleitung)}</textarea></div>
    <div class="section-title" style="margin-top:6px">Positionen</div>
    <div id="dPos"></div>
    <div class="row" style="margin-top:4px">
      <div class="field">${prods.length ? `<select class="input" id="dAddProd"><option value="">＋ Produkt hinzufügen…</option>${prods.map(p => `<option value="${p.id}">${esc(p.name)} – ${eur(p.price)}</option>`).join('')}</select>` : ''}</div>
      <div class="field" style="flex:0 0 auto"><button class="btn" id="dAddFree">＋ Freie Position</button></div>
    </div>
    <div class="doc-total"><span>Gesamtbetrag${K.settings.klein ? '' : ' (brutto)'}</span><b class="num" id="dTotal"></b></div>
    ${K.settings.klein ? `<div class="muted" style="font-size:.75rem;margin:-4px 0 10px">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (erscheint auf dem PDF).</div>` : ''}
    <div class="field"><label>Schlusstext</label><textarea class="input" id="dSchluss" rows="2">${esc(d.schluss)}</textarea></div>
    <div class="field"><label>Interne Notiz <span style="text-transform:none;letter-spacing:0;font-weight:500">(nicht auf dem PDF)</span></label><input class="input" id="dNotiz" value="${esc(d.notiz)}"></div>`,
    `${!isNew ? `<button class="btn btn-danger" id="dDel">Löschen</button>` : ''}<button class="btn" id="dPdf">👁 Vorschau</button><button class="btn" id="dSave">Speichern</button><button class="btn btn-primary" id="dFinal">✓ Abschließen</button>`);
  wideModal();

  const fill = () => {
    const k = get('kontakt', $('#dKontakt').value);
    $('#eSaveRow').classList.toggle('hidden', !!k);
    if (!k) return;
    $('#eName').value = k.name || ''; $('#eFirma').value = k.firma || ''; $('#eStr').value = k.strasse || ''; $('#ePlz').value = k.plz || ''; $('#eOrt').value = k.ort || ''; $('#eLand').value = k.land || '';
  };
  $('#dKontakt').onchange = fill; $('#eSaveRow').classList.toggle('hidden', !!d.kontaktId);

  const total = () => { $('#dTotal').textContent = eur(pos.reduce((a, p) => a + lineSum(p), 0)); };
  const renderPos = () => {
    $('#dPos').innerHTML = pos.length ? pos.map((p, i) => `<div class="doc-pos" data-k="${p.key}">
      <div class="pos-head"><span class="muted" style="width:22px;font-size:.8rem">${i + 1}.</span><input class="input" data-f="text" value="${esc(p.text)}" placeholder="Bezeichnung"><button class="x-btn" data-del="${p.key}" title="Entfernen">✕</button></div>
      <div class="row" style="margin:6px 0 0">
        <div class="field" style="margin:0"><input class="input" data-f="menge" type="number" step="any" min="0" inputmode="decimal" value="${p.menge}" placeholder="Menge"></div>
        <div class="field" style="margin:0;flex:0 0 96px"><select class="input" data-f="einheit">${EINHEITEN.map(u => `<option ${u === p.einheit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><input class="input" data-f="preis" inputmode="decimal" value="${moneyIn(p.preis)}" placeholder="Einzelpreis €"></div>
        <div class="pos-sum" data-sum="${p.key}">${eur(lineSum(p))}</div>
      </div></div>`).join('') : `<div class="muted" style="font-size:.85rem;padding:6px 2px 10px">Noch keine Positionen.</div>`;
    $$('#dPos .doc-pos').forEach(el => {
      const p = pos.find(x => x.key === el.dataset.k);
      el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', () => {
        const f = inp.dataset.f;
        if (f === 'menge') p.menge = parseFloat(String(inp.value).replace(',', '.')) || 0;
        else if (f === 'preis') { const v = parseMoney(inp.value); p.preis = isNaN(v) ? 0 : v; }
        else p[f] = inp.value;
        el.querySelector('[data-sum]').textContent = eur(lineSum(p)); total();
      }));
    });
    $$('#dPos [data-del]').forEach(b => b.onclick = () => { pos.splice(pos.findIndex(x => x.key === b.dataset.del), 1); renderPos(); });
    total();
  };
  renderPos();
  if ($('#dAddProd')) $('#dAddProd').onchange = e => {
    const p = prodById(e.target.value); e.target.value = ''; if (!p) return;
    pos.push({key: uid(), pid: p.id, text: p.name + (p.sku ? ` (Art.-Nr. ${p.sku})` : ''), menge: 1, einheit: p.unit || 'Stk', preis: p.price, tax: p.tax ?? K.settings.taxDefault}); renderPos();
  };
  $('#dAddFree').onclick = () => { pos.push({key: uid(), pid: null, text: '', menge: 1, einheit: 'Stk', preis: 0, tax: K.settings.taxDefault}); renderPos(); const all = $$('#dPos [data-f="text"]'); all[all.length - 1].focus(); };

  const collect = () => {
    const out = {...d};
    out.kontaktId = $('#dKontakt').value || (d.kontaktCreated ? d.kontaktId : null); delete out.kontaktCreated;
    out.empf = {name: $('#eName').value.trim(), firma: $('#eFirma').value.trim(), strasse: $('#eStr').value.trim(), plz: $('#ePlz').value.trim(), ort: $('#eOrt').value.trim(), land: $('#eLand').value.trim()};
    out.datum = $('#dDatum').value || isoDay(Date.now()); out.ts = parseDay(out.datum);
    if ($('#dLeist')) out.leistung = $('#dLeist').value || out.datum;
    if ($('#dGueltig')) out.gueltigBis = $('#dGueltig').value;
    if ($('#dZiel')) out.zielTage = +$('#dZiel').value;
    out.betreff = $('#dBetreff').value.trim(); out.einleitung = $('#dEin').value.trim(); out.schluss = $('#dSchluss').value.trim(); out.notiz = $('#dNotiz').value.trim();
    { const k = out.kontaktId && get('kontakt', out.kontaktId); out.kundenNr = k ? (k.nr || '') : ''; }
    out.positionen = pos.filter(p => p.text.trim() || p.preis).map(({key, ...p}) => ({...p, text: p.text.trim()}));
    out.total = docTotal(out);
    return out;
  };
  const store = () => {
    const out = collect();
    if (!out.kontaktId && $('#eSave').checked && (out.empf.name || out.empf.firma)) {
      const nr = 'K' + (T.kontakt.map(k => k.nr || '').filter(n => n.startsWith('K')).map(n => parseInt(n.slice(1), 10) || 0).reduce((a, b) => Math.max(a, b), 1000) + 1);
      const k = put('kontakt', {typ: 'kunde', nr, name: out.empf.name, firma: out.empf.firma, strasse: out.empf.strasse, plz: out.empf.plz, ort: out.empf.ort, land: out.empf.land, email: '', telefon: '', notiz: ''});
      out.kontaktId = k.id; out.kundenNr = nr;
    }
    const saved = put('beleg', out); d.id = saved.id; d.erstellt = saved.erstellt;
    if (saved.kontaktId && !$('#dKontakt').value) { d.kontaktId = saved.kontaktId; d.kontaktCreated = true; }
    return saved;
  };
  $('#dSave').onclick = () => { store(); closeModal(); toast('Entwurf gespeichert'); render(); };
  $('#dPdf').onclick = async () => { const out = store(); render(); await sharePdf(out); };
  $('#dFinal').onclick = async () => {
    const out = collect();
    if (!out.positionen.length) return toast('Bitte mindestens eine Position eintragen', true);
    if (!out.empf.name && !out.empf.firma) return toast('Bitte Empfänger eintragen', true);
    const saved = store(); closeModal();
    setTimeout(() => finalize(saved.id), 230);
  };
  if ($('#dDel')) $('#dDel').onclick = async () => {
    if (!await confirmBox('Entwurf löschen?', 'Der Entwurf hat noch keine Nummer und wird endgültig gelöscht.', 'Löschen', true)) return;
    remove('beleg', d.id); render();
  };
}

/* ─── Abschließen ─── */
function stockLines(d) {
  if (!ART[d.art].lager || !isActive('wawi') || d.lagerGebucht) return [];
  return d.positionen.filter(p => { const pr = p.pid && prodById(p.pid); return pr && pr.trackStock && p.menge > 0; });
}
function finalize(id) {
  const d = docById(id); if (!d) return;
  const lines = stockLines(d), nr = nextNr(d.art, d.datum);
  const warn = d.art === 'rechnung' && !K.settings.taxNo ? `<div class="alert warn" style="margin-top:0">Auf Rechnungen ist die <b>Steuernummer</b> Pflicht. Du kannst sie unter Einstellungen → Firma eintragen.</div>` : '';
  const bank = d.art === 'rechnung' && !K.settings.iban ? `<div class="alert warn">Es ist keine <b>Bankverbindung</b> hinterlegt (Einstellungen → Dokumente).</div>` : '';
  openModal(`${ART[d.art].name} abschließen?`, `${warn}${bank}
    <p style="font-size:.92rem;line-height:1.55;margin:10px 0">Das Dokument bekommt die Nummer <b>${esc(nr)}</b> und kann danach <b>nicht mehr geändert</b> werden. ${d.art === 'rechnung' ? 'Korrekturen gehen nur über ein Storno.' : ''}</p>
    ${lines.length ? `<label class="switch"><div><b>Bestand abbuchen</b><small>${lines.map(p => esc(p.menge + ' × ' + p.text)).join(', ')}</small></div><span class="toggle"><input type="checkbox" id="fStock" checked><span></span></span></label>` : ''}`,
    `<button class="btn" id="fNo">Abbrechen</button><button class="btn btn-primary" id="fOk">✓ Abschließen</button>`);
  $('#fNo').onclick = () => { closeModal(); setTimeout(() => editDoc(d), 230); };
  $('#fOk').onclick = () => {
    d.nr = nextNr(d.art, d.datum); // erneut, falls inzwischen ein anderes Gerät eine Nummer vergeben hat
    d.status = d.art === 'lieferschein' ? 'erstellt' : 'offen';
    d.festgeschrieben = true; d.festTs = Date.now(); d.absender = absenderSnapshot(); d.klein = !!K.settings.klein;
    if (d.art === 'gutschrift') d.erstattung = true; // eigenständige Gutschrift: Betrag wird ausgezahlt
    if (lines.length && $('#fStock') && $('#fStock').checked) {
      lines.forEach(p => { const pr = prodById(p.pid); pr.stock -= p.menge; put('produkt', pr); addMove(pr.id, -p.menge, 'doc', d.nr, d.id); });
      d.lagerGebucht = true;
    }
    if (d.bezugId) { const b = docById(d.bezugId); if (b && b.art === 'angebot' && b.status === 'offen' && d.art === 'rechnung') { b.status = 'angenommen'; put('beleg', b); } }
    put('beleg', d); flush();
    closeModal(); toast(`${ART[d.art].name} ${d.nr} abgeschlossen`); render();
    setTimeout(() => viewDoc(d), 230);
  };
}

/* ─── Ansicht (abgeschlossen) ─── */
export function viewDoc(d) {
  const A = ART[d.art];
  const rows = [[A.nrLabel, esc(d.nr)], ['Datum', deDay(d.datum)]];
  if (d.leistung && d.art !== 'angebot') rows.push([d.art === 'lieferschein' ? 'Lieferdatum' : 'Leistungsdatum', deDay(d.leistung)]);
  if (d.art === 'rechnung') rows.push(['Fällig am', deDay(faellig(d)) + (ueberfaellig(d) ? ' <span class="badge out">überfällig</span>' : '')]);
  if (d.art === 'angebot' && d.gueltigBis) rows.push(['Gültig bis', deDay(d.gueltigBis)]);
  rows.push(['Empfänger', esc(empfLabel(d.empf))]);
  if (d.betreff) rows.push(['Betreff', esc(d.betreff)]);
  if (d.bezugNr) rows.push(['Bezug', esc(d.bezugNr)]);
  if (d.stornoNr) rows.push(['Storniert durch', esc(d.stornoNr)]);
  if (d.erledigtAm) rows.push(['Ausgezahlt am', deDay(d.erledigtAm) + (d.zahlart ? ' · ' + esc(d.zahlart) : '')]);
  if (d.bezahltAm) rows.push(['Bezahlt am', deDay(d.bezahltAm) + (d.zahlart ? ' · ' + esc(d.zahlart) : '')]);
  if (d.lagerGebucht) rows.push(['Lager', 'Bestand abgebucht']);
  rows.push(['Status', statusBadge(d)]);
  const acts = [`<button class="btn btn-primary" data-act="pdf">📄 PDF</button>`];
  if (d.art === 'rechnung' && d.status === 'offen') acts.push(`<button class="btn" data-act="paid">✓ Bezahlt</button>`);
  if (d.art === 'rechnung' && d.status === 'bezahlt') acts.push(`<button class="btn" data-act="unpaid">Zahlung zurücknehmen</button>`);
  if (d.art === 'angebot' && d.status === 'offen') acts.push(`<button class="btn" data-act="toRechnung">→ Rechnung</button><button class="btn" data-act="toLieferschein">→ Lieferschein</button><button class="btn" data-act="accept">Angenommen</button><button class="btn" data-act="reject">Abgelehnt</button>`);
  if (d.art === 'angebot' && d.status === 'angenommen') acts.push(`<button class="btn" data-act="toRechnung">→ Rechnung</button>`);
  if (d.art === 'lieferschein') acts.push(`<button class="btn" data-act="toRechnung">→ Rechnung</button>`);
  if (d.art === 'gutschrift' && d.status === 'offen') acts.push(`<button class="btn" data-act="done">Erledigt</button>`);
  acts.push(`<button class="btn" data-act="copy">Kopie als Entwurf</button>`);
  if (d.art === 'rechnung' && (d.status === 'offen' || d.status === 'bezahlt')) acts.push(`<button class="btn btn-danger" data-act="storno">↩ Stornieren</button>`);
  openModal(`${A.icon} ${A.name} ${d.nr}`, `<div class="doc-view">
      ${rows.map(([l, v]) => `<div class="rr"><span>${l}</span><span>${v}</span></div>`).join('')}
      <div class="section-title">Positionen</div>
      <div class="list">${d.positionen.map(p => `<div class="li" style="cursor:default"><div class="li-main"><div class="li-title">${esc(p.text)}</div><div class="li-sub">${String(p.menge).replace('.', ',')} ${esc(p.einheit || '')} × ${eur(p.preis)}</div></div><div class="li-end"><b class="num">${eur(lineSum(p))}</b></div></div>`).join('')}</div>
      <div class="doc-total"><span>Gesamtbetrag</span><b class="num">${eur(d.total)}</b></div>
      ${d.notiz ? `<div class="muted" style="font-size:.8rem">Notiz: ${esc(d.notiz)}</div>` : ''}
      <div class="muted" style="font-size:.72rem;margin-top:8px">Abgeschlossen am ${fmtDT(d.festTs)} · unveränderbar</div></div>`,
    `<div class="doc-actions">${acts.join('')}</div>`);
  $$('[data-act]').forEach(b => b.onclick = () => action(d, b.dataset.act));
}

async function action(d, act) {
  if (act === 'pdf') return sharePdf(d);
  if (act === 'paid') return paidDialog(d);
  if (act === 'unpaid') { d.status = 'offen'; d.bezahltAm = null; d.zahlart = ''; put('beleg', d); closeModal(); return render(); }
  if (act === 'accept' || act === 'reject') { d.status = act === 'accept' ? 'angenommen' : 'abgelehnt'; put('beleg', d); closeModal(); return render(); }
  if (act === 'done') return paidDialog(d, true);
  if (act === 'copy' || act === 'toRechnung' || act === 'toLieferschein') {
    const art = act === 'toRechnung' ? 'rechnung' : act === 'toLieferschein' ? 'lieferschein' : d.art;
    const n = blank(art);
    Object.assign(n, {kontaktId: d.kontaktId, empf: {...d.empf}, betreff: d.betreff, positionen: d.positionen.map(p => ({...p}))});
    if (act !== 'copy') { n.bezugId = d.id; n.bezugNr = d.nr; if (d.art === 'lieferschein' && d.lagerGebucht) n.lagerGebucht = true; }
    closeModal(); setTimeout(() => editDoc(n), 240); // vorausgefüllter Entwurf, gespeichert erst mit „Speichern“
    return;
  }
  if (act === 'storno') {
    if (!await confirmBox(`Rechnung ${esc(d.nr)} stornieren?`, `Es wird eine Storno-Gutschrift über ${eur(d.total)} erstellt und die Rechnung als storniert markiert.${d.lagerGebucht && isActive('wawi') ? ' Die Ware wird wieder ins Lager gebucht.' : ''} Das lässt sich nicht rückgängig machen.`, 'Stornieren', true)) return;
    const g = {...blank('gutschrift'), kontaktId: d.kontaktId, empf: {...d.empf}, betreff: `Storno zu Rechnung ${d.nr}`, einleitung: `hiermit storniere ich die Rechnung ${d.nr} vom ${deDay(d.datum)} vollständig.`, schluss: '',
      positionen: d.positionen.map(p => ({...p})), bezugId: d.id, bezugNr: d.nr, stornoVon: d.id};
    g.nr = nextNr('gutschrift', g.datum); g.status = d.status === 'bezahlt' ? 'offen' : 'erledigt'; g.erstattung = d.status === 'bezahlt'; /* nur dann fließt Geld zurück */ g.festgeschrieben = true; g.festTs = Date.now(); g.absender = absenderSnapshot(); g.klein = !!K.settings.klein;
    g.total = docTotal(g); g.ts = parseDay(g.datum);
    put('beleg', g);
    if (d.lagerGebucht && isActive('wawi')) d.positionen.forEach(p => { const pr = p.pid && prodById(p.pid); if (pr && pr.trackStock) { pr.stock += p.menge; put('produkt', pr); addMove(pr.id, p.menge, 'storno', 'Storno ' + d.nr, d.id); } });
    d.status = 'storniert'; d.storno = true; d.stornoNr = g.nr; d.stornoId = g.id; put('beleg', d); flush();
    toast(`Storniert – Gutschrift ${g.nr} erstellt`); render(); viewDoc(g);
  }
}

function paidDialog(d, erstattung) {
  openModal(erstattung ? 'Erstattung erfassen' : 'Zahlung erfassen', `
    <div class="row"><div class="field"><label>${erstattung ? 'Ausgezahlt am' : 'Bezahlt am'}</label><input class="input" type="date" id="pDate" value="${isoDay(Date.now())}"></div>
    <div class="field"><label>Zahlart</label><select class="input" id="pArt">${['Überweisung', 'Bar', 'Karte', 'PayPal', 'Sonstiges'].map(z => `<option>${z}</option>`).join('')}</select></div></div>`,
    `<button class="btn" id="pNo">Abbrechen</button><button class="btn btn-primary" id="pOk">✓ Bezahlt</button>`);
  $('#pNo').onclick = () => { closeModal(); setTimeout(() => viewDoc(d), 230); };
  $('#pOk').onclick = () => {
    const day = $('#pDate').value || isoDay(Date.now());
    if (erstattung) { d.status = 'erledigt'; d.erledigtAm = day; } else { d.status = 'bezahlt'; d.bezahltAm = day; }
    d.zahlart = $('#pArt').value; put('beleg', d); closeModal(); toast(`${d.nr} ${erstattung ? 'erledigt' : 'als bezahlt markiert'}`); render();
  };
}

async function sharePdf(d) {
  toast('PDF wird erstellt …');
  try {
    const {docPdf} = await import('./pdf.js');
    const blob = await docPdf(d);
    const name = `${d.nr || ART[d.art].name + '-Entwurf'}${d.empf && (d.empf.firma || d.empf.name) ? '_' + (d.empf.firma || d.empf.name) : ''}.pdf`.replace(/[^\wäöüÄÖÜß.\- ]+/g, '').replace(/\s+/g, '_');
    await downloadBinary(name, blob, 'application/pdf');
  } catch (e) { toast('PDF fehlgeschlagen: ' + (e.message || e), true); }
}

export function initBelege() {
  $('#dkSearch').oninput = e => { st.q = e.target.value; renderBelege(); };
  $('#dkFab').onclick = newDialog;
}

/** Kennzahl für die Übersicht */
export function dashStats() {
  const offen = docs().filter(d => d.art === 'rechnung' && d.status === 'offen'), f = offen.filter(ueberfaellig);
  return [`<div class="stat-card" data-go="dokumente" style="--sc:${f.length ? 'var(--danger)' : 'var(--warn)'}"><div class="sc-label">Offene Rechnungen</div><div class="sc-value">${eur(offen.reduce((a, d) => a + d.total, 0))}</div><div class="sc-sub">${offen.length} offen${f.length ? ` · ${f.length} überfällig` : ''}</div></div>`];
}
export const badge = () => docs().filter(ueberfaellig).length;
