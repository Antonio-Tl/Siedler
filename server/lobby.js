// Plattformunabhängige Raumverwaltung: Lobby, Hot-Seat, autoritative Spiellogik, Bots.
// Genutzt vom Node-Server (server/index.js) und vom Cloudflare-Worker (worker/index.js).
// Eine Verbindung („conn“) braucht nur: token, room (beide beschreibbar) und send(text).
import { randomInt, randomUUID } from 'node:crypto';
import { createGame, applyAction, viewFor, pendingActors, playerVP, PLAYER_COLORS } from '../shared/engine.js';
import { botAction, botDelay } from './bot.js';

const MAX_SEATS = 4;
const BOT_NAMES = ['Eleonore', 'Rowan', 'Finn', 'Mira', 'Tobias', 'Ida', 'Konrad', 'Lotte'];
const AUTOPILOT_AFTER_MS = 45_000; // getrennte Spieler übernimmt nach dieser Zeit ein Bot
const ROOM_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const LOBBY_TTL_MS = 30 * 60 * 1000; // nie gestartete Räume
const PACE = { relaxed: 1.6, normal: 1, fast: 0.45 };
const AFTER_ROLL_MS = 3800; // Zeit für die Würfel-Kamerafahrt, bevor ein Bot weiterspielt
export const TURN_TIMES = [0, 60, 90, 120, 180, 300]; // Zugzeit in Sekunden (0 = ohne Zeitlimit)
const DEFAULT_TURN_TIME = 120; // für Online-Räume mit Freunden
const DISCARD_MAX_MS = 45_000; // Zeit zum Abwerfen nach einer 7 (höchstens so lang wie ein Zug)

/**
 * @param {object} [opts]
 * @param {number} [opts.botDelayScale] 0 = Bots ohne Pause (Tests)
 * @param {(room: any) => void} [opts.onSave] Raum hat sich geändert und sollte gespeichert werden
 * @param {(code: string) => void} [opts.onDelete] Raum wurde entfernt
 * @param {(record: any) => void} [opts.onGame] Statistik-Eintrag einer Partie anlegen oder ersetzen (gleiche id)
 */
export function createLobby({ botDelayScale = 1, onSave = () => {}, onDelete = () => {}, onGame = () => {} } = {}) {
  /** @type {Map<string, any>} */
  const rooms = new Map();

  function dropRoom(room) {
    clearTimeout(room.timer);
    clearTimeout(room.clockTimer);
    if (room.game && room.gameId && !room.gameEndedAt) onGame({ ...gameRecord(room), abandonedAt: Date.now() });
    rooms.delete(room.code);
    onDelete(room.code);
  }

  // ---------- Hilfsfunktionen ----------

  function makeCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (rooms.has(code));
    return code;
  }

  function send(conn, msg) {
    if (conn) conn.send(JSON.stringify(msg));
  }

  function freeColor(room) {
    const used = new Set(room.seats.map((s) => s.color));
    return PLAYER_COLORS.find((c) => !used.has(c.id))?.id || 'red';
  }

  function cleanName(name, fallback) {
    const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    return n || fallback;
  }

  function mySeats(room, conn) {
    return room.seats.map((s, i) => (s.token === conn.token ? i : -1)).filter((i) => i >= 0);
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

  function seatFor(room, conn, requested) {
    const mine = mySeats(room, conn);
    if (mine.length <= 1) return mine.length ? mine[0] : -1;
    if (Number.isInteger(requested) && mine.includes(requested)) return requested;
    return activeLocalSeat(room, conn.token);
  }

  function roomInfo(room) {
    return {
      code: room.code,
      host: room.host,
      started: !!room.game,
      vpToWin: room.vpToWin,
      hotseat: !!room.hotseat,
      pace: room.pace,
      turnTime: room.turnTime || 0,
      seats: room.seats.map((s, i) => ({ seat: i, name: s.name, color: s.color, isBot: s.isBot, connected: s.isBot || !!s.conn, left: !!s.left, away: !!s.away })),
    };
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    if (room.game?.phase === 'ended' && room.gameId && !room.gameEndedAt) {
      room.gameEndedAt = room.lastActive;
      onGame(gameRecord(room));
    }
    syncClock(room);
    const info = roomInfo(room);
    const clock = clockInfo(room);
    const conns = new Map();
    room.seats.forEach((s) => { if (s.conn) conns.set(s.conn, s.token); });
    for (const [conn, token] of conns) {
      const mine = room.seats.map((s, i) => (s.token === token ? i : -1)).filter((i) => i >= 0);
      const you = mine.length > 1 ? activeLocalSeat(room, token) : mine[0];
      send(conn, { t: 'room', room: info, you, local: mine.length > 1 ? mine : undefined });
      if (room.game) send(conn, { t: 'state', state: viewFor(room.game, you), clock });
    }
    for (const conn of room.spectators) {
      send(conn, { t: 'room', room: info, you: null });
      if (room.game) send(conn, { t: 'state', state: viewFor(room.game, -1), clock });
    }
    onSave(room);
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
    if (s.conn || !s.disconnectedAt || Date.now() - s.disconnectedAt < AUTOPILOT_AFTER_MS) return false;
    // Nur übernehmen, wenn noch jemand anderes am Tisch sitzt und wartet
    return room.seats.some((o) => o.conn && o.token !== s.token);
  }

  function botWait(room) {
    const g = room.game;
    const last = g.events[g.events.length - 1];
    const base = last && last.seq === g.seq && last.type === 'roll' ? AFTER_ROLL_MS : botDelay(g);
    return base * (PACE[room.pace] || 1) * botDelayScale;
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

  // Eintrag in Chronik und Ereignisliste, wie ihn auch die Spiellogik schreibt
  function note(g, player, text, icon, event) {
    g.log.push({ player, text, icon, turn: g.turn ? g.turn.number : 0 });
    if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
    if (event) {
      g.seq += 1;
      g.events.push({ ...event, seq: g.seq });
      if (g.events.length > 30) g.events.splice(0, g.events.length - 30);
    }
  }

  // Sitzt außer diesem Spieler noch ein Mensch am Tisch, der etwas mitbekommen sollte?
  function othersAtTable(room, token) {
    return room.seats.some((o) => !o.isBot && !o.left && o.token !== token);
  }

  // Spieler verlässt eine laufende Partie: eine KI übernimmt sofort, die anderen werden informiert
  function markAway(room, idxs) {
    const g = room.game;
    for (const i of idxs) {
      const s = room.seats[i];
      if (s.away || s.isBot) continue;
      s.away = true;
      if (g && g.phase !== 'ended' && othersAtTable(room, s.token)) {
        note(g, i, `${s.name} hat die Partie verlassen. Eine KI spielt für ${s.name} weiter.`, 'leave', { type: 'left', player: i });
      }
    }
  }

  // ---------- Zugzeit ----------
  // Die Uhr läuft pro Zug (in der Gründung pro Bauschritt). Nach einer 7 pausiert sie, solange abgeworfen
  // wird – das Abwerfen hat eine eigene, kürzere Frist. Sitzt kein Mensch verbunden am Tisch, steht sie still.

  function clockKey(g) {
    if (g.phase === 'setup') return `s:${g.setup.index}:${g.setup.step}`;
    return `p:${g.turn.number}`;
  }

  function syncClock(room, now = Date.now()) {
    const g = room.game;
    const limit = (room.turnTime || 0) * 1000;
    if (!g || !limit || (g.phase !== 'setup' && g.phase !== 'play')) {
      room.clock = null;
      clearTimeout(room.clockTimer);
      return;
    }
    const key = clockKey(g);
    let c = room.clock;
    if (!c || c.key !== key) c = room.clock = { key, endsAt: now + limit, discard: null, pausedAt: null };
    const watched = room.seats.some((s) => !s.isBot && s.conn);
    if (!watched && !c.pausedAt) c.pausedAt = now;
    if (watched && c.pausedAt) {
      const d = now - c.pausedAt;
      c.endsAt += d;
      if (c.discard) { c.discard.since += d; c.discard.endsAt += d; }
      c.pausedAt = null;
    }
    const discarding = g.phase === 'play' && g.turn.pending === 'discard';
    if (discarding && !c.discard) c.discard = { since: now, endsAt: now + Math.min(limit, DISCARD_MAX_MS) };
    if (!discarding && c.discard) {
      c.endsAt += now - c.discard.since;
      c.discard = null;
    }
    clearTimeout(room.clockTimer);
    if (c.pausedAt) return;
    const due = (c.discard ? c.discard.endsAt : c.endsAt) - now;
    room.clockTimer = setTimeout(() => checkClock(room), Math.max(0, due) + 50);
    room.clockTimer?.unref?.(); // Node: die Uhr allein hält den Prozess nicht am Leben (z. B. in Tests)
  }

  // Was mindestens geschehen muss, damit es weitergeht – gebaut oder gehandelt wird nicht automatisch
  function forcedAction(g, idx) {
    const t = g.turn;
    if (g.phase === 'setup') return g.current === idx ? botAction(g, idx) : null;
    if (t.pending === 'discard') return t.discards?.[idx] ? botAction(g, idx) : null;
    if (g.trade) {
      if (g.trade.from === idx) return { type: 'cancelTrade' };
      if (g.trade.responses[idx] === 'pending') return { type: 'respondTrade', response: 'decline' };
      return null;
    }
    if (g.current !== idx) return null;
    if (t.pending === 'robber') return botAction(g, idx);
    if (t.freeRoads > 0) {
      const a = botAction(g, idx);
      if (a) return a;
      t.freeRoads = 0; // kein Platz mehr für kostenlose Straßen
    }
    return t.rolled ? { type: 'endTurn' } : { type: 'roll' };
  }

  function checkClock(room, now = Date.now()) {
    const g = room.game;
    if (!g || rooms.get(room.code) !== room) return;
    syncClock(room, now);
    let c = room.clock;
    let changed = false;
    const timedOut = new Set();
    // Abgelaufene Fristen nacheinander abarbeiten; endet dabei der Zug, beginnt eine neue Frist
    for (let guard = 0; c && !c.pausedAt && guard < 12; guard++) {
      const discardPhase = !!c.discard;
      if ((discardPhase ? c.discard.endsAt : c.endsAt) > now) break;
      const actors = discardPhase
        ? Object.keys(g.turn.discards || {}).map(Number)
        : g.trade && g.trade.from === g.current ? [g.current] : pendingActors(g);
      let progressed = false;
      for (const idx of actors) {
        const action = forcedAction(g, idx);
        if (!action) continue;
        if (applyAction(g, idx, action).ok) {
          progressed = true;
          if (!g.players[idx].isBot) timedOut.add(idx);
        }
      }
      if (!progressed) break;
      changed = true;
      syncClock(room, now);
      c = room.clock;
    }
    for (const idx of timedOut) {
      note(g, idx, `Die Zeit von ${g.players[idx].name} ist abgelaufen – es geht automatisch weiter.`, 'hourglass', { type: 'timeout', player: idx });
    }
    if (changed) {
      broadcast(room);
      pump(room);
    }
  }

  function clockInfo(room, now = Date.now()) {
    const c = room.clock;
    if (!c || !room.game) return null;
    const limit = (room.turnTime || 0) * 1000;
    const ref = c.pausedAt || now;
    const discard = !!c.discard;
    const remaining = Math.max(0, (discard ? c.discard.endsAt : c.endsAt) - ref);
    return {
      mode: discard ? 'discard' : 'turn',
      total: discard ? Math.min(limit, DISCARD_MAX_MS) : limit,
      remaining,
      paused: !!c.pausedAt,
      actors: discard ? Object.keys(room.game.turn.discards || {}).map(Number) : pendingActors(room.game),
    };
  }

  // Eintrag für die Admin-Statistik (/admin) – bei Start, Sieg und Abbruch neu geschrieben
  function gameRecord(room) {
    const g = room.game;
    const humans = new Set(room.seats.filter((s) => !s.isBot).map((s) => s.token)).size;
    return {
      id: room.gameId,
      code: room.code,
      startedAt: room.gameStartedAt,
      endedAt: room.gameEndedAt || null,
      lastActive: room.lastActive,
      mode: room.hotseat ? 'hotseat' : humans > 1 ? 'online' : 'solo',
      island: g.islandName,
      vpToWin: g.vpToWin,
      players: g.players.map((p) => ({ name: p.name, color: p.color, isBot: p.isBot })),
      rounds: g.turn.round,
      winner: g.winner,
    };
  }

  function startGame(room) {
    room.game = createGame({
      players: room.seats.map((s) => ({ name: s.name, color: s.color, isBot: s.isBot })),
      seed: randomInt(2 ** 31),
      vpToWin: room.vpToWin,
    });
    room.lastLocal = undefined;
    room.clock = null;
    room.gameStartedAt = Date.now();
    room.gameEndedAt = null;
    room.gameId = `${room.code}-${room.gameStartedAt.toString(36)}`;
    for (const s of room.seats) s.away = false;
    onGame(gameRecord(room));
    broadcast(room);
    pump(room);
  }

  function newRoom(msg) {
    return {
      code: makeCode(), host: 0, seats: [], spectators: new Set(), game: null, timer: null,
      vpToWin: [8, 10, 12, 14].includes(msg.vpToWin) ? msg.vpToWin : 10,
      hotseat: false, pace: PACE[msg.pace] ? msg.pace : 'normal',
      // Gegen die KI und an einem Gerät wartet niemand – dort ist die Zugzeit zunächst aus
      turnTime: TURN_TIMES.includes(msg.turnTime) ? msg.turnTime : msg.solo || msg.hotseat ? 0 : DEFAULT_TURN_TIME,
      clock: null, clockTimer: null,
      lastActive: Date.now(), createdAt: Date.now(),
    };
  }

  function addBot(room) {
    const used = new Set(room.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.seats.length}`;
    room.seats.push({ token: `bot-${randomUUID()}`, name, color: freeColor(room), isBot: true, conn: null, disconnectedAt: null });
  }

  // ---------- Nachrichten ----------

  function handle(conn, msg) {
    const room = conn.room ? rooms.get(conn.room) : null;
    const seatIdx = room ? seatFor(room, conn, msg.seat) : -1;
    const isHost = room && room.seats[room.host]?.token === conn.token;

    switch (msg.t) {
      case 'hello': {
        conn.token = typeof msg.token === 'string' && msg.token.length >= 16 ? msg.token : randomUUID();
        send(conn, { t: 'welcome', token: conn.token, colors: PLAYER_COLORS });
        send(conn, { t: 'games', games: gamesFor(conn.token) });
        return;
      }
      case 'listGames': {
        send(conn, { t: 'games', games: gamesFor(conn.token) });
        return;
      }
      case 'deleteGame': {
        const r = rooms.get(String(msg.code || ''));
        if (!r) return;
        const mine = r.seats.map((s, i) => (s.token === conn.token && !s.left ? i : -1)).filter((i) => i >= 0);
        markAway(r, mine);
        for (const s of r.seats) {
          if (s.token === conn.token) { s.left = true; if (s.conn === conn) s.conn = null; s.disconnectedAt = 1; }
        }
        if (!r.seats.some((s) => !s.isBot && !s.left)) dropRoom(r); else broadcast(r);
        send(conn, { t: 'games', games: gamesFor(conn.token) });
        return;
      }
      case 'createRoom': {
        leaveRoom(conn);
        const r = newRoom(msg);
        if (msg.hotseat) {
          r.hotseat = true;
          const names = (Array.isArray(msg.players) ? msg.players : []).slice(0, MAX_SEATS);
          if (names.length < 1) names.push(msg.name);
          names.forEach((n, i) => {
            r.seats.push({ token: conn.token, name: cleanName(n, `Spieler ${i + 1}`), color: PLAYER_COLORS[i].id, isBot: false, conn, disconnectedAt: null });
          });
          const bots = Math.max(0, Math.min(MAX_SEATS - r.seats.length, Number(msg.bots) || 0));
          for (let i = 0; i < bots; i++) addBot(r);
        } else {
          r.seats.push({ token: conn.token, name: cleanName(msg.name, 'Du'), color: 'red', isBot: false, conn, disconnectedAt: null });
          if (msg.solo) {
            const bots = Math.min(3, Math.max(1, Number(msg.bots) || 3));
            for (let i = 0; i < bots; i++) addBot(r);
          }
        }
        rooms.set(r.code, r);
        conn.room = r.code;
        if ((msg.solo || msg.hotseat) && r.seats.length >= 2) startGame(r);
        else broadcast(r);
        return;
      }
      case 'joinRoom': {
        const code = String(msg.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) return send(conn, { t: 'error', msg: 'Diesen Raum gibt es nicht (mehr).' });
        leaveRoom(conn);
        const existing = r.seats.filter((s) => s.token === conn.token && !s.left);
        conn.room = code;
        if (existing.length) {
          for (const s of existing) {
            if (s.conn && s.conn !== conn) { send(s.conn, { t: 'kicked', msg: 'In einem anderen Tab geöffnet.' }); s.conn.room = null; }
            s.conn = conn;
            s.disconnectedAt = null;
            if (s.away) {
              s.away = false;
              const g = r.game;
              if (g && g.phase !== 'ended' && othersAtTable(r, s.token)) {
                const i = r.seats.indexOf(s);
                note(g, i, `${s.name} ist zurück und spielt wieder selbst.`, 'return', { type: 'returned', player: i });
              }
            }
          }
          if (!r.game && msg.name && existing.length === 1) existing[0].name = cleanName(msg.name, existing[0].name);
        } else if (!r.game && !r.hotseat && r.seats.length < MAX_SEATS) {
          r.seats.push({ token: conn.token, name: cleanName(msg.name, `Spieler ${r.seats.length + 1}`), color: freeColor(r), isBot: false, conn, disconnectedAt: null });
        } else if (!r.game && !r.hotseat) {
          const botSeat = r.seats.findIndex((s) => s.isBot);
          if (botSeat < 0) { conn.room = null; return send(conn, { t: 'error', msg: 'Der Raum ist voll.' }); }
          Object.assign(r.seats[botSeat], { token: conn.token, name: cleanName(msg.name, 'Gast'), isBot: false, conn, disconnectedAt: null });
        } else {
          r.spectators.add(conn);
          send(conn, { t: 'info', msg: 'Die Partie läuft bereits – du schaust zu.' });
        }
        broadcast(r);
        pump(r);
        return;
      }
      case 'leave': {
        leaveRoom(conn, true);
        send(conn, { t: 'left' });
        send(conn, { t: 'games', games: gamesFor(conn.token) });
        return;
      }
      case 'addBot': {
        if (!isHost || room.game) return;
        if (room.seats.length >= MAX_SEATS) return send(conn, { t: 'error', msg: 'Maximal 4 Spieler.' });
        addBot(room);
        broadcast(room);
        return;
      }
      case 'removeSeat': {
        if (!isHost || room.game) return;
        const i = Number(msg.seat);
        if (i === room.host || !room.seats[i]) return;
        const [s] = room.seats.splice(i, 1);
        if (s.conn && s.conn !== conn) { send(s.conn, { t: 'kicked', msg: 'Du wurdest aus dem Raum entfernt.' }); s.conn.room = null; }
        if (room.host > i) room.host--;
        broadcast(room);
        return;
      }
      case 'setColor': {
        if (!room || room.game || seatIdx < 0) return;
        if (!PLAYER_COLORS.some((c) => c.id === msg.color)) return;
        const target = Number.isInteger(msg.seat) && (isHost || room.seats[msg.seat]?.token === conn.token) ? msg.seat : seatIdx;
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
        if (TURN_TIMES.includes(msg.turnTime) && msg.turnTime !== room.turnTime) {
          room.turnTime = msg.turnTime;
          room.clock = null; // neue Zugzeit gilt ab sofort mit voller Frist
        }
        broadcast(room);
        return;
      }
      case 'start': {
        if (!isHost || room.game) return;
        if (room.seats.length < 2) return send(conn, { t: 'error', msg: 'Mindestens 2 Spieler (Bots zählen mit).' });
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
        // „forced“ (feste Augenzahlen) gibt es nur für Tests – Spieler würfeln immer zufällig
        const { forced, ...action } = msg.action || {};
        const r = applyAction(room.game, seatIdx, action);
        if (!r.ok) return send(conn, { t: 'error', msg: r.error });
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
        for (const s of room.seats) { if (s.conn && !sent.has(s.conn)) { sent.add(s.conn); send(s.conn, entry); } }
        for (const sp of room.spectators) send(sp, entry);
        return;
      }
      default:
    }
  }

  function leaveRoom(conn, explicit = false) {
    if (!conn.room) return;
    const room = rooms.get(conn.room);
    conn.room = null;
    if (!room) return;
    room.spectators.delete(conn);
    const idxs = room.seats.map((s, i) => (s.conn === conn ? i : -1)).filter((i) => i >= 0);
    if (!idxs.length) return;
    if (!room.game && explicit) {
      const hostToken = room.seats[room.host]?.token;
      room.seats = room.seats.filter((s) => s.conn !== conn);
      if (!room.seats.some((s) => !s.isBot)) { dropRoom(room); return; }
      const h = room.seats.findIndex((s) => s.token === hostToken);
      room.host = h >= 0 ? h : room.seats.findIndex((s) => !s.isBot);
    } else {
      if (explicit && room.game) markAway(room, idxs);
      for (const i of idxs) {
        room.seats[i].conn = null;
        room.seats[i].disconnectedAt = explicit && room.game ? 1 : Date.now(); // 1 = sofort vom Bot übernehmen
      }
      setTimeout(() => pump(room), AUTOPILOT_AFTER_MS + 500);
    }
    broadcast(room);
    pump(room);
  }

  // ---------- Schnittstelle für Server & Worker ----------

  return {
    rooms,

    /** Eingehende Nachricht (JSON-Text) einer Verbindung verarbeiten. */
    message(conn, text) {
      let msg;
      try { msg = JSON.parse(String(text)); } catch { return; } // z. B. „ping“
      if (!msg || typeof msg !== 'object') return;
      if (!conn.token && msg.t !== 'hello') return;
      try { handle(conn, msg); } catch (e) { console.error(e); send(conn, { t: 'error', msg: 'Serverfehler.' }); }
    },

    /** Verbindung wurde geschlossen. */
    disconnect(conn) {
      leaveRoom(conn);
    },

    /** Regelmäßig aufrufen: alte Räume aufräumen, liegengebliebene Bot-Züge anstoßen. */
    tick(now = Date.now()) {
      for (const room of rooms.values()) {
        const anyone = room.seats.some((s) => s.conn) || room.spectators.size;
        const ttl = room.game ? ROOM_TTL_MS : LOBBY_TTL_MS;
        if (!anyone && now - room.lastActive > ttl) dropRoom(room);
        else {
          pump(room);
          checkClock(room, now);
        }
      }
    },

    /** Speicherbare Form eines Raums (ohne Verbindungen und Timer). */
    serialize(room) {
      return {
        code: room.code, host: room.host, vpToWin: room.vpToWin, hotseat: room.hotseat, pace: room.pace,
        turnTime: room.turnTime || 0, clock: room.clock || null,
        lastActive: room.lastActive, createdAt: room.createdAt, lastLocal: room.lastLocal, game: room.game,
        gameId: room.gameId, gameStartedAt: room.gameStartedAt, gameEndedAt: room.gameEndedAt,
        seats: room.seats.map(({ token, name, color, isBot, left, away, disconnectedAt }) => ({ token, name, color, isBot, left, away, disconnectedAt })),
      };
    },

    /** Gespeicherten Raum wieder aufnehmen. Liefert false, wenn er abgelaufen ist. */
    restore(data, now = Date.now()) {
      if (now - data.lastActive > ROOM_TTL_MS) return false;
      rooms.set(data.code, {
        ...data,
        seats: data.seats.map((s) => ({ ...s, conn: null, disconnectedAt: s.disconnectedAt || now })),
        spectators: new Set(),
        timer: null,
        clockTimer: null,
        turnTime: data.turnTime || 0,
        clock: data.clock || null,
      });
      return true;
    },

    /** Noch offene Verbindung nach einem Neustart (z. B. Cloudflare-Ruhezustand) wieder ihrem Platz zuordnen. */
    reattach(conn) {
      const room = conn.room ? rooms.get(conn.room) : null;
      if (!room) { if (conn.room) conn.room = null; return; }
      const seats = room.seats.filter((s) => s.token === conn.token && !s.left);
      for (const s of seats) { s.conn = conn; s.disconnectedAt = null; }
      if (!seats.length) room.spectators.add(conn);
    },
  };
}
