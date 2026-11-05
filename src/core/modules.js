/* ═══════════════ MODUL-REGISTRY ═══════════════
 * Jedes Modul meldet ein Manifest an:
 *   id, name, icon, desc
 *   core      – immer aktiv (Kern), nicht abschaltbar
 *   planned   – Phase, in der das Modul kommt (dann noch nicht einschaltbar)
 *   defaultOn – Standard, solange in den Einstellungen nichts gewählt ist
 *   requires  – ids anderer Module, die aktiv sein müssen
 *   views     – [{id, label, icon, title, html, render(), mobile (Reihenfolge in der unteren Leiste), sidebar (false = ausblenden), badge()}]
 *   init()    – einmalig nach dem Einfügen der Ansichten (Ereignisse binden)
 *   onBack()  – Android-Zurück-Taste; true = erledigt
 *   onOverlay() – Klick auf den abgedunkelten Hintergrund (ohne offenen Dialog)
 *   onShow(viewId) – beim Wechsel der Ansicht
 */
import {K, saveSettings} from './db.js';

const MODS = [];
export const modules = () => MODS;
export const registerModule = m => { MODS.push({requires: [], views: [], defaultOn: false, ...m}); };
export const mod = id => MODS.find(m => m.id === id);

export function isActive(id) {
  const m = mod(id); if (!m) return false;
  if (m.core) return true;
  if (m.planned) return false;
  const on = K.settings.modules[id];
  if (!(on ?? m.defaultOn)) return false;
  return m.requires.every(isActive);
}

/** Warum lässt sich das Modul nicht umschalten? null = geht */
export function toggleBlocker(id) {
  const m = mod(id);
  if (m.core) return 'Teil des Kerns';
  if (m.planned) return `kommt in Phase ${m.planned}`;
  if (isActive(id)) {
    const deps = MODS.filter(x => x.requires.includes(id) && isActive(x.id));
    if (deps.length) return 'wird gebraucht von: ' + deps.map(d => d.name).join(', ');
  } else {
    const miss = m.requires.filter(r => !isActive(r));
    if (miss.length) return 'braucht zuerst: ' + miss.map(r => mod(r).name).join(', ');
  }
  return null;
}

export function setActive(id, on) {
  if (toggleBlocker(id)) return false;
  K.settings.modules[id] = !!on; saveSettings(); return true;
}

/** Alle Ansichten aktiver Module */
export const activeViews = () => MODS.filter(m => isActive(m.id)).flatMap(m => m.views.map(v => ({...v, module: m})));
export const viewById = id => MODS.flatMap(m => m.views.map(v => ({...v, module: m}))).find(v => v.id === id);
