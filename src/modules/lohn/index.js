/* ═══════════════ MODUL: Unternehmerlohn – Phase 3 ═══════════════
 * Als Einzelunternehmer gibt es kein Gehalt: Der „Lohn“ ist eine Privatentnahme und keine Betriebsausgabe.
 * Steuern zahlst du auf den Gewinn. Das Modul plant deshalb: Gewinn − Steuerrücklage − Entnahmen = noch entnehmbar.
 */
import {$, $$, esc, eur, parseMoney, moneyIn} from '../../core/util.js';
import {T, K, saveSettings} from '../../core/db.js';
import {registerModule} from '../../core/modules.js';
import {isoDay, deDay} from '../dokumente/shared.js';
import {euer, syncBuchungen, monate, pm, monatsEnde} from '../buchhaltung/shared.js';
import {editBuchung} from '../buchhaltung/buchungen.js';

const html = `
    <div class="stats-grid" id="ulStats"></div>
    <div id="ulTipp"></div>
    <div class="card" style="margin-top:12px">
      <div class="row"><div class="field"><label>Wunschlohn pro Monat (€)</label><input class="input" id="ulWunsch" inputmode="decimal" placeholder="z. B. 1.200,00"></div>
      <div class="field"><label>Steuerrücklage vom Gewinn</label><select class="input" id="ulRueck">${[0, 10, 15, 20, 25, 30, 35, 40].map(p => `<option value="${p}">${p} %</option>`).join('')}</select></div></div>
      <div class="doc-actions"><button class="btn btn-primary" id="ulEnt">👤 Entnahme buchen</button><button class="btn" id="ulEin">Einlage buchen</button></div>
      <p class="muted" style="font-size:.75rem;line-height:1.5;margin-top:8px">Die Rücklage ist eine Faustregel für Einkommensteuer (und ggf. Krankenversicherung). Den passenden Prozentsatz kann dir die Steuerberatung nennen.</p>
    </div>
    <div class="section-title">📅 ${new Date().getFullYear()} nach Monaten</div>
    <div class="list" id="ulMonate"></div>
    <div class="section-title">👤 Entnahmen & Einlagen</div>
    <div class="list" id="ulList"></div>`;

function rechnen(y) {
  let kum = 0;
  return monate.map((m, i) => {
    const r = euer(pm(y, i + 1) + '-01', monatsEnde(y, i + 1));
    const rueck = Math.max(0, Math.round(r.gewinn * K.settings.ruecklage / 100));
    kum += r.gewinn - rueck - r.entnahmen + r.einlagen;
    return {m, gewinn: r.gewinn, rueck, ent: r.entnahmen, ein: r.einlagen, frei: kum};
  });
}

function render() {
  syncBuchungen();
  const y = new Date().getFullYear(), mon = new Date().getMonth(), rows = rechnen(y), bisher = rows.slice(0, mon + 1);
  const sum = k => bisher.reduce((a, r) => a + r[k], 0), frei = rows[mon].frei;
  $('#ulStats').innerHTML = `
    <div class="stat-card" style="--sc:var(--primary)"><div class="sc-label">Gewinn ${y}</div><div class="sc-value">${eur(sum('gewinn'))}</div><div class="sc-sub">bis heute</div></div>
    <div class="stat-card" style="--sc:var(--warn)"><div class="sc-label">Steuerrücklage</div><div class="sc-value">${eur(sum('rueck'))}</div><div class="sc-sub">${K.settings.ruecklage} % vom Gewinn</div></div>
    <div class="stat-card" style="--sc:var(--indigo)"><div class="sc-label">Entnommen ${y}</div><div class="sc-value">${eur(sum('ent') - sum('ein'))}</div><div class="sc-sub">Entnahmen − Einlagen</div></div>
    <div class="stat-card" style="--sc:${frei >= 0 ? 'var(--ok)' : 'var(--danger)'}"><div class="sc-label">Noch entnehmbar</div><div class="sc-value">${eur(frei)}</div><div class="sc-sub">nach Rücklage</div></div>`;
  const w = K.settings.wunschlohn || 0, dieserMonat = rows[mon].ent;
  let tipp = '';
  if (w) {
    const rest = Math.max(0, w - dieserMonat), moeglich = Math.max(0, Math.min(rest, frei));
    tipp = rest === 0 ? `Dein Wunschlohn für ${monate[mon]} ist schon entnommen.`
      : moeglich >= rest ? `Für ${monate[mon]} kannst du deinen Wunschlohn von <b>${eur(rest)}</b> entnehmen.`
      : moeglich > 0 ? `Für ${monate[mon]} reicht es nach Rücklage nur für <b>${eur(moeglich)}</b> statt ${eur(rest)}.`
      : `Für ${monate[mon]} ist nach Rücklage nichts mehr entnehmbar. Eine Entnahme ginge an die Steuerrücklage.`;
  } else tipp = 'Trag deinen Wunschlohn ein – dann zeigt KONTORWERK dir jeden Monat, ob er drin ist.';
  $('#ulTipp').innerHTML = `<div class="alert ${w && frei < (w - dieserMonat) ? 'warn' : ''}" style="background:var(--primary-soft);margin-top:12px">${tipp}</div>`;
  $('#ulWunsch').value = moneyIn(K.settings.wunschlohn || null); $('#ulRueck').value = K.settings.ruecklage;
  $('#ulMonate').innerHTML = rows.slice(0, mon + 1).reverse().map(r => `<div class="li" style="cursor:default"><div class="li-main"><div class="li-title">${r.m}</div>
      <div class="li-sub">Gewinn ${eur(r.gewinn)} · Rücklage ${eur(r.rueck)} · Entnahmen ${eur(r.ent)}${r.ein ? ' · Einlagen ' + eur(r.ein) : ''}</div></div>
      <div class="li-end"><b class="num" style="color:${r.frei >= 0 ? 'var(--ok)' : 'var(--danger)'}">${eur(r.frei)}</b><span class="muted" style="font-size:.7rem">frei kumuliert</span></div></div>`).join('');
  const priv = T.buchung.filter(b => b.art === 'entnahme' || b.art === 'einlage').sort((a, b) => b.datum.localeCompare(a.datum));
  $('#ulList').innerHTML = priv.length ? priv.slice(0, 100).map(b => `<button class="li" data-id="${b.id}"><div class="li-thumb">${b.art === 'entnahme' ? '⬅️' : '➡️'}</div><div class="li-main"><div class="li-title">${b.art === 'entnahme' ? 'Entnahme' : 'Einlage'}${b.text ? ' · ' + esc(b.text) : ''}</div><div class="li-sub">${deDay(b.datum)}${b.festgeschrieben ? ' · 🔒' : ''}</div></div><div class="li-end"><b class="num">${eur(b.betrag)}</b></div></button>`).join('')
    : `<div class="li muted" style="cursor:default;font-size:.85rem">Noch keine Entnahmen.</div>`;
  $$('#ulList [data-id]').forEach(el => el.onclick = () => editBuchung(el.dataset.id));
}

function init() {
  $('#ulWunsch').addEventListener('change', e => { const v = parseMoney(e.target.value); K.settings.wunschlohn = isNaN(v) ? 0 : v; saveSettings(); render(); });
  $('#ulRueck').onchange = e => { K.settings.ruecklage = +e.target.value; saveSettings(); render(); };
  const y = new Date().getFullYear(), mon = new Date().getMonth();
  $('#ulEnt').onclick = () => {
    const rest = Math.max(0, (K.settings.wunschlohn || 0) - rechnen(y)[mon].ent);
    editBuchung(null, {art: 'entnahme', kategorie: 'entnahme', konto: 'bank', betrag: rest || null, text: `Unternehmerlohn ${monate[mon]}`, datum: isoDay(Date.now())});
  };
  $('#ulEin').onclick = () => editBuchung(null, {art: 'einlage', kategorie: 'einlage', konto: 'bank', text: 'Privateinlage', datum: isoDay(Date.now())});
}

registerModule({
  id: 'lohn',
  name: 'Unternehmerlohn',
  icon: '💶',
  requires: ['buchhaltung'],
  defaultOn: true,
  desc: 'Wunschlohn planen, Privatentnahmen erfassen, Rücklage für die Einkommensteuer im Blick',
  views: [{id: 'unternehmerlohn', label: 'Unternehmerlohn', icon: '👤', mobile: 12, hint: 'Entnahmen & Rücklage', html, render}],
  dashStats() {
    syncBuchungen();
    const y = new Date().getFullYear(), r = rechnen(y)[new Date().getMonth()];
    return [`<div class="stat-card" data-go="unternehmerlohn" style="--sc:${r.frei >= 0 ? 'var(--ok)' : 'var(--danger)'}"><div class="sc-label">Noch entnehmbar</div><div class="sc-value">${eur(r.frei)}</div><div class="sc-sub">nach ${K.settings.ruecklage} % Rücklage</div></div>`];
  },
  init
});
