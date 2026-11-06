/* „Was ist neu?“ – in der App angezeigt (ausführlich: CHANGELOG.md) */
export const CHANGELOG = [
  ['2.4.0', 14, '05.11.2026', [
    'Neues Modul <b>Buchhaltung (EÜR)</b>: Kassenbons, bezahlte Rechnungen und Belege werden automatisch gebucht',
    'Eigene Buchungen für Einnahmen, Ausgaben, Privatentnahmen und Einlagen; Kontostände für Kasse, Bank und PayPal',
    'Monat festschreiben: danach nur noch Korrekturbuchungen, wie es das Finanzamt verlangt',
    '<b>Bankabgleich</b>: Kontoauszug als CSV einlesen, Zahlungen mit Vorschlag den offenen Rechnungen oder Belegen zuordnen',
    '<b>EÜR-Übersicht</b> mit Gewinn je Monat und Kategorie',
    '<b>Export für die Steuerberatung</b>: DATEV-Buchungsstapel (SKR03) oder Paket als ZIP mit Belegen und Rechnungen',
    'Neues Modul <b>Unternehmerlohn</b>: zeigt, wie viel du dir nach Steuerrücklage entnehmen kannst, und bucht die Entnahme'
  ]],
  ['2.3.0', 13, '05.11.2026', [
    'Neues Modul <b>Dokumente</b>: Rechnung, Angebot, Lieferschein und Gutschrift als PDF',
    'Fortlaufende Nummern (z. B. RE-2026-0001), auch über mehrere Geräte',
    'Abgeschlossene Dokumente sind unveränderbar; Korrektur per Storno mit Gutschrift',
    'Angebot oder Lieferschein mit einem Tipp in eine Rechnung umwandeln',
    'Bestand wird beim Abschließen auf Wunsch abgebucht, beim Storno zurückgebucht',
    'Offene und überfällige Rechnungen in der Übersicht; Rechnungen zählen zum Kleinunternehmer-Wächter',
    'Neues <b>Belegarchiv</b>: Quittungen fotografieren oder PDFs ablegen, mit Betrag, Lieferant, Kategorie und Suche',
    'Einstellungen: Firmenlogo, Bankverbindung, Zahlungsziel, Nummern-Präfixe und Standardtexte',
    'Belege und Fotos gleichen sich zwischen den Geräten ab und sind im Backup enthalten'
  ]],
  ['2.2.2', 12, '05.11.2026', ['Ältere Tablets: Kacheln, Karten und Warenkorb stehen wieder nebeneinander statt untereinander', 'Symbole, die ältere Geräte nicht kennen, durch passende ersetzt', 'Einstellungen → „Was ist neu?“ zeigt die WebView-Version des Geräts']],
  ['2.2.1', 11, '05.11.2026', ['Behoben: Auf älteren Tablets (z. B. Android 7.1.1) blieb die App leer', 'Startet jetzt auch mit älteren WebViews ab Chrome 57', 'Startet die App trotzdem nicht, erscheint ein Hinweis mit der WebView-Version des Geräts']],
  ['2.2.0', 10, '05.11.2026', ['Neues Logo und App-Icon: das Kontor-Haus mit den Modul-Kacheln', 'Neues Startbild (hell und dunkel) mit „Das ERP für Selbstständige“', 'Eigene farbige Symbole für jedes Modul (Einstellungen, Übersicht, Seitenleiste)']],
  ['2.1.1', 9, '05.11.2026', ['Läuft jetzt auch auf älteren Tablets und Handys ab Android 7 (ältere eingebaute WebView)']],
  ['2.1.0', 8, '05.11.2026', [
    'Neu: <b>Geräte-Abgleich</b> – Handy und PC arbeiten mit denselben Daten über deinen eigenen PocketBase-Server',
    'Funktioniert offline weiter: Änderungen werden abgeglichen, sobald wieder Netz da ist',
    'Anzeige oben rechts: ✅ abgeglichen, 📴 offline, ⚠️ Problem – Tippen gleicht sofort ab',
    'Bonnummern laufen über alle Geräte fortlaufend weiter',
    'Server-Einrichtung mit einem Skript (Anleitung im Repo unter server/)'
  ]],
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
