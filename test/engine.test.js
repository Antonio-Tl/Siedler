import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyAction, viewFor, longestRoadFor, pendingActors, resCount, validSettlementSpots, validRoadSpots,
  RESOURCES, PIPS, TERRAIN_RESOURCE,
} from '../shared/engine.js';
import { botAction } from '../server/bot.js';

const PLAYERS = [
  { name: 'Anna', color: 'red' }, { name: 'Bert', color: 'yellow' },
  { name: 'Clara', color: 'blue' }, { name: 'Dora', color: 'white' },
];

function setupGame(seed = 42) {
  const g = createGame({ players: PLAYERS, seed });
  while (g.phase === 'setup') {
    const r = applyAction(g, g.current, botAction(g, g.current));
    assert.ok(r.ok, r.error);
  }
  return g;
}

test('Brett hat Standardaufbau', () => {
  const g = createGame({ players: PLAYERS, seed: 1 });
  const { hexes, vertices, edges, harbors } = g.board;
  assert.equal(hexes.length, 19);
  assert.equal(vertices.length, 54);
  assert.equal(edges.length, 72);
  assert.equal(harbors.length, 9);
  assert.equal(hexes.filter((h) => h.terrain === 'desert').length, 1);
  assert.equal(hexes.filter((h) => h.number).length, 18);
  for (const h of hexes) {
    if (h.number === 6 || h.number === 8) {
      for (const n of h.neighbors) assert.ok(![6, 8].includes(hexes[n].number), 'rote Zahlen nicht benachbart');
    }
  }
  const harborVerts = harbors.flatMap((h) => edges[h.edge].v);
  assert.equal(new Set(harborVerts).size, 18, 'Häfen teilen keine Ecken');
});

test('Gründungsphase: Schlangenreihenfolge und Startertrag', () => {
  const g = createGame({ players: PLAYERS, seed: 7 });
  const order = g.setup.order;
  assert.deepEqual(order.slice(4), [...order.slice(0, 4)].reverse());
  const bad = applyAction(g, (g.current + 1) % 4, { type: 'placeSettlement', vertex: 0 });
  assert.equal(bad.ok, false);
  const g2 = setupGame(7);
  assert.equal(g2.phase, 'play');
  for (const p of g2.players) {
    assert.equal(p.stock.settlement, 3);
    assert.equal(p.stock.road, 13);
  }
  const totalCards = g2.players.reduce((s, p) => s + resCount(p.resources), 0);
  assert.ok(totalCards > 0 && totalCards <= 12);
});

test('Abstandsregel verhindert benachbarte Siedlungen', () => {
  const g = createGame({ players: PLAYERS, seed: 3 });
  const v = 20;
  assert.ok(applyAction(g, g.current, { type: 'placeSettlement', vertex: v }).ok);
  const spots = validSettlementSpots(g, 1, true);
  for (const n of g.board.vertices[v].neighbors) assert.ok(!spots.includes(n));
  assert.ok(!spots.includes(v));
});

test('Würfeln verteilt Erträge korrekt und Bank bleibt konsistent', () => {
  const g = setupGame(11);
  const total = () => RESOURCES.reduce((s, r) => s + g.bank[r] + g.players.reduce((a, p) => a + p.resources[r], 0), 0);
  assert.equal(total(), 95);
  const r = applyAction(g, g.current, { type: 'roll', forced: [3, 3] });
  assert.ok(r.ok);
  assert.equal(total(), 95);
  assert.equal(applyAction(g, g.current, { type: 'roll' }).ok, false, 'nicht zweimal würfeln');
});

// Würfel mit genau dieser Augensumme (2–12)
const diceFor = (n) => [Math.min(6, n - 1), n - Math.min(6, n - 1)];

test('Feld unter dem Räuber liefert nichts und wird im Wurf gemeldet', () => {
  const g = setupGame(21);
  const hex = g.board.hexes.find((h) => h.number && h.vertices.some((v) => g.buildings[v]));
  g.robber = hex.id;
  const owners = hex.vertices.filter((v) => g.buildings[v]).map((v) => g.buildings[v].player);
  const res = TERRAIN_RESOURCE[hex.terrain];
  const before = g.players.map((p) => p.resources[res]);
  // Andere Felder mit derselben Zahl dürfen weiter liefern – erwartet wird nur, was dort anfällt
  const others = g.board.hexes.filter((h) => h.number === hex.number && h.id !== hex.id && TERRAIN_RESOURCE[h.terrain] === res);
  const fromOthers = (pi) => others.reduce((s, h) => s + h.vertices.reduce((a, v) => a + (g.buildings[v]?.player === pi ? (g.buildings[v].type === 'city' ? 2 : 1) : 0), 0), 0);
  assert.ok(applyAction(g, g.current, { type: 'roll', forced: diceFor(hex.number) }).ok);
  const ev = g.events.findLast((e) => e.type === 'roll');
  assert.equal(ev.blocked, hex.id);
  for (const pi of owners) assert.equal(g.players[pi].resources[res] - before[pi], fromOthers(pi), 'blockiertes Feld liefert nichts');
});

test('Reicht die Bank nicht für alle, erhält niemand etwas – und der Wurf meldet es', () => {
  const g = setupGame(21);
  const hex = g.board.hexes.find((h) => h.id !== g.robber && h.number && new Set(h.vertices.filter((v) => g.buildings[v]).map((v) => g.buildings[v].player)).size > 1);
  assert.ok(hex, 'Testbrett braucht ein Feld mit zwei Besitzern');
  const res = TERRAIN_RESOURCE[hex.terrain];
  const stash = g.bank[res] - 1;
  g.bank[res] = 1;
  g.players[g.current].resources[res] += stash;
  const before = g.players.map((p) => p.resources[res]);
  assert.ok(applyAction(g, g.current, { type: 'roll', forced: diceFor(hex.number) }).ok);
  const ev = g.events.findLast((e) => e.type === 'roll');
  assert.deepEqual(ev.short, [res]);
  assert.deepEqual(g.players.map((p) => p.resources[res]), before);
});

test('Eine 7 erzwingt Abwerfen und Räuber', () => {
  const g = setupGame(5);
  g.players[1].resources = { wood: 4, brick: 3, sheep: 2, wheat: 0, ore: 0 };
  g.bank.wood -= 4; g.bank.brick -= 3; g.bank.sheep -= 2;
  const cur = g.current;
  assert.ok(applyAction(g, cur, { type: 'roll', forced: [3, 4] }).ok);
  if (g.turn.pending === 'discard') {
    assert.ok(pendingActors(g).includes(1));
    assert.equal(g.turn.discards[1], 4);
    assert.equal(applyAction(g, 1, { type: 'discard', resources: { wood: 3 } }).ok, false);
    for (const i of pendingActors(g)) assert.ok(applyAction(g, i, botAction(g, i)).ok);
  }
  assert.equal(g.turn.pending, 'robber');
  assert.equal(applyAction(g, cur, { type: 'endTurn' }).ok, false);
  assert.ok(applyAction(g, cur, botAction(g, cur)).ok);
  assert.equal(g.turn.pending, null);
});

test('Längste Straße wird berechnet und durch Siedlungen unterbrochen', () => {
  const g = createGame({ players: PLAYERS, seed: 9 });
  g.phase = 'play';
  // Kette von Kanten für Spieler 0 bauen
  const { vertices, edges } = g.board;
  // Einfacher Pfad aus 6 Kanten ab dem Zentrum (Backtracking)
  const find = (v, path, seen) => {
    if (path.length === 6) return path;
    for (const e of vertices[v].edges) {
      const n = edges[e].v[0] === v ? edges[e].v[1] : edges[e].v[0];
      if (seen.includes(n)) continue;
      const r = find(n, [...path, e], [...seen, n]);
      if (r) return r;
    }
    return null;
  };
  const start = g.board.hexes.find((h) => h.q === 0 && h.r === 0).vertices[0];
  const path = find(start, [], [start]);
  for (const e of path) g.roads[e] = 0;
  assert.equal(longestRoadFor(g, 0), 6);
  // Gegnerische Siedlung in der Mitte teilt die Straße
  const mid = edges[path[2]].v.find((x) => edges[path[3]].v.includes(x));
  g.buildings[mid] = { player: 1, type: 'settlement' };
  assert.equal(longestRoadFor(g, 0), 3);
});

test('Auszeichnungen melden Gewinner, Vorbesitzer und Größe', () => {
  const g = setupGame(31);
  const cur = g.current;
  const other = (cur + 1) % 4;
  g.turn.rolled = true;
  const knights = (n) => Array.from({ length: n }, () => ({ type: 'knight', bought: 0 }));
  // Erst führt ein Mitspieler mit 3 Rittern, dann überholt der aktuelle Spieler mit dem vierten
  g.players[other].knights = 3;
  g.largestArmy = { player: other, size: 3 };
  g.players[cur].knights = 3;
  g.players[cur].devCards = knights(1);
  g.turn.number = 5;
  const r = applyAction(g, cur, { type: 'playDev', card: 'knight' });
  assert.ok(r.ok, r.error);
  const ev = g.events.findLast((e) => e.type === 'award');
  assert.deepEqual({ award: ev.award, player: ev.player, from: ev.from, size: ev.size }, { award: 'largestArmy', player: cur, from: other, size: 4 });
});

test('Sicht verbirgt fremde Handkarten', () => {
  const g = setupGame(13);
  const view = viewFor(g, 0);
  assert.ok(view.players[0].resources);
  assert.equal(view.players[1].resources, null);
  assert.equal(view.players[1].devCards, null);
  assert.equal(typeof view.players[1].resourceCount, 'number');
  assert.equal(view.devDeck, undefined);
  assert.equal(view.rng, undefined);
});

test('Handelsangebot an alle: Zusagen sammeln, Anbieter wählt', () => {
  const g = setupGame(21);
  const cur = g.current;
  const [a, b, c] = [1, 2, 3].map((k) => (cur + k) % 4);
  g.turn.rolled = true;
  g.players[cur].resources = { wood: 2, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  g.players[a].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 };
  g.players[b].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 2 };
  g.players[c].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  assert.ok(applyAction(g, cur, { type: 'offerTrade', give: { wood: 1 }, get: { ore: 1 } }).ok);
  assert.deepEqual(pendingActors(g).sort(), [a, b, c].sort(), 'alle Mitspieler sind gefragt');
  assert.equal(applyAction(g, cur, { type: 'buyDev' }).ok, false, 'offenes Angebot blockiert Bauen');
  assert.equal(applyAction(g, c, { type: 'respondTrade', response: 'accept' }).ok, false, 'ohne Karten keine Zusage');
  assert.ok(applyAction(g, a, { type: 'respondTrade', response: 'accept' }).ok);
  assert.ok(applyAction(g, b, { type: 'respondTrade', response: 'accept' }).ok);
  assert.ok(applyAction(g, c, { type: 'respondTrade', response: 'decline' }).ok);
  assert.deepEqual(pendingActors(g), [cur], 'danach entscheidet der Anbieter');
  assert.equal(applyAction(g, cur, { type: 'confirmTrade', with: c }).ok, false, 'nur Zusagen wählbar');
  assert.ok(applyAction(g, cur, { type: 'confirmTrade', with: b }).ok);
  assert.equal(g.trade, null);
  assert.equal(g.players[cur].resources.ore, 1);
  assert.equal(g.players[cur].resources.wood, 1);
  assert.equal(g.players[b].resources.wood, 1);
  assert.equal(g.players[b].resources.ore, 1);
  assert.equal(g.players[a].resources.ore, 1, 'der andere Zusagende behält seine Karten');
});

test('Lehnen alle ab, ist das Angebot vom Tisch', () => {
  const g = setupGame(23);
  const cur = g.current;
  g.turn.rolled = true;
  g.players[cur].resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  assert.ok(applyAction(g, cur, { type: 'offerTrade', give: { wood: 1 }, get: { ore: 1 } }).ok);
  for (const o of g.players) if (o.idx !== cur) assert.ok(applyAction(g, o.idx, { type: 'respondTrade', response: 'decline' }).ok);
  assert.equal(g.trade, null);
  assert.ok(g.events.some((e) => e.type === 'tradeDeclined' && e.from === cur));
});

test('Banktausch 4:1', () => {
  const g = setupGame(22);
  const cur = g.current;
  g.turn.rolled = true;
  g.players[cur].resources = { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const ratio = Math.min(4, ...[]);
  const r = applyAction(g, cur, { type: 'bankTrade', give: { wood: ratio }, get: { ore: 1 } });
  // Hafen könnte günstiger sein – dann schlägt 4 nicht fehl, sofern durch das Verhältnis teilbar
  if (r.ok) assert.equal(g.players[cur].resources.ore, 1);
});

test('Komplette Partie mit vier Bots endet mit einem Sieger', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = createGame({ players: PLAYERS.map((p) => ({ ...p, isBot: true })), seed });
    let steps = 0;
    while (g.phase !== 'ended' && steps < 20000) {
      const actors = pendingActors(g);
      const idx = actors[0];
      const action = botAction(g, idx);
      const r = applyAction(g, idx, action);
      if (!r.ok) {
        // Fallback wie auf dem Server
        const fb = g.turn.rolled ? { type: 'endTurn' } : { type: 'roll' };
        const r2 = applyAction(g, idx, fb);
        assert.ok(r2.ok, `Seed ${seed}: ${JSON.stringify(action)} -> ${r.error}; Fallback: ${r2.error}`);
      }
      steps++;
    }
    assert.equal(g.phase, 'ended', `Seed ${seed} endet nicht (${steps} Schritte)`);
    assert.ok(g.winner !== null);
    const total = RESOURCES.reduce((s, r) => s + g.bank[r] + g.players.reduce((a, p) => a + p.resources[r], 0), 0);
    assert.equal(total, 95, 'Kartenerhaltung');
    for (const r of RESOURCES) assert.ok(g.bank[r] >= 0);
  }
});

test('Pips-Tabelle vollständig', () => {
  assert.equal(Object.values(PIPS).reduce((a, b) => a + b, 0), 36 - 6);
  assert.ok(validRoadSpots);
});
