# ⚜ Siedler – das Inselspiel im Browser

Ein liebevoll gestalteter 3D-Nachbau des Brettspiel-Klassikers rund ums Siedeln, Handeln und Bauen – mit Online-Multiplayer, Hot-Seat, KI-Gegnern, Kamerafahrten und einer Hologramm-Bauvorschau. Läuft komplett lokal auf deinem Rechner, Mitspieler verbinden sich einfach über den Browser.

![Die Insel mit Hologramm-Bauvorschau](docs/screenshots/spiel.jpg)

---

## 🚀 Schnellstart

**Voraussetzung:** [Node.js](https://nodejs.org) ab Version 18 (die „LTS“-Version herunterladen und installieren).

| System      | So startest du das Spiel            |
| ----------- | ----------------------------------- |
| **macOS**   | Doppelklick auf **`start.command`** |
| **Windows** | Doppelklick auf **`start.bat`**     |
| **Linux**   | Im Terminal: `./start.command`      |

Die Startdatei erledigt alles automatisch:

1. prüft, ob Node.js installiert ist,
2. installiert beim ersten Start die Abhängigkeiten,
3. startet den Spielserver und
4. öffnet das Spiel im Browser unter **<http://localhost:5274>**.

Zum Beenden das Terminal-Fenster schließen (oder `Strg + C`). Läuft das Spiel schon, öffnet ein erneuter Doppelklick nur den Browser.

> **macOS-Hinweis:** Beim allerersten Doppelklick kann macOS melden, dass die Datei von einem „nicht verifizierten Entwickler“ stammt. Dann **Rechtsklick → Öffnen → Öffnen** wählen. Falls die Datei nicht ausführbar ist: `chmod +x start.command`.

<details>
<summary>Manuell über das Terminal starten</summary>

```bash
git clone https://github.com/Antonio-Tl/Siedler.git
cd Siedler
npm install
npm start
```

Danach <http://localhost:5274> im Browser öffnen.

</details>

---

## 🎲 Spielmodi

![Startmenü](docs/screenshots/menu.jpg)

- **Gegen die KI** – du und 1–3 KI-Siedler, Zielpunktzahl (8/10/12) und Tempo frei wählbar.
- **Mit Freunden** – Raum erstellen und den Einladungslink oder den 5-stelligen Code teilen. Freie Plätze füllt der Gastgeber auf Wunsch mit KI-Siedlern.
- **An einem Gerät (Hot-Seat)** – 2–4 Spieler reichen den Bildschirm reihum weiter. Zwischen den Zügen erscheint ein Vorhang, damit niemand fremde Karten sieht.

Jede Partie wird **automatisch gespeichert** – auch über einen Neustart hinweg. Im Hauptmenü findest du _„Weiterspielen“_, _„Gespeicherte Partien“_, das Regelbuch, die Einstellungen und unter _„Erweiterungen“_ eine Vorschau auf kommende Inhalte (5–6 Spieler, Seefahrer, Städte & Ritter, Händler & Barbaren, Entdecker & Piraten – noch _coming soon_).

### Mit Freunden spielen

- **Im selben WLAN:** Beim Start zeigt das Terminal eine Adresse wie `http://192.168.1.23:5274`. Diese Adresse (mit Raumcode bzw. Einladungslink) an die Mitspieler schicken.
- **Über das Internet:** Am einfachsten [online bei Cloudflare](#online-bei-cloudflare) – dann braucht es keinen eigenen Rechner. Alternativ muss Port 5274 von außen erreichbar sein, z. B. per Portweiterleitung, [Tailscale](https://tailscale.com) oder `ngrok http 5274`.
- **Verbindung verloren?** Einfach neu laden – dein Platz bleibt reserviert. In Online-Partien spielt nach 45 Sekunden eine KI für dich weiter, bis du zurück bist.
- **Partie verlassen:** Eine KI übernimmt sofort deinen Platz, alle anderen bekommen oben eine kurze Nachricht (und eine weitere, wenn du zurückkommst).
- **Zugzeit:** Der Gastgeber legt fest, wie lange jeder Zug dauern darf (aus, 1, 1½, 2, 3 oder 5 Minuten; online standardmäßig 2 Minuten). Läuft sie ab, wird nur das Nötigste automatisch erledigt – würfeln, Räuber versetzen, abwerfen – und der Zug endet. Nach einer 7 gibt es eine eigene Frist zum Abwerfen, die Zugzeit pausiert solange.
- Mehrere Browser-Tabs auf einem Rechner gelten als verschiedene Spieler – praktisch zum Ausprobieren.

### Online bei Cloudflare

Das Spiel läuft auch komplett bei Cloudflare (Workers + Durable Objects, im Gratis-Tarif nutzbar) – ohne eigenen Server und ohne dass dein Rechner an sein muss:

```bash
npm install
npx wrangler login   # einmalig: mit dem Cloudflare-Konto verbinden
npm run cf:deploy    # hochladen – danach unter https://siedlungen.<dein-name>.workers.dev erreichbar
```

Alternativ im Cloudflare-Dashboard unter _Workers & Pages → Erstellen → Repository importieren_ dieses Git-Repository verbinden; dann wird bei jedem Push automatisch neu veröffentlicht. Zum lokalen Ausprobieren der Cloudflare-Version: `npm run cf:dev` (Port 8787).

---

## ✨ Auf der Insel

![Hologramm einer Stadt über der Siedlung](docs/screenshots/hologramme.jpg)

- **Hologramm-Bauvorschau:** Sobald du dir etwas leisten kannst, erscheinen alle möglichen Straßen, Siedlungen und Städte als leuchtende Hologramme in deiner Farbe. Ein Klick genügt zum Bauen – beim Überfahren siehst du Kosten und Erträge.
- **Kamerafahrten:** Beim Würfeln fliegt die Kamera zur Würfelschale, dann zu den Feldern mit Ertrag. Die Felder leuchten auf, Rohstoffe steigen auf und fliegen in deine Hand. Bei einer 7 erwacht der Räuber. Baut ein Mitspieler eine Straße, Siedlung oder Stadt, zeigt die Kamera den neuen Bau.
- **Kamerafahrten abschalten:** Der Knopf **🎥 Kamerafahrten** oben rechts auf dem Brett schaltet alle Fahrten aus; unter ⚙ lassen sich Würfel, Erträge, Räuber und Bauten einzeln an- und abschalten.
- **Lebendige Insel:** Wälder, Schafe, Weizenfelder, Berge, Häfen mit Stegen, Brandung, Wolken und Segelboote. Figuren fallen mit Staubwolke aufs Brett, Straßen wachsen ein, der Räuber hüpft.
- **Geführte Inseltour**, illustriertes **Regelbuch**, **Chronik**, **Chat** und Feuerwerk beim Sieg.

<p>
  <img src="docs/screenshots/wuerfel.jpg" alt="Würfelwurf" width="280" />
  <img src="docs/screenshots/handel.jpg" alt="Handelstisch" width="280" />
</p>

### Steuerung

| Aktion                | Maus / Tastatur                                           | Handy / Tablet                                       |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Kamera drehen         | Ziehen mit der linken Maustaste                           | Mit zwei Fingern ziehen                              |
| Zoomen                | Mausrad oder Zoom-Regler                                  | Mit zwei Fingern auf- und zuziehen                   |
| Schwenken             | `W` `A` `S` `D`, Leertaste + Ziehen oder rechte Maustaste | Mit einem Finger ziehen                              |
| Bauen                 | Klick auf ein Hologramm                                   | Antippen (zeigt Infos), dann bestätigen oder nochmal antippen |
| Würfeln               | `R`                                                       | Großer Knopf unten rechts                            |
| Handelstisch          | `T`                                                       | **Handeln** oder eine Handkarte antippen             |
| Zug beenden           | `E`                                                       | Großer Knopf unten rechts                            |
| Abbrechen / Schließen | `Esc`                                                     | **Abbrechen** bzw. neben das Fenster tippen          |

### 📱 Auf dem Handy

Auf Handys und in kleinen Fenstern stellt sich die Oberfläche automatisch um. Alles passt auf einen Bildschirm, gescrollt wird nichts:

- **Hochformat** (empfohlen, einhändig): oben die Spielerleiste, darunter das Brett mit einer Statuszeile („Dein Zug – würfle …“, Zugzeit), unten die Handkarten und die Aktionsleiste mit **Bauen**, **Handeln** und dem großen Knopf für den nächsten Schritt (Würfeln, Zug beenden, Karten abwerfen …).
- **Querformat**: Spieler und Handkarten links, das Brett in der Mitte, rechts die Bauknöpfe, **Handeln** und der große Knopf. Das Handy muss nicht gedreht werden – beide Richtungen funktionieren.
- **Antippen statt Danebentippen:** Kreuzungen und Straßen sind auf dem Handy klein. Ein Tipp in die Nähe wählt den nächsten Platz aus und zeigt, welche Felder er bringt. Gebaut wird erst nach **Bestätigen** oder einem zweiten Tipp.
- **Chronik & Chat** öffnen sich über das Schriftrollen-Symbol am Brett, **Entwicklungskarten** über die Karte neben der Hand, alle Details der Mitspieler per Tipp auf die Spielerleiste. Dialoge wie der Handelstisch erscheinen als Blatt vom unteren Rand.
- **Vollbild:** Auf Android wechselt das Spiel beim Start einer Partie ins Vollbild (abschaltbar unter ⚙). Der Knopf am Brett und das Menü schalten es um. Auf dem iPhone gibt es für Webseiten kein Vollbild: Dort in Safari auf _Teilen → Zum Home-Bildschirm_ tippen, dann startet Siedlungen ohne Browserleisten wie eine App.

### Einstellungen („An deinem Tisch“ ⚙)

Grafikqualität (Ultra/Hoch/Mittel/Niedrig – „Ultra“ mit 2048er-Geländetexturen samt Relief, weichen 4K-Schatten, Umgebungslicht und dichterer Landschaft), Klang und Lautstärke mit Klangvorschau, Meeresrauschen, Tempo der KI, Zugzeit, Hinweise unten auf dem Brett, Kamerafahrten (insgesamt oder einzeln für Würfel, Erträge, Räuber und Bauten), bewegte Szenerie und die Hologramm-Vorschau lassen sich jederzeit anpassen.

Tipp: Ein Klick auf eine Rohstoffkarte in deiner Hand öffnet direkt den Handelstisch mit diesem Rohstoff.

---

## 📜 Regeln (Kurzfassung)

- Zufällige Insel mit 19 Feldern, keine zwei roten Zahlen (6/8) nebeneinander, 9 Häfen (3:1 und 2:1).
- **Gründung:** Jeder setzt zwei Siedlungen mit Straße – in der zweiten Runde rückwärts, die zweite Siedlung bringt Starterträge.
- **Würfeln:** Felder mit der gewürfelten Zahl liefern Rohstoffe an angrenzende Siedlungen (1) und Städte (2).
- **Bei einer 7:** Wer mehr als 7 Karten hat, gibt die Hälfte ab. Der Räuber blockiert ein Feld und stiehlt eine Karte.
- **Bauen:** Straße (Holz, Lehm) · Siedlung (Holz, Lehm, Wolle, Getreide) · Stadt (2 Getreide, 3 Erz) · Entwicklungskarte (Wolle, Getreide, Erz).
- **Entwicklungskarten:** Ritter, Straßenbau, Erfindung, Monopol, Siegpunkt.
- **Handel:** mit der Bank (4:1, an Häfen 3:1 oder 2:1) oder als Angebot an alle Mitspieler. Jeder nimmt an oder lehnt ab; nehmen mehrere an, wählst du, mit wem du tauschst.
- **Sonderpunkte:** Längste Handelsstraße (ab 5) und Größte Rittermacht (ab 3 Rittern) bringen je 2 Punkte.
- Wer in seinem Zug die Zielpunktzahl erreicht, gewinnt.

Das vollständige Regelbuch gibt es im Spiel über **📖 Regeln**.

---

## 🛠 Für Entwickler

```bash
npm install        # Abhängigkeiten
npm start          # Server starten (Port 5274)
npm run dev        # Server mit automatischem Neustart bei Änderungen
npm test           # alle Tests: Regeln, KI-Partien, Online-, Hot-Seat- und Speicher-Tests
npm run cf:dev     # Cloudflare-Version lokal (Wrangler, Port 8787)
npm run cf:deploy  # Cloudflare-Version veröffentlichen
```

| Umgebungsvariable | Bedeutung                                                                            | Standard |
| ----------------- | ------------------------------------------------------------------------------------ | -------- |
| `PORT`            | Port des Servers                                                                     | `5274`   |
| `DATA_DIR`        | Ordner für die Spielstände (`rooms.json`) und die Statistik (`games.json`)           | `./data` |
| `PERSIST`         | `0` schaltet das Speichern ab                                                        | an       |
| `ADMIN_KEY`       | Schlüssel für die Admin-Seite `/admin` – ohne ist sie nur versteckt, nicht geschützt | –        |

Beispiel: `PORT=8080 ./start.command` bzw. unter Windows `set PORT=8080` und danach `start.bat`.

### Admin-Seite (`/admin`)

Unter **`/admin`** (z. B. <http://localhost:5274/admin>) liegt das _Partienbuch_ – eine nirgends verlinkte Übersicht, wie viele Partien wann gespielt wurden: Kennzahlen, Partien pro Tag/Woche nach Spielmodus, Wochentag × Uhrzeit, Spielmodi, Siedler pro Partie und eine Liste aller Partien mit Insel, Spielern, Dauer und Ausgang. Über **„Statistik löschen“** wird die Statistik geleert; gespeicherte Partien der Spieler bleiben dabei erhalten.

Erfasst wird jede Partie beim Start, beim Sieg und wenn sie abgebrochen wird. Ist `ADMIN_KEY` gesetzt, fragt die Seite einmal pro Browser-Sitzung nach diesem Schlüssel:

```bash
ADMIN_KEY=mein-geheimer-schluessel npm start   # Node
npx wrangler secret put ADMIN_KEY             # Cloudflare (lokal mit „wrangler dev“: ADMIN_KEY=… in .dev.vars)
```

### Aufbau

| Pfad                                            | Inhalt                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start.command` / `start.bat`                   | Startdateien für macOS/Linux bzw. Windows                                                                                                           |
| `shared/engine.js`                              | Regel-Engine – läuft identisch auf Server und Client                                                                                                |
| `server/lobby.js`                               | Räume, Lobby, Hot-Seat, Wiederverbinden, Bot-Takt – gemeinsam für Node und Cloudflare                                                               |
| `server/index.js`                               | Node-Server: Express + WebSocket, Speicherstände in `data/rooms.json`, Statistik in `data/games.json`                                               |
| `server/admin.js`                               | Admin-Statistik: Schlüsselprüfung und Status der Partien – gemeinsam für Node und Cloudflare                                                        |
| `worker/index.js`                               | Cloudflare-Version: Worker + Durable Object (Speicherstände und Statistik in dessen SQLite-Datenbank)                                               |
| `wrangler.jsonc`, `scripts/build-cloudflare.js` | Cloudflare-Konfiguration und Build der statischen Dateien nach `dist/`                                                                              |
| `server/bot.js`                                 | KI-Siedler                                                                                                                                          |
| `client/app.js`                                 | Oberfläche, Menü, Dialoge, Handel, Tour, Kamerafahrten, kompakte Handy-Ansicht (Aktionsleiste, Blätter, Vollbild)                                    |
| `client/manifest.webmanifest`, `client/icons/`  | Web-App-Manifest und Symbole – „Zum Home-Bildschirm“ startet das Spiel im Vollbild                                                                  |
| `client/board3d.js`                             | Three.js-Szene: Kamera, Figuren, Hologramme, Würfel, Effekte                                                                                        |
| `client/three/`                                 | Texturen, handgemalte Gelände mit Normal-Maps (`terrain.js`), 3D-Modelle (Figuren, Räuber, Deko, Häfen) und Wasser                                  |
| `client/admin/`                                 | Admin-Seite `/admin` (Partienbuch)                                                                                                                  |
| `client/art.js`, `client/art/`                  | SVG-Grafiken: Rohstoffe, Porträts (`portraits.js`), Linien-Icons (`icons.js`), farbige Motive (`emblems.js`) und große Illustrationen (`scenes.js`) |
| `test/`                                         | automatisierte Tests                                                                                                                                |

Der Server ist autoritativ: Alle Spielzüge werden dort geprüft, jeder Spieler bekommt nur seine eigenen Handkarten zu sehen.

---

## ❓ Probleme?

| Problem                        | Lösung                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| „Node.js wurde nicht gefunden“ | Node.js von <https://nodejs.org> installieren und die Startdatei erneut öffnen.                                  |
| „Port schon belegt“            | Ein anderes Programm nutzt Port 5274 – mit `PORT=8080 ./start.command` einen anderen Port wählen.                |
| Mitspieler kommen nicht rein   | Gleiches WLAN? Firewall-Abfrage beim Start erlaubt? Für Internet-Spiele Port freigeben oder Tunnel nutzen.       |
| Spiel ruckelt                  | Unter ⚙ die Grafikqualität auf „Hoch“, „Mittel“ oder „Niedrig“ stellen und ggf. die bewegte Szenerie abschalten. |

---

_Ein nicht-kommerzielles Fanprojekt. Nicht verbunden mit den Rechteinhabern des Originalspiels._
