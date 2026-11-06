/* ═══════════════ SHOPS anlegen/bearbeiten + Einstellungen ═══════════════ */
import {$, $$, esc} from '../../core/util.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {render} from '../../core/shell.js';
import {shops, shopById, saveShop, deleteShop, shopHatDaten} from './shared.js';

export function editShop(id, onSaved) {
  const s = id ? {...shopById(id)} : {name: '', plattform: 'etsy', art: 'physisch', bestand: true};
  openModal(id ? 'Shop bearbeiten' : 'Etsy-Shop anlegen', `
    <div class="field"><label>Name des Shops</label><input class="input" id="shName" value="${esc(s.name)}" placeholder="wie bei Etsy"></div>
    <div class="segment" id="shArt">${[['physisch', '🔨 Handgemacht / mit Lager'], ['digital', '💾 Digitale Produkte']].map(([k, l]) => `<button data-a="${k}" class="${s.art === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <label class="check" id="shBestF" style="display:flex;gap:8px;align-items:center;font-size:.88rem;margin-top:12px"><input type="checkbox" id="shBest" ${s.bestand !== false ? 'checked' : ''}> Bestand bei Bestellungen automatisch abbuchen</label>
    <p class="muted" style="font-size:.75rem;line-height:1.5;margin-top:10px">Digitale Bestellungen gelten sofort als erledigt und brauchen keinen Bestand.</p>`,
    `${id && !shopHatDaten(id) ? `<button class="btn btn-danger" id="shDel">Löschen</button>` : ''}<button class="btn btn-primary" id="shOk">Speichern</button>`);
  let art = s.art;
  const upd = () => $('#shBestF').classList.toggle('hidden', art === 'digital');
  $$('#shArt button').forEach(b => b.onclick = () => { art = b.dataset.a; $$('#shArt button').forEach(x => x.classList.toggle('active', x === b)); upd(); });
  upd();
  $('#shOk').onclick = () => {
    const name = $('#shName').value.trim(); if (!name) return toast('Bitte Namen eingeben', true);
    const saved = saveShop({...s, name, art, bestand: $('#shBest').checked});
    closeModal(); toast('Shop gespeichert'); if (onSaved) setTimeout(() => onSaved(saved), 230); else render();
  };
  if ($('#shDel')) $('#shDel').onclick = async () => {
    if (!await confirmBox('Shop löschen?', `„${s.name}“ wird entfernt.`, 'Löschen', true)) return;
    deleteShop(id); render();
  };
}

export const settingsHtml = `
  <div class="section-title">🛒 E-Commerce <span class="muted">Etsy-Shops</span></div>
  <div class="card"><div class="list" id="esShops"></div><button class="btn" id="esAdd" style="margin-top:10px">＋ Shop hinzufügen</button>
  <p class="muted" style="font-size:.75rem;line-height:1.5;margin-top:10px">Das Etsy-Guthaben hat in der Buchhaltung ein eigenes Geldkonto (SKR03-Vorschlag 1360). Auszahlungen auf die Bank sind Umbuchungen und zählen nicht doppelt.</p></div>`;
export function renderSettings() {
  $('#esShops').innerHTML = shops().length ? shops().map(s => `<button class="li" data-shop="${s.id}"><div class="li-thumb">${s.art === 'digital' ? '💾' : '🔨'}</div><div class="li-main"><div class="li-title">${esc(s.name)}</div><div class="li-sub">${s.art === 'digital' ? 'Digitale Produkte' : 'Handgemacht' + (s.bestand !== false ? ', Bestand wird abgebucht' : ', ohne Bestand')}</div></div></button>`).join('')
    : '<div class="muted" style="font-size:.85rem;padding:6px 0">Noch kein Shop angelegt.</div>';
  $$('#esShops [data-shop]').forEach(b => b.onclick = () => editShop(b.dataset.shop));
}
export function initSettings() { $('#esAdd').onclick = () => editShop(null); }
