/* ═══════════════ PRODUKTE & KATEGORIEN ═══════════════ */
import {$, $$, esc, eur, parseMoney, moneyIn, uid, soft, COLORS} from '../../core/util.js';
import {T, K, put, remove} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {openLightbox} from '../../core/lightbox.js';
import {render} from '../../core/shell.js';
import {catById, prodById, sortedCats, addMove, photosOf, thumb, stockBadge} from './shared.js';
import {posCat, dropFromCart} from './verkauf.js';

export const html = `
    <div class="segment" id="prodSeg"><button data-seg="p" class="active">📦 Produkte</button><button data-seg="c">🏷️ Kategorien</button></div>
    <div id="prodPane">
      <div class="search" style="margin-bottom:10px"><input class="input" id="prodSearch" placeholder="Produkte durchsuchen…"></div>
      <div id="prodList"></div>
    </div>
    <div id="catPane" class="hidden"><div id="catList"></div></div>
    <div class="pad-fab"></div>
    <button class="fab" id="prodFab">＋ Produkt</button>`;

const st = {seg: 'p', q: ''};

export function renderProducts() {
  $$('#prodSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === st.seg));
  $('#prodPane').classList.toggle('hidden', st.seg !== 'p'); $('#catPane').classList.toggle('hidden', st.seg !== 'c');
  $('#prodFab').textContent = st.seg === 'p' ? '＋ Produkt' : '＋ Kategorie';
  if (st.seg === 'p') {
    const q = st.q.trim().toLowerCase();
    const list = T.produkt.filter(p => !q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q));
    if (!T.produkt.length) { $('#prodList').innerHTML = `<div class="card empty"><div>📦</div><p>Noch keine Produkte.</p><button class="btn btn-primary" onclick="KW.editProduct()">＋ Produkt anlegen</button></div>`; return; }
    const groups = [...sortedCats().map(c => ({c, items: list.filter(p => p.catId === c.id)})), {c: null, items: list.filter(p => !catById(p.catId))}].filter(g => g.items.length);
    $('#prodList').innerHTML = groups.length ? `<div class="list">${groups.map(g => `<div class="group-h">${g.c ? `<span class="dot" style="width:8px;height:8px;border-radius:50%;background:${g.c.color}"></span>${esc(g.c.emoji || '')} ${esc(g.c.name)}` : 'Ohne Kategorie'} <span style="margin-left:auto">${g.items.length}</span></div>` +
      g.items.sort((a, b) => a.name.localeCompare(b.name, 'de')).map(p => `<button class="li" data-id="${p.id}" style="${p.active ? '' : 'opacity:.5'}">${thumb(p)}
        <div class="li-main"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${p.sku ? 'Nr. ' + esc(p.sku) + ' · ' : ''}${p.cost ? 'EK ' + eur(p.cost) + ' · ' : ''}${p.active ? '' : 'inaktiv'}</div></div>
        <div class="li-end"><b class="num">${eur(p.price)}</b>${stockBadge(p)}</div></button>`).join('')).join('')}</div>`
      : `<div class="card empty"><div>🔍</div><p>Keine Treffer.</p></div>`;
    $$('#prodList .li').forEach(b => b.onclick = e => { const z = e.target.closest('[data-zoom]'); if (z) { const p = prodById(z.dataset.zoom); return openLightbox(photosOf(p).map(x => x.f || x.t), p.name); } editProduct(b.dataset.id); });
  } else {
    const cats = sortedCats();
    $('#catList').innerHTML = cats.length ? `<div class="list">${cats.map((c, i) => `<div class="li" style="cursor:default">
      <div class="li-thumb" style="background:${soft(c.color)}">${esc(c.emoji || '🏷️')}</div>
      <div class="li-main"><div class="li-title">${esc(c.name)}</div><div class="li-sub">${T.produkt.filter(p => p.catId === c.id).length} Produkte</div></div>
      <div style="display:flex;gap:4px"><button class="btn btn-sm" data-up="${c.id}" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>▲</button><button class="btn btn-sm" data-down="${c.id}" ${i === cats.length - 1 ? 'disabled style="opacity:.3"' : ''}>▼</button><button class="btn btn-sm btn-soft" data-ed="${c.id}">Bearbeiten</button></div></div>`).join('')}</div>`
      : `<div class="card empty"><div>🏷️</div><p>Noch keine Kategorien – z. B. „Lampen“, „Kerzen“, „Schmuck“.</p><button class="btn btn-primary" onclick="KW.editCategory()">＋ Kategorie anlegen</button></div>`;
    $$('#catList [data-ed]').forEach(b => b.onclick = () => editCategory(b.dataset.ed));
    const move = (id, d) => { const cs = sortedCats(); const i = cs.findIndex(c => c.id === id); const j = i + d; if (j < 0 || j >= cs.length) return; [cs[i], cs[j]] = [cs[j], cs[i]]; cs.forEach((c, k) => { if (c.sort !== k) { c.sort = k; put('kategorie', c); } }); renderProducts(); };
    $$('#catList [data-up]').forEach(b => b.onclick = () => move(b.dataset.up, -1));
    $$('#catList [data-down]').forEach(b => b.onclick = () => move(b.dataset.down, 1));
  }
}
function colorPicker(sel, auto) { return `<div class="swatches" id="swatches">${auto ? `<div class="swatch auto ${!sel ? 'active' : ''}" data-c="" title="Automatisch (Kategoriefarbe)"></div>` : ''}${COLORS.map(c => `<div class="swatch ${c === sel ? 'active' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div>`; }
function bindSwatches(cb) { $$('#swatches .swatch').forEach(s => s.onclick = () => { $$('#swatches .swatch').forEach(x => x.classList.toggle('active', x === s)); cb(s.dataset.c); }); }

export function editCategory(id) {
  const c = id ? catById(id) : {name: '', emoji: '🏷️', color: COLORS[T.kategorie.length % COLORS.length]};
  let color = c.color;
  openModal(id ? 'Kategorie bearbeiten' : 'Neue Kategorie', `
    <div class="row"><div class="field" style="flex:0 0 80px"><label>Symbol</label><input class="input" id="cEmoji" value="${esc(c.emoji)}" maxlength="4" style="text-align:center;font-size:1.3rem"></div>
    <div class="field"><label>Name</label><input class="input" id="cName" value="${esc(c.name)}" placeholder="z. B. Holzlampen"></div></div>
    <div class="field"><label>Farbe</label>${colorPicker(color)}</div>`,
    `${id ? `<button class="btn btn-danger" id="cDel">Löschen</button>` : ''}<button class="btn btn-primary" id="cOk">Speichern</button>`);
  bindSwatches(v => color = v);
  if (!id) setTimeout(() => $('#cName').focus(), 250);
  $('#cOk').onclick = () => {
    const name = $('#cName').value.trim(); if (!name) return toast('Bitte Namen eingeben', true);
    if (id) { Object.assign(c, {name, emoji: $('#cEmoji').value.trim(), color}); put('kategorie', c); }
    else put('kategorie', {id: uid(), name, emoji: $('#cEmoji').value.trim(), color, sort: T.kategorie.length});
    closeModal(); render();
  };
  if ($('#cDel')) $('#cDel').onclick = async () => {
    const n = T.produkt.filter(p => p.catId === id).length;
    if (!await confirmBox('Kategorie löschen?', `„${esc(c.name)}“ wird gelöscht.${n ? ` ${n} Produkt(e) landen in „Ohne Kategorie“.` : ''}`, 'Löschen', true)) return;
    remove('kategorie', id); T.produkt.filter(p => p.catId === id).forEach(p => { p.catId = null; put('produkt', p); });
    render();
  };
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
/** Vorschaubild: quadratisch zugeschnitten */
async function resizeImage(file, max = 360) {
  const img = await loadImage(file); const cv = document.createElement('canvas');
  const side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2, out = Math.min(max, side);
  cv.width = cv.height = out; cv.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, out, out);
  return cv.toDataURL('image/jpeg', .82);
}
/** Großansicht: ohne Zuschnitt */
async function resizeFull(file, max = 1600) {
  const img = await loadImage(file); const s = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', .85);
}

export function editProduct(id) {
  const isNew = !id;
  const p = id ? prodById(id) : {name: '', catId: posCat() !== 'all' ? posCat() : (sortedCats()[0] || {}).id || null, price: null, cost: null, stock: 0, minStock: K.settings.minDefault, sku: '', emoji: '', color: '', img: '', unit: 'Stk', active: true, trackStock: true, tax: K.settings.taxDefault};
  if (!p) return;
  let photos = photosOf(p).map(x => ({...x})), color = p.color || '';
  const MAX_PHOTOS = 8;
  const cats = sortedCats();
  openModal(isNew ? 'Neues Produkt' : 'Produkt bearbeiten', `
    <div class="img-pick" style="margin-bottom:10px"><div class="img-prev" id="pImgPrev"></div>
      <div style="flex:1"><div class="field" style="margin:0"><label>Emoji (ohne Foto)</label><input class="input" id="pEmoji" value="${esc(p.emoji)}" placeholder="z. B. 💡" maxlength="4" style="width:96px;text-align:center;padding:8px"></div></div></div>
    <div class="field"><label>Fotos <span id="pPhCount" style="text-transform:none;letter-spacing:0;font-weight:500"></span></label><div class="photos" id="pPhotos"></div>
      <small class="muted" style="font-size:.72rem">Erstes Foto = Titelbild (Kachel & Liste) · ★ macht ein Foto zum Titelbild</small></div>
    <div class="field"><label>Name *</label><input class="input" id="pName" value="${esc(p.name)}" placeholder="z. B. Tischlampe Eiche"></div>
    <div class="field"><label>Kategorie</label><select class="input" id="pCat"><option value="">— Ohne Kategorie —</option>${cats.map(c => `<option value="${c.id}" ${c.id === p.catId ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.name)}</option>`).join('')}<option value="__new">＋ Neue Kategorie…</option></select></div>
    <div class="row"><div class="field"><label>Verkaufspreis € *</label><input class="input" id="pPrice" inputmode="decimal" value="${moneyIn(p.price)}" placeholder="0,00"></div>
    <div class="field"><label>Einkauf / Material €</label><input class="input" id="pCost" inputmode="decimal" value="${moneyIn(p.cost)}" placeholder="optional"></div></div>
    <div class="row"><div class="field"><label>${isNew ? 'Anfangsbestand' : 'Bestand'}</label><input class="input" id="pStock" type="number" inputmode="numeric" value="${p.stock}"></div>
    <div class="field"><label>Mindestbestand</label><input class="input" id="pMin" type="number" min="0" inputmode="numeric" value="${p.minStock ?? K.settings.minDefault}"></div>
    <div class="field" style="flex:0 0 84px"><label>Einheit</label><select class="input" id="pUnit">${['Stk', 'Set', 'Paar', 'g', 'kg', 'm', 'l'].map(u => `<option ${u === (p.unit || 'Stk') ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field"><label>Artikelnr. / Barcode</label><input class="input" id="pSku" value="${esc(p.sku)}" placeholder="optional"></div>
    <div class="field ${K.settings.klein ? 'hidden' : ''}" style="flex:0 0 100px"><label>MwSt</label><select class="input" id="pTax">${[19, 7, 0].map(r => `<option value="${r}" ${r === (p.tax ?? K.settings.taxDefault) ? 'selected' : ''}>${r} %</option>`).join('')}</select></div></div>
    <div class="field"><label>Kachelfarbe</label>${colorPicker(color, true)}</div>
    <div class="switch"><div><b>Bestand führen</b><small>Aus = unbegrenzt (z. B. Gutscheine, Dienstleistung)</small></div><label class="toggle"><input type="checkbox" id="pTrack" ${p.trackStock ? 'checked' : ''}><span></span></label></div>
    <div class="switch"><div><b>Aktiv im Verkauf</b><small>Inaktive Produkte werden im Verkauf ausgeblendet</small></div><label class="toggle"><input type="checkbox" id="pActive" ${p.active ? 'checked' : ''}><span></span></label></div>
    ${!isNew && p.cost && p.price ? `<div class="info-box" style="margin-top:10px">Marge: <b>${eur(p.price - p.cost)}</b> (${Math.round((p.price - p.cost) / p.price * 100)} %)</div>` : ''}`,
    `${!isNew ? `<button class="btn btn-danger" id="pDel">Löschen</button><button class="btn" id="pDup">Duplizieren</button>` : ''}<button class="btn btn-primary" id="pOk">Speichern</button>`);
  const lbTitle = () => $('#pName').value.trim() || p.name;
  const prev = () => { const c = catById($('#pCat').value); const img = photos[0] && photos[0].t; $('#pImgPrev').style.background = soft(color || (c && c.color) || '#009EB2'); $('#pImgPrev').innerHTML = img ? `<img src="${img}" alt="">` : esc($('#pEmoji').value || (c && c.emoji) || '📦'); $('#pImgPrev').classList.toggle('zoomable', !!img); };
  const renderPhotos = () => {
    $('#pPhCount').textContent = `(${photos.length}/${MAX_PHOTOS})`;
    $('#pPhotos').innerHTML = photos.map((ph, k) => `<div class="ph ${k === 0 ? 'first' : ''}" data-k="${k}"><img src="${ph.t}" alt="">${k === 0 ? '<span class="ph-tag">Titel</span>' : `<button class="ph-star" data-star="${k}" title="Als Titelbild">★</button>`}<button class="ph-del" data-del="${k}" title="Entfernen">✕</button></div>`).join('')
      + (photos.length < MAX_PHOTOS ? `<label class="ph-add"><span>＋</span>Foto${photos.length ? 's' : ''}<input type="file" accept="image/*" multiple id="pImg" class="hidden"></label>` : '');
    $$('#pPhotos .ph').forEach(el => el.onclick = e => {
      const del = e.target.closest('[data-del]'), star = e.target.closest('[data-star]');
      if (del) { photos.splice(+del.dataset.del, 1); renderPhotos(); return prev(); }
      if (star) { const [x] = photos.splice(+star.dataset.star, 1); photos.unshift(x); renderPhotos(); return prev(); }
      openLightbox(photos.map(x => x.f || x.t), lbTitle(), +el.dataset.k);
    });
    if ($('#pImg')) $('#pImg').onchange = async e => {
      const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length); if (!files.length) return;
      if (e.target.files.length > files.length) toast(`Maximal ${MAX_PHOTOS} Fotos pro Produkt`, true);
      for (const f of files) { try { const [t, full] = await Promise.all([resizeImage(f), resizeFull(f)]); photos.push({t, f: full}); } catch (err) { toast('Ein Bild konnte nicht geladen werden', true); } }
      renderPhotos(); prev();
    };
  };
  $('#pImgPrev').onclick = () => { if (photos.length) openLightbox(photos.map(x => x.f || x.t), lbTitle(), 0); };
  renderPhotos();
  prev();
  bindSwatches(v => { color = v; prev(); });
  $('#pEmoji').oninput = prev;
  $('#pCat').onchange = () => {
    if ($('#pCat').value === '__new') {
      const n = prompt('Name der neuen Kategorie:');
      if (n && n.trim()) { const c = put('kategorie', {id: uid(), name: n.trim(), emoji: '🏷️', color: COLORS[T.kategorie.length % COLORS.length], sort: T.kategorie.length}); const o = new Option('🏷️ ' + c.name, c.id, true, true); $('#pCat').insertBefore(o, $('#pCat').lastElementChild); }
      else $('#pCat').value = p.catId || '';
    }
    prev();
  };
  if (isNew) setTimeout(() => $('#pName').focus(), 250);
  $('#pOk').onclick = () => {
    const name = $('#pName').value.trim(), price = parseMoney($('#pPrice').value), costRaw = $('#pCost').value.trim(), cost = costRaw ? parseMoney(costRaw) : 0;
    if (!name) return toast('Bitte Namen eingeben', true);
    if (isNaN(price) || price < 0) return toast('Bitte gültigen Preis eingeben', true);
    if (isNaN(cost) || cost < 0) return toast('Ungültiger Einkaufspreis', true);
    const stock = parseInt($('#pStock').value, 10) || 0, min = parseInt($('#pMin').value, 10);
    const data = {name, price, cost, catId: $('#pCat').value || null, minStock: isNaN(min) ? K.settings.minDefault : min, unit: $('#pUnit').value, sku: $('#pSku').value.trim(), emoji: $('#pEmoji').value.trim(), color, photos, img: photos[0] ? photos[0].t : '', imgFull: photos[0] ? photos[0].f : '', tax: +$('#pTax').value, trackStock: $('#pTrack').checked, active: $('#pActive').checked};
    if (data.sku && T.produkt.some(x => x.id !== id && x.sku && x.sku.toLowerCase() === data.sku.toLowerCase())) return toast('Artikelnummer ist schon vergeben', true);
    if (isNew) {
      const np = put('produkt', {id: uid(), created: Date.now(), stock, ...data});
      if (stock && np.trackStock) addMove(np.id, stock, 'init', 'Anfangsbestand');
    } else {
      if (stock !== p.stock && data.trackStock) addMove(p.id, stock - p.stock, 'inv', 'Bestand im Produkt geändert');
      Object.assign(p, data, {stock}); put('produkt', p);
    }
    closeModal(); toast(isNew ? 'Produkt angelegt' : 'Gespeichert'); render();
  };
  if (!isNew) {
    $('#pDel').onclick = async () => {
      if (!await confirmBox('Produkt löschen?', `„${esc(p.name)}“ wird gelöscht. Bisherige Verkäufe bleiben in den Berichten erhalten.`, 'Löschen', true)) return;
      remove('produkt', id); dropFromCart(id); render();
    };
    $('#pDup').onclick = () => {
      const {id: _i, erstellt: _e, geaendert: _g, geraet: _d, ...rest} = p;
      const np = put('produkt', {...rest, photos: photosOf(p).map(x => ({...x})), id: uid(), name: p.name + ' (Kopie)', sku: '', stock: 0, created: Date.now()});
      closeModal(); render(); setTimeout(() => editProduct(np.id), 260);
    };
  }
}

export function initProdukte() {
  $$('#prodSeg button').forEach(b => b.onclick = () => { st.seg = b.dataset.seg; renderProducts(); });
  $('#prodSearch').oninput = e => { st.q = e.target.value; renderProducts(); };
  $('#prodFab').onclick = () => st.seg === 'p' ? editProduct() : editCategory();
}
