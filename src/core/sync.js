/* ═══════════════ GERÄTE-ABGLEICH (PocketBase) ═══════════════
 * Server: eine Sammlung „kw_daten“ (siehe server/pb_migrations). Je App-Datensatz eine Zeile,
 * ihre id wird aus Tabelle + Datensatz-id berechnet, damit Hochladen ein einfaches Upsert ist.
 *
 * Ablauf:
 *  - Holen:     alle Zeilen, die seit dem letzten Abgleich auf dem Server geändert wurden
 *               (von anderen Geräten). Übernommen wird, was neuer ist (geaendert).
 *  - Hochladen: alle Datensätze, die auf diesem Gerät seit dem letzten Hochladen geändert wurden.
 *  - Vollabgleich (beim Verbinden, nach Backup-Import): alles holen, dann alles hochladen,
 *               was lokal neuer ist als auf dem Server.
 * Konflikte: Die jüngere Änderung gewinnt. Gelöschtes bleibt als Grabstein erhalten.
 */
import {K, setMeta, applyRemote, applyRemoteSettings, allRecords, flush, onLocalChange, TABLES} from './db.js';

const COL = 'kw_daten';
const SETTINGS_ROW = ['_einstellungen', 'main'];
const LOCAL_ONLY = ['theme']; // bleibt je Gerät
const BATCH = 40, BATCH_BYTES = 12 * 1024 * 1024;

const listeners = new Set();
export const onSyncStatus = fn => listeners.add(fn);
export const status = {state: 'aus', msg: '', running: false, last: null};
function setStatus(state, msg) { Object.assign(status, {state, msg}); listeners.forEach(f => f(status)); }
const remoteListeners = new Set();
/** Aufruf, wenn Daten von einem anderen Gerät übernommen wurden ({settings: bool}) */
export const onRemoteChange = fn => remoteListeners.add(fn);

export const cfg = () => K.meta.sync;
export const connected = () => !!(K.meta.sync && K.meta.sync.token);
const saveCfg = c => setMeta('sync', c);

/* ─── IDs: 15 Zeichen [a-z0-9], fest aus Tabelle + id ─── */
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const pbId = (t, id) => { const k = t + '\u0000' + id; return (cyrb53(k, 1).toString(36) + cyrb53(k, 2).toString(36)).padEnd(15, '0').slice(0, 15); };

/* ─── HTTP ─── */
export function normalizeUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
async function api(path, {method = 'GET', body, token} = {}) {
  const c = cfg();
  const res = await fetch(c.url + path, {
    method,
    headers: {'Content-Type': 'application/json', ...(token !== false && c.token ? {Authorization: c.token} : {})},
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { /* leer */ }
  if (!res.ok) { const err = new Error((data && data.message) || ('HTTP ' + res.status)); err.status = res.status; err.data = data; throw err; }
  return data;
}

/** Anmelden und Vollabgleich starten */
export async function connect(url, email, password) {
  url = normalizeUrl(url);
  if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(url)) throw new Error('Die Server-Adresse muss mit https:// beginnen');
  saveCfg({url, email, token: null});
  let r;
  try { r = await api('/api/collections/users/auth-with-password', {method: 'POST', body: {identity: email, password}, token: false}); }
  catch (e) { saveCfg(null); setStatus('aus', ''); throw new Error(e.status === 400 ? 'E-Mail oder Passwort falsch' : e.status ? e.message : 'Server nicht erreichbar'); }
  saveCfg({url, email, token: r.token, tokenTs: Date.now(), lastPull: '', lastPushAt: 0, needFull: true, lastOk: null});
  await syncNow();
}
export function disconnect() { saveCfg(null); setStatus('aus', ''); }
export function requestFullSync() { const c = cfg(); if (c) saveCfg({...c, needFull: true}); }

async function refreshToken() {
  const c = cfg();
  if (Date.now() - (c.tokenTs || 0) < 864e5) return;
  const r = await api('/api/collections/users/auth-refresh', {method: 'POST'});
  saveCfg({...cfg(), token: r.token, tokenTs: Date.now()});
}

/* ─── Holen ─── */
async function pull(full) {
  const c = cfg(), me = K.deviceId;
  const parts = [];
  if (!full && c.lastPull) parts.push(`updated >= "${c.lastPull}"`);
  if (!full) parts.push(`geraet != "${me}"`);
  const filter = encodeURIComponent(parts.join(' && '));
  const server = new Map(); let maxUpd = c.lastPull || '', page = 1, got = 0, settingsChanged = false;
  for (;;) {
    const r = await api(`/api/collections/${COL}/records?perPage=200&page=${page}&sort=updated,id&skipTotal=1${parts.length ? '&filter=' + filter : ''}`);
    for (const it of r.items) {
      server.set(it.tabelle + '\u0000' + it.rid, it.geaendert || 0);
      if (it.updated > maxUpd) maxUpd = it.updated;
      if (it.tabelle === SETTINGS_ROW[0]) {
        if ((it.geaendert || 0) > (K.meta.settingsTs || 0)) {
          const s = {...it.daten}; LOCAL_ONLY.forEach(k => { s[k] = K.settings[k]; });
          s.receiptNo = Math.max(s.receiptNo || 0, K.settings.receiptNo || 0);
          applyRemoteSettings(s, it.geaendert); settingsChanged = true; got++;
        }
        continue;
      }
      if (!TABLES.includes(it.tabelle)) continue;
      const rec = it.geloescht ? {...(it.daten || {}), id: it.rid, geloescht: true} : {...it.daten, id: it.rid};
      rec.geaendert = it.geaendert; rec.geraet = it.geraet;
      if (applyRemote(it.tabelle, rec)) got++;
    }
    if (r.items.length < 200) break;
    page++;
  }
  saveCfg({...cfg(), lastPull: maxUpd});
  if (got) remoteListeners.forEach(f => f({settings: settingsChanged}));
  return {got, server};
}

/* ─── Hochladen ─── */
function rowFor(t, r) {
  const {id, geaendert, geraet, geloescht, ...daten} = r;
  return {id: pbId(t, id), tabelle: t, rid: id, daten: geloescht ? {erstellt: r.erstellt} : {...daten}, geaendert: geaendert || 0, geraet: geraet || '', geloescht: !!geloescht};
}
async function push(full, server) {
  const c = cfg(), since = c.lastPushAt || 0, startedAt = Date.now(), me = K.deviceId;
  const rows = [];
  for (const [t, r] of allRecords()) {
    if (full) { if ((r.geaendert || 0) > (server.get(t + '\u0000' + r.id) ?? -1)) rows.push(rowFor(t, r)); }
    else if (r.geraet === me && (r.geaendert || 0) > since) rows.push(rowFor(t, r));
  }
  const sTs = K.meta.settingsTs || 0;
  if (sTs && (full ? sTs > (server.get(SETTINGS_ROW.join('\u0000')) ?? -1) : sTs > since)) {
    const s = {...K.settings}; LOCAL_ONLY.forEach(k => delete s[k]);
    rows.push({id: pbId(...SETTINGS_ROW), tabelle: SETTINGS_ROW[0], rid: SETTINGS_ROW[1], daten: s, geaendert: sTs, geraet: me, geloescht: false});
  }
  // in Päckchen hochladen (Anzahl und Größe begrenzt)
  let batch = [], bytes = 0;
  const send = async () => {
    if (!batch.length) return;
    await api('/api/batch', {method: 'POST', body: {requests: batch.map(b => ({method: 'PUT', url: `/api/collections/${COL}/records`, body: b}))}});
    batch = []; bytes = 0;
  };
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (batch.length && (batch.length >= BATCH || bytes + size > BATCH_BYTES)) await send();
    batch.push(row); bytes += size;
  }
  await send();
  saveCfg({...cfg(), lastPushAt: startedAt - 1000, needFull: false});
  return rows.length;
}

/* ─── Abgleich ─── */
let again = false;
export async function syncNow() {
  if (!connected()) return;
  if (!navigator.onLine) { setStatus('offline', 'Offline – Abgleich, sobald wieder Netz da ist'); return; }
  if (status.running) { again = true; return; }
  status.running = true; setStatus('laeuft', 'Abgleich läuft …');
  try {
    await refreshToken();
    const full = !!cfg().needFull;
    const {got, server} = await pull(full);
    const sent = await push(full, server);
    await flush();
    const c = cfg(); saveCfg({...c, lastOk: Date.now()});
    status.last = {got, sent, ts: Date.now()};
    setStatus('ok', '');
  } catch (e) {
    if (e.status === 401 || e.status === 403) { saveCfg({...cfg(), token: null}); setStatus('fehler', 'Anmeldung abgelaufen – bitte neu verbinden'); }
    else setStatus('fehler', e.status ? 'Server-Fehler: ' + e.message : 'Server nicht erreichbar');
  } finally {
    status.running = false;
    if (again) { again = false; setTimeout(syncNow, 500); }
  }
}

let soon = null, timer = null;
export function initSync() {
  if (cfg() && !cfg().token && cfg().url) setStatus('fehler', 'Anmeldung abgelaufen – bitte neu verbinden');
  else if (connected()) setStatus('ok', '');
  onLocalChange(() => { if (!connected()) return; clearTimeout(soon); soon = setTimeout(syncNow, 4000); });
  clearInterval(timer); timer = setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (connected()) syncNow(); });
  window.addEventListener('online', () => syncNow());
  syncNow();
}

