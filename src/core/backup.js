/* ═══════════════ BACKUP: Export, Import, Löschen ═══════════════ */
import {dayKey} from './util.js';
import {K, dump, replaceAll, allFiles, TABLES, lastWriteError} from './db.js';
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
  let j;
  try { j = JSON.parse(text); }
  catch (e) {
    const t = String(text || '').trim();
    if (t.startsWith('{') && !t.endsWith('}')) throw new Error('Die Datei ist unvollständig – wahrscheinlich wurde sie nicht ganz übertragen. Bitte noch einmal vom Handy schicken.');
    throw new Error('Das ist keine Backup-Datei von KONTORWERK.');
  }
  if (j && j.app === 'KONTORWERK' && j.tables) {
    const n = t => (j.tables[t] || []).filter(r => !r.geloescht).length;
    // Tabellen, die diese App-Version noch nicht kennt (Backup von einem neueren Gerät), gingen sonst still verloren
    const fremd = Object.keys(j.tables).filter(t => !TABLES.includes(t) && j.tables[t] && j.tables[t].some(r => !r.geloescht));
    return {kind: 'KONTORWERK', tables: j.tables, settings: j.settings, files: Array.isArray(j.dateien) ? j.dateien : null, version: j.version, build: j.build || 0, exported: j.exported, fremd,
      summary: {products: n('produkt'), categories: n('kategorie'), sales: n('beleg'), contacts: n('kontakt'), docs: n('dokument')}};
  }
  const d = j && (j.data || j);
  if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('Das ist keine Backup-Datei von KONTORWERK oder WAWIWERK.');
  const {tables, settings} = fromLegacy(d);
  return {kind: 'WAWIWERK', tables, settings, summary: {products: tables.produkt.length, categories: tables.kategorie.length, sales: tables.beleg.length, contacts: 0}};
}

export async function restoreBackup(b) {
  // Design und Modulauswahl des Geräts behalten, wenn das Backup keine eigene hat
  const settings = {...b.settings};
  if (!settings.theme) settings.theme = K.settings.theme;
  const ok = await replaceAll(b.tables, settings, {}, b.files || null);
  if (!ok) {
    const e = lastWriteError(), name = e && e.name || '';
    throw new Error(/quota/i.test(name + (e && e.message)) ? 'Auf dem Gerät ist nicht genug Speicher frei. Lösche z. B. alte Fotos oder Apps und versuche es noch einmal.' : 'Die Daten konnten nicht gespeichert werden' + (name ? ` (${name})` : '') + '.');
  }
  requestFullSync(); // mit dem Server zusammenführen
  return ok;
}

export function wipeAll() {
  disconnect(); // sonst kämen die Daten beim nächsten Abgleich zurück
  return replaceAll({}, {theme: K.settings.theme, modules: K.settings.modules}, {}, []);
}

