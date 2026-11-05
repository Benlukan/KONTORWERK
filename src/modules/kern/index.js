/* ═══════════════ KERN: Übersicht, Kontakte, Einstellungen, „Mehr“ ═══════════════ */
import {$, $$, esc} from '../../core/util.js';
import {registerModule, activeViews, modules} from '../../core/modules.js';
import {go} from '../../core/shell.js';
import * as U from './uebersicht.js';
import * as KT from './kontakte.js';
import * as E from './einstellungen.js';

/* „Mehr“ (nur Handy): alle Ansichten, die nicht in der unteren Leiste stehen, und geplante Module */
const mehrHtml = `<div class="section-title" style="margin-top:4px">☰ Alle Bereiche</div><div class="menu-grid" id="menuGrid"></div>
  <div class="section-title">🧩 Module in Arbeit</div><div class="menu-grid" id="menuPlanned"></div>`;
function renderMehr() {
  const inBar = new Set($$('#nav [data-v]').map(b => b.dataset.v));
  const vs = activeViews().filter(v => !inBar.has(v.id) && v.id !== 'mehr');
  $('#menuGrid').innerHTML = vs.map(v => `<button class="menu-tile" data-go="${v.id}"><i>${v.icon}</i><b>${esc(v.label)}</b><small>${esc(v.hint || v.module.name)}</small>${v.badge && v.badge() ? `<span class="badge low">${v.badge()}</span>` : ''}</button>`).join('');
  $('#menuPlanned').innerHTML = modules().filter(m => m.planned).sort((a, b) => a.planned - b.planned)
    .map(m => `<div class="menu-tile planned"><i>${m.icon}</i><b>${esc(m.name)}</b><small>${esc(m.desc)}</small><span class="badge gray">Phase ${m.planned}</span></div>`).join('');
  $$('#menuGrid [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

registerModule({
  id: 'kern', core: true, name: 'Kern', sideGroup: 'Übersicht', icon: '🏛️',
  desc: 'Übersicht, Kontakte, Belege, Einstellungen und Modulverwaltung',
  views: [
    {id: 'uebersicht', label: 'Übersicht', icon: '🏠', mobile: 5, hint: 'Grenzen-Wächter & Kennzahlen', html: U.html, render: U.renderUebersicht},
    {id: 'kontakte', label: 'Kontakte', icon: '📇', mobile: 6, hint: 'Kunden & Lieferanten', html: KT.html, render: KT.renderKontakte},
    {id: 'mehr', label: 'Mehr', icon: '☰', sidebar: false, html: mehrHtml, render: renderMehr}
  ],
  init() { KT.initKontakte(); },
  api: {editKontakt: KT.editKontakt}
});

export function registerSystem() {
  registerModule({
    id: 'system', core: true, hidden: true, name: 'System', sideGroup: 'System', icon: '⚙️', desc: '',
    views: [{id: 'einstellungen', label: 'Einstellungen', icon: '⚙️', hint: 'Firma, Module, Daten', html: E.html, render: E.renderEinstellungen}],
    init() { E.initEinstellungen(); }
  });
}
