/* ═══════════════ ETSY-ARTIKEL: Angebote mit Produkten verknüpfen, Bestand vergleichen ═══════════════ */
import {$, $$, esc, eur, uid} from '../../core/util.js';
import {T, K, put, flush} from '../../core/db.js';
import {toast, confirmBox} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {prodById, addMove, sortedCats} from '../wawi/shared.js';
import {shops, shopName, istDigital, artikelKey, bucheBestand} from './shared.js';
import {shopChips, keinShop} from './bestellungen.js';

export const html = `
    <div class="card" style="margin-bottom:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" data-etsy-import>📥 Angebote einlesen</button>
      <span class="muted" style="font-size:.78rem;flex:1;min-width:200px">Verknüpfe jedes Etsy-Angebot einmal mit deinem Produkt. Danach wird der Bestand bei jeder Bestellung abgebucht, und du siehst, wo Etsy und dein Lager auseinanderlaufen.</span></div></div>
    <div class="chips" id="eaShops"></div>
    <div class="chips" id="eaFilter"></div>
    <div id="eaList"></div>`;

const st = {shop: '', filter: 'alle'};
const abweichend = a => { const p = a.produktId && prodById(a.produktId); return !!(p && p.trackStock && a.etsyMenge != null && a.imAngebot && p.stock !== a.etsyMenge); };

export function renderArtikel() {
  if (!shops().length) { $('#eaShops').innerHTML = ''; $('#eaFilter').innerHTML = ''; return keinShop('#eaList'); }
  shopChips('#eaShops', st.shop, id => { st.shop = id; renderArtikel(); });
  const mine = T.shopartikel.filter(a => (!st.shop || a.shopId === st.shop));
  const offen = mine.filter(a => !a.produktId), diff = mine.filter(abweichend);
  $('#eaFilter').innerHTML = [['alle', `Alle (${mine.length})`], ['offen', `Nicht verknüpft (${offen.length})`], ['diff', `Bestand abweichend (${diff.length})`]].map(([k, l]) => `<button class="chip ${st.filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('');
  $$('#eaFilter .chip').forEach(b => b.onclick = () => { st.filter = b.dataset.f; renderArtikel(); });
  if (!T.shopartikel.length) { $('#eaList').innerHTML = `<div class="card empty"><div>🏷️</div><p>Noch keine Etsy-Angebote bekannt. Sie kommen mit den Dateien „Angebote“ oder „Bestellte Artikel“.</p></div>`; return; }
  const list = (st.filter === 'offen' ? offen : st.filter === 'diff' ? diff : mine).sort((a, b) => !!a.produktId - !!b.produktId || a.titel.localeCompare(b.titel, 'de'));
  const prods = [...T.produkt].filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const neuBtn = offen.filter(a => !istDigital(a.shopId)).length;
  $('#eaList').innerHTML = `${st.filter !== 'diff' && neuBtn ? `<button class="btn btn-sm" id="eaAll" style="margin-bottom:8px">✨ ${neuBtn} nicht verknüpfte als Produkte anlegen</button>` : ''}
    ${list.length ? `<div class="list">${list.map(a => {
      const p = a.produktId && prodById(a.produktId), d = abweichend(a);
      return `<div class="li" style="cursor:default;flex-wrap:wrap"><div class="li-thumb">${istDigital(a.shopId) ? '💾' : p ? '🔗' : '❔'}</div>
        <div class="li-main" style="min-width:180px"><div class="li-title" style="font-size:.88rem">${esc(a.titel)}</div>
        <div class="li-sub">${shops().length > 1 ? esc(shopName(a.shopId)) + ' · ' : ''}${a.sku ? 'Nr. ' + esc(a.sku) + ' · ' : ''}${a.preis != null ? eur(a.preis) + ' · ' : ''}${a.etsyMenge != null ? `Etsy: ${a.etsyMenge} Stk` : 'Etsy-Bestand unbekannt'}${p && p.trackStock ? ` · Lager: <b style="${d ? 'color:var(--danger)' : ''}">${p.stock} Stk</b>` : ''}${d ? ' · ⚠️ in Etsy anpassen' : ''}</div></div>
        <div style="display:flex;gap:6px;align-items:center"><select class="input" data-a="${a.id}" style="max-width:220px;font-size:.8rem"><option value="">— nicht verknüpft —</option>${prods.map(x => `<option value="${x.id}" ${x.id === a.produktId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${p ? '' : `<button class="btn btn-sm" data-neu="${a.id}" title="Als neues Produkt anlegen">＋</button>`}</div></div>`;
    }).join('')}</div>` : `<div class="card empty"><div>✅</div><p>Nichts zu tun.</p></div>`}`;
  $$('#eaList [data-a]').forEach(s => s.onchange = () => { const a = T.shopartikel.find(x => x.id === s.dataset.a); verknuepfeArtikel(a, s.value); flush(); toast(s.value ? 'Verknüpft' : 'Verknüpfung gelöst'); render(); });
  $$('#eaList [data-neu]').forEach(b => b.onclick = () => { anlegen(T.shopartikel.find(x => x.id === b.dataset.neu)); flush(); toast('Produkt angelegt'); render(); });
  if ($('#eaAll')) $('#eaAll').onclick = async () => {
    const l = offen.filter(a => !istDigital(a.shopId));
    if (!await confirmBox(`${l.length} Produkte anlegen?`, 'Name, Preis, Artikelnummer und Etsy-Bestand werden übernommen. Gleichnamige Produkte werden stattdessen verknüpft.', 'Anlegen')) return;
    l.forEach(anlegen); flush(); toast(`${l.length} Produkte angelegt`); render();
  };
}

/** Angebot verknüpfen; offene Positionen in Bestellungen bekommen die Verknüpfung mit (ohne bereits abgebuchte zu ändern) */
export function verknuepfeArtikel(a, produktId) {
  a.produktId = produktId || null; put('shopartikel', a);
  T.bestellung.filter(o => o.shopId === a.shopId).forEach(o => {
    let ch = false;
    o.positionen.forEach(p => { if (!p.gebucht && artikelKey(p.sku, p.titel) === a.key && p.produktId !== a.produktId) { p.produktId = a.produktId; ch = true; } });
    if (ch) { put('bestellung', o); bucheBestand(o); }
  });
}

function anlegen(a) {
  const same = T.produkt.find(p => p.name.trim().toLowerCase() === a.titel.trim().toLowerCase());
  if (same) return verknuepfeArtikel(a, same.id);
  const digital = istDigital(a.shopId), stock = digital ? 0 : a.etsyMenge || 0;
  const p = put('produkt', {id: uid(), created: Date.now(), name: a.titel.slice(0, 120), price: a.preis || 0, cost: null, catId: (sortedCats()[0] || {}).id || null, minStock: K.settings.minDefault, unit: 'Stk', sku: a.sku || '', emoji: digital ? '💾' : '', color: '', photos: [], img: '', imgFull: '', tax: K.settings.taxDefault, trackStock: !digital, active: true, stock});
  if (stock && p.trackStock) addMove(p.id, stock, 'init', 'Anfangsbestand aus Etsy');
  verknuepfeArtikel(a, p.id);
}
