/* „Was ist neu?“ – in der App angezeigt (ausführlich: CHANGELOG.md) */
export const CHANGELOG = [
  ['2.0.0', 7, '05.11.2026', [
    'Neuer Name: <b>KONTORWERK</b> – aus WAWIWERK wird ein modulares System für den ganzen Betrieb',
    'Module lassen sich unter „Einstellungen → Module“ einzeln ein- und ausschalten',
    'Neu: Übersicht mit Kleinunternehmer-Wächter (Grenzen 25.000 € / 100.000 €)',
    'Neu: Kontakte für Kunden und Lieferanten',
    'Neu: Firmendaten (Inhaber, Adresse, E-Mail, Telefon, Steuernummer)',
    'PC: Seitenleiste statt unterer Leiste, Seitentitel oben',
    'Alle WAWIWERK-Daten werden beim ersten Start automatisch übernommen; alte Backups lassen sich weiter einspielen',
    'Daten liegen jetzt in einzelnen Tabellen – Grundlage für den Abgleich zwischen PC und Handy'
  ]],
  ['1.2.0', 6, '05.11.2026', ['Bis zu 8 Fotos pro Produkt, mehrere auf einmal auswählbar', 'Titelbild per ★ festlegen, einzelne Fotos entfernen', 'Großansicht: zwischen den Fotos wischen (oder ‹ ›), Zähler und Punkte']],
  ['1.1.0', 5, '04.11.2026', ['Neuer Name: WAWIWERK (vorher KASSENWERK)', 'Neues App-Icon, Reiter „Kasse“ heißt jetzt „Verkauf“']],
  ['1.0.3', 4, '04.11.2026', ['Produktfotos in Vollbild mit Zoom', 'Neue Fotos zusätzlich in hoher Auflösung']],
  ['1.0.2', 3, '02.11.2026', ['Android: Status- und Navigationsleiste in App-Farbe']],
  ['1.0.1', 2, '02.11.2026', ['Handy-Hochformat repariert, kompaktere Kacheln, Querformat mit Warenkorb daneben']],
  ['1.0.0', 1, '02.11.2026', ['Erste Version: Kasse, Warenkorb, Bon, Storno, Produkte, Lager, Berichte, Tagesabschluss, Backup']]
];

export const changelogHtml = () => `<div style="font-size:.86rem;line-height:1.6">${CHANGELOG.map(([v, b, d, items]) =>
  `<b>v${v} · Build ${b}</b> <span class="muted">– ${d}</span><ul style="padding-left:18px;margin:6px 0 12px" class="muted">${items.map(i => `<li>${i}</li>`).join('')}</ul>`).join('')}</div>`;
