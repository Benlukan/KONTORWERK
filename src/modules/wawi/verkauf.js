/* ═══════════════ VERKAUF (Kasse vor Ort) ═══════════════ */
import {$, $$, esc, eur, eurPlain, parseMoney, moneyIn, uid, soft, fmtDT, IS_NATIVE} from '../../core/util.js';
import {T, K, put, saveSettings, flush} from '../../core/db.js';
import {toast, haptic, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {shareText} from '../../core/files.js';
import {render, ui} from '../../core/shell.js';
import {catById, prodById, sortedCats, stockState, addMove, payLabel, bons} from './shared.js';

export const html = `
    <div class="pos">
      <div>
        <div class="pos-head">
          <div class="search"><input class="input" id="posSearch" placeholder="Produkt, Artikelnr. oder Barcode…" autocomplete="off" enterkeyhint="search"></div>
        </div>
        <div class="chips" id="posCats"></div>
        <div class="grid" id="posGrid"></div>
        <div class="pad-cartbar"></div>
      </div>
      <aside class="cart" id="cart">
        <div class="cart-head">
          <b>🧾 Warenkorb <span class="muted" id="cartCount" style="font-weight:500"></span></b>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" id="cartClear">Leeren</button>
            <button class="x-btn sheet-close" id="cartClose">✕</button>
          </div>
        </div>
        <div class="cart-lines" id="cartLines"></div>
        <div class="cart-foot">
          <div class="sum-row"><span>Zwischensumme</span><span class="num" id="cartSub">0,00 €</span></div>
          <div class="sum-row" id="cartDiscRow"><span>Rabatt</span><span class="num" id="cartDisc"></span></div>
          <div class="sum-total"><span style="font-weight:700">Gesamt</span><b class="num" id="cartTotal">0,00 €</b></div>
          <div class="cart-actions">
            <button class="btn btn-sm" id="discBtn">％ Rabatt</button>
            <button class="btn btn-sm" id="customBtn">＋ Freier Betrag</button>
          </div>
          <button class="btn btn-grad btn-block btn-xl" id="payBtn">Bezahlen</button>
        </div>
      </aside>
    </div>
    <button class="cartbar hidden" id="cartBar"><span><span class="cb-count" id="cbCount">0</span>&nbsp; Warenkorb</span><span class="cb-total num" id="cbTotal">0,00 €</span></button>`;

export let cart = {lines: [], discount: null}; // discount: {type:'pct'|'abs', val}
const pos = {cat: 'all', q: ''};
export const posCat = () => pos.cat;
export function dropFromCart(pid) { cart.lines = cart.lines.filter(l => l.pid !== pid); }
export function clearCart() { cart = {lines: [], discount: null}; }

function inCart(pid) { return cart.lines.filter(l => l.pid === pid).reduce((a, l) => a + l.qty, 0); }

export function renderPOS() {
  const cats = sortedCats();
  const used = new Set(T.produkt.filter(p => p.active).map(p => p.catId));
  $('#posCats').innerHTML = `<button class="chip ${pos.cat === 'all' ? 'active' : ''}" data-c="all">Alle</button>` +
    cats.filter(c => used.has(c.id)).map(c => `<button class="chip ${pos.cat === c.id ? 'active' : ''}" data-c="${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.emoji || '')} ${esc(c.name)}</button>`).join('');
  $$('#posCats .chip').forEach(b => b.onclick = () => { pos.cat = b.dataset.c; renderPOS(); });

  const q = pos.q.trim().toLowerCase();
  let list = T.produkt.filter(p => p.active);
  if (pos.cat !== 'all') list = list.filter(p => p.catId === pos.cat);
  if (q) list = list.filter(p => (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q));
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  if (!T.produkt.length) {
    $('#posGrid').innerHTML = `<div class="card empty" style="grid-column:1/-1"><div>📦</div><p>Noch keine Produkte angelegt.<br>Leg deine ersten Produkte an oder probier die Demo aus.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" onclick="KW.go('produkte');KW.editProduct()">＋ Erstes Produkt</button><button class="btn" onclick="KW.loadDemo()">✨ Demo-Daten</button></div></div>`;
  } else {
    $('#posGrid').innerHTML = list.map(p => {
      const c = catById(p.catId); const st = stockState(p); const n = inCart(p.id);
      const avail = p.trackStock ? p.stock - n : null;
      const stockLbl = !p.trackStock ? '' : `<span class="ti-stock ${st === 'out' || avail <= 0 ? 'out' : st === 'low' ? 'low' : ''}">${p.stock} ${esc(p.unit || 'Stk')}</span>`;
      const blocked = p.trackStock && avail <= 0 && !K.settings.allowNegative;
      return `<button class="tile ${blocked ? 'disabled' : ''}" data-id="${p.id}" style="--tc:${soft(p.color || (c && c.color) || '#009EB2')}">
        <div class="ti-img">${p.img ? `<img src="${p.img}" alt="">` : esc(p.emoji || (c && c.emoji) || '📦')}${n ? `<span class="ti-qty">${n}</span>` : ''}${stockLbl}</div>
        <div class="ti-body"><div class="ti-name">${esc(p.name)}</div><div class="ti-price num">${eur(p.price)}</div></div></button>`;
    }).join('') + `<button class="tile add" id="posCustom"><span>＋</span>Freier Betrag</button>`;
    if (!list.length && q) $('#posGrid').insertAdjacentHTML('afterbegin', `<div class="muted" style="grid-column:1/-1;padding:8px 2px;font-size:.85rem">Kein Produkt zu „${esc(pos.q)}“ gefunden.</div>`);
    $$('#posGrid .tile[data-id]').forEach(t => t.onclick = () => addToCart(t.dataset.id, t));
    $('#posCustom').onclick = customItem;
  }
  renderCart();
}

function addToCart(pid, el) {
  const p = prodById(pid); if (!p) return;
  if (p.trackStock && !K.settings.allowNegative && p.stock - inCart(pid) <= 0) {
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    toast(`„${p.name}“ ist nicht mehr auf Lager`, true); return;
  }
  const l = cart.lines.find(x => x.pid === pid && x.price === p.price);
  if (l) l.qty++; else cart.lines.push({key: uid(), pid, name: p.name, price: p.price, qty: 1});
  haptic(); renderPOS();
}
function cartCalc() {
  const sub = cart.lines.reduce((a, l) => a + l.price * l.qty, 0);
  let disc = 0;
  if (cart.discount) disc = cart.discount.type === 'pct' ? Math.round(sub * cart.discount.val / 100) : Math.min(cart.discount.val, sub);
  return {sub, disc, total: sub - disc, count: cart.lines.reduce((a, l) => a + l.qty, 0)};
}
function renderCart() {
  const c = cartCalc();
  $('#cartLines').innerHTML = cart.lines.length ? cart.lines.map(l => `
    <div class="line"><div class="line-info" data-edit="${l.key}"><div class="line-name">${esc(l.name)}</div><div class="line-sub num">${eur(l.price)} / Stk</div></div>
    <div class="qty"><button data-dec="${l.key}">−</button><span class="num">${l.qty}</span><button data-inc="${l.key}">+</button></div>
    <div class="line-total num">${eur(l.price * l.qty)}</div></div>`).join('')
    : `<div class="cart-empty"><div>🛒</div>Tippe auf ein Produkt,<br>um es hinzuzufügen.</div>`;
  $('#cartCount').textContent = c.count ? `· ${c.count} Artikel` : '';
  $('#cartSub').textContent = eur(c.sub);
  $('#cartDiscRow').classList.toggle('hidden', !c.disc);
  $('#cartDisc').textContent = (cart.discount && cart.discount.type === 'pct' ? cart.discount.val + ' % · ' : '') + eur(-c.disc);
  $('#cartTotal').textContent = eur(c.total);
  $('#payBtn').disabled = !cart.lines.length;
  $('#payBtn').textContent = cart.lines.length ? `Bezahlen · ${eur(c.total)}` : 'Bezahlen';
  $('#cbCount').textContent = c.count; $('#cbTotal').textContent = eur(c.total);
  $('#cartBar').classList.toggle('hidden', !cart.lines.length || ui.view !== 'verkauf');
  $$('#cartLines [data-inc]').forEach(b => b.onclick = () => {
    const l = cart.lines.find(x => x.key === b.dataset.inc); const p = l.pid && prodById(l.pid);
    if (p && p.trackStock && !K.settings.allowNegative && p.stock - inCart(p.id) <= 0) return toast('Kein weiterer Bestand', true);
    l.qty++; haptic(); renderPOS();
  });
  $$('#cartLines [data-dec]').forEach(b => b.onclick = () => {
    const l = cart.lines.find(x => x.key === b.dataset.dec); l.qty--;
    if (l.qty <= 0) cart.lines = cart.lines.filter(x => x !== l);
    if (!cart.lines.length) cart.discount = null;
    renderPOS();
  });
  $$('#cartLines [data-edit]').forEach(b => b.onclick = () => editLine(b.dataset.edit));
}
export function openCart() { $('#cart').classList.add('open'); $('#overlay').classList.add('show'); }
export function closeCart() { const c = $('#cart'); if (!c) return; c.classList.remove('open'); if (!$('#modal').classList.contains('show')) $('#overlay').classList.remove('show'); }
export const cartOpen = () => !!document.querySelector('#cart.open');

function editLine(key) {
  const l = cart.lines.find(x => x.key === key); if (!l) return;
  openModal('Position bearbeiten', `
    <div class="field"><label>Bezeichnung</label><input class="input" id="elName" value="${esc(l.name)}"></div>
    <div class="row"><div class="field"><label>Einzelpreis (€)</label><input class="input" id="elPrice" inputmode="decimal" value="${moneyIn(l.price)}"></div>
    <div class="field"><label>Menge</label><input class="input" id="elQty" type="number" min="1" inputmode="numeric" value="${l.qty}"></div></div>`,
    `<button class="btn btn-danger" id="elDel">Entfernen</button><button class="btn btn-primary" id="elOk">Übernehmen</button>`);
  $('#elDel').onclick = () => { cart.lines = cart.lines.filter(x => x !== l); if (!cart.lines.length) cart.discount = null; closeModal(); renderPOS(); };
  $('#elOk').onclick = () => {
    const pr = parseMoney($('#elPrice').value), q = parseInt($('#elQty').value, 10);
    if (isNaN(pr) || pr < 0) return toast('Ungültiger Preis', true);
    if (!(q > 0)) return toast('Ungültige Menge', true);
    const p = l.pid && prodById(l.pid);
    if (p && p.trackStock && !K.settings.allowNegative && q - l.qty > p.stock - inCart(p.id)) return toast(`Nur noch ${p.stock - inCart(p.id) + l.qty} auf Lager`, true);
    l.name = $('#elName').value.trim() || l.name; l.price = pr; l.qty = q; closeModal(); renderPOS();
  };
}
function customItem() {
  openModal('Freier Betrag', `
    <div class="field"><label>Betrag (€)</label><input class="input" id="ciPrice" inputmode="decimal" placeholder="0,00" style="font-size:1.4rem;font-weight:700"></div>
    <div class="field"><label>Bezeichnung</label><input class="input" id="ciName" placeholder="z. B. Sonderanfertigung"></div>`,
    `<button class="btn btn-primary" id="ciOk">In den Warenkorb</button>`);
  setTimeout(() => $('#ciPrice').focus(), 250);
  $('#ciOk').onclick = () => {
    const pr = parseMoney($('#ciPrice').value);
    if (isNaN(pr) || pr <= 0) return toast('Bitte Betrag eingeben', true);
    cart.lines.push({key: uid(), pid: null, name: $('#ciName').value.trim() || 'Freier Artikel', price: pr, qty: 1});
    closeModal(); haptic(); renderPOS();
  };
}
function discountDialog() {
  if (!cart.lines.length) return toast('Warenkorb ist leer', true);
  const d = cart.discount || {type: 'pct', val: 0};
  openModal('Rabatt', `
    <div class="segment" id="dType"><button data-t="pct" class="${d.type === 'pct' ? 'active' : ''}">Prozent (%)</button><button data-t="abs" class="${d.type === 'abs' ? 'active' : ''}">Betrag (€)</button></div>
    <div class="field"><label id="dLbl">Rabatt</label><input class="input" id="dVal" inputmode="decimal" value="${d.val ? (d.type === 'pct' ? d.val : moneyIn(d.val)) : ''}" placeholder="0" style="font-size:1.3rem;font-weight:700"></div>
    <div class="quick" id="dQuick"><button data-p="5">5 %</button><button data-p="10">10 %</button><button data-p="15">15 %</button><button data-p="20">20 %</button></div>`,
    `<button class="btn btn-danger" id="dDel">Kein Rabatt</button><button class="btn btn-primary" id="dOk">Übernehmen</button>`);
  let type = d.type;
  $$('#dType button').forEach(b => b.onclick = () => { type = b.dataset.t; $$('#dType button').forEach(x => x.classList.toggle('active', x === b)); $('#dVal').value = ''; });
  $$('#dQuick button').forEach(b => b.onclick = () => { type = 'pct'; $$('#dType button').forEach(x => x.classList.toggle('active', x.dataset.t === 'pct')); $('#dVal').value = b.dataset.p; });
  $('#dDel').onclick = () => { cart.discount = null; closeModal(); renderPOS(); };
  $('#dOk').onclick = () => {
    if (type === 'pct') { const v = parseFloat(String($('#dVal').value).replace(',', '.')); if (!(v > 0 && v <= 100)) return toast('0–100 %', true); cart.discount = {type, val: Math.round(v * 100) / 100}; }
    else { const v = parseMoney($('#dVal').value); if (!(v > 0)) return toast('Ungültiger Betrag', true); cart.discount = {type, val: v}; }
    closeModal(); renderPOS();
  };
}

/* ─── BEZAHLEN ─── */
function payDialog() {
  const c = cartCalc(); if (!cart.lines.length) return;
  let method = 'bar';
  const quicks = [...new Set([c.total, Math.ceil(c.total / 500) * 500, Math.ceil(c.total / 1000) * 1000, Math.ceil(c.total / 2000) * 2000, Math.ceil(c.total / 5000) * 5000, 10000])].filter(v => v >= c.total).slice(0, 4);
  openModal('Bezahlen', `
    <div class="pay-total"><small>Zu zahlen</small><b class="num">${eur(c.total)}</b></div>
    <div class="pay-methods" id="pm"><button class="pay-m active" data-m="bar"><i>💶</i>Bar</button><button class="pay-m" data-m="karte"><i>💳</i>Karte</button><button class="pay-m" data-m="sonst"><i>📲</i>Sonstiges</button></div>
    <div id="barBox">
      <div class="field"><label>Gegeben (€)</label><input class="input num" id="given" inputmode="decimal" placeholder="${moneyIn(c.total)}" style="font-size:1.4rem;font-weight:700"></div>
      <div class="quick">${quicks.map((v, i) => `<button data-g="${v}">${i === 0 ? 'Passend' : eur(v).replace(',00', '')}</button>`).join('')}</div>
      <div class="change" id="changeBox"><span>Rückgeld</span><b class="num" id="changeVal">0,00 €</b></div>
    </div>
    <div id="sonstBox" class="hidden"><div class="field"><label>Zahlart / Notiz</label><input class="input" id="payNote" placeholder="z. B. PayPal, Überweisung"></div></div>`,
    `<button class="btn btn-grad btn-xl" id="payOk">✓ Verkauf abschließen</button>`);
  const upd = () => {
    const g = parseMoney($('#given').value); const ch = (isNaN(g) ? c.total : g) - c.total;
    $('#changeVal').textContent = eur(Math.max(0, ch)); $('#changeBox').classList.toggle('neg', ch < 0);
    $('#changeBox').firstElementChild.textContent = ch < 0 ? 'Es fehlen' : 'Rückgeld'; if (ch < 0) $('#changeVal').textContent = eur(-ch);
  };
  $('#given').oninput = upd;
  $$('.quick [data-g]').forEach(b => b.onclick = () => { $('#given').value = moneyIn(+b.dataset.g); upd(); });
  $$('#pm .pay-m').forEach(b => b.onclick = () => {
    method = b.dataset.m; $$('#pm .pay-m').forEach(x => x.classList.toggle('active', x === b));
    $('#barBox').classList.toggle('hidden', method !== 'bar'); $('#sonstBox').classList.toggle('hidden', method !== 'sonst');
  });
  $('#payOk').onclick = () => {
    let given = null, change = null;
    if (method === 'bar') {
      const g = parseMoney($('#given').value); given = isNaN(g) ? c.total : g;
      if (given < c.total) return toast('Gegebener Betrag reicht nicht', true);
      change = given - c.total;
    }
    finishSale(method, given, change, method === 'sonst' ? $('#payNote').value.trim() : '');
  };
}
function finishSale(method, given, change, note) {
  const c = cartCalc();
  // fortlaufend über alle Geräte: höchste bekannte Nummer + 1
  K.settings.receiptNo = Math.max(K.settings.receiptNo || 0, ...bons().map(b => b.no || 0)) + 1; saveSettings();
  const sale = {
    id: uid(), art: 'bon', kanal: 'vor-ort', no: K.settings.receiptNo, ts: Date.now(), pay: method, payNote: note || '',
    items: cart.lines.map(l => { const p = l.pid && prodById(l.pid); return {pid: l.pid, name: l.name, qty: l.qty, price: l.price, cost: p ? (p.cost || 0) : 0, catId: p ? p.catId : null, tax: p ? (p.tax ?? K.settings.taxDefault) : K.settings.taxDefault}; }),
    sub: c.sub, disc: c.disc, discount: cart.discount, total: c.total, given, change, klein: !!K.settings.klein, storno: false
  };
  sale.items.forEach(it => { const p = it.pid && prodById(it.pid); if (p && p.trackStock) { p.stock -= it.qty; put('produkt', p); addMove(p.id, -it.qty, 'sale', 'Bon #' + sale.no, sale.id); } });
  put('beleg', sale); flush();
  clearCart(); closeCart();
  haptic();
  openModal('Verkauf abgeschlossen', `
    <div class="success"><div class="ok-ring">✓</div><div style="font-weight:800;font-size:1.2rem">${eur(sale.total)}</div><div class="muted" style="font-size:.85rem">Bon #${sale.no} · ${payLabel(sale)}</div>
    ${sale.pay === 'bar' && sale.change ? `<div class="change" style="margin-top:14px"><span>Rückgeld</span><b class="num">${eur(sale.change)}</b></div>` : ''}</div>`,
    `<button class="btn" id="sRc">🧾 Bon</button><button class="btn btn-primary" id="sNew">Neuer Verkauf</button>`);
  $('#sRc').onclick = () => showReceipt(sale.id);
  $('#sNew').onclick = closeModal;
  render();
}

/* ─── BON ─── */
function receiptText(s) {
  const st = K.settings, W = 32, line = '-'.repeat(W);
  const rr = (a, b) => { a = String(a); b = String(b); const sp = W - a.length - b.length; return sp >= 1 ? a + ' '.repeat(sp) + b : a + '\n' + ' '.repeat(Math.max(0, W - b.length)) + b; };
  let t = (st.shopName || 'KONTORWERK') + '\n' + (st.address ? st.address + '\n' : '') + line + '\n';
  t += 'Bon #' + s.no + '   ' + fmtDT(s.ts) + '\n' + line + '\n';
  s.items.forEach(i => { t += (i.qty > 1 ? i.qty + ' x ' : '') + i.name + '\n' + rr(i.qty > 1 ? '  à ' + eurPlain(i.price) : '', eurPlain(i.price * i.qty)) + '\n'; });
  t += line + '\n';
  if (s.disc) t += rr('Zwischensumme', eurPlain(s.sub)) + '\n' + rr('Rabatt', '-' + eurPlain(s.disc)) + '\n';
  t += rr('SUMME EUR', eurPlain(s.total)) + '\n';
  t += rr(s.pay === 'bar' ? 'Bar' : s.pay === 'karte' ? 'Karte' : (s.payNote || 'Sonstiges'), eurPlain(s.pay === 'bar' ? s.given : s.total)) + '\n';
  if (s.pay === 'bar') t += rr('Rückgeld', eurPlain(s.change || 0)) + '\n';
  t += line + '\n' + taxLines(s).map(x => x.txt).join('\n') + '\n';
  if (st.footer) t += '\n' + st.footer + '\n';
  if (s.storno) t = '*** STORNIERT ***\n' + t;
  return t;
}
function taxLines(s) {
  if (s.klein) return [{txt: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}];
  const f = s.sub ? s.total / s.sub : 1, by = {};
  s.items.forEach(i => { const g = Math.round(i.price * i.qty * f); by[i.tax] = (by[i.tax] || 0) + g; });
  return Object.keys(by).sort((a, b) => b - a).map(r => { const gross = by[r]; const tax = Math.round(gross - gross / (1 + r / 100)); return {txt: `enth. ${r} % MwSt: ${eurPlain(tax)} € (Netto ${eurPlain(gross - tax)} €)`}; });
}
export function showReceipt(id) {
  const s = bons().find(x => x.id === id); if (!s) return;
  const st = K.settings;
  const body = `<div class="receipt">
    ${s.storno ? `<div class="rc"><span class="storno-stamp">STORNIERT</span></div>` : ''}
    <div class="rc big">${esc(st.shopName || 'KONTORWERK')}</div>${st.address ? `<div class="rc" style="white-space:pre-line">${esc(st.address)}</div>` : ''}
    <hr><div class="rr"><span>Bon #${s.no}</span><span>${fmtDT(s.ts)}</span></div><hr>
    ${s.items.map(i => `<div class="rr"><span>${i.qty > 1 ? i.qty + ' × ' : ''}${esc(i.name)}</span><span>${eurPlain(i.price * i.qty)}</span></div>${i.qty > 1 ? `<div class="muted" style="font-size:.72rem">&nbsp;&nbsp;à ${eurPlain(i.price)}</div>` : ''}`).join('')}
    <hr>${s.disc ? `<div class="rr"><span>Zwischensumme</span><span>${eurPlain(s.sub)}</span></div><div class="rr"><span>Rabatt${s.discount && s.discount.type === 'pct' ? ' ' + s.discount.val + ' %' : ''}</span><span>−${eurPlain(s.disc)}</span></div>` : ''}
    <div class="rr big"><span>SUMME</span><span>${eur(s.total)}</span></div>
    <div class="rr"><span>${esc(payLabel(s).replace(/^\S+ /, ''))}</span><span>${eurPlain(s.pay === 'bar' ? s.given : s.total)}</span></div>
    ${s.pay === 'bar' ? `<div class="rr"><span>Rückgeld</span><span>${eurPlain(s.change || 0)}</span></div>` : ''}
    <hr>${taxLines(s).map(x => `<div style="font-size:.72rem">${esc(x.txt)}</div>`).join('')}
    ${st.footer ? `<div class="rc" style="margin-top:8px">${esc(st.footer)}</div>` : ''}
    ${s.storno ? `<div class="rc" style="margin-top:6px;color:var(--danger);font-size:.72rem">Storniert am ${fmtDT(s.stornoTs)}</div>` : ''}</div>`;
  openModal('Bon #' + s.no, body,
    `${!s.storno ? `<button class="btn btn-danger" id="rcStorno">↩ Storno</button>` : ''}<button class="btn" id="rcShare">📤 Teilen</button>${!IS_NATIVE ? `<button class="btn" id="rcPrint">🖨 Drucken</button>` : ''}`);
  $('#rcShare').onclick = () => shareText('Bon #' + s.no, receiptText(s));
  if ($('#rcPrint')) $('#rcPrint').onclick = () => { $('#printArea').innerHTML = `<pre style="white-space:pre-wrap">${esc(receiptText(s))}</pre>`; window.print(); };
  if ($('#rcStorno')) $('#rcStorno').onclick = async () => {
    if (!await confirmBox('Verkauf stornieren?', `Bon #${s.no} über ${eur(s.total)} wird storniert. Die Ware wird wieder ins Lager gebucht.`, 'Stornieren', true)) return;
    s.storno = true; s.stornoTs = Date.now(); put('beleg', s);
    s.items.forEach(it => { const p = it.pid && prodById(it.pid); if (p && p.trackStock) { p.stock += it.qty; put('produkt', p); addMove(p.id, it.qty, 'storno', 'Storno Bon #' + s.no, s.id); } });
    toast('Bon #' + s.no + ' storniert'); render();
  };
}

export function initVerkauf() {
  $('#posSearch').addEventListener('input', e => { pos.q = e.target.value; renderPOS(); });
  $('#posSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLowerCase(); if (!q) return;
    // Barcode-Scanner / Artikelnummer: exakter Treffer → direkt in den Warenkorb
    let p = T.produkt.find(x => x.active && (x.sku || '').toLowerCase() === q);
    if (!p) { const m = T.produkt.filter(x => x.active && (x.name + ' ' + (x.sku || '')).toLowerCase().includes(q)); if (m.length === 1) p = m[0]; }
    if (p) { addToCart(p.id); e.target.value = ''; pos.q = ''; renderPOS(); }
    else toast('Kein eindeutiger Treffer', true);
  });
  $('#cartBar').onclick = openCart;
  $('#cartClose').onclick = closeCart;
  $('#cartClear').onclick = async () => { if (!cart.lines.length) return; if (await confirmBox('Warenkorb leeren?', 'Alle Positionen werden entfernt.', 'Leeren', true)) { clearCart(); closeCart(); renderPOS(); } };
  $('#customBtn').onclick = customItem;
  $('#discBtn').onclick = discountDialog;
  $('#payBtn').onclick = payDialog;
}
