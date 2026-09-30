import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { validSettlementSpots, validRoadSpots, robberHexes, stealCandidates, RESOURCES } from '../shared/engine.js';

function startServer(port, env = {}) {
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), BOT_DELAY_SCALE: '0.02', PERSIST: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes('läuft')) resolve(proc); });
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server startet nicht')), 5000);
  });
}

function client(port, token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const c = { ws, token, state: null, room: null, you: null, local: null, games: null, waiters: [] };
  ws.on('message', (d) => {
    const msg = JSON.parse(d);
    if (msg.t === 'welcome') c.token = msg.token;
    if (msg.t === 'games') c.games = msg.games;
    if (msg.t === 'room') { c.room = msg.room; c.you = msg.you; c.local = msg.local; }
    if (msg.t === 'state') { c.state = msg.state; if (c.auto) play(c); }
    c.waiters = c.waiters.filter((w) => !w(msg));
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = (pred, ms = 8000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Timeout')), ms);
    t.unref();
    c.waiters.push((m) => { if (pred(m)) { clearTimeout(t); res(m); return true; } return false; });
  });
  c.open = new Promise((r) => ws.on('open', () => { c.send({ t: 'hello', token }); r(); }));
  return c;
}

// Spielt einfache gültige Züge für den Platz, den der Server gerade als „du“ meldet
function play(c) {
  const st = c.state;
  const me = c.you;
  if (!st || me === null || st.phase === 'ended') return;
  const a = (action) => setTimeout(() => c.send({ t: 'action', seat: me, action }), 1);
  if (st.phase === 'setup') {
    if (st.current !== me) return;
    a(st.setup.step === 'settlement'
      ? { type: 'placeSettlement', vertex: validSettlementSpots(st, me, true)[0] }
      : { type: 'placeRoad', edge: validRoadSpots(st, me, st.setup.lastVertex)[0] });
    return;
  }
  if (st.turn.pending === 'discard' && st.turn.discards[me]) {
    const res = { ...st.players[me].resources };
    const out = {};
    for (let i = 0; i < st.turn.discards[me]; i++) { const r = RESOURCES.find((x) => res[x] > 0); res[r]--; out[r] = (out[r] || 0) + 1; }
    a({ type: 'discard', resources: out });
    return;
  }
  if (st.current !== me) return;
  if (st.turn.pending === 'robber') { const hex = robberHexes(st)[0]; a({ type: 'moveRobber', hex, victim: stealCandidates(st, hex, me)[0] }); }
  else if (!st.turn.rolled) a({ type: 'roll' });
  else if (!st.trade) a({ type: 'endTurn' });
}

test('Hot-Seat: zwei Spieler an einem Gerät plus KI spielen bis zum Sieg', { timeout: 60000 }, async () => {
  const port = 6100 + Math.floor(Math.random() * 300);
  const server = await startServer(port);
  const c = client(port);
  try {
    await c.open;
    await c.wait((m) => m.t === 'welcome');
    c.send({ t: 'createRoom', hotseat: true, players: ['Anna', 'Ben'], bots: 1 });
    await c.wait((m) => m.t === 'state');
    assert.deepEqual(c.local, [0, 1], 'beide Plätze gehören zu diesem Gerät');
    assert.equal(c.room.hotseat, true);
    assert.equal(c.state.players.length, 3);
    // Sicht zeigt nur die Hand des aktiven lokalen Spielers
    const other = c.local.find((i) => i !== c.you);
    assert.equal(c.state.players[other].resources, null);
    const seen = new Set();
    c.auto = true;
    play(c);
    const end = await c.wait((m) => {
      if (m.t === 'room') seen.add(m.you);
      return m.t === 'state' && m.state.phase === 'ended';
    }, 55000);
    assert.ok(seen.has(0) && seen.has(1), 'die Ansicht wechselt zwischen den lokalen Spielern');
    assert.ok(end.state.winner !== null);
  } finally {
    c.ws.terminate();
    server.kill();
  }
});

test('Partien überleben einen Server-Neustart', { timeout: 30000 }, async () => {
  const port = 6500 + Math.floor(Math.random() * 300);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siedlungen-'));
  const env = { PERSIST: '1', DATA_DIR: dir };
  let server = await startServer(port, env);
  const c = client(port);
  let token;
  let code;
  let island;
  try {
    await c.open;
    await c.wait((m) => m.t === 'welcome');
    token = c.token;
    c.send({ t: 'createRoom', name: 'Anna', solo: true, bots: 2 });
    const st = await c.wait((m) => m.t === 'state');
    code = c.room.code;
    island = st.state.islandName;
    await new Promise((r) => setTimeout(r, 2200)); // Speichern ist entprellt
    assert.ok(fs.existsSync(path.join(dir, 'rooms.json')));
  } finally {
    c.ws.terminate();
    server.kill();
  }
  await new Promise((r) => setTimeout(r, 300));
  server = await startServer(port, env);
  const c2 = client(port, token);
  try {
    await c2.open;
    const g = await c2.wait((m) => m.t === 'games');
    assert.ok(g.games.some((x) => x.code === code), 'gespeicherte Partie wird gelistet');
    c2.send({ t: 'joinRoom', code });
    const st = await c2.wait((m) => m.t === 'state');
    assert.equal(st.state.islandName, island);
    assert.equal(c2.you, 0, 'Platz wird über das Token wiedererkannt');
    c2.send({ t: 'deleteGame', code });
    const after = await c2.wait((m) => m.t === 'games');
    assert.ok(!after.games.some((x) => x.code === code), 'Partie lässt sich aus der Liste entfernen');
  } finally {
    c2.ws.terminate();
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
