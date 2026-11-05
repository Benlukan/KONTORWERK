/* ═══════════════ ÜBERNAHME AUS WAWIWERK / KASSENWERK ═══════════════
 * WAWIWERK speicherte alles als einen Block {settings, categories, products, sales, moves, days}
 * unter dem Schlüssel "state_v1" in der IndexedDB "kassenwerk". KONTORWERK nutzt dieselbe
 * App-Kennung, kann diese Datenbank also lesen. Die alte Datenbank bleibt unverändert liegen.
 */
import {TOOL_CONFIG} from './config.js';
import {K, isEmpty, replaceAll} from './db.js';

/** Alten Datenblock in KONTORWERK-Tabellen umwandeln */
export function fromLegacy(d) {
  const settings = {...(d.settings || {})};
  settings.modules = {wawi: true};
  const products = (d.products || []).map(p => {
    const q = {...p};
    if (q.trackStock == null) q.trackStock = true;
    if (q.active == null) q.active = true;
    if (q.stock == null) q.stock = 0;
    if (!Array.isArray(q.photos)) q.photos = q.img ? [{t: q.img, f: q.imgFull || q.img}] : [];
    return q;
  });
  return {
    settings,
    tables: {
      kategorie: (d.categories || []).map(c => ({...c})),
      produkt: products,
      lagerbewegung: (d.moves || []).map(m => ({...m})),
      beleg: (d.sales || []).map(s => ({...s, art: 'bon', kanal: 'vor-ort'})),
      tagesabschluss: Object.entries(d.days || {}).map(([k, v]) => ({...v, id: k}))
    }
  };
}

/** Den alten Block lesen, ohne die alte Datenbank anzulegen, falls es sie nicht gibt */
function readLegacyDb() {
  return new Promise(res => {
    let r;
    try { r = indexedDB.open(TOOL_CONFIG.legacyDbName); } catch (e) { return res(null); }
    r.onupgradeneeded = () => { r.transaction.abort(); }; // gab es nicht → nicht anlegen
    r.onerror = () => res(null);
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) { db.close(); return res(null); }
      const g = db.transaction('kv').objectStore('kv').get(TOOL_CONFIG.legacyStateKey);
      g.onsuccess = () => { db.close(); res(g.result || null); };
      g.onerror = () => { db.close(); res(null); };
    };
  });
}
function readLegacyLocalStorage() {
  try { const l = localStorage.getItem('kw_' + TOOL_CONFIG.legacyStateKey); return l ? JSON.parse(l) : null; } catch (e) { return null; }
}

/** Beim ersten Start: vorhandene WAWIWERK-Daten übernehmen. Liefert Zusammenfassung oder null. */
export async function migrateIfNeeded() {
  if (K.meta.migratedFrom || !isEmpty() || !K.persistent) return null;
  const d = (await readLegacyDb()) || readLegacyLocalStorage();
  if (!d || !Array.isArray(d.products)) return null;
  const {tables, settings} = fromLegacy(d);
  const ok = await replaceAll(tables, settings, {migratedFrom: 'wawiwerk', migratedTs: Date.now()});
  return ok ? {products: tables.produkt.length, sales: tables.beleg.length} : null;
}
