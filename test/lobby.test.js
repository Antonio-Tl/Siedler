import test from 'node:test';
import assert from 'node:assert/strict';
import { createLobby } from '../server/lobby.js';
import { validSettlementSpots } from '../shared/engine.js';

// Verbindung ohne Netzwerk: merkt sich alle empfangenen Nachrichten
function fakeConn() {
  const c = { token: null, room: null, inbox: [] };
  c.send = (text) => c.inbox.push(JSON.parse(text));
  c.last = (t) => c.inbox.findLast((m) => m.t === t);
  return c;
}

function say(lobby, conn, msg) {
  lobby.message(conn, JSON.stringify(msg));
}

test('Räume überstehen einen Neustart mit offenen Verbindungen (Cloudflare-Ruhezustand)', () => {
  const before = createLobby();
  const [anna, ben, carl, dora, emil, fritz] = Array.from({ length: 6 }, fakeConn);
  for (const c of [anna, ben, carl, dora, emil, fritz]) say(before, c, { t: 'hello' });
  say(before, anna, { t: 'createRoom', name: 'Anna' });
  const code = anna.room;
  say(before, ben, { t: 'joinRoom', code, name: 'Ben' });
  say(before, carl, { t: 'joinRoom', code, name: 'Carl' });
  say(before, anna, { t: 'start' });
  say(before, dora, { t: 'joinRoom', code }); // Zuschauerin
  assert.equal(dora.last('room').you, null);
  say(before, emil, { t: 'createRoom', name: 'Emil' });
  say(before, fritz, { t: 'joinRoom', code: emil.room, name: 'Fritz' });

  // Zustand wie aus der Datenbank; Fritz' Verbindung ist während des Schlafs abgerissen
  const saved = JSON.parse(JSON.stringify([...before.rooms.values()].map(before.serialize)));
  const after = createLobby();
  for (const r of saved) assert.ok(after.restore(r));
  for (const c of [anna, ben, carl, dora, emil]) after.reattach(c);

  const room = after.rooms.get(code);
  assert.deepEqual(room.seats.map((s) => s.conn), [anna, ben, carl]);
  assert.ok(room.spectators.has(dora));
  const other = after.rooms.get(emil.room);
  assert.equal(other.seats[0].conn, emil);
  assert.equal(other.seats[1].conn, null);
  assert.ok(other.seats[1].disconnectedAt > 0, 'Fritz gilt als getrennt, damit später ein Bot übernehmen kann');

  // Weiterspielen: wer dran ist, setzt die erste Siedlung – alle bekommen den neuen Stand
  const st = anna.last('state').state;
  const mover = [anna, ben, carl][st.current];
  for (const c of [anna, ben, carl, dora]) c.inbox.length = 0;
  say(after, mover, { t: 'action', action: { type: 'placeSettlement', vertex: validSettlementSpots(st, st.current, true)[0] } });
  assert.equal(mover.last('error'), undefined);
  for (const c of [anna, ben, carl, dora]) assert.equal(c.last('state')?.state.seq, st.seq + 1, 'Broadcast erreicht alle offenen Verbindungen');

  // Verbindung zu einem inzwischen gelöschten Raum wird sauber gelöst
  const ghost = fakeConn();
  ghost.token = 'x'.repeat(16);
  ghost.room = 'WEG12';
  after.reattach(ghost);
  assert.equal(ghost.room, null);
});

function twoPlayerGame(options = {}) {
  const lobby = createLobby({ botDelayScale: 0 });
  const [anna, ben] = [fakeConn(), fakeConn()];
  for (const c of [anna, ben]) say(lobby, c, { t: 'hello' });
  say(lobby, anna, { t: 'createRoom', name: 'Anna', ...options });
  say(lobby, ben, { t: 'joinRoom', code: anna.room, name: 'Ben' });
  say(lobby, anna, { t: 'start' });
  return { lobby, anna, ben, room: lobby.rooms.get(anna.room) };
}

test('Wer eine Online-Partie verlässt, wird von einer KI ersetzt – die anderen erfahren es', () => {
  const { lobby, anna, ben, room } = twoPlayerGame();
  const code = anna.room;
  ben.inbox.length = 0;
  say(lobby, anna, { t: 'leave' });
  assert.equal(room.seats[0].away, true);
  const st = ben.last('state').state;
  assert.ok(st.events.some((e) => e.type === 'left' && e.player === 0), 'Ereignis „left“ erreicht Ben');
  assert.match(st.log.at(-1).text, /Anna hat die Partie verlassen/);
  assert.equal(ben.last('room').room.seats[0].away, true);

  // Anna kommt zurück und übernimmt wieder selbst
  ben.inbox.length = 0;
  say(lobby, anna, { t: 'joinRoom', code });
  assert.equal(room.seats[0].away, false);
  assert.ok(ben.last('state').state.events.some((e) => e.type === 'returned' && e.player === 0));

  // Gegen die KI allein: niemand muss benachrichtigt werden
  const solo = createLobby({ botDelayScale: 0 });
  const cara = fakeConn();
  say(solo, cara, { t: 'hello' });
  say(solo, cara, { t: 'createRoom', name: 'Cara', solo: true, bots: 2 });
  const soloRoom = solo.rooms.get(cara.room);
  assert.equal(soloRoom.turnTime, 0, 'gegen die KI ist die Zugzeit zunächst aus');
  say(solo, cara, { t: 'leave' });
  assert.ok(!soloRoom.game.events.some((e) => e.type === 'left'));
});

test('Zugzeit: Ablauf erledigt nur das Nötigste und beendet den Zug', () => {
  const { lobby, ben, room } = twoPlayerGame({ turnTime: 60 });
  assert.equal(room.turnTime, 60);
  const g = room.game;
  let now = Date.now();
  assert.ok(ben.last('state').clock?.remaining > 55_000, 'Clients bekommen die Restzeit');

  // Gründungsphase: jeder abgelaufene Bauschritt wird automatisch gesetzt
  for (let i = 0; i < 20 && g.phase === 'setup'; i++) {
    now += 61_000;
    lobby.tick(now);
  }
  assert.equal(g.phase, 'play');
  assert.ok(g.log.some((l) => /Die Zeit von (Anna|Ben) ist abgelaufen/.test(l.text)));

  // Spielzug: würfeln und beenden – aber nichts bauen
  const before = { turn: g.turn.number, current: g.current, buildings: Object.keys(g.buildings).length, roads: Object.keys(g.roads).length };
  lobby.tick(now + 30_000);
  assert.equal(g.turn.number, before.turn, 'vor Ablauf passiert nichts');
  now += 61_000;
  lobby.tick(now);
  assert.equal(g.turn.number, before.turn + 1, 'nach Ablauf ist der nächste Spieler dran');
  assert.notEqual(g.current, before.current);
  assert.equal(Object.keys(g.buildings).length, before.buildings);
  assert.equal(Object.keys(g.roads).length, before.roads);
  assert.ok(g.events.some((e) => e.type === 'timeout' && e.player === before.current));
});

test('Zugzeit: Abwerfen hat eine eigene Frist, die Zugzeit pausiert solange', () => {
  const { lobby, room } = twoPlayerGame({ turnTime: 60 });
  const g = room.game;
  let now = Date.now();
  for (let i = 0; i < 20 && g.phase === 'setup'; i++) { now += 61_000; lobby.tick(now); }
  // Der aktuelle Spieler hat eine 7 gewürfelt, der andere muss 4 von 8 Karten abwerfen
  const other = 1 - g.current;
  Object.assign(g.players[other].resources, { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  Object.assign(g.turn, { rolled: true, pending: 'discard', discards: { [other]: 4 } });
  lobby.tick(now + 10_000);
  assert.equal(room.clock.discard !== null, true, 'Abwerf-Frist läuft');
  now += 10_000 + 46_000;
  lobby.tick(now);
  assert.equal(Object.values(g.players[other].resources).reduce((a, b) => a + b, 0), 4, 'Karten wurden automatisch abgeworfen');
  assert.equal(g.turn.pending, 'robber');
  assert.equal(room.clock.discard, null);
  const left = room.clock.endsAt - now;
  assert.ok(left > 40_000, `die eigentliche Zugzeit lief während des Abwerfens nicht weiter (${left} ms übrig)`);
});
