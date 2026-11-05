/* ═══════════════ MODUL: Buchhaltung (EÜR) – Phase 3 ═══════════════ */
import {$, $$, esc, eur, parseMoney, moneyIn} from '../../core/util.js';
import {T, K, saveSettings} from '../../core/db.js';
import {registerModule} from '../../core/modules.js';
import {isoDay} from '../dokumente/shared.js';
import * as BU from './buchungen.js';
import * as BK from './bank.js';
import * as EU from './euer.js';
import {KAT, ZK, euer, syncBuchungen} from './shared.js';

const settingsHtml = `
  <div class="section-title">📒 Buchhaltung <span class="muted">EÜR & DATEV-Export</span></div>
  <div class="card">
    <div class="row"><div class="field"><label>Beraternummer</label><input class="input" id="bsBer" inputmode="numeric" placeholder="von der Steuerberatung"></div>
    <div class="field"><label>Mandantennummer</label><input class="input" id="bsMan" inputmode="numeric"></div>
    <div class="field" style="flex:0 0 120px"><label>WJ-Beginn</label><input class="input" id="bsWj" maxlength="4" placeholder="0101" title="Tag und Monat, z. B. 0101"></div></div>
    <div class="field"><label>Anfangsbestände <span style="text-transform:none;letter-spacing:0;font-weight:500">(Stand zum Stichtag)</span></label>
      <div class="row">${Object.entries(ZK).map(([k, v]) => `<div class="field" style="margin:0"><input class="input" data-start="${k}" inputmode="decimal" placeholder="0,00"><small class="muted" style="font-size:.7rem">${v.name}</small></div>`).join('')}
      <div class="field" style="margin:0"><input class="input" type="date" id="bsStartDat"><small class="muted" style="font-size:.7rem">Stichtag</small></div></div></div>
    <details><summary style="cursor:pointer;font-weight:600;font-size:.88rem;padding:6px 0">Sachkonten (SKR03-Vorschlag) anpassen</summary>
      <p class="muted" style="font-size:.75rem;margin:6px 0 10px">Leer lassen = Vorschlag verwenden. Am besten einmal mit der Steuerberatung abstimmen.</p>
      <div class="list">${[...Object.entries(ZK).map(([k, v]) => [k, v.name + ' (Geldkonto)', v.konto]), ...Object.entries(KAT).map(([k, v]) => [k, v.name, v.konto])].map(([k, n, d]) => `<div class="li" style="cursor:default"><div class="li-main"><div class="li-title" style="font-size:.85rem">${esc(n)}</div></div><input class="input" data-konto="${k}" placeholder="${d}" style="width:90px" inputmode="numeric" maxlength="8"></div>`).join('')}</div>
    </details>
  </div>`;

function renderSettings() {
  const s = K.settings;
  $('#bsBer').value = s.datev.berater || ''; $('#bsMan').value = s.datev.mandant || ''; $('#bsWj').value = s.datev.wjBeginn || '0101';
  $$('[data-start]').forEach(i => { i.value = moneyIn(s.kontoStart[i.dataset.start]); });
  $('#bsStartDat').value = s.kontoStartDatum || '';
  $$('[data-konto]').forEach(i => { i.value = s.konten[i.dataset.konto] || ''; });
}
function initSettings() {
  const dv = (sel, key, fn) => $(sel).addEventListener('input', e => { K.settings.datev[key] = fn(e.target.value); saveSettings(); });
  dv('#bsBer', 'berater', v => v.replace(/\D/g, '')); dv('#bsMan', 'mandant', v => v.replace(/\D/g, '')); dv('#bsWj', 'wjBeginn', v => v.replace(/\D/g, '') || '0101');
  $$('[data-start]').forEach(i => i.addEventListener('input', () => { const v = parseMoney(i.value); K.settings.kontoStart[i.dataset.start] = isNaN(v) ? 0 : v; saveSettings(); }));
  $('#bsStartDat').onchange = e => { K.settings.kontoStartDatum = e.target.value; saveSettings(); };
  $$('[data-konto]').forEach(i => i.addEventListener('input', () => { const v = i.value.replace(/\D/g, ''); if (v) K.settings.konten[i.dataset.konto] = v; else delete K.settings.konten[i.dataset.konto]; saveSettings(); }));
}

function dashStats() {
  syncBuchungen();
  const y = new Date().getFullYear(), r = euer(`${y}-01-01`, isoDay(Date.now()));
  return [`<div class="stat-card" data-go="euer" style="--sc:${r.gewinn >= 0 ? 'var(--primary)' : 'var(--danger)'}"><div class="sc-label">${r.gewinn >= 0 ? 'Gewinn' : 'Verlust'} ${y}</div><div class="sc-value">${eur(r.gewinn)}</div><div class="sc-sub">Einnahmen ${eur(r.einSum)}</div></div>`];
}

registerModule({
  id: 'buchhaltung',
  name: 'Buchhaltung (EÜR)',
  icon: '📒',
  requires: ['dokumente'],
  defaultOn: true,
  desc: 'Einnahmen und Ausgaben, Kasse und Bank, Bankabgleich per CSV, EÜR und DATEV-Export für die Steuerberatung',
  views: [
    {id: 'buchungen', label: 'Buchungen', icon: '📒', mobile: 9, hint: 'Einnahmen, Ausgaben, Konten', html: BU.html, render: BU.renderBuchungen},
    {id: 'bankabgleich', label: 'Bankabgleich', icon: '🏦', mobile: 10, hint: 'Kontoauszug zuordnen', html: BK.html, render: BK.renderBank, badge: () => T.bankumsatz.filter(b => b.status === 'offen').length},
    {id: 'euer', label: 'EÜR & Export', icon: '📊', mobile: 11, hint: 'Gewinn, DATEV, Steuerberatung', html: EU.html, render: EU.renderEuer}
  ],
  settings: {html: settingsHtml, render: renderSettings, init: initSettings},
  dashStats,
  init() { BU.initBuchungen(); BK.initBank(); EU.initEuer(); },
  api: {editBuchung: BU.editBuchung}
});
