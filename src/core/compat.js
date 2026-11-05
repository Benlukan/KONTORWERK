/* Ältere Android-WebViews (z. B. Android 7 mit alter WebView, ab Chrome 55):
 * fehlende Funktionen nachrüsten. Muss als Erstes geladen werden (siehe main.js). */
if (typeof globalThis === 'undefined') window.globalThis = window; // für jsPDF/fast-png (vor Chrome 71)
if (!Object.fromEntries) Object.fromEntries = it => { const o = {}; for (const [k, v] of it) o[k] = v; return o; };
if (!Array.prototype.flat) Object.defineProperty(Array.prototype, 'flat', {configurable: true, writable: true, value(d = 1) { return d < 1 ? this.slice() : this.reduce((a, x) => a.concat(Array.isArray(x) ? x.flat(d - 1) : x), []); }});
if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, 'flatMap', {configurable: true, writable: true, value(fn, t) { return this.map(fn, t).flat(); }});
if (!String.prototype.padStart) String.prototype.padStart = function (n, c) { let s = String(this); c = c === undefined ? ' ' : String(c); while (s.length < n) s = c + s; return s.length > n && c.length > 1 ? s.slice(s.length - n) : s; };
if (!String.prototype.padEnd) String.prototype.padEnd = function (n, c) { let s = String(this); c = c === undefined ? ' ' : String(c); while (s.length < n) s += c; return s.slice(0, Math.max(n, String(this).length)); };
/** matchMedia-Änderungen: alte WebViews kennen nur addListener */
window.kwOnMedia = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); };
if (typeof window.structuredClone !== 'function') window.structuredClone = v => JSON.parse(JSON.stringify(v));
