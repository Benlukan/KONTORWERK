/* ═══════════════ LAGER ═══════════════ */
import {$, $$, esc, eur, fmtDT} from '../../core/util.js';
import {T, K, put} from '../../core/db.js';
import {toast, haptic, openModal, closeModal} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {prodById, stockState, addMove, MOVE_LBL, thumb, stockBadge} from './shared.js';
import {editProduct} from './produkte.js';

export const html = `
    <div class="stats-grid" id="stockStats"></div>
    <div class="segment" id="stockSeg" style="margin-top:14px"><button data-seg="b" class="active">📋 Bestand</button><button data-seg="m">🔁 Bewegungen</button></div>
    <div id="stockPane">
      <div class="chips" id="stockFilter"></div>
      <div id="stockList"></div>
    </div>
    <div id="movePane" class="hidden"><div id="moveList"></div></div>`;

const st = {seg: 'b', filter: 'all'};

export function renderStock() {
  const tracked = T.produkt.filter(p => p.trackStock);
  const units = tracked.reduce((a, p) => a + Math.max(0, p.stock), 0);
  const valCost = tracked.reduce((a, p) => a + Math.max(0, p.stock) * (p.cost || 0), 0);
  const valSale = tracked.reduce((a, p) => a + Math.max(0, p.stock) * p.price, 0);
  const low = tracked.filter(p => stockState(p) === 'low').length, out = tracked.filter(p => stockState(p) === 'out').length;
  $('#stockStats').innerHTML = `
    <div class="stat-card"><div class="sc-label">Bestand</div><div class="sc-value">${units}</div><div class="sc-sub">${tracked.length} Produkte</div></div>
    <div class="stat-card" style="--sc:var(--indigo)"><div class="sc-label">Lagerwert VK</div><div class="sc-value">${eur(valSale)}</div><div class="sc-sub">EK/Material: ${eur(valCost)}</div></div>
    <div class="stat-card" style="--sc:var(--warn)"><div class="sc-label">Nachproduzieren</div><div class="sc-value">${low}</div><div class="sc-sub">am Mindestbestand</div></div>
    <div class="stat-card" style="--sc:var(--danger)"><div class="sc-label">Ausverkauft</div><div class="sc-value">${out}</div><div class="sc-sub">Bestand 0</div></div>`;
  $$('#stockSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === st.seg));
  $('#stockPane').classList.toggle('hidden', st.seg !== 'b'); $('#movePane').classList.toggle('hidden', st.seg !== 'm');
  if (st.seg === 'b') {
    const F = [['all', 'Alle'], ['low', '⚠️ Niedrig'], ['out', '⛔ Leer']];
    $('#stockFilter').innerHTML = F.map(([k, l]) => `<button class="chip ${st.filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('');
    $$('#stockFilter .chip').forEach(b => b.onclick = () => { st.filter = b.dataset.f; renderStock(); });
    let list = tracked;
    if (st.filter === 'low') list = list.filter(p => ['low', 'out'].includes(stockState(p)));
    if (st.filter === 'out') list = list.filter(p => stockState(p) === 'out');
    const rank = {out: 0, low: 1, ok: 2};
    list = [...list].sort((a, b) => rank[stockState(a)] - rank[stockState(b)] || a.name.localeCompare(b.name, 'de'));
    $('#stockList').innerHTML = list.length ? `<div class="list">${list.map(p => `<div class="li">${thumb(p)}
      <div class="li-main" data-adj="${p.id}" style="cursor:pointer"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${stockBadge(p)} &nbsp;min. ${p.minStock ?? K.settings.minDefault}</div></div>
      <div class="stock-ctrl"><button class="sbtn" data-m="${p.id}">−</button><span class="sval num">${p.stock}</span><button class="sbtn" data-p="${p.id}">+</button></div></div>`).join('')}</div>`
      : `<div class="card empty"><div>${tracked.length ? '✅' : '🏷️'}</div><p>${tracked.length ? 'Nichts in dieser Ansicht.' : 'Noch keine Produkte mit Bestandsführung.'}</p></div>`;
    $$('#stockList [data-p]').forEach(b => b.onclick = () => quickAdj(b.dataset.p, 1));
    $$('#stockList [data-m]').forEach(b => b.onclick = () => quickAdj(b.dataset.m, -1));
    $$('#stockList [data-adj]').forEach(b => b.onclick = () => adjustStock(b.dataset.adj));
  } else {
    const mv = [...T.lagerbewegung].sort((a, b) => b.ts - a.ts).slice(0, 300);
    $('#moveList').innerHTML = mv.length ? `<div class="list">${mv.map(m => { const p = prodById(m.pid); return `<div class="li"><div class="li-main"><div class="li-title">${esc(p ? p.name : 'Gelöschtes Produkt')}</div><div class="li-sub">${MOVE_LBL[m.type] || m.type} · ${fmtDT(m.ts)}${m.note ? ' · ' + esc(m.note) : ''}</div></div><div class="li-end"><b class="num" style="color:${m.qty >= 0 ? 'var(--ok)' : 'var(--danger)'}">${m.qty > 0 ? '+' : ''}${m.qty}</b></div></div>`; }).join('')}</div>`
      : `<div class="card empty"><div>🔁</div><p>Noch keine Lagerbewegungen.</p></div>`;
  }
}
// Kurz hintereinander getippte +/- werden zu einer Bewegung zusammengefasst
const adjBuf = {};
function quickAdj(pid, d) {
  const p = prodById(pid); if (!p) return;
  if (d < 0 && p.stock <= 0 && !K.settings.allowNegative) return toast('Bestand ist schon 0', true);
  p.stock += d; put('produkt', p); haptic();
  const b = adjBuf[pid] || (adjBuf[pid] = {qty: 0});
  b.qty += d; clearTimeout(b.t);
  b.t = setTimeout(() => { if (b.qty) addMove(pid, b.qty, b.qty > 0 ? 'in' : 'out', 'Schnellkorrektur'); delete adjBuf[pid]; }, 1500);
  render();
}
function adjustStock(pid) {
  const p = prodById(pid); if (!p) return;
  let mode = 'in';
  openModal(p.name, `
    <div class="pay-total" style="padding:0 0 12px"><small>Aktueller Bestand</small><b class="num">${p.stock} ${esc(p.unit || 'Stk')}</b></div>
    <div class="segment" id="aMode"><button data-m="in" class="active">📥 Zugang</button><button data-m="out">📤 Abgang</button><button data-m="inv">📋 Inventur</button></div>
    <div class="field"><label id="aLbl">Menge hinzufügen</label><input class="input" id="aQty" type="number" min="0" inputmode="numeric" style="font-size:1.3rem;font-weight:700" placeholder="0"></div>
    <div class="field"><label>Notiz</label><input class="input" id="aNote" placeholder="z. B. neue Produktion, Bruch, Geschenk…"></div>
    <div class="muted" id="aPrev" style="font-size:.85rem"></div>`,
    `<button class="btn" id="aEdit">Produkt bearbeiten</button><button class="btn btn-primary" id="aOk">Buchen</button>`);
  const lbl = {in: 'Menge hinzufügen', out: 'Menge abziehen', inv: 'Gezählter Bestand'};
  const upd = () => { const q = parseInt($('#aQty').value, 10); if (isNaN(q)) { $('#aPrev').textContent = ''; return; } const n = mode === 'in' ? p.stock + q : mode === 'out' ? p.stock - q : q; $('#aPrev').textContent = `Neuer Bestand: ${n} ${p.unit || 'Stk'}`; };
  $$('#aMode button').forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#aMode button').forEach(x => x.classList.toggle('active', x === b)); $('#aLbl').textContent = lbl[mode]; if (mode === 'inv') $('#aQty').value = p.stock; upd(); });
  $('#aQty').oninput = upd;
  setTimeout(() => $('#aQty').focus(), 250);
  $('#aEdit').onclick = () => { closeModal(); setTimeout(() => editProduct(pid), 240); };
  $('#aOk').onclick = () => {
    const q = parseInt($('#aQty').value, 10); if (isNaN(q) || q < 0) return toast('Bitte Menge eingeben', true);
    const diff = mode === 'in' ? q : mode === 'out' ? -q : q - p.stock;
    if (!diff) { closeModal(); return; }
    if (p.stock + diff < 0 && !K.settings.allowNegative) return toast('Bestand würde negativ', true);
    p.stock += diff; put('produkt', p); addMove(pid, diff, mode, $('#aNote').value.trim()); closeModal(); toast('Gebucht: ' + (diff > 0 ? '+' : '') + diff); render();
  };
}

export function initLager() {
  $$('#stockSeg button').forEach(b => b.onclick = () => { st.seg = b.dataset.seg; renderStock(); });
}
