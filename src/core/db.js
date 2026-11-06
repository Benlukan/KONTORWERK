/* ═══════════════ DATENBANK (IndexedDB) ═══════════════
 * Eine Tabelle (Object Store) pro Entität. Alle Datensätze liegen zusätzlich im Speicher (T.*),
 * damit die Oberfläche synchron lesen kann. Jede Änderung geht über put()/remove() und bekommt
 * die Abgleich-Felder erstellt / geaendert / geraet. Gelöschte Datensätze bleiben als
 * Grabstein ({id, geloescht:true}) erhalten – nötig für den späteren Geräte-Abgleich.
 *
 * Dateien (Fotos/PDFs im Belegarchiv) liegen im eigenen Store „datei“ und werden NICHT in den
 * Speicher geladen (alte Tablets). Zugriff nur asynchron über getFile()/putFile().
 */
import {TOOL_CONFIG} from './config.js';
import {uid} from './util.js';

export const TABLES = ['kontakt', 'kategorie', 'produkt', 'lagerbewegung', 'beleg', 'tagesabschluss', 'dokument', 'buchung', 'bankumsatz', 'bestellung', 'shopposten', 'shopartikel'];
export const FILES = 'datei';
const DB_VERSION = 4;

export const DEFAULT_SETTINGS = {
  // Firma
  shopName: '', ownerName: '', address: '', email: '', phone: '', taxNo: '',
  footer: 'Vielen Dank für Ihren Einkauf!',
  web: '', logo: '', // Firmenlogo als Bild-URL (data:) für Rechnungen
  // Bank (Rechnungen)
  bankInhaber: '', iban: '', bic: '', bankName: '',
  zahlungsziel: 14, // Tage
  // Nummernkreise der Dokumente: Präfix je Art
  nrPrefix: {rechnung: 'RE', angebot: 'AN', lieferschein: 'LS', gutschrift: 'GS'},
  // Standardtexte der Dokumente
  docTexte: {},
  // Buchhaltung
  datev: {berater: '', mandant: '', wjBeginn: '0101'},
  konten: {},        // Kategorie/Zahlungskonto → Sachkonto (Abweichungen vom SKR03-Vorschlag)
  kontoStart: {},    // Anfangsbestände {kasse, bank, paypal} in Cent
  kontoStartDatum: '',
  // E-Commerce: Shops [{id, name, plattform:'etsy', art:'physisch'|'digital', bestand:true}]
  shops: [],
  // Unternehmerlohn
  wunschlohn: 0, ruecklage: 30,
  // Steuer & Verkauf
  klein: true, taxDefault: 19, allowNegative: false, minDefault: 2, haptic: true,
  umsatzExtra: {}, // {Jahr: Cent} – Umsätze außerhalb von KONTORWERK (z. B. Etsy, bis das E-Commerce-Modul kommt)
  // Oberfläche
  theme: 'auto',
  // Nummernkreise
  receiptNo: 0,
  // Module (id → an/aus)
  modules: {}
};

/** Lebende Datensätze je Tabelle (ohne Grabsteine) */
export const T = Object.fromEntries(TABLES.map(t => [t, []]));
const idx = Object.fromEntries(TABLES.map(t => [t, new Map()]));
export const K = {settings: structuredClone(DEFAULT_SETTINGS), deviceId: null, meta: {}, persistent: false};

let idb = null;
const pending = new Map(); // "tabelle\u0000id" → Datensatz
let flushTimer = null;
const listeners = new Set();
export const onWriteError = fn => listeners.add(fn);
const changeListeners = new Set();
/** Wird nach jeder lokalen Änderung aufgerufen (z. B. für den Abgleich) */
export const onLocalChange = fn => changeListeners.add(fn);
const changed = () => changeListeners.forEach(f => f());

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export async function openDb() {
  try {
    idb = await new Promise((res, rej) => {
      const r = indexedDB.open(TOOL_CONFIG.dbName, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        TABLES.forEach(t => { if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, {keyPath: 'id'}); });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains(FILES)) d.createObjectStore(FILES, {keyPath: 'id'});
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    K.persistent = true;
  } catch (e) {
    idb = null; K.persistent = false;
  }
  await load();
}

async function load() {
  TABLES.forEach(t => { T[t].length = 0; idx[t].clear(); });
  if (!idb) { K.deviceId = uid(); return; }
  const tx = idb.transaction([...TABLES, 'meta']);
  for (const t of TABLES) {
    const rows = await req(tx.objectStore(t).getAll());
    rows.sort((a, b) => (a.erstellt || 0) - (b.erstellt || 0));
    rows.forEach(r => { idx[t].set(r.id, r); if (!r.geloescht) T[t].push(r); });
  }
  const m = tx.objectStore('meta');
  const [settings, deviceId, migratedFrom, settingsTs, sync, dateiHoch] = await Promise.all(['settings', 'deviceId', 'migratedFrom', 'settingsTs', 'sync', 'dateiHoch'].map(k => req(m.get(k))));
  K.meta.dateiHoch = dateiHoch || [];
  K.settings = mergeSettings(settings);
  K.meta.migratedFrom = migratedFrom || null;
  K.meta.settingsTs = settingsTs || 0;
  K.meta.sync = sync || null;
  K.deviceId = deviceId || null;
  if (!K.deviceId) { K.deviceId = uid(); queueMeta('deviceId', K.deviceId); }
}

export function mergeSettings(s) {
  const out = {...structuredClone(DEFAULT_SETTINGS), ...(s || {})};
  out.modules = {...(s && s.modules || {})};
  out.umsatzExtra = {...(s && s.umsatzExtra || {})};
  out.nrPrefix = {...DEFAULT_SETTINGS.nrPrefix, ...(s && s.nrPrefix || {})};
  out.docTexte = {...(s && s.docTexte || {})};
  out.datev = {...DEFAULT_SETTINGS.datev, ...(s && s.datev || {})};
  out.konten = {...(s && s.konten || {})};
  out.kontoStart = {...(s && s.kontoStart || {})};
  out.shops = (s && Array.isArray(s.shops) ? s.shops : []).map(x => ({...x}));
  return out;
}

export const get = (t, id) => { const r = idx[t].get(id); return r && !r.geloescht ? r : undefined; };
export const isEmpty = () => TABLES.every(t => !T[t].length);

/** Neuen Datensatz anlegen oder bestehenden speichern (gleiches Objekt oder gleiche id). */
export function put(t, rec) {
  const now = Date.now();
  if (!rec.id) rec.id = uid();
  if (!rec.erstellt) rec.erstellt = rec.created || rec.ts || now;
  rec.geaendert = now; rec.geraet = K.deviceId;
  const ex = idx[t].get(rec.id);
  if (!ex || ex.geloescht) T[t].push(rec);
  else if (ex !== rec) { const i = T[t].indexOf(ex); if (i >= 0) T[t][i] = rec; else T[t].push(rec); }
  idx[t].set(rec.id, rec);
  queue(t, rec); changed();
  return rec;
}

/** Löschen = Grabstein setzen (bleibt für den Abgleich erhalten). Bei Dokumenten bleibt die Datei-id im Grabstein. */
export function remove(t, id) {
  const ex = idx[t].get(id); if (!ex || ex.geloescht) return;
  const tomb = {id, geloescht: true, erstellt: ex.erstellt, geaendert: Date.now(), geraet: K.deviceId};
  if (ex.dateiId) tomb.dateiId = ex.dateiId;
  idx[t].set(id, tomb);
  const i = T[t].indexOf(ex); if (i >= 0) T[t].splice(i, 1);
  queue(t, tomb); changed();
}

export function saveSettings() {
  K.meta.settingsTs = Date.now();
  queueMeta('settings', K.settings); queueMeta('settingsTs', K.meta.settingsTs); changed();
}
/** Einstellungen aus dem Abgleich übernehmen (ohne neuen Zeitstempel) */
export function applyRemoteSettings(s, ts) {
  K.settings = mergeSettings(s); K.meta.settingsTs = ts;
  queueMeta('settings', K.settings); queueMeta('settingsTs', ts);
}
export function setMeta(key, val) { K.meta[key] = val; queueMeta(key, val); }

/* ─── Abgleich ─── */
export const getAny = (t, id) => idx[t].get(id);
/** Datensatz von einem anderen Gerät übernehmen, wenn er neuer ist. true = übernommen */
export function applyRemote(t, rec) {
  if (!idx[t]) return false;
  const ex = idx[t].get(rec.id);
  if (ex && (ex.geaendert || 0) >= (rec.geaendert || 0)) return false;
  idx[t].set(rec.id, rec);
  const i = ex ? T[t].indexOf(ex) : -1;
  if (rec.geloescht) { if (i >= 0) T[t].splice(i, 1); }
  else if (i >= 0) T[t][i] = rec; else T[t].push(rec);
  queue(t, rec);
  return true;
}
/* ─── Dateien (eigener Store, nicht im Speicher) ─── */
function fileTx(mode, fn) {
  return new Promise((res, rej) => {
    if (!idb) return rej(new Error('Kein Speicher verfügbar'));
    const tx = idb.transaction(FILES, mode); const s = tx.objectStore(FILES); let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    tx.oncomplete = () => res(out); tx.onerror = tx.onabort = () => { listeners.forEach(f => f(tx.error)); rej(tx.error); };
  });
}
/** Datei speichern: {data (data-URL), mime, name} → Datensatz ohne data */
export async function putFile(f) {
  const now = Date.now();
  const rec = {id: f.id || uid(), data: f.data, mime: f.mime || '', name: f.name || '', size: f.size || (f.data || '').length, erstellt: f.erstellt || now, geaendert: now, geraet: K.deviceId};
  await fileTx('readwrite', s => { s.put(rec); });
  changed();
  const {data, ...meta} = rec; return meta;
}
export const getFile = id => fileTx('readonly', s => req(s.get(id))).then(r => r && !r.geloescht ? r : null);
/** Datei löschen (Grabstein, Inhalt wird entfernt) */
export const removeFile = id => fileTx('readwrite', s => { s.put({id, geloescht: true, geaendert: Date.now(), geraet: K.deviceId}); });
/** Datei von einem anderen Gerät übernehmen (Dateien ändern sich nie, nur Löschen zählt) */
export async function applyRemoteFile(rec) {
  const ex = await fileTx('readonly', s => req(s.get(rec.id)));
  if (ex && (ex.geloescht || (ex.geaendert || 0) >= (rec.geaendert || 0))) return false;
  await fileTx('readwrite', s => { s.put(rec); });
  return true;
}
export const allFiles = () => idb ? fileTx('readonly', s => req(s.getAll())) : Promise.resolve([]);

/** Alle Datensätze (inkl. Grabsteine) als [tabelle, datensatz] */
export const allRecords = () => TABLES.flatMap(t => [...idx[t].values()].map(r => [t, r]));

function queue(t, rec) { pending.set(t + '\u0000' + rec.id, {t, rec}); schedule(); }
function queueMeta(key, val) { pending.set('meta\u0000' + key, {t: 'meta', key, rec: val}); schedule(); }
function schedule() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 120); }

export function flush() {
  clearTimeout(flushTimer);
  if (!pending.size || !idb) { pending.clear(); return Promise.resolve(true); }
  const items = [...pending.values()]; pending.clear();
  return new Promise(res => {
    let tx;
    try { tx = idb.transaction([...TABLES, 'meta'], 'readwrite'); } catch (e) { listeners.forEach(f => f(e)); return res(false); }
    items.forEach(({t, key, rec}) => {
      const clean = JSON.parse(JSON.stringify(rec)); // keine Proxies/Funktionen speichern
      if (t === 'meta') tx.objectStore('meta').put(clean, key); else tx.objectStore(t).put(clean);
    });
    tx.oncomplete = () => res(true);
    tx.onerror = tx.onabort = () => { lastErr = tx.error; listeners.forEach(f => f(tx.error)); res(false); };
  });
}
let lastErr = null;
/** Letzter Fehler beim Ersetzen aller Daten (z. B. QuotaExceededError) */
export const lastWriteError = () => lastErr;

/** Alles ersetzen (Backup-Import, Migration, „Alle Daten löschen“). tables: {tabelle: [Datensätze]} */
export async function replaceAll(tables, settings, extraMeta = {}, files = null) {
  pending.clear(); clearTimeout(flushTimer);
  const now = Date.now();
  TABLES.forEach(t => { T[t].length = 0; idx[t].clear(); });
  for (const t of TABLES) for (const r of (tables[t] || [])) {
    if (!r.id) r.id = uid();
    if (!r.erstellt) r.erstellt = r.created || r.ts || now;
    if (!r.geaendert) r.geaendert = now;
    if (!r.geraet) r.geraet = K.deviceId;
    idx[t].set(r.id, r); if (!r.geloescht) T[t].push(r);
  }
  K.settings = mergeSettings(settings);
  K.meta.settingsTs = now; // übernommene Einstellungen gelten als aktuell (wichtig für den Abgleich)
  Object.assign(K.meta, extraMeta);
  if (!idb) return true;
  return new Promise(res => {
    const tx = idb.transaction([...TABLES, 'meta', FILES], 'readwrite');
    TABLES.forEach(t => { const s = tx.objectStore(t); s.clear(); idx[t].forEach(r => s.put(JSON.parse(JSON.stringify(r)))); });
    if (files) { const fs = tx.objectStore(FILES); fs.clear(); files.forEach(f => fs.put(f)); }
    tx.objectStore('meta').put([], 'dateiHoch'); K.meta.dateiHoch = [];
    const m = tx.objectStore('meta');
    m.put(JSON.parse(JSON.stringify(K.settings)), 'settings');
    m.put(K.deviceId, 'deviceId');
    m.put(now, 'settingsTs');
    Object.entries(extraMeta).forEach(([k, v]) => m.put(v, k));
    tx.oncomplete = () => res(true);
    tx.onerror = tx.onabort = () => { lastErr = tx.error; listeners.forEach(f => f(tx.error)); res(false); };
  });
}

/** Alle Datensätze inkl. Grabsteine (für Backup/Abgleich) */
export const dump = () => Object.fromEntries(TABLES.map(t => [t, [...idx[t].values()]]));

document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
