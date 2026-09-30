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
