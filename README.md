# 🧾 KASSENWERK

Kasse, Produkte & Lager für selbstgemachte Produkte – im david.digital-Stil.
Komplett offline, keine Cloud, kein Konto. Android-App (Capacitor) + Web-Version aus derselben `www/index.html`.

## Funktionen
- **Kasse** – Produktkacheln, Kategorien, Suche/Barcode, Rabatt, freier Betrag, Bar/Karte/Sonstiges mit Rückgeld
- **Bon** – teilen oder drucken, Storno mit Lager-Rückbuchung
- **Produkte & Kategorien** – Foto/Emoji, Preise, EK/Material, Artikelnr., Einheiten, Mindestbestand
- **Lager** – Bestände, Warnungen, Zugang/Abgang/Inventur, Bewegungsprotokoll, Lagerwert
- **Berichte** – Umsatz, Rohertrag, Zahlarten, Kategorien, Top-Produkte, Verlauf, CSV-Export, Tagesabschluss
- **Daten** – Backup/Wiederherstellen (JSON), Hell/Dunkel-Modus

## APK holen
Jeder Push auf `main` baut die App über GitHub Actions:
**Actions → „Android-App bauen“ → letzter Lauf → Artifacts → `KASSENWERK-android`** (ZIP mit der APK).
Die Debug-APK ist mit einem festen Schlüssel signiert – neue Versionen lassen sich über die alte installieren, die Daten bleiben erhalten.

Ein Tag `v1.0.0` erzeugt zusätzlich ein GitHub-Release mit angehängter APK.

### Play Store (optional)
Repo-Secrets anlegen, dann baut die Action zusätzlich ein signiertes `.aab`:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

## Lokal entwickeln
```bash
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
```
Web-Version: `www/index.html` im Browser öffnen.

## Versionierung
Bei jeder Auslieferung hochzählen: `TOOL_CONFIG` in `www/index.html` (version + build), `versionName`/`versionCode` in `android/app/build.gradle`, `package.json`, `www/sw.js` (Cache-Name) und `CHANGELOG.md`.

## Hinweis zur Kassenführung
KASSENWERK hat **keine zertifizierte TSE** nach Kassensicherungsverordnung. Es ist als Verkaufs- und Lagerhilfe gedacht; wie du es steuerlich einsetzen darfst, bitte mit der Steuerberatung klären.

---
© david.digital
