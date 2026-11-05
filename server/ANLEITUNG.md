# KONTORWERK-Server einrichten (Oracle Cloud „Always Free“)

Danach gleichen Handy und PC ihre Daten über deinen eigenen Server ab. Am PC öffnest du KONTORWERK einfach im Browser unter deiner Server-Adresse.

Dauer: etwa 30 Minuten. Kosten: 0 € (Oracle verlangt bei der Anmeldung eine Kreditkarte zur Prüfung).

## 1. Oracle-Konto anlegen
1. Auf **oracle.com/cloud/free** „Kostenlos starten“ wählen und registrieren.
2. Als **Home-Region „Germany Central (Frankfurt)“** wählen. Die Region lässt sich später nicht ändern, und die Daten liegen dann in Deutschland.
3. Kreditkarte zur Prüfung angeben. Solange du nur „Always Free“-Bausteine nutzt, wird nichts abgebucht.

## 2. Server (Instanz) erstellen
1. In der Oracle-Konsole: **Compute → Instances → Create instance**.
2. **Image:** Canonical Ubuntu 24.04.
3. **Shape:** „VM.Standard.E2.1.Micro“ (AMD, Always Free) – reicht für KONTORWERK.
   Falls angeboten, geht auch „VM.Standard.A1.Flex“ (Ampere) mit 1 OCPU und 6 GB; in Frankfurt ist die oft ausgebucht.
4. **SSH-Schlüssel:** „Save private key“ – Datei gut aufbewahren, das ist dein Zugang zum Server.
5. **Create**. Nach ein bis zwei Minuten steht unter „Public IP address“ die IP deines Servers.

## 3. Ports 80 und 443 öffnen
Ohne diesen Schritt ist der Server von außen nicht erreichbar.
1. In der Instanz auf das **Subnet** klicken → **Security Lists** → „Default Security List…“.
2. **Add Ingress Rules**, zweimal:
   - Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80**
   - Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **443**

## 4. Einrichtungs-Skript starten
Am PC ein Terminal öffnen (Windows: PowerShell) und anmelden – Pfad zum Schlüssel und IP anpassen:
```bash
ssh -i ~/Downloads/ssh-key.key ubuntu@DEINE.IP.ADRESSE
```
Auf dem Server:
```bash
curl -fsSLO https://raw.githubusercontent.com/Benlukan/KONTORWERK/main/server/install.sh
sudo bash install.sh
```
Das Skript fragt nach **E-Mail und Passwort** (mind. 10 Zeichen) – damit meldest du dich später in der App an. Es richtet ein:
- PocketBase als Dienst (startet nach einem Neustart von selbst), tägliche Sicherung um 3 Uhr, die letzten 7 bleiben
- HTTPS-Zertifikat über Caddy, Adresse `https://<deine-ip-mit-bindestrichen>.sslip.io` (kostenlos, ohne eigene Domain)
- die Web-App für den PC (aus dem neuesten GitHub-Release)

Am Ende stehen Server-Adresse und Verwaltungs-Link im Terminal. Eigene Domain gewünscht? Vorher einen DNS-Eintrag auf die IP setzen und `sudo DOMAIN=kontorwerk.deine-domain.de bash install.sh` aufrufen.

## 5. Geräte verbinden
1. **Zuerst das Handy** (dort liegen deine Wawiwerk-Daten): KONTORWERK → Einstellungen → **Geräte-Abgleich** → Server-Adresse, E-Mail, Passwort → **Verbinden**. Alle Daten werden hochgeladen.
2. **Dann der PC:** Server-Adresse im Browser öffnen → Einstellungen → Geräte-Abgleich → Verbinden. Die Adresse ist schon eingetragen.
3. Fertig. Änderungen gleichen sich automatisch ab: nach jeder Änderung, jede Minute und beim Öffnen der App. Oben rechts zeigt ✅ „abgeglichen“, 📴 offline, ⚠️ ein Problem.

## Gut zu wissen
- **Offline geht weiter:** Jedes Gerät hat alle Daten selbst. Ohne Netz wird lokal gearbeitet und später abgeglichen.
- **Konflikte:** Ändern zwei Geräte denselben Datensatz, gewinnt die jüngere Änderung. Verkaufen beide Geräte **gleichzeitig ohne Netz** dasselbe Produkt, kann der Bestand danach abweichen – dann im Lager eine Inventur buchen.
- **Server weg?** Die Daten liegen weiter auf jedem Gerät. Neuen Server einrichten, verbinden – der erste Abgleich lädt alles wieder hoch.
- **Oracle-Hinweis:** Oracle kann ungenutzte Always-Free-Konten nach längerer Inaktivität stilllegen. Der regelmäßige Abgleich hält den Server in Gebrauch. Die Sicherungen liegen unter `/opt/pocketbase/pb_data/backups`; Backups aus der App (Einstellungen → Daten) bleiben zusätzlich sinnvoll.
- **Web-App aktualisieren:** Nach einem neuen Release `sudo bash install.sh` erneut ausführen (Daten bleiben erhalten).
