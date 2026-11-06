/* ═══════════════ GEPLANTE MODULE (Phasenplan) ═══════════════
 * Sie erscheinen schon in den Einstellungen und im „Mehr“-Menü, lassen sich aber erst
 * einschalten, wenn sie gebaut sind. Abhängigkeiten stehen bereits fest.
 */
import {registerModule} from '../core/modules.js';

registerModule({id: 'ecommerce', planned: 4, name: 'E-Commerce', icon: '🛒', requires: ['wawi'], desc: 'Etsy-Bestellungen abholen, Bestand zurückmelden, Gebühren als Ausgabe'});
registerModule({id: 'produktion', planned: 5, name: 'Produktion', icon: '🛠️', requires: ['wawi'], desc: 'Stücklisten, Fertigungsaufträge, Materialkosten pro Stück'});
registerModule({id: 'versand', planned: 5, name: 'Logistik & Versand', icon: '🚚', requires: ['wawi'], desc: 'Sendungen zu Aufträgen, Sendungsnummern, später DHL-Labels'});
