#!/usr/bin/env bash
# Siedler starten (macOS & Linux)
# Doppelklick im Finder oder im Terminal:  ./start.command
# Optional anderer Port:                     PORT=8080 ./start.command

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-5274}"
URL="http://localhost:$PORT"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() {
  printf '\n\033[31m%s\033[0m\n' "$1"
  read -r -p "Enter drücken zum Schließen …" _
  exit 1
}

bold "⚜  Siedler – Inselspiel"
echo

# 1. Node.js vorhanden?
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js wurde nicht gefunden. Bitte Node.js 18 oder neuer installieren: https://nodejs.org"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $(node -v) ist zu alt. Benötigt wird Version 18 oder neuer: https://nodejs.org"
fi
echo "✓ Node.js $(node -v)"

# 2. Abhängigkeiten installieren (nur beim ersten Start oder nach Updates)
if [ ! -d node_modules ] || [ package.json -nt node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "… Installiere Abhängigkeiten (einmalig)"
  npm install --no-audit --no-fund || fail "npm install ist fehlgeschlagen."
  touch node_modules
fi
echo "✓ Abhängigkeiten bereit"

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  else echo "Bitte im Browser öffnen: $URL"
  fi
}

# 3. Läuft das Spiel schon? Dann nur den Browser öffnen.
if curl -fs "$URL/health" >/dev/null 2>&1; then
  echo "✓ Das Spiel läuft bereits – öffne $URL"
  open_browser
  exit 0
fi

# 4. Adresse im Heimnetz für Mitspieler ermitteln
LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
fi
if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

# 5. Server starten, auf Bereitschaft warten, Browser öffnen
PORT="$PORT" node server/index.js &
SERVER_PID=$!
trap 'echo; echo "Server wird beendet …"; kill $SERVER_PID 2>/dev/null; exit 0' INT TERM

for _ in $(seq 1 50); do
  if curl -fs "$URL/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    fail "Der Server konnte nicht starten. Ist Port $PORT schon belegt? Versuche z. B.: PORT=8080 ./start.command"
  fi
  sleep 0.2
done

echo
bold "🏝  Siedler läuft!"
echo "   Auf diesem Computer:   $URL"
[ -n "$LAN_IP" ] && echo "   Für Mitspieler im WLAN: http://$LAN_IP:$PORT"
echo
echo "   Zum Beenden dieses Fenster schließen oder Strg+C drücken."
echo
open_browser
wait $SERVER_PID
