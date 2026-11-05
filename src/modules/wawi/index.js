/* ═══════════════ MODUL: Warenwirtschaft & Verkauf (vorher WAWIWERK) ═══════════════ */
import {uid, eurPlain, dayKey, csv} from '../../core/util.js';
import {T, K, put} from '../../core/db.js';
import {toast, confirmBox} from '../../core/ui.js';
import {downloadFile} from '../../core/files.js';
import {go} from '../../core/shell.js';
import {registerModule} from '../../core/modules.js';
import * as V from './verkauf.js';
import * as PR from './produkte.js';
import * as L from './lager.js';
import * as B from './berichte.js';
import {catById, addMove, lowCount} from './shared.js';

export async function loadDemo() {
  if (T.produkt.length && !await confirmBox('Demo-Daten hinzufügen?', 'Beispiel-Kategorien und -Produkte werden zu deinen vorhandenen Daten hinzugefügt.', 'Hinzufügen')) return;
  const C = [['Holzlampen', '💡', '#a16207'], ['Kerzen', '🕯️', '#f59e0b'], ['Schmuck', '💍', '#ec4899'], ['Karten & Papier', '✉️', '#6366f1'], ['Gutscheine', '🎁', '#10b981']]
    .map(([name, emoji, color], i) => put('kategorie', {id: uid(), name, emoji, color, sort: T.kategorie.length + i}));
  const P_ = [[0, 'Tischlampe Eiche', 8900, 3200, 4, 'LMP-01'], [0, 'Nachttischlampe Nuss', 6900, 2500, 2, 'LMP-02'], [0, 'Wandleuchte Treibholz', 12900, 4100, 1, 'LMP-03'],
    [1, 'Bienenwachskerze klein', 690, 210, 24, 'KRZ-01'], [1, 'Duftkerze Lavendel', 1490, 450, 12, 'KRZ-02'], [1, 'Kerzen-Set 3er', 1890, 600, 0, 'KRZ-03'],
    [2, 'Ohrringe Holz rund', 1890, 380, 9, 'SCH-01'], [2, 'Armband geflochten', 1290, 220, 15, 'SCH-02'], [3, 'Grußkarte Linoldruck', 390, 80, 40, 'KRT-01'], [3, 'Notizbuch A6', 990, 310, 6, 'KRT-02']];
  P_.forEach(([ci, name, price, cost, stock, sku]) => { const p = put('produkt', {id: uid(), created: Date.now(), name, catId: C[ci].id, price, cost, stock, minStock: 2, sku, emoji: '', color: '', img: '', photos: [], unit: 'Stk', active: true, trackStock: true, tax: K.settings.taxDefault}); if (stock) addMove(p.id, stock, 'init', 'Demo'); });
  put('produkt', {id: uid(), created: Date.now(), name: 'Gutschein 25 €', catId: C[4].id, price: 2500, cost: 0, stock: 0, minStock: 0, sku: 'GUT-25', emoji: '🎁', color: '', img: '', photos: [], unit: 'Stk', active: true, trackStock: false, tax: 0});
  toast('Demo-Daten geladen'); go('verkauf');
}

function exportProductsCsv() {
  if (!T.produkt.length) return toast('Keine Produkte vorhanden', true);
  const rows = [['Name', 'Kategorie', 'Artikelnr.', 'Verkaufspreis', 'EK/Material', 'Bestand', 'Einheit', 'Mindestbestand', 'Lagerwert VK', 'Aktiv']];
  T.produkt.forEach(p => { const c = catById(p.catId); rows.push([p.name, c ? c.name : '', p.sku || '', eurPlain(p.price), eurPlain(p.cost || 0), p.trackStock ? p.stock : '∞', p.unit || 'Stk', p.minStock ?? '', p.trackStock ? eurPlain(Math.max(0, p.stock) * p.price) : '', p.active ? 'ja' : 'nein']); });
  downloadFile(`kontorwerk-produkte-${dayKey(Date.now())}.csv`, csv(rows), 'text/csv');
}

registerModule({
  id: 'wawi',
  name: 'Warenwirtschaft & Verkauf',
  sideGroup: 'Warenwirtschaft',
  icon: '📦',
  desc: 'Produkte, Kategorien, Lager, Verkauf vor Ort mit Bon, Berichte und Tagesabschluss',
  defaultOn: true,
  views: [
    {id: 'verkauf', label: 'Verkauf', icon: '🛍️', mobile: 1, html: V.html, render: V.renderPOS},
    {id: 'produkte', label: 'Produkte', icon: '📦', mobile: 2, html: PR.html, render: PR.renderProducts},
    {id: 'lager', label: 'Lager', icon: '🏷️', mobile: 3, html: L.html, render: L.renderStock, badge: lowCount},
    {id: 'berichte', label: 'Berichte', icon: '📊', mobile: 4, html: B.html, render: B.renderReports}
  ],
  dataActions: [
    {icon: '📊', title: 'Produktliste als CSV', sub: 'Für Excel / Numbers / Inventur', run: exportProductsCsv},
    {icon: '✨', title: 'Demo-Daten laden', sub: 'Beispiel-Kategorien und -Produkte zum Ausprobieren', run: loadDemo}
  ],
  init() { V.initVerkauf(); PR.initProdukte(); L.initLager(); B.initBerichte(); },
  onShow() { V.closeCart(); },
  onOverlay() { V.closeCart(); },
  onBack() {
    if (V.cartOpen()) { V.closeCart(); return true; }
    return false;
  },
  onReset() { V.clearCart(); },
  api: {editProduct: PR.editProduct, editCategory: PR.editCategory, loadDemo}
});
