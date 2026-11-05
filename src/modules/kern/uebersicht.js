/* ═══════════════ ÜBERSICHT (Dashboard) ═══════════════ */
import {$, $$, esc, eur, parseMoney, moneyIn} from '../../core/util.js';
import {T, K, saveSettings} from '../../core/db.js';
import {toast, openModal, closeModal} from '../../core/ui.js';
import {go, render} from '../../core/shell.js';
import {isActive, modules, viewById} from '../../core/modules.js';
import {moduleIcon} from '../../core/brand.js';
import {umsatzJahr, stufe, GRENZE_LAUFEND, GRENZE_VORJAHR} from '../../core/umsatz.js';

export const html = `
    <div id="dashWatch"></div>
    <div id="dashStats"></div>
    <div id="dashPlan"></div>`;

const meter = (wert, grenze) => {
  const s = stufe(wert, grenze), pct = Math.min(100, wert / grenze * 100);
  return `<div class="meter"><div class="meter-track"><div class="meter-fill ${s === 'ok' ? '' : s}" style="width:${pct}%"></div></div>
    <div class="meter-legend"><span>${(wert / grenze * 100).toLocaleString('de-DE', {maximumFractionDigits: wert / grenze < .1 ? 1 : 0})} % der Grenze</span><span>Grenze ${eur(grenze).replace(',00', '')}</span></div></div>`;
};

function watchHtml() {
  if (!K.settings.klein) return '';
  const y = new Date().getFullYear(), now = umsatzJahr(y), prev = umsatzJahr(y - 1);
  const alerts = [];
  if (prev.total > GRENZE_VORJAHR) alerts.push(['danger', `Dein Umsatz ${y - 1} lag über 25.000 €. Damit giltst du ${y} nicht mehr als Kleinunternehmer. Kläre das bitte mit deiner Steuerberatung.`]);
  if (now.total > GRENZE_LAUFEND) alerts.push(['danger', `Der Umsatz ${y} liegt über 100.000 €. Die Kleinunternehmerregelung endet damit sofort, ab dem Umsatz, der die Grenze überschreitet.`]);
  else if (now.total >= GRENZE_LAUFEND * 0.8) alerts.push(['warn', `Der Umsatz ${y} nähert sich der Grenze von 100.000 €. Wird sie überschritten, endet die Befreiung sofort.`]);
  if (now.total > GRENZE_VORJAHR && prev.total <= GRENZE_VORJAHR) alerts.push(['warn', `Der Umsatz ${y} liegt über 25.000 €. Für ${y} ändert sich nichts, aber ab ${y + 1} bist du voraussichtlich kein Kleinunternehmer mehr.`]);
  return `<div class="section-title" style="margin-top:4px">📃 Kleinunternehmer-Grenzen (§ 19 UStG) <button class="btn btn-sm" id="dashExtra">Umsätze nachtragen</button></div>
    <div class="watch">
      <div class="card"><h4><span>Laufendes Jahr ${y}</span><span class="muted">max. 100.000 €</span></h4><div class="big">${eur(now.total)}</div>${meter(now.total, GRENZE_LAUFEND)}
        <div class="muted" style="font-size:.75rem">${eur(now.inApp)} in KONTORWERK${now.extra ? ` + ${eur(now.extra)} nachgetragen` : ''}</div></div>
      <div class="card"><h4><span>Vorjahr ${y - 1}</span><span class="muted">max. 25.000 €</span></h4><div class="big">${eur(prev.total)}</div>${meter(prev.total, GRENZE_VORJAHR)}
        <div class="muted" style="font-size:.75rem">${eur(prev.inApp)} in KONTORWERK${prev.extra ? ` + ${eur(prev.extra)} nachgetragen` : ''}</div></div>
    </div>
    ${alerts.map(([k, t]) => `<div class="alert ${k}">${t}</div>`).join('')}
    <div class="muted" style="font-size:.75rem;margin-top:8px;line-height:1.5">Verkäufe über Etsy oder andere Kanäle zählen mit. Bis das E-Commerce-Modul sie automatisch holt, trag sie über „Umsätze nachtragen“ ein.</div>`;
}

function extraDialog() {
  const y = new Date().getFullYear(), ex = K.settings.umsatzExtra;
  openModal('Umsätze außerhalb von KONTORWERK', `
    <p class="muted" style="font-size:.85rem;line-height:1.5;margin-bottom:12px">Summe aller Umsätze, die nicht als Verkauf in KONTORWERK erfasst sind, z. B. Etsy-Verkäufe oder Rechnungen aus einem anderen Programm.</p>
    <div class="row"><div class="field"><label>${y} (€)</label><input class="input" id="exNow" inputmode="decimal" value="${moneyIn(ex[y])}" placeholder="0,00"></div>
    <div class="field"><label>${y - 1} (€)</label><input class="input" id="exPrev" inputmode="decimal" value="${moneyIn(ex[y - 1])}" placeholder="0,00"></div></div>`,
    `<button class="btn btn-primary" id="exOk">Speichern</button>`);
  $('#exOk').onclick = () => {
    const a = $('#exNow').value.trim() ? parseMoney($('#exNow').value) : 0, b = $('#exPrev').value.trim() ? parseMoney($('#exPrev').value) : 0;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return toast('Ungültiger Betrag', true);
    ex[y] = a; ex[y - 1] = b; saveSettings(); closeModal(); render();
  };
}

function statsHtml() {
  const out = [];
  if (isActive('wawi')) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime(), m0 = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    const ok = T.beleg.filter(b => b.art === 'bon' && !b.storno);
    const today = ok.filter(b => b.ts >= t0), month = ok.filter(b => b.ts >= m0);
    const sum = l => l.reduce((a, b) => a + b.total, 0), n = l => l.length === 1 ? '1 Verkauf' : l.length + ' Verkäufe';
    const lager = viewById('lager'), low = lager && lager.badge ? lager.badge() : 0;
    out.push(`<div class="stat-card" data-go="berichte"><div class="sc-label">Umsatz heute</div><div class="sc-value">${eur(sum(today))}</div><div class="sc-sub">${n(today)}</div></div>`);
    out.push(`<div class="stat-card" data-go="berichte" style="--sc:var(--indigo)"><div class="sc-label">Umsatz Monat</div><div class="sc-value">${eur(sum(month))}</div><div class="sc-sub">${n(month)}</div></div>`);
    out.push(`<div class="stat-card" data-go="lager" style="--sc:${low ? 'var(--warn)' : 'var(--ok)'}"><div class="sc-label">Lager</div><div class="sc-value">${low}</div><div class="sc-sub">${low ? 'Produkte nachproduzieren' : 'alles auf Lager'}</div></div>`);
  }
  modules().filter(m => isActive(m.id) && m.dashStats).forEach(m => out.push(...m.dashStats()));
  out.push(`<div class="stat-card" data-go="kontakte" style="--sc:var(--ok)"><div class="sc-label">Kontakte</div><div class="sc-value">${T.kontakt.length}</div><div class="sc-sub">Kunden & Lieferanten</div></div>`);
  return `<div class="section-title">📌 Auf einen Blick</div><div class="stats-grid">${out.join('')}</div>`;
}

function planHtml() {
  const planned = modules().filter(m => m.planned).sort((a, b) => a.planned - b.planned);
  if (!planned.length) return '';
  return `<div class="section-title">🔌 Module in Arbeit <span class="muted">Ausbau nach Phasenplan</span></div>
    <div class="list">${planned.map(m => `<div class="li"><div class="li-thumb svg">${moduleIcon(m.id, 44) || m.icon}</div><div class="li-main"><div class="li-title">${esc(m.name)}</div><div class="li-sub">${esc(m.desc)}</div></div><div class="li-end"><span class="badge gray">Phase ${m.planned}</span></div></div>`).join('')}</div>`;
}

export function renderUebersicht() {
  $('#dashWatch').innerHTML = watchHtml();
  $('#dashStats').innerHTML = statsHtml();
  $('#dashPlan').innerHTML = planHtml();
  if ($('#dashExtra')) $('#dashExtra').onclick = extraDialog;
  $$('#dashStats [data-go]').forEach(c => { c.style.cursor = 'pointer'; c.onclick = () => go(c.dataset.go); });
}
