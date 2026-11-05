/* ═══════════════ OBERFLÄCHE: Toast, Vibration, Dialoge ═══════════════ */
import {$, P} from './util.js';
import {K} from './db.js';

export function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 2300);
}

export function haptic() {
  if (!K.settings.haptic) return;
  try { if (P.Haptics) P.Haptics.impact({style: 'LIGHT'}); else if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* egal */ }
}

const sheetOpen = () => !!document.querySelector('.cart.open');
let modalOnClose = null;
export function openModal(title, body, foot, onClose) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = body; $('#mFoot').innerHTML = foot || '';
  $('#mFoot').classList.toggle('hidden', !foot);
  $('#modal').classList.add('show'); $('#overlay').classList.add('show');
  $('#mBody').scrollTop = 0; modalOnClose = onClose || null;
}
export function closeModal() {
  $('#modal').classList.remove('show', 'wide');
  if (!sheetOpen()) $('#overlay').classList.remove('show');
  const f = modalOnClose; modalOnClose = null; if (f) f();
}
/** Breiter Dialog (z. B. Dokument-Editor am PC) */
export const wideModal = () => $('#modal').classList.add('wide');
export const modalOpen = () => $('#modal').classList.contains('show');

export function confirmBox(title, text, okLabel, danger) {
  return new Promise(res => {
    let done = false;
    openModal(title, `<p style="font-size:.92rem;line-height:1.5">${text}</p>`,
      `<button class="btn" id="cfNo">Abbrechen</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cfOk">${okLabel || 'OK'}</button>`,
      () => { if (!done) res(false); });
    $('#cfNo').onclick = () => { done = true; closeModal(); res(false); };
    $('#cfOk').onclick = () => { done = true; closeModal(); res(true); };
  });
}

export function initUi() {
  $('#mClose').onclick = closeModal;
}
