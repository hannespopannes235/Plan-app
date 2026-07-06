#!/bin/sh
# ============================================================================
# Plan – Update-Skript für die Synology
# Holt die neueste Version aus Git und baut den Container neu.
# Der Daten-Ordner pb_data bleibt dabei vollständig erhalten.
#
# Manuell aufrufen:   sudo sh /volume1/docker/plan/update.sh
# Oder automatisch:   DSM → Aufgabenplaner (siehe docs/ANLEITUNG.md, Abschnitt 12).
# ============================================================================
set -e

# In den Ordner wechseln, in dem dieses Skript liegt (egal von wo es startet).
cd "$(dirname "$0")"

echo "==> [1/4] Neueste Version aus Git holen..."
git pull --ff-only

echo "==> [2/4] pb_data-Ordner sicherstellen..."
mkdir -p pb_data

echo "==> [3/4] Container neu bauen und starten..."
# Neuere Docker-Versionen nutzen "docker compose", ältere "docker-compose".
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

echo "==> [4/4] Alte, ungenutzte Images aufräumen..."
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "==> Fertig. Aktueller Status:"
docker ps --filter "name=plan"
