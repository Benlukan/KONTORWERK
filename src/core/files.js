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

/** Binärdatei (Blob oder data-URL) speichern bzw. teilen – z. B. PDF oder Belegfoto */
export async function downloadBinary(name, src, mime) {
  const blob = typeof src === 'string' ? dataUrlToBlob(src) : src;
  if (IS_NATIVE && P.Filesystem && P.Share) {
    try {
      const data = typeof src === 'string' ? src.slice(src.indexOf(',') + 1) : await blobToBase64(blob);
      const r = await P.Filesystem.writeFile({path: name, data, directory: 'CACHE'});
      await P.Share.share({title: name, files: [r.uri], dialogTitle: 'Öffnen, speichern oder teilen'});
      return;
    } catch (e) { if (String(e && e.message || e).toLowerCase().includes('cancel')) return; toast('Export fehlgeschlagen: ' + (e.message || e), true); return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob.type ? blob : new Blob([blob], {type: mime || 'application/octet-stream'})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Datei gespeichert: ' + name);
}
export function dataUrlToBlob(u) {
  const i = u.indexOf(','), meta = u.slice(5, i), b64 = meta.includes(';base64');
  const raw = b64 ? atob(u.slice(i + 1)) : decodeURIComponent(u.slice(i + 1));
  const arr = new Uint8Array(raw.length); for (let k = 0; k < raw.length; k++) arr[k] = raw.charCodeAt(k);
  return new Blob([arr], {type: meta.split(';')[0]});
}
export const blobToDataUrl = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
const blobToBase64 = b => blobToDataUrl(b).then(u => u.slice(u.indexOf(',') + 1));

export async function shareText(title, text) {
  try {
    if (IS_NATIVE && P.Share) return await P.Share.share({title, text, dialogTitle: title});
    if (navigator.share) return await navigator.share({title, text});
    await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert');
  } catch (e) { /* abgebrochen */ }
}
