#!/usr/bin/env bash
# KONTORWERK – Server einrichten (PocketBase + HTTPS über Caddy)
# Für Ubuntu 22.04/24.04, z. B. Oracle Cloud „Always Free“. Aufruf auf dem Server:
#   curl -fsSLO https://raw.githubusercontent.com/Benlukan/KONTORWERK/main/server/install.sh
#   sudo bash install.sh
# Optional vorher setzen: DOMAIN=kontorwerk.meine-domain.de (sonst <IP>.sslip.io), REF=main
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.36.6}"
REF="${REF:-main}"
REPO_RAW="https://raw.githubusercontent.com/Benlukan/KONTORWERK/${REF}/server"
DIR=/opt/pocketbase

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo starten: sudo bash install.sh"; exit 1; }

echo "== KONTORWERK-Server =="
if [ -z "${EMAIL:-}" ]; then read -rp "E-Mail für deine Anmeldung: " EMAIL; fi
if [ -z "${PASSWORD:-}" ]; then
  read -rsp "Passwort (mind. 10 Zeichen): " PASSWORD; echo
  read -rsp "Passwort wiederholen: " PASSWORD2; echo
  [ "$PASSWORD" = "$PASSWORD2" ] || { echo "Passwörter stimmen nicht überein."; exit 1; }
fi
[ ${#PASSWORD} -ge 10 ] || { echo "Passwort zu kurz (mind. 10 Zeichen)."; exit 1; }

if [ -z "${DOMAIN:-}" ]; then
  IP="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)"
  DOMAIN="${IP//./-}.sslip.io"
fi
echo "Server-Adresse wird: https://${DOMAIN}"

echo "== Pakete =="
apt-get update -qq
apt-get install -y -qq unzip curl python3 debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null

case "$(uname -m)" in
  x86_64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Unbekannte Architektur $(uname -m)"; exit 1 ;;
esac

echo "== PocketBase ${PB_VERSION} (${ARCH}) =="
id pocketbase >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin pocketbase
mkdir -p "$DIR/pb_migrations"
cd "$DIR"
curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
unzip -oq pb.zip pocketbase && rm pb.zip
curl -fsSL -o pb_migrations/1762300000_kontorwerk.js "${REPO_RAW}/pb_migrations/1762300000_kontorwerk.js"
chown -R pocketbase:pocketbase "$DIR"
systemctl stop pocketbase 2>/dev/null || true
sudo -u pocketbase ./pocketbase migrate up --dir="$DIR/pb_data" --migrationsDir="$DIR/pb_migrations"
sudo -u pocketbase ./pocketbase superuser upsert "$EMAIL" "$PASSWORD" --dir="$DIR/pb_data"

cat > /etc/systemd/system/pocketbase.service <<UNIT
[Unit]
Description=KONTORWERK PocketBase
After=network.target

[Service]
User=pocketbase
Group=pocketbase
WorkingDirectory=${DIR}
ExecStart=${DIR}/pocketbase serve --http=127.0.0.1:8090 --dir=${DIR}/pb_data --migrationsDir=${DIR}/pb_migrations
Restart=always
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now pocketbase
sleep 3

echo "== App-Nutzer anlegen =="
TOKEN="$(curl -fsS -X POST http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"identity":sys.argv[1],"password":sys.argv[2]}))' "$EMAIL" "$PASSWORD")" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
BODY="$(python3 -c 'import json,sys; print(json.dumps({"email":sys.argv[1],"password":sys.argv[2],"passwordConfirm":sys.argv[2],"verified":True}))' "$EMAIL" "$PASSWORD")"
if ! curl -fsS -o /dev/null -X POST http://127.0.0.1:8090/api/collections/users/records -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d "$BODY"; then
  echo "Hinweis: App-Nutzer gibt es wohl schon – übersprungen."
fi

echo "== HTTPS mit Caddy =="
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
echo "== Web-App für den PC =="
mkdir -p /var/www/kontorwerk
if curl -fsSL -o /tmp/kw-web.zip "https://github.com/Benlukan/KONTORWERK/releases/latest/download/KONTORWERK-web.zip"; then
  rm -rf /var/www/kontorwerk/* && unzip -oq /tmp/kw-web.zip -d /var/www/kontorwerk && rm /tmp/kw-web.zip
  echo "Web-App installiert."
else
  echo "Hinweis: Noch kein GitHub-Release mit KONTORWERK-web.zip – Web-App übersprungen (Server läuft trotzdem)."
fi
chown -R caddy:caddy /var/www/kontorwerk 2>/dev/null || true

cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
	request_body {
		max_size 64MB
	}
	# PocketBase: Schnittstelle und Verwaltung
	handle /api/* {
		reverse_proxy 127.0.0.1:8090
	}
	handle /_/* {
		reverse_proxy 127.0.0.1:8090
	}
	# KONTORWERK als Web-App (PC-Browser)
	handle {
		root * /var/www/kontorwerk
		file_server
	}
}
CADDY

echo "== Firewall (Ports 80 und 443) =="
if command -v iptables >/dev/null; then
  for P in 80 443; do
    iptables -C INPUT -p tcp --dport "$P" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport "$P" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null; fi
fi
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi
systemctl restart caddy

echo
echo "Fertig."
echo "  Server-Adresse für die App:  https://${DOMAIN}"
echo "  Anmeldung in der App:        ${EMAIL} + dein Passwort"
echo "  KONTORWERK am PC:            https://${DOMAIN}/"
echo "  Verwaltung (PocketBase):     https://${DOMAIN}/_/"
echo "Falls die Adresse nicht lädt: In der Oracle-Konsole die Ports 80 und 443 freigeben (siehe ANLEITUNG.md, Schritt 3)."
