/* ═══════════════ BACKUP: Export, Import, Löschen ═══════════════ */
import {dayKey} from './util.js';
import {K, T, dump, replaceAll} from './db.js';
import {TOOL_CONFIG} from './config.js';
import {downloadFile} from './files.js';
import {fromLegacy} from './migrate.js';

export function exportBackup() {
  const data = {app: 'KONTORWERK', format: 2, version: TOOL_CONFIG.version, build: TOOL_CONFIG.build, exported: new Date().toISOString(), deviceId: K.deviceId, settings: K.settings, tables: dump()};
  return downloadFile(`kontorwerk-backup-${dayKey(Date.now())}.json`, JSON.stringify(data), 'application/json');
}

/** Backup-Datei lesen: KONTORWERK (Format 2) oder alte WAWIWERK/KASSENWERK-Backups */
export function parseBackup(text) {
  const j = JSON.parse(text);
  if (j && j.app === 'KONTORWERK' && j.tables) {
    const n = t => (j.tables[t] || []).filter(r => !r.geloescht).length;
    return {kind: 'KONTORWERK', tables: j.tables, settings: j.settings, summary: {products: n('produkt'), categories: n('kategorie'), sales: n('beleg'), contacts: n('kontakt')}};
  }
  const d = j && (j.data || j);
  if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('Kein KONTORWERK- oder WAWIWERK-Backup');
  const {tables, settings} = fromLegacy(d);
  return {kind: 'WAWIWERK', tables, settings, summary: {products: tables.produkt.length, categories: tables.kategorie.length, sales: tables.beleg.length, contacts: 0}};
}

export function restoreBackup(b) {
  // Design und Modulauswahl des Geräts behalten, wenn das Backup keine eigene hat
  const settings = {...b.settings};
  if (!settings.theme) settings.theme = K.settings.theme;
  return replaceAll(b.tables, settings);
}

export function wipeAll() {
  return replaceAll({}, {theme: K.settings.theme, modules: K.settings.modules});
}

export const counts = () => ({products: T.produkt.length, contacts: T.kontakt.length, belege: T.beleg.length});
