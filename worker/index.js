// Cloudflare-Version des Servers: Worker + ein Durable Object, das alle Räume verwaltet.
// Die statischen Dateien (dist/, siehe scripts/build-cloudflare.js) liefert Cloudflare direkt aus;
// dieser Worker bekommt nur /ws (WebSocket), /health und /api/admin/… (Statistik der Admin-Seite /admin).
//
// Das Durable Object nutzt die „WebSocket Hibernation API“: Ist gerade nichts zu tun, darf Cloudflare
// es schlafen legen, ohne dass die Verbindungen der Spieler abreißen. Danach wird der Zustand aus der
// eingebauten SQLite-Datenbank wiederhergestellt und jede Verbindung wieder ihrem Platz zugeordnet.
import { DurableObject } from 'cloudflare:workers';
import { createLobby } from '../server/lobby.js';
import { adminAllowed, gameStats } from '../server/admin.js';

const SAVE_DELAY_MS = 1500; // Speichern entprellen
const CHECK_EVERY_MS = 60_000; // Takt für Verbindungsprüfung, solange jemand verbunden ist
const SWEEP_EVERY_MS = 60 * 60 * 1000; // Aufräumen alter Räume, wenn niemand verbunden ist
const STALE_AFTER_MS = 3 * 60 * 1000; // so lange ohne „ping“ vom Browser → Verbindung gilt als tot

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/ws' || pathname === '/health' || pathname.startsWith('/api/')) {
      return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

// Verbindung, deren token/room den Ruhezustand überdauern (als „Attachment“ am WebSocket)
class Conn {
  constructor(ws, data) {
    this.ws = ws;
    this.data = { token: null, room: null, since: Date.now(), ...data };
  }

  get token() { return this.data.token; }
  set token(v) { this.data.token = v; this.persist(); }
  get room() { return this.data.room; }
  set room(v) { this.data.room = v; this.persist(); }

  persist() {
    try { this.ws.serializeAttachment(this.data); } catch { /* schon geschlossen */ }
  }

  send(text) {
    try { this.ws.send(text); } catch { /* schon geschlossen */ }
  }
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /** @type {Map<WebSocket, Conn>} */
    this.conns = new Map();
    this.dirty = new Set();
    this.saveTimer = null;
    this.lobby = createLobby({
      botDelayScale: Number(env.BOT_DELAY_SCALE ?? 1),
      onSave: (room) => this.queueSave(room.code),
      onDelete: (code) => this.queueSave(code),
      onGame: (r) => ctx.storage.sql.exec('INSERT OR REPLACE INTO games (id, started_at, data) VALUES (?, ?, ?)', r.id, r.startedAt, JSON.stringify(r)),
    });

    // Der Browser schickt regelmäßig „ping“; Cloudflare antwortet selbst, ohne das Objekt zu wecken.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, data TEXT NOT NULL)');
    for (const { code, data } of sql.exec('SELECT code, data FROM rooms')) {
      if (!this.lobby.restore(JSON.parse(data))) this.queueSave(code);
    }
    for (const ws of ctx.getWebSockets()) this.lobby.reattach(this.conn(ws));
  }

  conn(ws) {
    let c = this.conns.get(ws);
    if (!c) {
      c = new Conn(ws, ws.deserializeAttachment() ?? undefined);
      this.conns.set(ws, c);
    }
    return c;
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') {
      return Response.json({ ok: true, rooms: this.lobby.rooms.size, connections: this.ctx.getWebSockets().length });
    }
    if (pathname === '/api/admin/games') return this.admin(request);
    if (pathname.startsWith('/api/')) return new Response('Nicht gefunden', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket erwartet', { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    this.conn(server).persist();
    await this.scheduleAlarm(CHECK_EVERY_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Statistik für die Admin-Seite: GET liefert alle Partien, DELETE löscht sie
  admin(request) {
    const headers = { 'Cache-Control': 'no-store' };
    if (!adminAllowed(this.env.ADMIN_KEY, request.headers.get('X-Admin-Key'))) {
      return Response.json({ error: 'Admin-Schlüssel fehlt oder ist falsch.' }, { status: 401, headers });
    }
    const sql = this.ctx.storage.sql;
    if (request.method === 'DELETE') {
      sql.exec('DELETE FROM games');
      return Response.json({ ok: true }, { headers });
    }
    if (request.method !== 'GET') return new Response(null, { status: 405, headers });
    const records = sql.exec('SELECT data FROM games').toArray().map((row) => JSON.parse(row.data));
    return Response.json(gameStats(records, this.lobby.rooms), { headers });
  }

  webSocketMessage(ws, message) {
    this.lobby.message(this.conn(ws), message);
  }

  webSocketClose(ws, code, reason) {
    this.drop(ws);
    try { ws.close(code, reason); } catch { /* bereits zu */ }
  }

  webSocketError(ws) {
    this.drop(ws);
  }

  drop(ws) {
    const c = this.conn(ws);
    this.conns.delete(ws);
    this.lobby.disconnect(c);
  }

  async alarm() {
    const now = Date.now();
    // Verbindungen ohne Lebenszeichen schließen, damit nach 45 s ein Bot übernehmen kann
    for (const ws of this.ctx.getWebSockets()) {
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(pinged, this.conn(ws).data.since) > STALE_AFTER_MS) {
        this.drop(ws);
        try { ws.close(4000, 'Keine Antwort'); } catch { /* bereits zu */ }
      }
    }
    this.lobby.tick(now);
    this.flush();
    if (this.ctx.getWebSockets().length) await this.scheduleAlarm(CHECK_EVERY_MS);
    else if (this.lobby.rooms.size) await this.scheduleAlarm(SWEEP_EVERY_MS);
  }

  async scheduleAlarm(ms) {
    const at = Date.now() + ms;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > at) await this.ctx.storage.setAlarm(at);
  }

  // ---------- Speichern (ein Datensatz pro Raum) ----------

  queueSave(code) {
    this.dirty.add(code);
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.flush();
      }, SAVE_DELAY_MS);
    }
  }

  flush() {
    const sql = this.ctx.storage.sql;
    for (const code of this.dirty) {
      const room = this.lobby.rooms.get(code);
      if (room) sql.exec('INSERT OR REPLACE INTO rooms (code, data) VALUES (?, ?)', code, JSON.stringify(this.lobby.serialize(room)));
      else sql.exec('DELETE FROM rooms WHERE code = ?', code);
    }
    this.dirty.clear();
  }
}
