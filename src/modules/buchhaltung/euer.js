/* ═══════════════ EÜR: Einnahmen-Überschuss-Rechnung je Jahr + Export ═══════════════ */
import {$, $$, esc, eur} from '../../core/util.js';
import {T, K, flush} from '../../core/db.js';
import {toast} from '../../core/ui.js';
import {downloadBinary} from '../../core/files.js';
import {KAT, KAT_EIN, KAT_AUS, euer, syncBuchungen, sachkonto, monate, pm, monatsEnde} from './shared.js';

export const html = `
    <div class="chips" id="euYears"></div>
    <div class="stats-grid" id="euStats"></div>
    <div class="section-title">📈 Ergebnis je Monat</div>
    <div class="card"><div class="cols" id="euCols" style="height:150px"></div></div>
    <div class="grid2">
      <div><div class="section-title">⬆️ Betriebseinnahmen</div><div class="list" id="euEin"></div></div>
      <div><div class="section-title">⬇️ Betriebsausgaben</div><div class="list" id="euAus"></div></div>
    </div>
    <div class="section-title">📤 Für die Steuerberatung</div>
    <div class="card">
      <div class="row"><div class="field"><label>Zeitraum</label><select class="input" id="euZeit"></select></div></div>
      <div id="euWarn"></div>
      <div class="doc-actions"><button class="btn btn-primary" id="euZip">📦 Paket (ZIP): DATEV + Belege + Rechnungen</button><button class="btn" id="euExtf">DATEV-Buchungsstapel (CSV)</button></div>
      <p class="muted" style="font-size:.75rem;line-height:1.5;margin-top:10px">Der Buchungsstapel nutzt SKR03-Konten als Vorschlag (Einstellungen → Buchhaltung). Bitte den ersten Export mit der Steuerberatung abstimmen. Die Anlage EÜR erstellt die Steuerberatung aus diesen Daten.</p>
    </div>`;

const st = {year: new Date().getFullYear()};

export function renderEuer() {
  if (syncBuchungen()) flush();
  const years = [...new Set([new Date().getFullYear(), ...T.buchung.map(b => +(b.datum || '').slice(0, 4)).filter(Boolean)])].sort((a, b) => b - a);
  $('#euYears').innerHTML = years.map(y => `<button class="chip ${st.year === y ? 'active' : ''}" data-y="${y}">${y}</button>`).join('');
  $$('#euYears .chip').forEach(b => b.onclick = () => { st.year = +b.dataset.y; renderEuer(); });
  const y = st.year, r = euer(`${y}-01-01`, `${y}-12-31`);
  $('#euStats').innerHTML = `
    <div class="stat-card" style="--sc:var(--ok)"><div class="sc-label">Einnahmen ${y}</div><div class="sc-value">${eur(r.einSum)}</div><div class="sc-sub">Betriebseinnahmen</div></div>
    <div class="stat-card" style="--sc:var(--danger)"><div class="sc-label">Ausgaben ${y}</div><div class="sc-value">${eur(r.ausSum)}</div><div class="sc-sub">Betriebsausgaben</div></div>
    <div class="stat-card" style="--sc:${r.gewinn >= 0 ? 'var(--primary)' : 'var(--danger)'}"><div class="sc-label">${r.gewinn >= 0 ? 'Gewinn' : 'Verlust'}</div><div class="sc-value">${eur(r.gewinn)}</div><div class="sc-sub">Einnahmen − Ausgaben</div></div>
    <div class="stat-card" style="--sc:var(--indigo)"><div class="sc-label">Privat</div><div class="sc-value">${eur(r.entnahmen - r.einlagen)}</div><div class="sc-sub">Entnahmen ${eur(r.entnahmen)} · Einlagen ${eur(r.einlagen)}</div></div>`;
  const ms = monate.map((_, i) => euer(pm(y, i + 1) + '-01', monatsEnde(y, i + 1)).gewinn), max = Math.max(1, ...ms.map(Math.abs));
  $('#euCols').innerHTML = ms.map((g, i) => `<div class="col" title="${monate[i]}: ${eur(g)}"><div class="col-bar" style="height:${Math.abs(g) / max * 100}%;${g < 0 ? 'background:var(--danger)' : ''}"></div><small>${monate[i].slice(0, 3)}</small></div>`).join('');
  const rows = (keys, obj, sum, label) => {
    const items = keys.filter(k => obj[k]);
    return (items.length ? items.map(k => `<div class="li" style="cursor:default"><div class="li-main"><div class="li-title">${esc(KAT[k].name)}</div><div class="li-sub">Konto ${esc(sachkonto(k))}</div></div><div class="li-end"><b class="num">${eur(obj[k])}</b></div></div>`).join('')
      : `<div class="li muted" style="cursor:default;font-size:.85rem">Keine ${label}</div>`) + `<div class="li" style="cursor:default;background:var(--card2)"><div class="li-main"><div class="li-title">Summe</div></div><div class="li-end"><b class="num">${eur(sum)}</b></div></div>`;
  };
  $('#euEin').innerHTML = rows(KAT_EIN, r.ein, r.einSum, 'Einnahmen');
  $('#euAus').innerHTML = rows(KAT_AUS, r.aus, r.ausSum, 'Ausgaben');
  // Zeitraum für den Export
  const opts = [[`${y}-01-01|${y}-12-31`, `Ganzes Jahr ${y}`], ...[1, 2, 3, 4].map(qu => [`${pm(y, qu * 3 - 2)}-01|${monatsEnde(y, qu * 3)}`, `${qu}. Quartal ${y}`]), ...monate.map((m, i) => [`${pm(y, i + 1)}-01|${monatsEnde(y, i + 1)}`, `${m} ${y}`])];
  const cur = $('#euZeit').value;
  $('#euZeit').innerHTML = opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');
  const dv = K.settings.datev, warn = [];
  if (!dv.berater || !dv.mandant) warn.push('Berater- und Mandantennummer fehlen (Einstellungen → Buchhaltung). Die bekommst du von deiner Steuerberatung.');
  if (T.bankumsatz.some(b => b.status === 'offen' && b.datum.startsWith(String(y)))) warn.push(`Im Bankabgleich gibt es noch offene Umsätze aus ${y}.`);
  $('#euWarn').innerHTML = warn.map(w => `<div class="alert warn" style="margin:0 0 10px">${w}</div>`).join('');
}

async function exp(zip) {
  const [von, bis] = $('#euZeit').value.split('|');
  try {
    const m = await import('./datev.js');
    if (zip) {
      toast('Paket wird erstellt …');
      const blob = await m.steuerPaket(von, bis, s => toast(s));
      await downloadBinary(`KONTORWERK_Steuerberatung_${von}_bis_${bis}.zip`, blob, 'application/zip');
    } else {
      await downloadBinary(`EXTF_Buchungsstapel_${von}_bis_${bis}.csv`, new Blob([m.cp1252(m.extfCsv(von, bis))], {type: 'text/csv'}), 'text/csv');
    }
  } catch (e) { toast('Export fehlgeschlagen: ' + (e.message || e), true); }
}

export function initEuer() {
  $('#euZip').onclick = () => exp(true);
  $('#euExtf').onclick = () => exp(false);
}
