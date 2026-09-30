// HTTP + WebSocket-Server für den lokalen Betrieb mit Node.js.
// Räume, Lobby und Spiellogik stecken in lobby.js (auch von der Cloudflare-Version genutzt).
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createLobby } from './lobby.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5274;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'rooms.json');
const PERSIST = process.env.PERSIST !== '0';

const lobby = createLobby({
  botDelayScale: Number(process.env.BOT_DELAY_SCALE ?? 1), // 0 = Bots ohne Pause (Tests)
  onSave: scheduleSave,
  onDelete: scheduleSave,
});

const app = express();
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'client')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: lobby.rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ---------- Speichern & Laden ----------

let saveTimer = null;
function scheduleSave() {
  if (!PERSIST || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = [...lobby.rooms.values()].map(lobby.serialize);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(`${SAVE_FILE}.tmp`, JSON.stringify(data));
      fs.renameSync(`${SAVE_FILE}.tmp`, SAVE_FILE);
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e.message);
    }
  }, 1500);
}

function loadRooms() {
  if (!PERSIST) return;
  try {
    const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    for (const r of data) lobby.restore(r);
    if (lobby.rooms.size) console.log(`${lobby.rooms.size} gespeicherte Partie(n) geladen.`);
  } catch { /* noch keine Speicherdatei */ }
}

// ---------- Verbindungen ----------

wss.on('connection', (ws) => {
  const conn = { token: null, room: null, send: (text) => { if (ws.readyState === 1) ws.send(text); } };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => lobby.message(conn, data));
  ws.on('close', () => lobby.disconnect(conn));
});

// Verbindungen prüfen & alte Räume aufräumen
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  lobby.tick();
}, 30_000);

loadRooms();
server.listen(PORT, () => {
  console.log(`Siedlungen läuft auf http://localhost:${PORT}`);
});
