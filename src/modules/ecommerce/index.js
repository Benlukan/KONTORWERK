/* ═══════════════ MODUL: E-Commerce (Etsy) – Phase 4 ═══════════════
 * Phase 4.0: Import der Etsy-CSV-Dateien (Bestellungen, bestellte Artikel, Angebote, Monatsabrechnung).
 * Phase 4.1 (geplant): automatische Abholung über die Etsy-API via eigenem PocketBase-Server, Bestand zurückmelden.
 */
import {eur} from '../../core/util.js';
import {T} from '../../core/db.js';
import {registerModule} from '../../core/modules.js';
import {isoDay} from '../dokumente/shared.js';
import * as EB from './bestellungen.js';
import * as EK from './konto.js';
import * as EA from './artikel.js';
import * as SH from './shops.js';
import {shops, umsatzVon, offeneBestellungen} from './shared.js';

function dashStats() {
  if (!shops().length) return [];
  const m0 = isoDay(Date.now()).slice(0, 7), monat = T.bestellung.filter(o => (o.datum || '').startsWith(m0));
  const offen = offeneBestellungen().length, physisch = shops().some(s => s.art !== 'digital');
  return [
    ...(physisch ? [`<div class="stat-card" data-go="bestellungen" style="--sc:var(--warn)"><div class="sc-label">Etsy: zu versenden</div><div class="sc-value">${offen}</div><div class="sc-sub">${offen ? 'offene Bestellungen' : 'alles verschickt'}</div></div>`] : []),
    `<div class="stat-card" data-go="bestellungen" style="--sc:#f1641e"><div class="sc-label">Etsy diesen Monat</div><div class="sc-value">${eur(monat.reduce((a, o) => a + umsatzVon(o), 0))}</div><div class="sc-sub">${monat.filter(o => o.status !== 'storniert').length} Bestellungen</div></div>`
  ];
}

registerModule({
  id: 'ecommerce',
  name: 'E-Commerce (Etsy)',
  icon: '🛒',
  requires: ['wawi'],
  defaultOn: true,
  desc: 'Etsy-Bestellungen, Abrechnungen und Angebote einlesen; Bestand automatisch abbuchen; Gebühren und Auszahlungen in die Buchhaltung',
  views: [
    {id: 'bestellungen', label: 'Bestellungen', icon: '🛒', mobile: 13, hint: 'Etsy-Bestellungen', html: EB.html, render: EB.renderBestellungen, badge: EB.badge},
    {id: 'etsykonto', label: 'Etsy-Konto', icon: '💳', mobile: 14, hint: 'Abrechnungen, Gebühren, Auszahlungen', html: EK.html, render: EK.renderKonto},
    {id: 'etsyartikel', label: 'Etsy-Artikel', icon: '🏷️', mobile: 15, hint: 'Angebote verknüpfen, Bestand', html: EA.html, render: EA.renderArtikel}
  ],
  settings: {html: SH.settingsHtml, render: SH.renderSettings, init: SH.initSettings},
  dashStats,
  init() { EB.initBestellungen(); },
  api: {openImport: EB.openImport, openBestellung: EB.openBestellung}
});
