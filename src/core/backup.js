/* ═══════════════ BACKUP: Export, Import, Löschen ═══════════════ */
import {dayKey} from './util.js';
import {K, dump, replaceAll, allFiles} from './db.js';
import {TOOL_CONFIG} from './config.js';
import {downloadFile} from './files.js';
import {fromLegacy} from './migrate.js';
import {requestFullSync, disconnect} from './sync.js';

export async function exportBackup() {
  const dateien = (await allFiles()).filter(f => !f.geloescht);
  const data = {app: 'KONTORWERK', format: 2, version: TOOL_CONFIG.version, build: TOOL_CONFIG.build, exported: new Date().toISOString(), deviceId: K.deviceId, settings: K.settings, tables: dump(), dateien};
  return downloadFile(`kontorwerk-backup-${dayKey(Date.now())}.json`, JSON.stringify(data), 'application/json');
}

/** Backup-Datei lesen: KONTORWERK (Format 2) oder alte WAWIWERK/KASSENWERK-Backups */
export function parseBackup(text) {
  const j = JSON.parse(text);
  if (j && j.app === 'KONTORWERK' && j.tables) {
    const n = t => (j.tables[t] || []).filter(r => !r.geloescht).length;
    return {kind: 'KONTORWERK', tables: j.tables, settings: j.settings, files: Array.isArray(j.dateien) ? j.dateien : null, summary: {products: n('produkt'), categories: n('kategorie'), sales: n('beleg'), contacts: n('kontakt'), docs: n('dokument')}};
  }
  const d = j && (j.data || j);
  if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('Kein KONTORWERK- oder WAWIWERK-Backup');
  const {tables, settings} = fromLegacy(d);
  return {kind: 'WAWIWERK', tables, settings, summary: {products: tables.produkt.length, categories: tables.kategorie.length, sales: tables.beleg.length, contacts: 0}};
}

export async function restoreBackup(b) {
  // Design und Modulauswahl des Geräts behalten, wenn das Backup keine eigene hat
  const settings = {...b.settings};
  if (!settings.theme) settings.theme = K.settings.theme;
  const ok = await replaceAll(b.tables, settings, {}, b.files || null);
  requestFullSync(); // mit dem Server zusammenführen
  return ok;
}

export function wipeAll() {
  disconnect(); // sonst kämen die Daten beim nächsten Abgleich zurück
  return replaceAll({}, {theme: K.settings.theme, modules: K.settings.modules}, {}, []);
}

