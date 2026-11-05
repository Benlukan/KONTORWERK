/* ═══════════════ MODUL: Dokumente (Phase 2) ═══════════════ */
import {$, $$} from '../../core/util.js';
import {K, saveSettings} from '../../core/db.js';
import {toast} from '../../core/ui.js';
import {registerModule} from '../../core/modules.js';
import {blobToDataUrl} from '../../core/files.js';
import * as B from './belege.js';
import * as AR from './archiv.js';
import {ART, ARTEN, DEFAULT_TEXTE} from './shared.js';

/* Einstellungen des Moduls (erscheinen unter Einstellungen, wenn das Modul aktiv ist) */
const settingsHtml = `
  <div class="section-title">📄 Dokumente <span class="muted">Rechnungen, Angebote, Lieferscheine</span></div>
  <div class="card">
    <div class="field"><label>Firmenlogo für PDFs</label>
      <div class="img-pick"><div class="img-prev" id="dsLogoPrev" style="background:var(--card2)"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><label class="btn btn-sm">Bild wählen<input type="file" accept="image/*" id="dsLogo" class="hidden"></label><button class="btn btn-sm btn-danger" id="dsLogoDel">Entfernen</button></div></div></div>
    <div class="field"><label>Website</label><input class="input" id="dsWeb" placeholder="z. B. etsy.com/shop/LichtManufakturShop"></div>
    <div class="row"><div class="field"><label>Kontoinhaber</label><input class="input" id="dsInh"></div><div class="field"><label>Bank</label><input class="input" id="dsBank"></div></div>
    <div class="row"><div class="field"><label>IBAN</label><input class="input" id="dsIban" autocapitalize="characters" placeholder="DE00 0000 0000 0000 0000 00"></div><div class="field" style="flex:0 0 38%"><label>BIC</label><input class="input" id="dsBic" autocapitalize="characters"></div></div>
    <div class="row"><div class="field"><label>Zahlungsziel (Standard)</label><select class="input" id="dsZiel">${[0, 7, 10, 14, 30].map(n => `<option value="${n}">${n ? n + ' Tage' : 'sofort'}</option>`).join('')}</select></div></div>
    <div class="field"><label>Nummern-Präfixe <span style="text-transform:none;letter-spacing:0;font-weight:500">(ergibt z. B. RE-2026-0001)</span></label>
      <div class="row">${ARTEN.map(a => `<div class="field" style="margin:0"><input class="input" data-pre="${a}" maxlength="6" title="${ART[a].name}" placeholder="${ART[a].name}"><small class="muted" style="font-size:.7rem">${ART[a].name}</small></div>`).join('')}</div></div>
    <div class="field"><label>Standardtexte</label><select class="input" id="dsTxtArt">${ARTEN.map(a => `<option value="${a}">${ART[a].name}</option>`).join('')}</select></div>
    <div class="field"><label>Einleitung</label><textarea class="input" id="dsEin" rows="2"></textarea></div>
    <div class="field"><label>Schlusstext</label><textarea class="input" id="dsSchl" rows="2"></textarea></div>
  </div>`;

function renderSettings() {
  const s = K.settings;
  $('#dsWeb').value = s.web || ''; $('#dsInh').value = s.bankInhaber || ''; $('#dsBank').value = s.bankName || '';
  $('#dsIban').value = s.iban || ''; $('#dsBic').value = s.bic || ''; $('#dsZiel').value = s.zahlungsziel;
  $$('[data-pre]').forEach(i => { i.value = s.nrPrefix[i.dataset.pre] || ''; });
  $('#dsLogoPrev').innerHTML = s.logo ? `<img src="${s.logo}" alt="" style="object-fit:contain">` : '<span class="muted" style="font-size:.7rem">kein Logo</span>';
  $('#dsLogoDel').classList.toggle('hidden', !s.logo);
  showTexts();
}
function showTexts() {
  const a = $('#dsTxtArt').value, t = {...DEFAULT_TEXTE[a], ...(K.settings.docTexte[a] || {})};
  $('#dsEin').value = t.einleitung || ''; $('#dsSchl').value = t.schluss || '';
}
function initSettings() {
  const bind = (sel, key, fn = t => t.value.trim()) => $(sel).addEventListener('input', e => { K.settings[key] = fn(e.target); saveSettings(); });
  bind('#dsWeb', 'web'); bind('#dsInh', 'bankInhaber'); bind('#dsBank', 'bankName');
  bind('#dsIban', 'iban', t => t.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim());
  bind('#dsBic', 'bic', t => t.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  $('#dsZiel').onchange = e => { K.settings.zahlungsziel = +e.target.value; saveSettings(); };
  $$('[data-pre]').forEach(i => i.addEventListener('input', () => { K.settings.nrPrefix[i.dataset.pre] = i.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); saveSettings(); }));
  $('#dsTxtArt').onchange = showTexts;
  const saveTxt = () => { const a = $('#dsTxtArt').value; K.settings.docTexte[a] = {einleitung: $('#dsEin').value.trim(), schluss: $('#dsSchl').value.trim()}; saveSettings(); };
  $('#dsEin').addEventListener('input', saveTxt); $('#dsSchl').addEventListener('input', saveTxt);
  $('#dsLogo').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { K.settings.logo = await AR.shrinkImage(await blobToDataUrl(f), 600, 0.92, 'image/png'); saveSettings(); renderSettings(); toast('Logo gespeichert'); }
    catch (err) { toast('Bild konnte nicht gelesen werden', true); }
  };
  $('#dsLogoDel').onclick = () => { K.settings.logo = ''; saveSettings(); renderSettings(); };
}

registerModule({
  id: 'dokumente',
  name: 'Dokumente',
  icon: '📄',
  desc: 'Rechnung, Angebot, Lieferschein, Gutschrift als PDF; Belegarchiv mit Fotos und Suche',
  defaultOn: true,
  views: [
    {id: 'dokumente', label: 'Dokumente', icon: '📄', mobile: 7, hint: 'Rechnungen, Angebote, Lieferscheine', html: B.html, render: B.renderBelege, badge: B.badge},
    {id: 'belegarchiv', label: 'Belegarchiv', icon: '🗂️', mobile: 8, hint: 'Quittungen & Belege', html: AR.html, render: AR.renderArchiv}
  ],
  settings: {html: settingsHtml, render: renderSettings, init: initSettings},
  dashStats: B.dashStats,
  init() { B.initBelege(); AR.initArchiv(); },
  api: {openDoc: B.openDoc, editDoc: B.editDoc}
});
