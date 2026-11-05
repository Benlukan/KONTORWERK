/* ═══════════════ EINSTELLUNGEN ═══════════════ */
import {$, $$, esc} from '../../core/util.js';
import {K, saveSettings} from '../../core/db.js';
import {toast, openModal, closeModal, confirmBox} from '../../core/ui.js';
import {applyTheme, refreshApp, startView} from '../../core/shell.js';
import {modules, isActive, toggleBlocker, setActive} from '../../core/modules.js';
import {exportBackup, parseBackup, restoreBackup, wipeAll} from '../../core/backup.js';
import {changelogHtml} from '../../core/changelog.js';
import {TOOL_CONFIG} from '../../core/config.js';
import {moduleIcon} from '../../core/brand.js';
import {cfg, connected, connect, disconnect, syncNow, status, requestFullSync} from '../../core/sync.js';
import {fmtDT, IS_NATIVE} from '../../core/util.js';

export const html = `
    <div class="section-title" style="margin-top:4px">🏢 Firma</div>
    <div class="card">
      <div class="row"><div class="field"><label>Firmen- / Shop-Name</label><input class="input" id="setShop" placeholder="z. B. LichtManufaktur"></div>
      <div class="field"><label>Inhaber</label><input class="input" id="setOwner" placeholder="Vor- und Nachname"></div></div>
      <div class="field"><label>Adresse (Bon- und Rechnungskopf)</label><textarea class="input" id="setAddr" rows="2" placeholder="Straße, PLZ Ort"></textarea></div>
      <div class="row"><div class="field"><label>E-Mail</label><input class="input" id="setMail" type="email"></div>
      <div class="field"><label>Telefon</label><input class="input" id="setPhone" type="tel"></div></div>
      <div class="row"><div class="field"><label>Steuernummer</label><input class="input" id="setTaxNo" placeholder="für Rechnungen (später)"></div>
      <div class="field"><label>Bon-Fußzeile</label><input class="input" id="setFoot" placeholder="Vielen Dank für Ihren Einkauf!"></div></div>
    </div>
    <div class="section-title">💶 Steuer & Verkauf</div>
    <div class="card" style="padding:4px 16px">
      <div class="switch"><div><b>Kleinunternehmer (§ 19 UStG)</b><small>Keine Umsatzsteuer, Hinweis auf Bon; Grenzen-Wächter in der Übersicht</small></div><label class="toggle"><input type="checkbox" id="setKlein"><span></span></label></div>
      <div class="switch" id="taxRateRow"><div><b>Standard-Steuersatz</b><small>für neue Produkte</small></div><select class="input" id="setTax" style="width:110px"><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option></select></div>
      <div class="switch"><div><b>Verkauf ohne Bestand erlauben</b><small>Bestand darf negativ werden</small></div><label class="toggle"><input type="checkbox" id="setNeg"><span></span></label></div>
      <div class="switch"><div><b>Mindestbestand (Standard)</b><small>Warnung ab diesem Bestand</small></div><input class="input" id="setMin" type="number" min="0" style="width:90px" inputmode="numeric"></div>
      <div class="switch"><div><b>Vibration</b><small>Kurzes Feedback beim Hinzufügen</small></div><label class="toggle"><input type="checkbox" id="setHaptic"><span></span></label></div>
    </div>
    <div class="section-title">🔌 Module <span class="muted">einzeln ein- und ausschaltbar</span></div>
    <div class="card" style="padding:4px 16px" id="modList"></div>
    <div class="section-title">🔄 Geräte-Abgleich <span class="muted">PC und Handy mit denselben Daten</span></div>
    <div class="card" id="syncBox"></div>
    <div class="section-title">🎨 Design</div>
    <div class="segment" id="themeSeg"><button data-t="auto">Automatisch</button><button data-t="light">☀️ Hell</button><button data-t="dark">🌙 Dunkel</button></div>
    <div class="section-title">💾 Daten</div>
    <div class="list" id="dataList"></div>
    <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    <div class="section-title">ℹ️ Info</div>
    <div class="info-box"><b>Hinweis zur Kassenführung:</b> KONTORWERK ist ein Werkzeug für Warenwirtschaft und Betriebsverwaltung und kein zertifiziertes Kassensystem. Es besitzt keine technische Sicherheitseinrichtung (TSE) nach Kassensicherungsverordnung. Ob und wie du es für deine Aufzeichnungspflichten einsetzen darfst, klärst du am besten mit deiner Steuerberatung.</div>
    <div class="list" style="margin-top:12px">
      <button class="li" id="privacyBtn"><div class="li-thumb">🔒</div><div class="li-main"><div class="li-title">Datenschutz</div><div class="li-sub">Daten auf dem Gerät und auf deinem Server</div></div></button>
      <button class="li" id="changelogBtn"><div class="li-thumb">📝</div><div class="li-main"><div class="li-title">Was ist neu?</div><div class="li-sub" id="verSub"></div></div></button>
    </div>
    <div class="footer"><b>KONTORWERK</b> · Das ERP für Selbstständige — david.digital <span class="fv" id="footerVersion"></span></div>`;

function renderModules() {
  $('#modList').innerHTML = modules().filter(m => !m.hidden).map(m => {
    const on = isActive(m.id), blk = toggleBlocker(m.id);
    const req = m.requires.length ? ' · braucht ' + m.requires.map(r => modules().find(x => x.id === r).name).join(', ') : '';
    return `<div class="mod-row ${m.planned ? 'planned' : ''}"><div class="mi ${moduleIcon(m.id) ? 'svg' : ''}">${moduleIcon(m.id, 40) || m.icon}</div>
      <div class="mm"><b>${esc(m.name)} ${m.planned ? `<span class="badge gray">Phase ${m.planned}</span>` : m.core ? '<span class="badge">Kern</span>' : ''}</b><small>${esc(m.desc)}${esc(req)}</small>${blk && !m.core && !m.planned ? `<small style="color:var(--warn)">${esc(blk)}</small>` : ''}</div>
      <label class="toggle"><input type="checkbox" data-mod="${m.id}" ${on ? 'checked' : ''} ${blk ? 'disabled' : ''}><span></span></label></div>`;
  }).join('');
  $$('#modList [data-mod]').forEach(c => c.onchange = () => {
    if (!setActive(c.dataset.mod, c.checked)) { c.checked = !c.checked; return; }
    toast(c.checked ? 'Modul eingeschaltet' : 'Modul ausgeschaltet – die Daten bleiben erhalten');
    refreshApp('einstellungen');
  });
}

function renderData() {
  const extra = modules().filter(m => isActive(m.id) && m.dataActions).flatMap(m => m.dataActions);
  const rows = [
    {id: 'exportBtn', icon: '📤', title: 'Backup exportieren', sub: 'Alle Daten als JSON-Datei sichern'},
    {id: 'importBtn', icon: '📥', title: 'Backup wiederherstellen', sub: 'KONTORWERK- oder WAWIWERK-Backup · ersetzt alle aktuellen Daten'},
    ...extra.map((a, i) => ({id: 'dataAct' + i, ...a})),
    {id: 'wipeBtn', icon: '🗑️', title: 'Alle Daten löschen', sub: 'Nicht rückgängig zu machen', danger: true}
  ];
  $('#dataList').innerHTML = rows.map(r => `<button class="li" id="${r.id}"><div class="li-thumb" ${r.danger ? 'style="background:var(--danger-soft)"' : ''}>${r.icon}</div><div class="li-main"><div class="li-title" ${r.danger ? 'style="color:var(--danger)"' : ''}>${esc(r.title)}</div><div class="li-sub">${esc(r.sub)}</div></div></button>`).join('');
  extra.forEach((a, i) => { $('#dataAct' + i).onclick = a.run; });
  $('#exportBtn').onclick = exportBackup;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#wipeBtn').onclick = async () => {
    if (!await confirmBox('Alle Daten löschen?', `Produkte, Kontakte, Lager und alle Belege werden <b>unwiderruflich</b> gelöscht. Tipp: Vorher ein Backup exportieren.${connected() ? ' Der Geräte-Abgleich wird getrennt; die Daten auf dem Server bleiben erhalten.' : ''}`, 'Alles löschen', true)) return;
    await wipeAll(); toast('Alle Daten gelöscht'); refreshApp(startView());
  };
}

export function renderSync() {
  const box = $('#syncBox'); if (!box) return;
  const c = cfg();
  // Läuft die Web-App auf dem eigenen Server, ist das die Server-Adresse
  const here = !IS_NATIVE && location.protocol === 'https:' && location.hostname !== 'localhost' ? location.origin : '';
  if (!connected()) {
    box.innerHTML = `<p class="muted" style="font-size:.82rem;line-height:1.5;margin-bottom:12px">Verbinde dieses Gerät mit deinem PocketBase-Server. Danach gleichen sich alle verbundenen Geräte automatisch ab – auch offline erfasste Verkäufe, sobald wieder Netz da ist. Einrichtung des Servers: <b>server/ANLEITUNG.md</b> im Repo.</p>
      ${status.state === 'fehler' ? `<div class="alert danger" style="margin:0 0 12px">${esc(status.msg)}</div>` : ''}
      <div class="field"><label>Server-Adresse</label><input class="input" id="syUrl" placeholder="https://kontorwerk.example.de" value="${esc(c && c.url || here)}" autocapitalize="off" autocorrect="off"></div>
      <div class="row"><div class="field"><label>E-Mail</label><input class="input" id="syMail" type="email" value="${esc(c && c.email || '')}" autocapitalize="off"></div>
      <div class="field"><label>Passwort</label><input class="input" id="syPass" type="password"></div></div>
      <button class="btn btn-primary btn-block" id="syConnect">Verbinden</button>
      <div class="muted" style="font-size:.72rem;margin-top:8px">Das Passwort wird nicht gespeichert, nur eine Anmeldung, die sich selbst verlängert. Geräte-ID: ${esc(K.deviceId)}</div>`;
    $('#syConnect').onclick = async () => {
      const b = $('#syConnect'); b.disabled = true; b.textContent = 'Verbinde …';
      try { await connect($('#syUrl').value, $('#syMail').value.trim(), $('#syPass').value); toast(status.state === 'ok' ? 'Verbunden – Daten abgeglichen' : status.msg, status.state !== 'ok'); }
      catch (e) { toast(e.message, true); }
      renderSync();
    };
    return;
  }
  const st = status.state === 'ok' ? `<span class="badge ok">verbunden</span>` : status.state === 'laeuft' ? `<span class="badge">gleicht ab …</span>` : status.state === 'offline' ? `<span class="badge gray">offline</span>` : `<span class="badge out">Fehler</span>`;
  box.innerHTML = `<div class="switch" style="padding-top:0"><div><b>${esc(c.url.replace(/^https?:\/\//, ''))}</b><small>${esc(c.email)}</small></div>${st}</div>
    ${status.msg ? `<div class="alert ${status.state === 'fehler' ? 'danger' : 'warn'}">${esc(status.msg)}</div>` : ''}
    <div class="muted" style="font-size:.78rem;margin:10px 0 12px">Letzter Abgleich: ${c.lastOk ? fmtDT(c.lastOk) : '–'}${status.last ? ` · ${status.last.got} geholt, ${status.last.sent} hochgeladen` : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" id="syNow">🔄 Jetzt abgleichen</button><button class="btn" id="syFull">Vollständig abgleichen</button><button class="btn btn-danger" id="syOff">Trennen</button></div>`;
  $('#syNow').onclick = () => syncNow();
  $('#syFull').onclick = () => { requestFullSync(); syncNow(); };
  $('#syOff').onclick = async () => {
    if (!await confirmBox('Abgleich trennen?', 'Dieses Gerät gleicht sich danach nicht mehr ab. Die Daten auf dem Gerät und auf dem Server bleiben erhalten.', 'Trennen', true)) return;
    disconnect(); renderSync();
  };
}

export function renderEinstellungen() {
  const s = K.settings;
  $('#setShop').value = s.shopName; $('#setOwner').value = s.ownerName; $('#setAddr').value = s.address;
  $('#setMail').value = s.email; $('#setPhone').value = s.phone; $('#setTaxNo').value = s.taxNo; $('#setFoot').value = s.footer;
  $('#setKlein').checked = s.klein; $('#setTax').value = s.taxDefault; $('#taxRateRow').classList.toggle('hidden', s.klein);
  $('#setNeg').checked = s.allowNegative; $('#setMin').value = s.minDefault; $('#setHaptic').checked = s.haptic;
  $('#footerVersion').textContent = `v${TOOL_CONFIG.version} · Build ${TOOL_CONFIG.build}`;
  const wv = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1];
  $('#verSub').textContent = `Version ${TOOL_CONFIG.version} (Build ${TOOL_CONFIG.build})${wv ? ' · WebView ' + wv : ''}`;
  renderSync(); renderModules(); renderData(); applyTheme();
}

export function initEinstellungen() {
  const bind = (sel, key, fn, ev = 'change') => $(sel).addEventListener(ev, e => {
    K.settings[key] = fn(e.target); saveSettings();
    if (key === 'klein') renderEinstellungen();
    if (key === 'shopName') $('#shopNameTop').textContent = $('#shopNameSide').textContent = K.settings.shopName || 'david.digital';
  });
  bind('#setShop', 'shopName', t => t.value.trim(), 'input');
  bind('#setOwner', 'ownerName', t => t.value.trim(), 'input');
  bind('#setAddr', 'address', t => t.value.trim(), 'input');
  bind('#setMail', 'email', t => t.value.trim(), 'input');
  bind('#setPhone', 'phone', t => t.value.trim(), 'input');
  bind('#setTaxNo', 'taxNo', t => t.value.trim(), 'input');
  bind('#setFoot', 'footer', t => t.value.trim(), 'input');
  bind('#setKlein', 'klein', t => t.checked);
  bind('#setTax', 'taxDefault', t => +t.value);
  bind('#setNeg', 'allowNegative', t => t.checked);
  bind('#setMin', 'minDefault', t => Math.max(0, parseInt(t.value, 10) || 0));
  bind('#setHaptic', 'haptic', t => t.checked);
  $$('#themeSeg button').forEach(b => b.onclick = () => { K.settings.theme = b.dataset.t; applyTheme(); saveSettings(); });
  $('#importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = async () => {
      try {
        const b = parseBackup(fr.result), n = b.summary;
        const what = `${n.products} Produkte, ${n.categories} Kategorien, ${n.sales} Belege${n.contacts ? `, ${n.contacts} Kontakte` : ''}`;
        if (!await confirmBox('Backup wiederherstellen?', `${b.kind}-Backup: ${what} werden geladen. <b>Alle aktuellen Daten werden ersetzt.</b>${connected() ? ' Danach wird mit dem Server zusammengeführt – neuere Daten vom Server bleiben erhalten.' : ''}`, 'Wiederherstellen', true)) return;
        await restoreBackup(b); toast('Backup wiederhergestellt'); refreshApp('einstellungen');
      } catch (err) { toast('Datei ungültig: ' + err.message, true); }
      e.target.value = '';
    };
    fr.readAsText(f);
  };
  $('#privacyBtn').onclick = () => { openModal('Datenschutz', `<div style="font-size:.85rem;line-height:1.6;display:flex;flex-direction:column;gap:12px">
    <div><b style="color:var(--primary)">1. Verantwortlicher</b><p class="muted">Diese App läuft vollständig lokal auf deinem Gerät. Anbieter: <b style="color:var(--text)">david.digital</b>.</p></div>
    <div><b style="color:var(--primary)">2. Gespeicherte Daten</b><p class="muted">Produkte, Lager, Belege, Kontakte und Einstellungen werden ausschließlich im lokalen Speicher der App (IndexedDB) abgelegt. Es gibt kein Tracking und keine Werbung.</p></div>
    <div><b style="color:var(--primary)">2a. Geräte-Abgleich</b><p class="muted">Nur wenn du ihn einrichtest: Dann werden die Daten zusätzlich auf deinem eigenen PocketBase-Server gespeichert, den du selbst betreibst. david.digital hat keinen Zugriff darauf.</p></div>
    <div><b style="color:var(--primary)">3. Kontakte</b><p class="muted">Wenn du Kunden oder Lieferanten anlegst, speicherst du personenbezogene Daten. Du bist dafür verantwortlich, sie nur für deine Geschäftszwecke zu nutzen und auf Wunsch zu löschen.</p></div>
    <div><b style="color:var(--primary)">4. Weitergabe</b><p class="muted">Daten verlassen das Gerät nur, wenn du selbst einen Export, ein Backup oder einen Bon teilst.</p></div>
    <div><b style="color:var(--primary)">5. Löschen</b><p class="muted">Unter „Einstellungen → Alle Daten löschen“ oder durch Deinstallation der App werden alle Daten entfernt.</p></div></div>`,
    `<button class="btn btn-primary" id="privOk">✓ Verstanden</button>`);
    $('#privOk').onclick = closeModal;
  };
  $('#changelogBtn').onclick = () => openModal('Was ist neu?', changelogHtml());
}
