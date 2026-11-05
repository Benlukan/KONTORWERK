# 🏛️ KONTORWERK

Modulares ERP für Maker und kleine Betriebe – im david.digital-Stil.
Läuft offline als Android-App (Capacitor) und im Browser am PC, aus derselben Codebasis.
Nachfolger von WAWIWERK (vorher KASSENWERK).

Konzept & Phasenplan: [KONTORWERK – ERP-Konzept](https://claude.ai/artifact/2gtw9WY82P91s1xAupyo2W)

## Module

| Modul | Status | braucht |
| --- | --- | --- |
| Kern: Übersicht (Kleinunternehmer-Wächter), Kontakte, Einstellungen | ✅ v2.0 | – |
| Warenwirtschaft & Verkauf: Produkte, Kategorien, Lager, Verkauf mit Bon, Berichte, Tagesabschluss | ✅ v2.0 | Kern |
| Geräte-Abgleich (PocketBase) | ✅ v2.1 | – |
| Dokumente: Rechnung, Angebot, Lieferschein, Belegarchiv | Phase 2 | – |
| Buchhaltung (EÜR, DATEV-Export) | Phase 3 | Dokumente |
| Unternehmerlohn (Privatentnahmen) | Phase 3 | Buchhaltung |
| E-Commerce (Etsy) | Phase 4 | Warenwirtschaft |
| Produktion (Stücklisten, Fertigungsaufträge) | Phase 5 | Warenwirtschaft |
| Logistik & Versand | Phase 5 | Warenwirtschaft |

Module werden unter **Einstellungen → Module** ein- und ausgeschaltet. Ausgeschaltete Module behalten ihre Daten.

## Aufbau

```
index.html            App-Hülle (Seitenleiste, Kopfzeile, Dialoge)
src/main.js           Start, Modul-Reihenfolge, Zurück-Taste
src/core/             Kern: Datenbank, Modul-Registry, Shell, Dialoge, Backup, Übernahme aus WAWIWERK
src/modules/kern/     Übersicht, Kontakte, Einstellungen, „Mehr“
src/modules/wawi/     Warenwirtschaft & Verkauf (Verkauf, Produkte, Lager, Berichte)
src/modules/geplant.js  Geplante Module (Manifest mit Phase und Abhängigkeiten)
server/               PocketBase-Schema, Einrichtungs-Skript, Anleitung (Oracle Cloud)
public/               Schriften, Icons, Manifest, Service Worker
www/                  Build-Ausgabe (nicht im Repo) – eine einzige index.html
```

**Neues Modul:** Ordner unter `src/modules/`, `registerModule({id, name, icon, desc, requires, views, init})` aufrufen und in `src/main.js` importieren. Jede Ansicht bringt ihr HTML und eine `render()`-Funktion mit.

**Daten:** IndexedDB `kontorwerk`, eine Tabelle je Bereich (`kontakt`, `kategorie`, `produkt`, `lagerbewegung`, `beleg`, `tagesabschluss`) plus `meta` (Einstellungen, Geräte-ID). Jeder Datensatz trägt `erstellt`, `geaendert`, `geraet`; Löschen setzt einen Grabstein (`geloescht: true`). Schreiben nur über `put()` / `remove()` aus `src/core/db.js`.

**Geräte-Abgleich:** `src/core/sync.js`. Server-Sammlung `kw_daten` (eine Zeile je Datensatz, id fest aus Tabelle + Datensatz-id). Holen: alles seit dem letzten Abgleich von anderen Geräten; Hochladen: alle eigenen Änderungen seit dem letzten Hochladen, per Batch-Upsert. Jüngere Änderung gewinnt. Einrichtung: [server/ANLEITUNG.md](server/ANLEITUNG.md).

**Übernahme aus WAWIWERK:** Gleiche App-Kennung `de.daviddigital.kassenwerk`. Beim ersten Start liest KONTORWERK die alte Datenbank `kassenwerk` und übernimmt alles. Die alte Datenbank bleibt unverändert. Alte JSON-Backups lassen sich unter „Backup wiederherstellen“ einspielen.

## APK holen
Jeder Push auf `main` baut die App über GitHub Actions:
**Actions → „Android-App bauen“ → letzter Lauf → Artifacts → `KONTORWERK-android`** (ZIP mit der APK).
Die Web-Version liegt im Artifact `KONTORWERK-web`; Releases enthalten sie als `KONTORWERK-web.zip`, die `server/install.sh` auf den Server lädt.
Die Debug-APK ist mit einem festen Schlüssel signiert – sie lässt sich über WAWIWERK installieren, die Daten bleiben erhalten.

Ein Tag `v2.0.0` erzeugt zusätzlich ein GitHub-Release mit angehängter APK.

### Play Store (optional)
Repo-Secrets anlegen, dann baut die Action zusätzlich ein signiertes `.aab`:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

## Ältere Geräte
Mindestens **Android 7.0** (API 24). Der Code wird für WebViews ab Chrome 61 übersetzt (`vite.config.js`, `src/core/compat.js`). Capacitor verlangt WebView 60 oder neuer – auf alten Geräten im Play Store „Android System WebView“ aktualisieren. Der Geräte-Abgleich über Let’s-Encrypt-HTTPS braucht Android 7.1.1 oder neuer.

## Lokal entwickeln
```bash
npm ci
npm run dev            # Browser mit Live-Neuladen
npm run build          # www/index.html bauen
npm run android        # bauen + Debug-APK
```

## Versionierung
Bei jeder Auslieferung hochzählen: `src/core/config.js` (version + build), `src/core/changelog.js`, `versionName`/`versionCode` in `android/app/build.gradle`, `package.json`, `public/sw.js` (Cache-Name) und `CHANGELOG.md`.

## Hinweis zur Kassenführung
KONTORWERK ist kein zertifiziertes Kassensystem und hat **keine TSE** nach Kassensicherungsverordnung. Wie du es steuerlich einsetzen darfst, bitte mit der Steuerberatung klären.
