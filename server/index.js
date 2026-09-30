// HTTP + WebSocket-Server: Räume, Lobby, autoritative Spiellogik, Bots.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame, applyAction, viewFor, pendingActors, PLAYER_COLORS } from '../shared/engine.js';
import { botAction, botDelay } from './bot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5274;
const MAX_SEATS = 4;
const BOT_NAMES = ['Eleonore', 'Rowan', 'Finn', 'Mira', 'Tobias', 'Ida', 'Konrad', 'Lotte'];
const AUTOPILOT_AFTER_MS = 45_000; // getrennte Spieler übernimmt nach dieser Zeit ein Bot
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const BOT_DELAY_SCALE = Number(process.env.BOT_DELAY_SCALE ?? 1); // 0 = Bots ohne Pause (Tests)

const app = express();
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'client')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/** @type {Map<string, any>} */
const rooms = new Map();

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function roomInfo(room) {
  return {
    code: room.code,
    host: room.host,
    started: !!room.game,
    vpToWin: room.vpToWin,
    seats: room.seats.map((s, i) => ({
      seat: i, name: s.name, color: s.color, isBot: s.isBot, connected: s.isBot || !!s.ws, token: undefined,
    })),
  };
}

function broadcast(room) {
  room.lastActive = Date.now();
  const info = roomInfo(room);
  room.seats.forEach((s, i) => {
    if (!s.ws) return;
    send(s.ws, { t: 'room', room: info, you: i });
    if (room.game) send(s.ws, { t: 'state', state: viewFor(room.game, i) });
  });
  for (const ws of room.spectators) {
    send(ws, { t: 'room', room: info, you: null });
    if (room.game) send(ws, { t: 'state', state: viewFor(room.game, -1) });
  }
}

function freeColor(room) {
  const used = new Set(room.seats.map((s) => s.color));
  return PLAYER_COLORS.find((c) => !used.has(c.id))?.id || 'red';
}

function cleanName(name, fallback) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return n || fallback;
}

function isAutomated(room, idx) {
  const s = room.seats[idx];
  if (!s) return false;
  if (s.isBot) return true;
  return !s.ws && s.disconnectedAt && Date.now() - s.disconnectedAt > AUTOPILOT_AFTER_MS;
}

// Führt anstehende Bot-Züge nacheinander mit kleiner Pause aus.
function pump(room) {
  if (!room.game || room.timer || room.game.phase === 'ended') return;
  const actors = pendingActors(room.game).filter((i) => isAutomated(room, i));
  // Offenes Gegenangebot an den aktuellen Spieler: der Anbieter muss reagieren
  const g = room.game;
  if (g.trade && g.trade.status === 'countered' && isAutomated(room, g.trade.from)) actors.unshift(g.trade.from);
  if (!actors.length) return;
  const idx = actors[0];
  room.timer = setTimeout(() => {
    room.timer = null;
    if (!room.game || rooms.get(room.code) !== room) return;
    const action = botAction(room.game, idx);
    if (action) {
      const r = applyAction(room.game, idx, action);
      if (!r.ok) {
        const fb = room.game.phase === 'play' && room.game.current === idx
          ? (room.game.turn.rolled ? { type: 'endTurn' } : { type: 'roll' }) : null;
        const r2 = fb ? applyAction(room.game, idx, fb) : { ok: false };
        if (!r2.ok) console.warn(`[${room.code}] Bot ${idx} steckt fest:`, action, r.error);
      }
    }
    broadcast(room);
    pump(room);
  }, botDelay(room.game) * BOT_DELAY_SCALE);
}

function startGame(room) {
  room.game = createGame({
    players: room.seats.map((s) => ({ name: s.name, color: s.color, isBot: s.isBot })),
    seed: crypto.randomInt(2 ** 31),
    vpToWin: room.vpToWin,
  });
  broadcast(room);
  pump(room);
}

function handle(ws, msg) {
  const room = ws.room ? rooms.get(ws.room) : null;
  const seatIdx = room ? room.seats.findIndex((s) => s.token === ws.token) : -1;
  const isHost = room && seatIdx === room.host;

  switch (msg.t) {
    case 'hello': {
      ws.token = typeof msg.token === 'string' && msg.token.length >= 16 ? msg.token : crypto.randomUUID();
      send(ws, { t: 'welcome', token: ws.token, colors: PLAYER_COLORS });
      return;
    }
    case 'createRoom': {
      leaveRoom(ws);
      const code = makeCode();
      const r = {
        code, host: 0, seats: [], spectators: new Set(), game: null, timer: null,
        vpToWin: [8, 10, 12, 14].includes(msg.vpToWin) ? msg.vpToWin : 10, lastActive: Date.now(),
      };
      r.seats.push({ token: ws.token, name: cleanName(msg.name, 'Du'), color: 'red', isBot: false, ws, disconnectedAt: null });
      if (msg.solo) {
        const bots = Math.min(3, Math.max(1, Number(msg.bots) || 3));
        for (let i = 0; i < bots; i++) addBot(r);
      }
      rooms.set(code, r);
      ws.room = code;
      if (msg.solo) startGame(r);
      else broadcast(r);
      return;
    }
    case 'joinRoom': {
      const code = String(msg.code || '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: 'error', msg: 'Diesen Raum gibt es nicht (mehr).' });
      leaveRoom(ws);
      const existing = r.seats.findIndex((s) => s.token === ws.token);
      ws.room = code;
      if (existing >= 0) {
        const s = r.seats[existing];
        if (s.ws && s.ws !== ws) { send(s.ws, { t: 'kicked', msg: 'In einem anderen Tab geöffnet.' }); s.ws.room = null; }
        s.ws = ws;
        s.disconnectedAt = null;
        if (!r.game && msg.name) s.name = cleanName(msg.name, s.name);
      } else if (!r.game && r.seats.length < MAX_SEATS) {
        r.seats.push({ token: ws.token, name: cleanName(msg.name, `Spieler ${r.seats.length + 1}`), color: freeColor(r), isBot: false, ws, disconnectedAt: null });
      } else if (!r.game) {
        // Voller Raum: einen Bot ersetzen, falls vorhanden
        const botSeat = r.seats.findIndex((s) => s.isBot);
        if (botSeat < 0) { ws.room = null; return send(ws, { t: 'error', msg: 'Der Raum ist voll.' }); }
        Object.assign(r.seats[botSeat], { token: ws.token, name: cleanName(msg.name, 'Gast'), isBot: false, ws, disconnectedAt: null });
      } else {
        r.spectators.add(ws);
        send(ws, { t: 'info', msg: 'Die Partie läuft bereits – du schaust zu.' });
      }
      broadcast(r);
      pump(r);
      return;
    }
    case 'leave': {
      leaveRoom(ws, true);
      send(ws, { t: 'left' });
      return;
    }
    case 'addBot': {
      if (!isHost || room.game) return;
      if (room.seats.length >= MAX_SEATS) return send(ws, { t: 'error', msg: 'Maximal 4 Spieler.' });
      addBot(room);
      broadcast(room);
      return;
    }
    case 'removeSeat': {
      if (!isHost || room.game) return;
      const i = Number(msg.seat);
      if (i === room.host || !room.seats[i]) return;
      const [s] = room.seats.splice(i, 1);
      if (s.ws) { send(s.ws, { t: 'kicked', msg: 'Du wurdest aus dem Raum entfernt.' }); s.ws.room = null; }
      if (room.host > i) room.host--;
      broadcast(room);
      return;
    }
    case 'setColor': {
      if (!room || room.game || seatIdx < 0) return;
      if (!PLAYER_COLORS.some((c) => c.id === msg.color)) return;
      const target = Number.isInteger(msg.seat) && isHost ? msg.seat : seatIdx;
      if (!room.seats[target] || room.seats.some((s, i) => i !== target && s.color === msg.color)) return;
      room.seats[target].color = msg.color;
      broadcast(room);
      return;
    }
    case 'setName': {
      if (!room || room.game || seatIdx < 0) return;
      room.seats[seatIdx].name = cleanName(msg.name, room.seats[seatIdx].name);
      broadcast(room);
      return;
    }
    case 'setOptions': {
      if (!isHost || room.game) return;
      if ([8, 10, 12, 14].includes(msg.vpToWin)) room.vpToWin = msg.vpToWin;
      broadcast(room);
      return;
    }
    case 'start': {
      if (!isHost || room.game) return;
      if (room.seats.length < 2) return send(ws, { t: 'error', msg: 'Mindestens 2 Spieler (Bots zählen mit).' });
      startGame(room);
      return;
    }
    case 'rematch': {
      if (!isHost || !room.game || room.game.phase !== 'ended') return;
      startGame(room);
      return;
    }
    case 'action': {
      if (!room || !room.game || seatIdx < 0) return;
      const r = applyAction(room.game, seatIdx, msg.action || {});
      if (!r.ok) return send(ws, { t: 'error', msg: r.error });
      broadcast(room);
      pump(room);
      return;
    }
    case 'chat': {
      if (!room || seatIdx < 0) return;
      const text = String(msg.text || '').trim().slice(0, 240);
      if (!text) return;
      const entry = { t: 'chat', seat: seatIdx, name: room.seats[seatIdx].name, color: room.seats[seatIdx].color, text, at: Date.now() };
      for (const s of room.seats) send(s.ws, entry);
      for (const sp of room.spectators) send(sp, entry);
      return;
    }
    default:
  }
}

function addBot(room) {
  const used = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.seats.length}`;
  room.seats.push({ token: `bot-${crypto.randomUUID()}`, name, color: freeColor(room), isBot: true, ws: null, disconnectedAt: null });
}

function leaveRoom(ws, explicit = false) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  ws.room = null;
  if (!room) return;
  room.spectators.delete(ws);
  const i = room.seats.findIndex((s) => s.ws === ws);
  if (i < 0) return;
  if (!room.game && explicit) {
    room.seats.splice(i, 1);
    if (!room.seats.some((s) => !s.isBot)) { rooms.delete(room.code); return; }
    if (room.host === i || room.host >= room.seats.length) room.host = room.seats.findIndex((s) => !s.isBot);
    else if (room.host > i) room.host--;
  } else {
    room.seats[i].ws = null;
    room.seats[i].disconnectedAt = Date.now();
    if (explicit && room.game) room.seats[i].disconnectedAt = 1; // sofort vom Bot übernehmen lassen
    setTimeout(() => pump(room), AUTOPILOT_AFTER_MS + 500);
  }
  broadcast(room);
  pump(room);
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!ws.token && msg.t !== 'hello') return;
    try { handle(ws, msg); } catch (e) { console.error(e); send(ws, { t: 'error', msg: 'Serverfehler.' }); }
  });
  ws.on('close', () => leaveRoom(ws));
});

// Verbindungen prüfen & alte Räume aufräumen
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.seats.some((s) => s.ws) || room.spectators.size;
    if (!anyone && now - room.lastActive > (room.game ? ROOM_TTL_MS : 30 * 60 * 1000)) {
      clearTimeout(room.timer);
      rooms.delete(code);
    }
  }
}, 30_000);

server.listen(PORT, () => {
  console.log(`Siedlungen läuft auf http://localhost:${PORT}`);
});
