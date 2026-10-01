import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { createLobby } from '../server/lobby.js';
import { adminAllowed, gameStats } from '../server/admin.js';

function fakeConn() {
  const c = { token: null, room: null, inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  return c;
}

function say(lobby, conn, msg) {
  lobby.message(conn, JSON.stringify(msg));
}

test('Statistik: Start, Sieg, Revanche und Abbruch landen als Einträge bei onGame', () => {
  const records = new Map();
  const lobby = createLobby({ botDelayScale: 0, onGame: (r) => records.set(r.id, r) });
  const [anna, ben] = [fakeConn(), fakeConn()];
  for (const c of [anna, ben]) say(lobby, c, { t: 'hello' });
  say(lobby, anna, { t: 'createRoom', name: 'Anna' });
  say(lobby, ben, { t: 'joinRoom', code: anna.room, name: 'Ben' });
  say(lobby, anna, { t: 'addBot' });
  assert.equal(records.size, 0, 'der Warteraum zählt noch nicht');

  say(lobby, anna, { t: 'start' });
  const room = lobby.rooms.get(anna.room);
  const [first] = records.values();
  assert.equal(first.mode, 'online');
  assert.equal(first.code, room.code);
  assert.equal(first.island, room.game.islandName);
  assert.deepEqual(first.players.map((p) => p.isBot), [false, false, true]);
  assert.equal(first.endedAt, null);
  assert.equal(gameStats([first], lobby.rooms).games[0].status, 'live');

  // Sieg (abgekürzt): beim nächsten Broadcast wird das Ende einmalig festgehalten
  room.game.phase = 'ended';
  room.game.winner = 1;
  say(lobby, anna, { t: 'setOptions', pace: 'fast' });
  const ended = records.get(first.id);
  assert.ok(ended.endedAt >= ended.startedAt);
  assert.equal(ended.winner, 1);
  assert.equal(gameStats([...records.values()], lobby.rooms).games[0].status, 'ended');

  // Neustart des Servers: die laufende Revanche behält ihre id
  say(lobby, anna, { t: 'rematch' });
  assert.equal(records.size, 2, 'die Revanche ist eine neue Partie');
  const saved = JSON.parse(JSON.stringify(lobby.serialize(room)));
  const after = createLobby({ botDelayScale: 0, onGame: (r) => records.set(r.id, r) });
  after.restore(saved);
  assert.equal(after.rooms.get(room.code).gameId, room.gameId);
  assert.equal(gameStats([...records.values()], after.rooms).games.find((g) => g.id === room.gameId).status, 'paused');

  // Alle verlassen die Partie endgültig → Raum weg, Eintrag gilt als abgebrochen
  for (const c of [anna, ben]) say(lobby, c, { t: 'deleteGame', code: room.code });
  assert.ok(!lobby.rooms.has(room.code));
  const rematch = records.get(room.gameId);
  assert.ok(rematch.abandonedAt > 0);
  const stats = gameStats([...records.values()], lobby.rooms).games;
  assert.deepEqual(stats.map((g) => g.status).sort(), ['abandoned', 'ended']);

  // Gegen die KI und an einem Gerät
  const [cara, dirk] = [fakeConn(), fakeConn()];
  for (const c of [cara, dirk]) say(lobby, c, { t: 'hello' });
  say(lobby, cara, { t: 'createRoom', name: 'Cara', solo: true, bots: 1 });
  say(lobby, dirk, { t: 'createRoom', hotseat: true, players: ['Dirk', 'Emil'] });
  assert.deepEqual([...records.values()].slice(-2).map((r) => r.mode), ['solo', 'hotseat']);
});

test('Admin-Schlüssel: ohne gesetzten Schlüssel offen, sonst nur mit dem richtigen', () => {
  assert.equal(adminAllowed('', undefined), true);
  assert.equal(adminAllowed(undefined, 'egal'), true);
  assert.equal(adminAllowed('geheim', 'geheim'), true);
  assert.equal(adminAllowed('geheim', 'geheiM'), false);
  assert.equal(adminAllowed('geheim', 'geheim2'), false);
  assert.equal(adminAllowed('geheim', null), false);
});

test('Admin-Schnittstelle des Node-Servers: Schlüssel, Liste, Löschen und Seite /admin', { timeout: 20000 }, async () => {
  const port = 5900 + Math.floor(Math.random() * 400);
  const KEY = 'test-schluessel-123';
  const proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(port), PERSIST: '0', BOT_DELAY_SCALE: '0', ADMIN_KEY: KEY },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes('läuft')) resolve(); });
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server startet nicht')), 5000).unref();
  });
  const base = `http://localhost:${port}`;
  const api = (method = 'GET', key = KEY) => fetch(`${base}/api/admin/games`, { method, headers: key ? { 'X-Admin-Key': key } : {} });
  let ws;
  try {
    assert.equal((await api('GET', null)).status, 401);
    assert.equal((await api('GET', 'falsch')).status, 401);
    assert.equal((await api('DELETE', 'falsch')).status, 401);
    assert.deepEqual((await (await api()).json()).games, []);

    // Eine Partie gegen die KI beginnen → erscheint als „live“
    ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello' })));
      ws.on('message', (d) => {
        const m = JSON.parse(d);
        if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'createRoom', name: 'Ida', solo: true, bots: 3 }));
        if (m.t === 'state') resolve();
      });
    });
    const { games } = await (await api()).json();
    assert.equal(games.length, 1);
    assert.equal(games[0].mode, 'solo');
    assert.equal(games[0].status, 'live');
    assert.equal(games[0].players.length, 4);

    assert.equal((await api('DELETE')).status, 200);
    assert.deepEqual((await (await api()).json()).games, []);

    const page = await fetch(`${base}/admin/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Partienbuch/);
  } finally {
    ws?.terminate();
    proc.kill();
  }
});
