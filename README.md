# Siedlungen

Ein 3D-Nachbau des Catan-Basisspiels im Browser – mit Online-Multiplayer, Bots, Handel und allen Grundregeln.

## Starten

```bash
npm install
npm start
```

Dann <http://localhost:5274> öffnen. Port ändern: `PORT=8080 npm start`.

## Spielen

- **Allein gegen Bots:** Namen eingeben, 1–3 Gegner wählen, „Partie starten“.
- **Mit Freunden online:** „Raum erstellen“, Code oder Einladungslink teilen. Freie Plätze kann der Gastgeber mit Bots füllen.
  Für Spieler in anderen Netzwerken muss der Server erreichbar sein (z. B. per Port-Weiterleitung, Tailscale oder einem Hoster).
- **Mehrere Spieler im selben Browser:** Jeder Tab bekommt automatisch eine eigene Identität.
- **Verbindung weg?** Neuladen oder den Link erneut öffnen holt deinen Platz zurück. Nach 45 s ohne Verbindung spielt ein Bot für dich weiter, bis du zurück bist.

Steuerung: Ziehen dreht, Scrollen zoomt, WASD oder Leertaste + Ziehen schwenkt. Tasten: **R** würfeln, **T** handeln, **E** Zug beenden, **Esc** abbrechen.

## Regeln & Funktionen

- Zufällige Insel (19 Felder, keine benachbarten 6/8), 9 Häfen (3:1 und 2:1)
- Gründungsphase in Schlangenreihenfolge mit Startertrag
- Würfeln, Erträge (inkl. Bank-Knappheit), Räuber bei 7 mit Abwerfen und Stehlen
- Straßen, Siedlungen, Städte mit Abstandsregel und Figurenvorrat
- Entwicklungskarten: Ritter, Straßenbau, Erfindung, Monopol, Siegpunkt
- Längste Handelsstraße (inkl. Unterbrechung) und größte Rittermacht
- Banktausch 4:1 / Häfen, Spielerhandel mit Annehmen, Ablehnen und Gegenangebot
- Sieg bei 8/10/12/14 Punkten (einstellbar), Revanche-Funktion
- Chronik, Chat, Regelbuch, Einführung, Toasts, Soundeffekte

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `shared/engine.js` | Regel-Engine (läuft auf Server und Client) |
| `server/index.js` | Express + WebSocket, Räume, Lobby, Wiederverbinden |
| `server/bot.js` | Bot-KI |
| `client/board3d.js` | Three.js-Szene: Insel, Deko, Häfen, Figuren, Würfel, Kamera |
| `client/app.js` | Oberfläche, Modals, Handel, Ereignisse |
| `test/` | Regeltests, Bot-Partien und ein Online-Integrationstest |

Tests: `npm test`
