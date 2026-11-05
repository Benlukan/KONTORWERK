/* ═══════════════ BERICHTE & TAGESABSCHLUSS ═══════════════ */
import {$, $$, esc, eur, eurPlain, parseMoney, moneyIn, dayKey, fmtDate, fmtTime, fmtDT, csv} from '../../core/util.js';
import {K, get, put} from '../../core/db.js';
import {toast, openModal, closeModal} from '../../core/ui.js';
import {downloadFile, shareText} from '../../core/files.js';
import {catById, bons} from './shared.js';
import {showReceipt} from './verkauf.js';

export const html = `
    <div class="chips" id="periodChips"></div>
    <div class="stats-grid" id="repStats"></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-soft" id="closeDayBtn">🔢 Tagesabschluss</button>
      <button class="btn" id="csvSalesBtn">⬇ CSV-Export</button>
    </div>
    <div id="repDays"></div>
    <div class="grid2">
      <div><div class="section-title">💳 Zahlarten</div><div class="card"><div class="bars" id="repPay"></div></div></div>
      <div><div class="section-title">🏷️ Kategorien</div><div class="card"><div class="bars" id="repCats"></div></div></div>
    </div>
    <div class="section-title">🏆 Top-Produkte</div>
    <div class="list" id="repTop"></div>
    <div class="section-title">📃 Verkäufe <span class="muted" id="repSalesCount"></span></div>
    <div class="list" id="repSales"></div>`;

const PERIODS = [['today', 'Heute'], ['yesterday', 'Gestern'], ['7', '7 Tage'], ['30', '30 Tage'], ['month', 'Dieser Monat'], ['year', 'Dieses Jahr'], ['all', 'Alles']];
const st = {period: 'today'};

export function periodRange(k) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime(), DAY = 864e5;
  switch (k) {
    case 'today': return [t0, t0 + DAY];
    case 'yesterday': return [t0 - DAY, t0];
    case '7': return [t0 - 6 * DAY, t0 + DAY];
    case '30': return [t0 - 29 * DAY, t0 + DAY];
    case 'month': return [new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(), t0 + DAY];
    case 'year': return [new Date(d0.getFullYear(), 0, 1).getTime(), t0 + DAY];
    default: return [0, Infinity];
  }
}
export const salesIn = (a, b) => bons().filter(s => s.ts >= a && s.ts < b);
export function aggregate(list) {
  const ok = list.filter(s => !s.storno);
  const r = {rev: 0, n: ok.length, items: 0, cost: 0, pay: {bar: 0, karte: 0, sonst: 0}, cats: {}, prods: {}, storno: list.length - ok.length};
  ok.forEach(s => {
    r.rev += s.total; r.pay[s.pay] = (r.pay[s.pay] || 0) + s.total;
    const f = s.sub ? s.total / s.sub : 1;
    s.items.forEach(i => {
      const net = Math.round(i.price * i.qty * f); r.items += i.qty; r.cost += (i.cost || 0) * i.qty;
      const ck = i.catId && catById(i.catId) ? i.catId : '_';
      r.cats[ck] = (r.cats[ck] || 0) + net;
      const pk = i.pid || 'free:' + i.name;
      const pr = r.prods[pk] || (r.prods[pk] = {name: i.name, qty: 0, rev: 0}); pr.qty += i.qty; pr.rev += net;
    });
  });
  return r;
}
function bars(el, rows) {
  const max = Math.max(1, ...rows.map(r => r.v));
  el.innerHTML = rows.length ? rows.map(r => `<div class="bar-row"><span class="bl">${r.l}</span><div class="bar-track"><div class="bar-fill" style="width:${r.v / max * 100}%;--bc:${r.c || 'var(--primary)'}"></div></div><span class="bv">${r.t}</span></div>`).join('') : `<div class="muted" style="font-size:.85rem">Keine Daten im Zeitraum.</div>`;
}
export function renderReports() {
  $('#periodChips').innerHTML = PERIODS.map(([k, l]) => `<button class="chip ${st.period === k ? 'active' : ''}" data-p="${k}">${l}</button>`).join('');
  $$('#periodChips .chip').forEach(b => b.onclick = () => { st.period = b.dataset.p; renderReports(); });
  const [a, b] = periodRange(st.period); const list = salesIn(a, b); const r = aggregate(list);
  const hasCost = r.cost > 0;
  $('#repStats').innerHTML = `
    <div class="stat-card"><div class="sc-label">Umsatz</div><div class="sc-value">${eur(r.rev)}</div><div class="sc-sub">${r.items} Artikel verkauft</div></div>
    <div class="stat-card" style="--sc:var(--indigo)"><div class="sc-label">Verkäufe</div><div class="sc-value">${r.n}</div><div class="sc-sub">${r.storno ? r.storno + ' storniert' : 'keine Stornos'}</div></div>
    <div class="stat-card" style="--sc:var(--ok)"><div class="sc-label">Ø Bon</div><div class="sc-value">${eur(r.n ? Math.round(r.rev / r.n) : 0)}</div><div class="sc-sub">pro Verkauf</div></div>
    <div class="stat-card" style="--sc:var(--warn)"><div class="sc-label">Rohertrag</div><div class="sc-value">${hasCost ? eur(r.rev - r.cost) : '–'}</div><div class="sc-sub">${hasCost ? 'Umsatz − EK/Material' : 'EK-Preise pflegen'}</div></div>`;
  // Umsatz pro Tag
  if (st.period !== 'today' && st.period !== 'yesterday' && list.length) {
    let start = a; if (!isFinite(start) || start === 0) { start = Math.min(...list.map(s => s.ts)); const d = new Date(start); d.setHours(0, 0, 0, 0); start = d.getTime(); }
    const end = Math.min(b, Date.now() + 1); const days = [];
    for (let t = start; t < end && days.length < 400; t += 864e5) { const k = dayKey(t + 3600e3); days.push({k, v: 0}); }
    const byK = Object.fromEntries(days.map(d => [d.k, d]));
    list.filter(s => !s.storno).forEach(s => { const d = byK[dayKey(s.ts)]; if (d) d.v += s.total; });
    let shown = days; if (days.length > 31) { // nach Monat gruppieren
      const m = {}; days.forEach(d => { const k = d.k.slice(0, 7); m[k] = (m[k] || 0) + d.v; }); shown = Object.entries(m).map(([k, v]) => ({k, v, lbl: k.slice(5) + '/' + k.slice(2, 4)}));
    }
    const max = Math.max(1, ...shown.map(d => d.v));
    $('#repDays').innerHTML = `<div class="section-title">📈 Umsatzverlauf</div><div class="card"><div class="cols">${shown.map(d => `<div class="col" title="${d.k}: ${eur(d.v)}"><div class="col-bar" style="height:${d.v / max * 100}%"></div><small>${d.lbl || d.k.slice(8) + '.'}</small></div>`).join('')}</div></div>`;
  } else $('#repDays').innerHTML = '';
  bars($('#repPay'), [['bar', '💶 Bar', '#10b981'], ['karte', '💳 Karte', '#6366f1'], ['sonst', '📲 Sonstiges', '#f59e0b']].filter(([k]) => r.pay[k]).map(([k, l, c]) => ({l, v: r.pay[k], t: eur(r.pay[k]), c})));
  bars($('#repCats'), Object.entries(r.cats).sort((x, y) => y[1] - x[1]).map(([k, v]) => { const c = catById(k); return {l: c ? esc((c.emoji || '') + ' ' + c.name) : 'Ohne Kategorie', v, t: eur(v), c: c ? c.color : '#64748b'}; }));
  const top = Object.values(r.prods).sort((x, y) => y.rev - x.rev).slice(0, 10);
  $('#repTop').innerHTML = top.length ? top.map((p, i) => `<div class="li"><div class="li-thumb" style="font-size:.95rem;font-weight:800;color:var(--primary)">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div><div class="li-main"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${p.qty}× verkauft</div></div><div class="li-end"><b class="num">${eur(p.rev)}</b></div></div>`).join('')
    : `<div class="empty"><div>🏆</div><p>Noch keine Verkäufe im Zeitraum.</p></div>`;
  const sl = [...list].sort((x, y) => y.ts - x.ts);
  $('#repSalesCount').textContent = sl.length ? `· ${sl.length}` : '';
  $('#repSales').innerHTML = sl.length ? sl.slice(0, 200).map(s => `<button class="li ${s.storno ? 'strike' : ''}" data-s="${s.id}"><div class="li-thumb">${s.pay === 'bar' ? '💶' : s.pay === 'karte' ? '💳' : '📲'}</div><div class="li-main"><div class="li-title">Bon #${s.no} · ${s.items.reduce((x, i) => x + i.qty, 0)} Artikel</div><div class="li-sub">${fmtDT(s.ts)} · ${esc(s.items.map(i => i.name).join(', '))}</div></div><div class="li-end"><b class="num">${eur(s.total)}</b>${s.storno ? '<span class="badge out">Storno</span>' : ''}</div></button>`).join('')
    + (sl.length > 200 ? `<div class="li muted" style="font-size:.8rem;justify-content:center">… ${sl.length - 200} ältere im CSV-Export</div>` : '')
    : `<div class="empty"><div>📃</div><p>Keine Verkäufe im Zeitraum.</p></div>`;
  $$('#repSales [data-s]').forEach(x => x.onclick = () => showReceipt(x.dataset.s));
}
function exportSalesCsv() {
  const [a, b] = periodRange(st.period); const list = salesIn(a, b).sort((x, y) => x.ts - y.ts);
  if (!list.length) return toast('Keine Verkäufe im Zeitraum', true);
  const rows = [['Bon', 'Datum', 'Uhrzeit', 'Artikel', 'Kategorie', 'Menge', 'Einzelpreis', 'Positionssumme', 'Rabatt Bon', 'Bon gesamt', 'Zahlart', 'Storniert']];
  list.forEach(s => s.items.forEach(i => { const c = catById(i.catId); rows.push([s.no, fmtDate(s.ts), fmtTime(s.ts), i.name, c ? c.name : '', i.qty, eurPlain(i.price), eurPlain(i.price * i.qty), eurPlain(s.disc || 0), eurPlain(s.total), s.pay === 'bar' ? 'Bar' : s.pay === 'karte' ? 'Karte' : (s.payNote || 'Sonstiges'), s.storno ? 'ja' : '']); }));
  downloadFile(`kontorwerk-verkaeufe-${dayKey(Date.now())}.csv`, csv(rows), 'text/csv');
}

/* ─── TAGESABSCHLUSS ─── */
function closeDay(k) {
  const [y, m, d] = k.split('-').map(Number); const a = new Date(y, m - 1, d).getTime(), b = a + 864e5;
  const r = aggregate(salesIn(a, b)); const rec = get('tagesabschluss', k) || {};
  openModal('Tagesabschluss', `
    <div class="field"><label>Datum</label><input class="input" type="date" id="cdDate" value="${k}"></div>
    <div class="receipt" style="font-family:inherit;margin-bottom:14px">
      <div class="rr"><span>Verkäufe</span><b>${r.n}${r.storno ? ` <span class="muted" style="font-weight:500">(+${r.storno} Storno)</span>` : ''}</b></div>
      <div class="rr"><span>💶 Bar</span><b class="num">${eur(r.pay.bar || 0)}</b></div>
      <div class="rr"><span>💳 Karte</span><b class="num">${eur(r.pay.karte || 0)}</b></div>
      <div class="rr"><span>📲 Sonstiges</span><b class="num">${eur(r.pay.sonst || 0)}</b></div><hr>
      <div class="rr big"><span>Umsatz</span><span class="num">${eur(r.rev)}</span></div></div>
    <div class="row"><div class="field"><label>Wechselgeld Start €</label><input class="input" id="cdOpen" inputmode="decimal" value="${moneyIn(rec.open)}" placeholder="0,00"></div>
    <div class="field"><label>Bar gezählt €</label><input class="input" id="cdCount" inputmode="decimal" value="${moneyIn(rec.counted)}" placeholder="0,00"></div></div>
    <div class="row"><div class="field"><label>Entnahmen €</label><input class="input" id="cdOut" inputmode="decimal" value="${moneyIn(rec.out)}" placeholder="0,00"></div><div class="field"><label>Notiz</label><input class="input" id="cdNote" value="${esc(rec.note || '')}" placeholder="optional"></div></div>
    <div class="change" id="cdDiff"></div>
    ${rec.closedTs ? `<div class="muted" style="font-size:.75rem;margin-top:8px">Zuletzt gespeichert: ${fmtDT(rec.closedTs)}</div>` : ''}`,
    `<button class="btn" id="cdShare">📤 Teilen</button><button class="btn btn-primary" id="cdOk">Speichern</button>`);
  const val = id => { const v = parseMoney($(id).value); return isNaN(v) ? 0 : v; };
  const upd = () => {
    const soll = val('#cdOpen') + (r.pay.bar || 0) - val('#cdOut');
    const has = $('#cdCount').value.trim() !== '';
    const diff = val('#cdCount') - soll;
    $('#cdDiff').className = 'change' + (has && diff < 0 ? ' neg' : '');
    $('#cdDiff').innerHTML = has ? `<span>Soll ${eur(soll)} · Differenz</span><b class="num">${diff > 0 ? '+' : ''}${eur(diff)}</b>` : `<span>Soll-Bestand Bargeld</span><b class="num">${eur(soll)}</b>`;
    return {soll, diff, has};
  };
  ['#cdOpen', '#cdCount', '#cdOut'].forEach(i => $(i).oninput = upd); upd();
  $('#cdDate').onchange = e => { if (e.target.value) closeDay(e.target.value); };
  const store = () => put('tagesabschluss', {...rec, id: k, open: val('#cdOpen'), counted: $('#cdCount').value.trim() ? val('#cdCount') : null, out: val('#cdOut'), note: $('#cdNote').value.trim(), closedTs: Date.now(), rev: r.rev, bar: r.pay.bar || 0});
  $('#cdOk').onclick = () => { store(); closeModal(); toast('Tagesabschluss gespeichert'); };
  $('#cdShare').onclick = () => {
    store(); const u = upd(); const s = K.settings;
    const t = `Tagesabschluss ${fmtDate(a)}\n${s.shopName || 'KONTORWERK'}\n\nVerkäufe: ${r.n}${r.storno ? ' (+' + r.storno + ' Storno)' : ''}\nBar: ${eur(r.pay.bar || 0)}\nKarte: ${eur(r.pay.karte || 0)}\nSonstiges: ${eur(r.pay.sonst || 0)}\nUmsatz: ${eur(r.rev)}\n\nWechselgeld Start: ${eur(val('#cdOpen'))}\nEntnahmen: ${eur(val('#cdOut'))}\nSoll Bargeld: ${eur(u.soll)}${u.has ? `\nGezählt: ${eur(val('#cdCount'))}\nDifferenz: ${eur(u.diff)}` : ''}${$('#cdNote').value.trim() ? '\nNotiz: ' + $('#cdNote').value.trim() : ''}`;
    shareText('Tagesabschluss ' + fmtDate(a), t);
  };
}

export function initBerichte() {
  $('#csvSalesBtn').onclick = exportSalesCsv;
  $('#closeDayBtn').onclick = () => closeDay(dayKey(Date.now()));
}
