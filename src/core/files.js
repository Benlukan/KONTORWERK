/* ═══════════════ DATEIEN: Export & Teilen ═══════════════ */
import {IS_NATIVE, P} from './util.js';
import {toast} from './ui.js';

export async function downloadFile(name, content, mime) {
  if (IS_NATIVE && P.Filesystem && P.Share) {
    try {
      const data = btoa(unescape(encodeURIComponent(content)));
      const r = await P.Filesystem.writeFile({path: name, data, directory: 'CACHE'});
      await P.Share.share({title: name, files: [r.uri], dialogTitle: 'Datei speichern oder teilen'});
      return;
    } catch (e) { if (String(e && e.message || e).toLowerCase().includes('cancel')) return; toast('Export fehlgeschlagen: ' + (e.message || e), true); return; }
  }
  const blob = new Blob([content], {type: mime + ';charset=utf-8'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Datei gespeichert: ' + name);
}

export async function shareText(title, text) {
  try {
    if (IS_NATIVE && P.Share) return await P.Share.share({title, text, dialogTitle: title});
    if (navigator.share) return await navigator.share({title, text});
    await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert');
  } catch (e) { /* abgebrochen */ }
}
