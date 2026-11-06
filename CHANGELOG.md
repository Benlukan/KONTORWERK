# Changelog

## v2.5.4 (Build 19) – 06.11.2026
- **Behoben:** Auf älteren WebViews wurde das Logo in der Seitenleiste abgeschnitten, sobald die Leiste mit vielen Modulen scrollbar war. Die alte WebView staucht die Einträge einer scrollbaren Flex-Leiste, statt zu scrollen. Jetzt gilt `.sidebar>*{flex-shrink:0}`.
- `--safe-t`/`--safe-b` mit Rückfall für WebViews ohne `env()`/`max()`: Dort war jedes Padding mit diesen Variablen ungültig und fiel auf 0. Jetzt wird erst Capacitors `--safe-area-inset-*` verwendet, `env()`/`max()` nur über `@supports`.

## v2.5.3 (Build 18) – 06.11.2026
- **Behoben:** Auf Android 10 und älter (z. B. Tablet mit Android 7.1.1) lag der Inhalt unter der Statusleiste; Logo und Name oben in der Seitenleiste waren abgeschnitten. Capacitor 8 behandelt die Systemleisten über einen eigenen Inset-Listener, der den Inhalt dort nicht zuverlässig verschiebt. Auf diesen Versionen gilt jetzt wieder das klassische Android-Verhalten (`setDecorFitsSystemWindows(true)`, eigener Listener entfernt): Die App beginnt unter der Statusleiste, die Statusleiste bekommt die App-Farbe. Die Navigationsleiste wird erst ab Android 8 hell eingefärbt, weil es davor keine dunklen Symbole gibt. Ab Android 11 unverändert.

## v2.5.2 (Build 17) – 06.11.2026
- **Behoben:** Auf älteren Android-WebViews (z. B. Tablet mit Android 7.1.1) waren die Produktfotos in den Verkaufskacheln unsichtbar. Ältere WebViews ziehen den Inhalt einer `<button>`-Kachel nicht auf volle Breite; der Fotobereich ohne Text war dadurch 0 px breit. Fotobereich und Textbereich haben jetzt ausdrücklich volle Breite. Damit sitzt auch die Bestandsanzeige wieder oben rechts.

## v2.5.1 (Build 16) – 06.11.2026
- **Behoben:** Auf älteren Android-Geräten (z. B. Tablet mit Android 7.1.1) ließ sich ein Backup vom Handy nicht auswählen. Der Dateifilter `application/json` wird an den Android-Auswahldialog weitergegeben; ältere Android-Versionen kennen den Dateityp von `.json` nicht und grauen die Datei aus. Auf Android wird der Filter für Backups und CSV-Importe (Bankabgleich, Etsy) jetzt beim Öffnen entfernt; geprüft wird stattdessen der Inhalt. Foto- und PDF-Auswahl bleiben gefiltert.
- Backup wiederherstellen
  - Lesefehler werden gemeldet (vorher passierte nichts)
  - Abgeschnittene Datei (unvollständig übertragen) und falsche Datei mit klarer Meldung
  - Bestätigung zeigt Datum und App-Version des Backups; Warnung, wenn es aus einer neueren Version stammt und Tabellen enthält, die das Gerät noch nicht kennt
  - Schlägt das Speichern fehl (z. B. Speicher voll), erscheint eine Fehlermeldung statt „wiederhergestellt“

## v2.5.0 (Build 15) – 06.11.2026
- **Modul E-Commerce (Etsy)** (Phase 4, CSV-Import; die API-Anbindung folgt als 4.1)
  - Mehrere Shops mit Art „Handgemacht / mit Lager“ oder „Digital“ (Einstellungen → E-Commerce); Auswertungen je Shop oder gesamt
  - **Import** der Etsy-Dateien mit automatischer Erkennung: Bestellungen (`EtsySoldOrders`), bestellte Artikel (`EtsySoldOrderItems`), Angebote (`EtsyListingsDownload`), Monatsabrechnung (`etsy_statement`) – englisch oder deutsch, UTF-8 oder Windows-1252, Komma oder Semikolon; mehrere Dateien auf einmal; ids aus Shop + Etsy-Nummer, daher auch über mehrere Geräte keine Doppelten
  - **Bestellungen**: Liste mit Status (offen, versendet, digital erledigt, storniert), Suche, Kennzahlen; Detail mit Lieferanschrift (kopieren), Artikeln, Warenwert, Rabatt, Versand, Steuer und Netto laut Etsy; versendet mit Datum und Sendungsnummer; Lieferschein oder Rechnung aus der Bestellung (ohne erneute Bestandsbuchung); Käufer als Kontakt; Storno
  - **Bestand**: neue, noch nicht versendete Bestellungen buchen den Bestand ab (wählbar: alle / keine); jede Position genau einmal; Storno bucht zurück; Lagerbewegung „Etsy-Bestellung“
  - **Etsy-Artikel**: Katalog aus Angeboten und Bestellungen, automatische Verknüpfung über Artikelnummer oder Namen, sonst von Hand; Produkte aus Angeboten anlegen (einzeln oder alle); Filter „Bestand abweichend“
  - **Etsy-Konto**: Guthaben, Verkäufe, Kosten (mit Anteil an den Verkäufen) und Auszahlungen je Jahr und Monat; Hinweis bei Monaten mit Bestellungen, aber ohne Abrechnung; Einordnung jeder Abrechnungszeile änderbar; Monat entfernen und neu einlesen
- **Buchhaltung**
  - Monatsabrechnung wird automatisch gebucht: Verkäufe und Erstattungen (Umsatzerlöse), Gebühren inkl. USt auf Gebühren (4970), Etsy Ads/Offsite Ads (4600), Versandetiketten (4910), Auszahlungen als Umbuchung Etsy → Bank; vom Käufer gezahlte und von Etsy abgeführte Steuer wird nicht gebucht
  - Neues Geldkonto **Etsy-Guthaben** (SKR03-Vorschlag 1360) mit Kontostand und Anfangsbestand
  - Neue Buchungsart **Umbuchung** zwischen eigenen Konten (zählt nicht zur EÜR), auch von Hand und im Bankabgleich; DATEV-Export als Zielkonto an Herkunftskonto
  - Bankabgleich schlägt passende Umbuchungen (±7 Tage) vor, z. B. die Etsy-Auszahlung
  - EÜR & Export warnt, wenn für Monate mit Etsy-Bestellungen die Monatsabrechnung fehlt
- Übersicht: Kennzahlen „Etsy: zu versenden“ und „Etsy diesen Monat“; Kleinunternehmer-Wächter zählt Etsy-Bestellungen (ohne von Etsy eingezogene Steuer)
- CSV-Helfer zentral in `src/core/csvimport.js` (englische und deutsche Beträge und Daten)
- Web-Version: Cache-Name des Service Workers wieder an die Version gekoppelt (war in v2.4.0 nicht hochgezählt)
- Datenbank-Version 4 (neue Tabellen `bestellung`, `shopposten`, `shopartikel`, Upgrade automatisch, alles wird abgeglichen)

## v2.4.0 (Build 14) – 05.11.2026
- **Modul Buchhaltung (EÜR)** (Phase 3)
  - Zufluss-/Abflussprinzip: gebucht wird am Zahlungstag
  - Automatische Buchungen aus Kassenbons, bezahlten Rechnungen, ausgezahlten Gutschriften/Stornos und Belegen aus dem Archiv (neues Feld „Bezahlt über“); Änderungen an der Quelle werden nachgezogen
  - Eigene Buchungen: Einnahme, Ausgabe, Privatentnahme, Privateinlage mit Kategorie, Zahlungskonto (Kasse/Bank/PayPal), Buchungstext und Belegnummer
  - Kontostände mit Anfangsbestand und Stichtag, Warnung bei negativer Kasse
  - **Monat festschreiben** (GoBD): festgeschriebene Buchungen sind unveränderbar; spätere Änderungen an Bons, Rechnungen oder Belegen erzeugen automatisch Korrekturbuchungen, eigene Buchungen werden per Gegenbuchung korrigiert
- **Bankabgleich**: CSV-Kontoauszüge (Sparkasse, Volksbank, DKB, ING, PayPal u. a.) mit automatischer Spaltenerkennung, Zuordnung von Hand möglich; Windows-1252 und UTF-8; erneuter Import ohne Doppelte
  - Vorschläge: Zahlungseingang ↔ offene Rechnung (Betrag oder Rechnungsnummer, markiert sie als bezahlt), Abbuchung ↔ Beleg im Archiv (Betrag, ±20 Tage)
  - Neue Buchung direkt aus dem Umsatz, Ignorieren (z. B. Umbuchungen), Zuordnung zurücksetzen
- **EÜR & Export**: Einnahmen, Ausgaben, Gewinn und Privat je Jahr, Ergebnis je Monat, Summen je Kategorie mit Sachkonto
  - **DATEV-Buchungsstapel** (EXTF, Format 700, Windows-1252, SKR03) für Jahr, Quartal oder Monat
  - **Paket für die Steuerberatung** (ZIP): Buchungsstapel, Buchungsliste, EÜR-Übersicht, alle Belege und Ausgangsrechnungen als PDF, Liesmich
  - Einstellungen → Buchhaltung: Berater- und Mandantennummer, Beginn des Wirtschaftsjahrs, Anfangsbestände, eigene Sachkonten
- **Modul Unternehmerlohn**: Gewinn bis heute, Steuerrücklage (einstellbar, Standard 30 %), schon entnommen und noch entnehmbar; Wunschlohn pro Monat mit Hinweis; Entnahme/Einlage mit einem Tipp buchen; Monatsübersicht
- Übersicht: Kennzahlen „Gewinn“ und „Noch entnehmbar“
- Rechnungen: „Erledigt“ bei Gutschriften fragt nach Auszahlungsdatum und Zahlart
- Datenbank-Version 3 (neue Tabellen `buchung` und `bankumsatz`, Upgrade automatisch, beides wird abgeglichen)

## v2.3.0 (Build 13) – 05.11.2026
- **Modul Dokumente** (Phase 2): Rechnung, Angebot, Lieferschein, Gutschrift
  - Editor mit Empfänger aus den Kontakten (oder neu, optional als Kontakt speichern), Produkten oder freien Positionen, Leistungs-/Lieferdatum, Zahlungsziel, Gültigkeit, Einleitungs- und Schlusstext, interner Notiz
  - Entwurf → **Abschließen**: fortlaufende Nummer je Art und Jahr (`RE-2026-0001`, höchste bekannte Nummer aller Geräte + 1), Absenderdaten werden eingefroren, Dokument danach unveränderbar (GoBD)
  - Rechnung: bezahlt markieren (Datum, Zahlart), **Storno** erzeugt eine Storno-Gutschrift und bucht den Bestand zurück; Angebot/Lieferschein → Rechnung; Kopie als Entwurf
  - Bestand beim Abschließen von Rechnung/Lieferschein optional abbuchen (keine doppelte Abbuchung bei Lieferschein → Rechnung)
  - **PDF** (jsPDF, A4 nach DIN 5008): Logo, Absender-Rückzeile, Anschrift, Infoblock, Positionstabelle mit Seitenumbruch, § 19-Hinweis bzw. enthaltene USt, Zahlungshinweis mit Verwendungszweck, Fußzeile mit Steuernummer und Bankverbindung, Wasserzeichen „ENTWURF“ für Vorschauen
  - Liste mit Filter nach Art und Status, Suche, Kennzahlen (offen, überfällig, bezahlt); Hinweis-Punkt bei überfälligen Rechnungen
- **Belegarchiv**: Fotos (Kamera) oder PDFs bis 10 MB, Belegdatum, Betrag, Lieferant, Kategorie (EÜR-nah), Titel, Notiz; Filter nach Jahr und Kategorie, Suche, Summen
- Dateien liegen im eigenen IndexedDB-Store `datei` und werden nur bei Bedarf geladen (schont alte Tablets); Datenbank-Version 2 (Upgrade automatisch)
- Geräte-Abgleich überträgt Archiv-Dateien (einmalig je Datei) und Löschungen; Backups enthalten die Dateien
- Übersicht: Kennzahl „Offene Rechnungen“; Kleinunternehmer-Wächter zählt abgeschlossene Rechnungen (ohne Stornos), eigenständige Gutschriften mindern den Umsatz
- Einstellungen → Dokumente: Firmenlogo, Website, Bankverbindung, Zahlungsziel, Nummern-Präfixe, Standardtexte je Dokumentart
- Module können eigene Einstellungen und Kennzahlen für die Übersicht beisteuern
- Alte WebViews: `globalThis` nachgerüstet, Dialogbreite ohne `min()`

## v2.2.2 (Build 12) – 05.11.2026
- **Ältere Tablets** (WebView ohne CSS Grid, vor Chrome 57): Ersatz-Layout mit Flexbox für Produktkacheln, Kennzahlen, Grenzen-Wächter, Warenkorb neben den Produkten, Zahlarten, „Mehr“-Menü und Berichte
- Emojis aus Unicode 10/11 (🧾 🧩 🧑 🧮), die ältere Geräte als leere Kästchen zeigen, durch ältere ersetzt (📃 🔌 👤 🔢)
- Einstellungen: Versionszeile zeigt zusätzlich die WebView-Version

## v2.2.1 (Build 11) – 05.11.2026
- **Behoben:** Auf älteren Tablets (Android 7.1.1 mit alter WebView) blieb die App leer – die WebView führte das als `type="module"` eingebundene Skript nicht aus
- Bundle jetzt als klassisches Skript (IIFE) am Ende von `<body>`, Build-Ziel Chrome 55 (async/await wird übersetzt); `padStart`/`padEnd` und `matchMedia`-Listener für alte WebViews nachgerüstet
- Startprüfung: Startet die App nach 6 Sekunden nicht, erscheint ein Hinweis mit WebView-Version, Fehlermeldung und Abhilfe

## v2.2.0 (Build 10) – 05.11.2026
- **Neues Logo und App-Icon** nach Davids Entwurf: Kontor-Haus über sechs Modul-Kacheln auf Nachtblau – als Vektorgrafik nachgezeichnet (`src/core/brand.js`), daraus Android-Icons (adaptiv + klassisch), Web-Icons und Startbilder
- Startbild hell und dunkel mit Schriftzug und „Das ERP für Selbstständige“
- Modul-Symbole (Warenwirtschaft, Dokumente, Logistik, E-Commerce, Produktion, Buchhaltung, Unternehmerlohn) in Einstellungen, Übersicht, „Mehr“ und Seitenleiste
- `npm run icons` erzeugt alle Icons neu (tools/brand.mjs → tools/render_brand.py → capacitor-assets)

## v2.1.1 (Build 9) – 05.11.2026
- Ältere Geräte ab Android 7.0 (z. B. Tablets mit Android 7.1.1): Code wird für alte WebViews (ab Chrome 61) übersetzt, fehlende Funktionen werden nachgerüstet, Produktkacheln mit fester Bildhöhe, wenn `aspect-ratio` fehlt

## v2.1.0 (Build 8) – 05.11.2026
- **Geräte-Abgleich** über einen eigenen PocketBase-Server: Einstellungen → Geräte-Abgleich → Server-Adresse, E-Mail, Passwort
- Offline-fähig: Änderungen werden nach jeder Änderung (4 s), jede Minute, beim Öffnen und beim Schließen der App abgeglichen
- Erstes Verbinden (und nach Backup-Import) führt einen Vollabgleich durch: alles holen, lokal Neueres hochladen
- Konflikte: jüngere Änderung gewinnt; gelöschte Datensätze werden über Grabsteine an alle Geräte weitergegeben
- Firmendaten, Steuer- und Moduleinstellungen gleichen sich ab, das Design (Hell/Dunkel) bleibt je Gerät
- Bonnummern: höchste bekannte Nummer aller Geräte + 1
- Statusanzeige in der Kopfzeile (✅ / 🔄 / 📴 / ⚠️), Tippen gleicht sofort ab
- „Alle Daten löschen“ trennt den Abgleich (Server-Daten bleiben erhalten)
- Neu im Repo: `server/` mit PocketBase-Schema (`pb_migrations`), Einrichtungs-Skript `install.sh` (PocketBase, HTTPS über Caddy, Web-App für den PC, tägliche Sicherung) und `ANLEITUNG.md` für Oracle Cloud „Always Free“
- Releases enthalten zusätzlich `KONTORWERK-web.zip` (Web-App für den Server)

## v2.0.0 (Build 7) – 05.11.2026
- **Neuer Name: KONTORWERK** – aus WAWIWERK wird ein modulares ERP; WAWIWERK lebt als Modul „Warenwirtschaft & Verkauf“ weiter
- **Module:** Kern (Übersicht, Kontakte, Einstellungen) + Warenwirtschaft & Verkauf; unter „Einstellungen → Module“ einzeln ein- und ausschaltbar, mit Abhängigkeiten
- Geplante Module (Dokumente, Buchhaltung/EÜR, Unternehmerlohn, E-Commerce, Produktion, Versand) sind schon sichtbar und mit ihrer Phase gekennzeichnet
- **Übersicht:** Kleinunternehmer-Wächter für das laufende Jahr (100.000 €) und das Vorjahr (25.000 €) mit Warnungen; Umsätze außerhalb der App (z. B. Etsy) nachtragbar; Kennzahlen Umsatz, Lager, Kontakte
- **Kontakte:** Kunden und Lieferanten mit Adresse, E-Mail, Telefon, Notiz, fortlaufender Nummer (K1001 / L1001), Suche, CSV-Export
- **Firmendaten:** Inhaber, E-Mail, Telefon, Steuernummer
- **PC:** Seitenleiste mit allen Bereichen, Seitentitel oben; Handy: untere Leiste + „Mehr“
- **Daten:** eigene Tabelle je Bereich (Kontakte, Kategorien, Produkte, Lagerbewegungen, Belege, Tagesabschlüsse) mit Abgleich-Feldern – Grundlage für den Geräte-Abgleich in Phase 2
- **Übernahme:** vorhandene WAWIWERK-Daten werden beim ersten Start automatisch übernommen (gleiche App-Kennung, Update ohne Datenverlust); alte WAWIWERK-Backups lassen sich weiter einspielen
- Technik: Vite-Build zu einer einzigen `www/index.html`, Code aufgeteilt in `src/core` und `src/modules`

## v1.2.0 (Build 6) – 05.11.2026
- Bis zu 8 Fotos pro Produkt; mehrere Fotos auf einmal auswählbar
- Erstes Foto ist das Titelbild (Kachel & Liste), ★ macht ein anderes Foto zum Titelbild, ✕ entfernt ein Foto
- Großansicht: zwischen den Fotos wischen oder ‹ › tippen, Zähler „2 / 5“ und Punkte; am PC Pfeiltasten
- Bestehende Produktfotos werden automatisch übernommen

## v1.1.0 (Build 5) – 04.11.2026
- **Neuer Name: WAWIWERK** (vorher KASSENWERK) – kleine Warenwirtschaft für Produkte, Lager & Verkauf
- Neues App-Icon (Warenstapel), Logo „W“, Reiter „Kasse“ → „Verkauf“
- Exporte heißen jetzt `wawiwerk-…`; Daten, App-Kennung und Signatur bleiben gleich – Update ohne Datenverlust, alte Backups weiter importierbar

## v1.0.3 (Build 4) – 04.11.2026
- Produktfotos in Vollbild: Foto in der Produkt-Detailansicht oder in der Produktliste antippen
- Zoom per Doppeltippen oder Zwei-Finger-Geste, Verschieben im gezoomten Bild; Tippen, ✕ oder Zurück-Taste schließt
- Neue Fotos werden zusätzlich in hoher Auflösung (max. 1600 px, ohne Zuschnitt) gespeichert; bestehende Fotos zeigen die vorhandene Auflösung – für volle Schärfe einmal neu wählen

## v1.0.2 (Build 3) – 02.11.2026
- Android: Flächen hinter Status- und Navigationsleiste in App-Farbe (vorher grau), Symbole hell/dunkel passend zum Design – auch bei manuellem Hell/Dunkel-Wechsel
- Kopfzeile als Leiste (gleiche Farbe wie untere Navigation), Safe-Area-Abstände für randlose Darstellung

## v1.0.1 (Build 2) – 02.11.2026
- Handy-Hochformat: Seite war breiter als der Bildschirm (Kategorie-Leiste) – 4. Spalte, Suche und „Mehr“ wurden abgeschnitten; behoben
- Kompaktere Produktkacheln (Bild 4:3, kleinere Schrift), mehr Produkte auf einen Blick
- Querformat: Warenkorb immer daneben, kompaktere Kopf- und Navigationsleiste
- Android: Schriftgröße unabhängig von der System-Schriftgröße (Layout bleibt stabil)

## v1.0.0 (Build 1) – 02.11.2026
- Erste Version
- **Kasse:** Produktkacheln mit Foto/Emoji, Kategorie-Filter, Suche, Artikelnr./Barcode per Enter (auch Hand-Scanner)
- **Warenkorb:** Mengen, Preis/Bezeichnung je Position änderbar, Rabatt in % oder €, freier Betrag
- **Bezahlen:** Bar mit Rückgeld-Rechner und Schnellbeträgen, Karte, Sonstiges (z. B. PayPal)
- **Bon:** digital teilen (WhatsApp, Mail …), im Browser drucken; Kleinunternehmer-Hinweis oder MwSt-Ausweis
- **Storno** mit automatischer Rückbuchung ins Lager
- **Produkte & Kategorien:** Preis, EK/Material, Artikelnr., Einheit, Mindestbestand, Farbe, aktiv/inaktiv, „Bestand führen“ aus für Gutscheine
- **Lager:** Bestand, Warnung bei Mindestbestand, Zugang/Abgang/Inventur, Bewegungsprotokoll, Lagerwert (VK/EK)
- **Berichte:** Umsatz, Verkäufe, Ø Bon, Rohertrag, Zahlarten, Kategorien, Top 10, Umsatzverlauf, CSV-Export
- **Tagesabschluss** mit Kassensturz (Wechselgeld, Entnahmen, Soll/Ist-Differenz)
- Backup/Wiederherstellen (JSON), Produkt-CSV, Demo-Daten, Hell/Dunkel-Modus
- Android: Zurück-Taste schließt Fenster bzw. führt zur Kasse; Daten in IndexedDB, komplett offline
