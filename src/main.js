/* ═══════════════ KONTORWERK – Start ═══════════════ */
import './styles.css';
import './shell.css';
import {$, IS_NATIVE, P} from './core/util.js';
import {openDb, flush, onWriteError} from './core/db.js';
import {initUi, toast, modalOpen, closeModal} from './core/ui.js';
import {initLightbox, lbOpen, closeLightbox, lbStep} from './core/lightbox.js';
import {initShell, mountModules, applyTheme, buildNav, go, ui, startView} from './core/shell.js';
import {modules, mod} from './core/modules.js';
import {migrateIfNeeded} from './core/migrate.js';
// Reihenfolge = Reihenfolge in der Seitenleiste
import './modules/kern/index.js';
import './modules/wawi/index.js';
import './modules/geplant.js';
import {registerSystem} from './modules/kern/index.js';
registerSystem();

// Für onclick-Attribute in Vorlagen
window.KW = {
  go,
  editProduct: (...a) => mod('wawi').api.editProduct(...a),
  editCategory: (...a) => mod('wawi').api.editCategory(...a),
  loadDemo: () => mod('wawi').api.loadDemo(),
  closeModal
};

onWriteError(() => toast('Speichern fehlgeschlagen – Speicher voll?', true));

function back() {
  if (lbOpen()) return closeLightbox();
  if (modalOpen()) return closeModal();
  for (const m of modules()) if (m.onBack && m.onBack()) return;
  const home = startView();
  if (ui.view !== home) return go(home);
  if (P.App) P.App.exitApp();
}

(async function init() {
  await openDb();
  const mig = await migrateIfNeeded();
  initUi(); initLightbox(); initShell();
  mountModules();
  applyTheme(); buildNav(); go(startView());
  if (mig) toast(`WAWIWERK-Daten übernommen: ${mig.products} Produkte, ${mig.sales} Verkäufe`);

  $('#overlay').onclick = () => { if (modalOpen()) closeModal(); else modules().forEach(m => m.onOverlay && m.onOverlay()); };
  document.addEventListener('keydown', e => {
    if (lbOpen() && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return lbStep(e.key === 'ArrowRight' ? 1 : -1);
    if (e.key === 'Escape') { if (lbOpen()) closeLightbox(); else if (modalOpen()) closeModal(); else modules().forEach(m => m.onOverlay && m.onOverlay()); }
  });
  let wasDesktop = matchMedia('(min-width:1024px)').matches;
  matchMedia('(min-width:1024px)').addEventListener('change', e => { if (e.matches !== wasDesktop) { wasDesktop = e.matches; buildNav(); } });
  if (IS_NATIVE && P.App) {
    P.App.addListener('backButton', back);
    P.App.addListener('pause', () => flush());
  }
  if ('serviceWorker' in navigator && !IS_NATIVE && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
