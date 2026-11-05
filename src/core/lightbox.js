/* ═══════════════ BILD-VOLLANSICHT (Zoom, Wischen) ═══════════════ */
import {$} from './util.js';

const LB = {s: 1, x: 0, y: 0, list: [], i: 0, title: ''};
function lbApply() { $('#lbImg').style.transform = `translate(${LB.x}px,${LB.y}px) scale(${LB.s})`; }
function lbReset() { LB.s = 1; LB.x = 0; LB.y = 0; lbApply(); }

/** list: Bild-URLs (oder eine URL), i: Startindex */
export function openLightbox(list, title, i = 0) {
  list = (Array.isArray(list) ? list : [list]).filter(Boolean); if (!list.length) return;
  LB.list = list; LB.title = title || ''; $('#lightbox').classList.add('show'); lbShow(i);
}
export function lbShow(i) {
  const n = LB.list.length; LB.i = (i + n) % n; $('#lbImg').src = LB.list[LB.i]; lbReset();
  $('#lbTitle').textContent = LB.title + (n > 1 ? `  ·  ${LB.i + 1} / ${n}` : '');
  $('#lbPrev').classList.toggle('hidden', n < 2); $('#lbNext').classList.toggle('hidden', n < 2);
  $('#lbDots').innerHTML = n > 1 ? LB.list.map((_, k) => `<i class="${k === LB.i ? 'on' : ''}"></i>`).join('') : '';
  $('#lbHintTxt').textContent = n > 1 ? 'Wischen für nächstes Foto · Doppeltippen zoomt · Tippen schließt' : 'Doppeltippen oder mit zwei Fingern zoomen · Tippen schließt';
}
export function closeLightbox() { $('#lightbox').classList.remove('show'); }
export const lbOpen = () => $('#lightbox').classList.contains('show');
export const lbStep = d => lbShow(LB.i + d);

export function initLightbox() {
  $('#lbPrev').onclick = e => { e.stopPropagation(); lbShow(LB.i - 1); };
  $('#lbNext').onclick = e => { e.stopPropagation(); lbShow(LB.i + 1); };
  ['touchstart', 'touchend'].forEach(ev => { $('#lbPrev').addEventListener(ev, e => e.stopPropagation()); $('#lbNext').addEventListener(ev, e => e.stopPropagation()); });
  $('#lbClose').onclick = closeLightbox;
  const st = $('#lbStage'), im = $('#lbImg'); let t0 = null, lastTap = 0, moved = false;
  // um Punkt (cx, cy) auf neuen Maßstab zoomen
  const zoomAt = (cx, cy, ns) => {
    ns = Math.max(1, Math.min(6, ns)); const r = im.getBoundingClientRect(); const ox = r.left - LB.x, oy = r.top - LB.y;
    const ix = (cx - r.left) / LB.s, iy = (cy - r.top) / LB.s; LB.s = ns; LB.x = cx - ox - ix * ns; LB.y = cy - oy - iy * ns;
    if (ns === 1) { LB.x = 0; LB.y = 0; } lbApply();
  };
  st.addEventListener('touchstart', e => {
    moved = false;
    if (e.touches.length === 2) { const [a, b] = e.touches; t0 = {d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: LB.s, cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2}; }
    else if (e.touches.length === 1) t0 = {px: e.touches[0].clientX, py: e.touches[0].clientY, x: LB.x, y: LB.y};
  }, {passive: true});
  st.addEventListener('touchmove', e => {
    if (!t0) return; moved = true;
    if (e.touches.length === 2 && t0.d) { const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); zoomAt(t0.cx, t0.cy, t0.s * d / t0.d); t0.s = LB.s; t0.d = d; }
    else if (e.touches.length === 1 && LB.s > 1 && t0.px != null) { LB.x = t0.x + e.touches[0].clientX - t0.px; LB.y = t0.y + e.touches[0].clientY - t0.py; lbApply(); }
  }, {passive: true});
  st.addEventListener('touchend', e => {
    if (e.touches.length) return; const wasMove = moved, start = t0; t0 = null;
    if (wasMove) {
      // Wischen zum nächsten/vorigen Foto (nur ungezoomt)
      if (start && start.px != null && LB.s === 1 && LB.list.length > 1) {
        const dx = e.changedTouches[0].clientX - start.px, dy = e.changedTouches[0].clientY - start.py;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbShow(LB.i + (dx < 0 ? 1 : -1));
      }
      return;
    }
    const now = Date.now(); const tp = e.changedTouches[0];
    if (now - lastTap < 300) { zoomAt(tp.clientX, tp.clientY, LB.s > 1 ? 1 : 2.5); lastTap = 0; clearTimeout(st._t); }
    else { lastTap = now; st._t = setTimeout(() => { if (LB.s === 1) closeLightbox(); }, 300); }
  });
  // Maus/PC
  st.addEventListener('dblclick', e => zoomAt(e.clientX, e.clientY, LB.s > 1 ? 1 : 2.5));
  st.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, LB.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, {passive: false});
  st.addEventListener('click', e => { if (e.pointerType === 'mouse' && e.target === st && LB.s === 1) closeLightbox(); });
}
