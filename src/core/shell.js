/* ═══════════════ SHELL: Navigation, Ansichten, Design ═══════════════ */
import {$, $$, esc, Cap, IS_NATIVE, P, isDesktop} from './util.js';
import {K, saveSettings} from './db.js';
import {modules, isActive, activeViews, viewById} from './modules.js';
import {TOOL_CONFIG} from './config.js';
import {moduleIcon} from './brand.js';

export const ui = {view: null};
const MOBILE_SLOTS = 4; // + „Mehr“

/** Ansichten aller Module einmalig in die Seite einfügen und Module initialisieren */
export function mountModules() {
  const main = $('#main');
  modules().forEach(m => m.views.forEach(v => {
    if ($('#v-' + v.id)) return;
    const s = document.createElement('section');
    s.id = 'v-' + v.id; s.className = 'view hidden'; s.innerHTML = v.html || '';
    main.appendChild(s);
  }));
  modules().forEach(m => { if (m.init) m.init(); });
}

export function startView() {
  const vs = activeViews();
  if (isDesktop()) return 'uebersicht';
  const mob = vs.filter(v => v.mobile).sort((a, b) => a.mobile - b.mobile);
  return (mob[0] || vs[0]).id;
}

export function buildNav() {
  const vs = activeViews();
  // Handy: untere Leiste
  const mob = vs.filter(v => v.mobile).sort((a, b) => a.mobile - b.mobile).slice(0, MOBILE_SLOTS);
  $('#nav').innerHTML = mob.map(v => `<button data-v="${v.id}"><i>${v.icon}</i>${esc(v.label)}<span class="nav-dot hidden" data-dot="${v.id}"></span></button>`).join('')
    + `<button data-v="mehr"><i>☰</i>Mehr<span class="nav-dot hidden" data-dot="mehr"></span></button>`;
  // PC: Seitenleiste, gruppiert nach Modul
  const groups = modules().filter(m => isActive(m.id) && m.views.some(v => v.sidebar !== false));
  $('#sideNav').innerHTML = groups.map(m => `<div class="side-group">${moduleIcon(m.id, 16)}${esc(m.sideGroup || m.name)}</div>` +
    m.views.filter(v => v.sidebar !== false).map(v => `<button class="side-link" data-v="${v.id}"><i>${v.icon}</i>${esc(v.label)}<span class="nav-dot hidden" data-dot="${v.id}"></span></button>`).join('')).join('');
  $$('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
  $('#sideVersion').textContent = `v${TOOL_CONFIG.version} · Build ${TOOL_CONFIG.build}`;
  markNav();
}

function markNav() {
  $$('#nav [data-v], #sideNav [data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === ui.view));
}

export function go(id) {
  let v = viewById(id);
  if (!v || !isActive(v.module.id)) { id = startView(); v = viewById(id); }
  ui.view = id;
  $$('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + id));
  $('#pageTitle').textContent = v.title || v.label;
  markNav();
  modules().forEach(m => { if (m.onShow) m.onShow(id); });
  render();
  window.scrollTo(0, 0);
}

export function render() {
  $('#shopNameTop').textContent = $('#shopNameSide').textContent = K.settings.shopName || 'david.digital';
  // Hinweis-Punkte (z. B. Lager: niedriger Bestand)
  let hidden = 0; const mobIds = new Set($$('#nav [data-v]').map(b => b.dataset.v));
  activeViews().forEach(v => {
    const n = v.badge ? v.badge() : 0;
    $$(`[data-dot="${v.id}"]`).forEach(d => { d.textContent = n; d.classList.toggle('hidden', !n); });
    if (n && !mobIds.has(v.id)) hidden += n;
  });
  $$('[data-dot="mehr"]').forEach(d => { d.textContent = hidden; d.classList.toggle('hidden', !hidden); });
  const v = viewById(ui.view);
  if (v && v.render) v.render();
}

/** Nach Import, Löschen oder Modulwechsel: alles neu aufbauen */
export function refreshApp(view) {
  modules().forEach(m => { if (m.onReset) m.onReset(); });
  applyTheme(); buildNav(); go(view || ui.view);
}

/* ─── Design ─── */
export function applyTheme() {
  const t = K.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
  // System-Leisten (Android) und Browser-Leiste an Kopf-/Navigationsleiste angleichen
  const bar = dark ? '#161b27' : '#ffffff';
  $('#themeColor').setAttribute('content', bar);
  const SC = IS_NATIVE ? (P.SystemColor || (Cap.registerPlugin ? (P.SystemColor = Cap.registerPlugin('SystemColor')) : null)) : null;
  if (SC) SC.set({color: bar, dark}).catch(() => {});
  $$('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.t === t));
}

export function initShell() {
  window.kwOnMedia(matchMedia('(prefers-color-scheme: dark)'), applyTheme);
  $('#themeBtn').onclick = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    K.settings.theme = dark ? 'light' : 'dark'; applyTheme(); saveSettings();
  };
}
