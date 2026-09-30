// HTTP + WebSocket-Server: Räume, Lobby, Hot-Seat, Speicherstände, autoritative Spiellogik, Bots.
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame, applyAction, viewFor, pendingActors, playerVP, PLAYER_COLORS } from '../shared/engine.js';
import { botAction, botDelay } from './bot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5274;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'rooms.json');
const PERSIST = process.env.PERSIST !== '0';
const MAX_SEATS = 4;
const BOT_NAMES = ['Eleonore', 'Rowan', 'Finn', 'Mira', 'Tobias', 'Ida', 'Konrad', 'Lotte'];
const AUTOPILOT_AFTER_MS = 45_000; // getrennte Spieler übernimmt nach dieser Zeit ein Bot
const ROOM_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const BOT_DELAY_SCALE = Number(process.env.BOT_DELAY_SCALE ?? 1); // 0 = Bots ohne Pause (Tests)
const PACE = { relaxed: 1.6, normal: 1, fast: 0.45 };
const AFTER_ROLL_MS = 3800; // Zeit für die Würfel-Kamerafahrt, bevor ein Bot weiterspielt

const app = express();
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'client')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/** @type {Map<string, any>} */
const rooms = new Map();

// ---------- Speichern & Laden ----------

let saveTimer = null;
function scheduleSave() {
  if (!PERSIST || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = [...rooms.values()].map((r) => ({
      code: r.code, host: r.host, vpToWin: r.vpToWin, hotseat: r.hotseat, pace: r.pace,
      lastActive: r.lastActive, createdAt: r.createdAt, game: r.game,
      seats: r.seats.map(({ token, name, color, isBot, left }) => ({ token, name, color, isBot, left })),
    }));
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
    for (const r of data) {
      if (Date.now() - r.lastActive > ROOM_TTL_MS) continue;
      rooms.set(r.code, {
        ...r,
        seats: r.seats.map((s) => ({ ...s, ws: null, disconnectedAt: Date.now() })),
        spectators: new Set(),
        timer: null,
      });
    }
    if (rooms.size) console.log(`${rooms.size} gespeicherte Partie(n) geladen.`);
  } catch { /* noch keine Speicherdatei */ }
}

// ---------- Hilfsfunktionen ----------

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

function freeColor(room) {
  const used = new Set(room.seats.map((s) => s.color));
  return PLAYER_COLORS.find((c) => !used.has(c.id))?.id || 'red';
}

function cleanName(name, fallback) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return n || fallback;
}

function mySeats(room, ws) {
  return room.seats.map((s, i) => (s.token === ws.token ? i : -1)).filter((i) => i >= 0);
}

// Im Hot-Seat-Modus: der lokale Spieler, der gerade handeln muss
function activeLocalSeat(room, token) {
  const local = room.seats.map((s, i) => (s.token === token && !s.isBot ? i : -1)).filter((i) => i >= 0);
  if (!room.game) return local[0];
  const g = room.game;
  const actors = [...pendingActors(g)];
  const found = actors.find((i) => local.includes(i));
  if (found !== undefined) room.lastLocal = found;
  return found ?? (local.includes(room.lastLocal) ? room.lastLocal : local[0]);
}

function seatFor(room, ws, requested) {
  const mine = mySeats(room, ws);
  if (mine.length <= 1) return mine.length ? mine[0] : -1;
  if (Number.isInteger(requested) && mine.includes(requested)) return requested;
  return activeLocalSeat(room, ws.token);
}

function roomInfo(room) {
  return {
    code: room.code,
    host: room.host,
    started: !!room.game,
    vpToWin: room.vpToWin,
    hotseat: !!room.hotseat,
    pace: room.pace,
    seats: room.seats.map((s, i) => ({ seat: i, name: s.name, color: s.color, isBot: s.isBot, connected: s.isBot || !!s.ws, left: !!s.left })),
  };
}

function broadcast(room) {
  room.lastActive = Date.now();
  const info = roomInfo(room);
  const sockets = new Map();
  room.seats.forEach((s) => { if (s.ws) sockets.set(s.ws, s.token); });
  for (const [ws, token] of sockets) {
    const mine = room.seats.map((s, i) => (s.token === token ? i : -1)).filter((i) => i >= 0);
    const you = mine.length > 1 ? activeLocalSeat(room, token) : mine[0];
    send(ws, { t: 'room', room: info, you, local: mine.length > 1 ? mine : undefined });
    if (room.game) send(ws, { t: 'state', state: viewFor(room.game, you) });
  }
  for (const ws of room.spectators) {
    send(ws, { t: 'room', room: info, you: null });
    if (room.game) send(ws, { t: 'state', state: viewFor(room.game, -1) });
  }
  scheduleSave();
}

// Liste der eigenen, noch laufenden Partien für das Startmenü
function gamesFor(token) {
  const list = [];
  for (const r of rooms.values()) {
    const seat = r.seats.findIndex((s) => s.token === token && !s.left);
    if (seat < 0 || !r.game) continue;
    const g = r.game;
    list.push({
      code: r.code,
      island: g.islandName,
      phase: g.phase,
      turn: g.turn.number,
      round: g.turn.round,
      hotseat: !!r.hotseat,
      lastActive: r.lastActive,
      you: seat,
      vp: playerVP(g, seat, true),
      vpToWin: g.vpToWin,
      winner: g.winner,
      players: g.players.map((p) => ({ name: p.name, color: p.color, isBot: p.isBot })),
    });
  }
  return list.sort((a, b) => b.lastActive - a.lastActive).slice(0, 12);
}

function isAutomated(room, idx) {
  const s = room.seats[idx];
  if (!s) return false;
  if (s.isBot) return true;
  if (s.ws || !s.disconnectedAt || Date.now() - s.disconnectedAt < AUTOPILOT_AFTER_MS) return false;
  // Nur übernehmen, wenn noch jemand anderes am Tisch sitzt und wartet
  return room.seats.some((o) => o.ws && o.token !== s.token);
}

function botWait(room) {
  const g = room.game;
  const last = g.events[g.events.length - 1];
  const base = last && last.seq === g.seq && last.type === 'roll' ? AFTER_ROLL_MS : botDelay(g);
  return base * (PACE[room.pace] || 1) * BOT_DELAY_SCALE;
}

// Führt anstehende Bot-Züge nacheinander mit kleiner Pause aus.
function pump(room) {
  if (!room.game || room.timer || room.game.phase === 'ended') return;
  const g = room.game;
  const actors = pendingActors(g).filter((i) => isAutomated(room, i));
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
  }, botWait(room));
}

function startGame(room) {
  room.game = createGame({
    players: room.seats.map((s) => ({ name: s.name, color: s.color, isBot: s.isBot })),
    seed: crypto.randomInt(2 ** 31),
    vpToWin: room.vpToWin,
  });
  room.lastLocal = undefined;
  broadcast(room);
  pump(room);
}

function newRoom(ws, msg) {
  return {
    code: makeCode(), host: 0, seats: [], spectators: new Set(), game: null, timer: null,
    vpToWin: [8, 10, 12, 14].includes(msg.vpToWin) ? msg.vpToWin : 10,
    hotseat: false, pace: PACE[msg.pace] ? msg.pace : 'normal',
    lastActive: Date.now(), createdAt: Date.now(),
  };
}

function addBot(room) {
  const used = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.seats.length}`;
  room.seats.push({ token: `bot-${crypto.randomUUID()}`, name, color: freeColor(room), isBot: true, ws: null, disconnectedAt: null });
}

// ---------- Nachrichten ----------

function handle(ws, msg) {
  const room = ws.room ? rooms.get(ws.room) : null;
  const seatIdx = room ? seatFor(room, ws, msg.seat) : -1;
  const isHost = room && room.seats[room.host]?.token === ws.token;

  switch (msg.t) {
    case 'hello': {
      ws.token = typeof msg.token === 'string' && msg.token.length >= 16 ? msg.token : crypto.randomUUID();
      send(ws, { t: 'welcome', token: ws.token, colors: PLAYER_COLORS });
      send(ws, { t: 'games', games: gamesFor(ws.token) });
      return;
    }
    case 'listGames': {
      send(ws, { t: 'games', games: gamesFor(ws.token) });
      return;
    }
    case 'deleteGame': {
      const r = rooms.get(String(msg.code || ''));
      if (!r) return;
      for (const s of r.seats) {
        if (s.token === ws.token) { s.left = true; if (s.ws === ws) s.ws = null; s.disconnectedAt = 1; }
      }
      if (!r.seats.some((s) => !s.isBot && !s.left)) { clearTimeout(r.timer); rooms.delete(r.code); scheduleSave(); } else broadcast(r);
      send(ws, { t: 'games', games: gamesFor(ws.token) });
      return;
    }
    case 'createRoom': {
      leaveRoom(ws);
      const r = newRoom(ws, msg);
      if (msg.hotseat) {
        r.hotseat = true;
        const names = (Array.isArray(msg.players) ? msg.players : []).slice(0, MAX_SEATS);
        if (names.length < 1) names.push(msg.name);
        names.forEach((n, i) => {
          r.seats.push({ token: ws.token, name: cleanName(n, `Spieler ${i + 1}`), color: PLAYER_COLORS[i].id, isBot: false, ws, disconnectedAt: null });
        });
        const bots = Math.max(0, Math.min(MAX_SEATS - r.seats.length, Number(msg.bots) || 0));
        for (let i = 0; i < bots; i++) addBot(r);
      } else {
        r.seats.push({ token: ws.token, name: cleanName(msg.name, 'Du'), color: 'red', isBot: false, ws, disconnectedAt: null });
        if (msg.solo) {
          const bots = Math.min(3, Math.max(1, Number(msg.bots) || 3));
          for (let i = 0; i < bots; i++) addBot(r);
        }
      }
      rooms.set(r.code, r);
      ws.room = r.code;
      if ((msg.solo || msg.hotseat) && r.seats.length >= 2) startGame(r);
      else broadcast(r);
      return;
    }
    case 'joinRoom': {
      const code = String(msg.code || '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: 'error', msg: 'Diesen Raum gibt es nicht (mehr).' });
      leaveRoom(ws);
      const existing = r.seats.filter((s) => s.token === ws.token && !s.left);
      ws.room = code;
      if (existing.length) {
        for (const s of existing) {
          if (s.ws && s.ws !== ws) { send(s.ws, { t: 'kicked', msg: 'In einem anderen Tab geöffnet.' }); s.ws.room = null; }
          s.ws = ws;
          s.disconnectedAt = null;
        }
        if (!r.game && msg.name && existing.length === 1) existing[0].name = cleanName(msg.name, existing[0].name);
      } else if (!r.game && !r.hotseat && r.seats.length < MAX_SEATS) {
        r.seats.push({ token: ws.token, name: cleanName(msg.name, `Spieler ${r.seats.length + 1}`), color: freeColor(r), isBot: false, ws, disconnectedAt: null });
      } else if (!r.game && !r.hotseat) {
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
      send(ws, { t: 'games', games: gamesFor(ws.token) });
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
      if (s.ws && s.ws !== ws) { send(s.ws, { t: 'kicked', msg: 'Du wurdest aus dem Raum entfernt.' }); s.ws.room = null; }
      if (room.host > i) room.host--;
      broadcast(room);
      return;
    }
    case 'setColor': {
      if (!room || room.game || seatIdx < 0) return;
      if (!PLAYER_COLORS.some((c) => c.id === msg.color)) return;
      const target = Number.isInteger(msg.seat) && (isHost || room.seats[msg.seat]?.token === ws.token) ? msg.seat : seatIdx;
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
      if (!isHost) return;
      if (!room.game && [8, 10, 12, 14].includes(msg.vpToWin)) room.vpToWin = msg.vpToWin;
      if (PACE[msg.pace]) room.pace = msg.pace;
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
      const sent = new Set();
      for (const s of room.seats) { if (s.ws && !sent.has(s.ws)) { sent.add(s.ws); send(s.ws, entry); } }
      for (const sp of room.spectators) send(sp, entry);
      return;
    }
    default:
  }
}

function leaveRoom(ws, explicit = false) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  ws.room = null;
  if (!room) return;
  room.spectators.delete(ws);
  const idxs = room.seats.map((s, i) => (s.ws === ws ? i : -1)).filter((i) => i >= 0);
  if (!idxs.length) return;
  if (!room.game && explicit) {
    const hostToken = room.seats[room.host]?.token;
    room.seats = room.seats.filter((s) => s.ws !== ws);
    if (!room.seats.some((s) => !s.isBot)) { rooms.delete(room.code); scheduleSave(); return; }
    const h = room.seats.findIndex((s) => s.token === hostToken);
    room.host = h >= 0 ? h : room.seats.findIndex((s) => !s.isBot);
  } else {
    for (const i of idxs) {
      room.seats[i].ws = null;
      room.seats[i].disconnectedAt = explicit && room.game ? 1 : Date.now(); // 1 = sofort vom Bot übernehmen
    }
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
    const ttl = room.game ? ROOM_TTL_MS : 30 * 60 * 1000;
    if (!anyone && now - room.lastActive > ttl) {
      clearTimeout(room.timer);
      rooms.delete(code);
      scheduleSave();
    }
  }
}, 30_000);

loadRooms();
server.listen(PORT, () => {
  console.log(`Siedlungen läuft auf http://localhost:${PORT}`);
});
