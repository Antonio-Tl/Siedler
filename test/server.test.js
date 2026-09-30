import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { validSettlementSpots, validRoadSpots, robberHexes, stealCandidates, RESOURCES } from '../shared/engine.js';

const PORT = 5400 + Math.floor(Math.random() * 500);

function startServer() {
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), BOT_DELAY_SCALE: '0.02', PERSIST: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes('läuft')) resolve(proc); });
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server startet nicht')), 5000);
  });
}

// Minimaler Client: spielt einfache, gültige Züge für seinen Platz
const clients = [];
function client(name, token) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  clients.push(ws);
  const c = { ws, name, token, state: null, room: null, you: null, errors: [], waiters: [] };
  ws.on('message', (d) => {
    const msg = JSON.parse(d);
    if (msg.t === 'welcome') c.token = msg.token;
    if (msg.t === 'room') { c.room = msg.room; c.you = msg.you; }
    if (msg.t === 'state') { c.state = msg.state; c.play(); }
    if (msg.t === 'error') c.errors.push(msg.msg);
    c.waiters = c.waiters.filter((w) => !w(msg));
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = (pred, ms = 5000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`Timeout beim Warten (${name})`)), ms);
    t.unref(); // offene Wartetimer sollen den Testprozess nicht am Leben halten
    c.waiters.push((m) => { if (pred(m)) { clearTimeout(t); res(m); return true; } return false; });
  });
  c.open = new Promise((r) => ws.on('open', () => { c.send({ t: 'hello', token }); r(); }));
  c.play = () => {
    const st = c.state;
    const me = c.you;
    if (!st || me === null || st.phase === 'ended') return;
    const a = (action) => setTimeout(() => c.send({ t: 'action', action }), 1);
    if (st.phase === 'setup' && st.current === me) {
      if (st.setup.step === 'settlement') a({ type: 'placeSettlement', vertex: validSettlementSpots(st, me, true)[0] });
      else a({ type: 'placeRoad', edge: validRoadSpots(st, me, st.setup.lastVertex)[0] });
      return;
    }
    if (st.phase !== 'play') return;
    if (st.turn.pending === 'discard' && st.turn.discards[me]) {
      const res = { ...st.players[me].resources };
      const out = {};
      for (let i = 0; i < st.turn.discards[me]; i++) {
        const r = RESOURCES.find((x) => res[x] > 0);
        res[r]--; out[r] = (out[r] || 0) + 1;
      }
      a({ type: 'discard', resources: out });
      return;
    }
    if (st.trade && st.trade.status === 'pending' && st.trade.to === me) { a({ type: 'respondTrade', response: 'decline' }); return; }
    if (st.current !== me) return;
    if (st.turn.pending === 'robber') {
      const hex = robberHexes(st)[0];
      a({ type: 'moveRobber', hex, victim: stealCandidates(st, hex, me)[0] });
    } else if (!st.turn.rolled) a({ type: 'roll' });
    else if (!st.trade && !st.turn.pending) a({ type: 'endTurn' });
  };
  return c;
}

test('Zwei Menschen + Bots spielen online eine komplette Partie', { timeout: 60000 }, async () => {
  const server = await startServer();
  try {
    const alice = client('Alice');
    await alice.open;
    await alice.wait((m) => m.t === 'welcome');
    alice.send({ t: 'createRoom', name: 'Alice' });
    const { room } = await alice.wait((m) => m.t === 'room');
    assert.equal(room.seats.length, 1);

    const bob = client('Bob');
    await bob.open;
    await bob.wait((m) => m.t === 'welcome');
    bob.send({ t: 'joinRoom', code: room.code, name: 'Bob' });
    await bob.wait((m) => m.t === 'room' && m.room.seats.length === 2);
    assert.equal(bob.you, 1);

    bob.send({ t: 'start' }); // kein Gastgeber -> wird ignoriert
    alice.send({ t: 'addBot' });
    alice.send({ t: 'addBot' });
    await alice.wait((m) => m.t === 'room' && m.room.seats.length === 4);
    alice.send({ t: 'start' });
    await bob.wait((m) => m.t === 'state');
    assert.equal(bob.state.players.length, 4);
    assert.equal(bob.state.players[0].resources, null, 'fremde Hand ist verdeckt');

    // Bob trennt die Verbindung und kehrt mit seinem Token zurück
    await new Promise((r) => setTimeout(r, 300));
    const bobToken = bob.token;
    bob.ws.close();
    await new Promise((r) => setTimeout(r, 200));
    const bob2 = client('Bob', bobToken);
    await bob2.open;
    await bob2.wait((m) => m.t === 'welcome');
    bob2.send({ t: 'joinRoom', code: room.code });
    await bob2.wait((m) => m.t === 'state');
    assert.equal(bob2.you, 1, 'Bob erhält seinen Platz zurück');

    const end = await Promise.race([
      alice.wait((m) => m.t === 'state' && m.state.phase === 'ended', 55000),
      bob2.wait((m) => m.t === 'state' && m.state.phase === 'ended', 55000),
    ]);
    assert.ok(end.state.winner !== null);
    assert.ok(end.state.players[end.state.winner].vp >= 10);
  } finally {
    for (const ws of clients) ws.terminate();
    server.kill();
  }
});
