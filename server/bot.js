// Einfache, aber solide Bot-KI. Liefert pro Aufruf genau eine Aktion.
import {
  RESOURCES, COSTS, PIPS, TERRAIN_RESOURCE, resCount, hasRes, harborRatios, playerVP,
  validSettlementSpots, validRoadSpots, validCitySpots, robberHexes, stealCandidates, canPlaceSettlement,
} from '../shared/engine.js';

const RES_WEIGHT = { wood: 1, brick: 1, sheep: 0.9, wheat: 1.15, ore: 1.1 };

function vertexValue(state, v, idx) {
  const vert = state.board.vertices[v];
  let score = 0;
  const seen = new Set();
  for (const h of vert.hexes) {
    const hex = state.board.hexes[h];
    const r = TERRAIN_RESOURCE[hex.terrain];
    if (!r || !hex.number) continue;
    let s = PIPS[hex.number] * RES_WEIGHT[r];
    if (hex.id === state.robber) s *= 0.4;
    if (!seen.has(r)) s += 1.2;
    seen.add(r);
    score += s;
  }
  if (vert.harbor) {
    if (vert.harbor === 'any') score += 1.2;
    else if (idx !== undefined && ownIncome(state, idx)[vert.harbor] >= 4) score += 2;
    else score += 0.6;
  }
  return score;
}

function ownIncome(state, idx) {
  const inc = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  for (const [v, b] of Object.entries(state.buildings)) {
    if (b.player !== idx) continue;
    for (const h of state.board.vertices[v].hexes) {
      const hex = state.board.hexes[h];
      const r = TERRAIN_RESOURCE[hex.terrain];
      if (r && hex.number) inc[r] += PIPS[hex.number] * (b.type === 'city' ? 2 : 1);
    }
  }
  return inc;
}

function bestSetupSettlement(state, idx) {
  const spots = validSettlementSpots(state, idx, true);
  const inc = ownIncome(state, idx);
  let best = spots[0];
  let bestScore = -Infinity;
  for (const v of spots) {
    let s = vertexValue(state, v, idx);
    // Vielfalt: fehlende Rohstoffe bevorzugen
    for (const h of state.board.vertices[v].hexes) {
      const r = TERRAIN_RESOURCE[state.board.hexes[h].terrain];
      if (r && inc[r] === 0) s += 1;
    }
    s += Math.random() * 0.5;
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}

// Straße, die zu einem guten, freien Siedlungsplatz führt
function bestRoad(state, idx, setupVertex = null) {
  const edges = validRoadSpots(state, idx, setupVertex);
  if (!edges.length) return null;
  let best = edges[0];
  let bestScore = -Infinity;
  for (const e of edges) {
    const [a, b] = state.board.edges[e].v;
    const ownA = state.buildings[a]?.player === idx || state.board.vertices[a].edges.some((x) => state.roads[x] === idx);
    const far = setupVertex !== null ? (a === setupVertex ? b : a) : (ownA ? b : a);
    let s = 0;
    if (canPlaceSettlement(state, idx, far, true)) s = vertexValue(state, far, idx) + 2;
    for (const n of state.board.vertices[far].neighbors) {
      if (canPlaceSettlement(state, idx, n, true)) s = Math.max(s, vertexValue(state, n, idx) * 0.8);
    }
    if (state.buildings[far] && state.buildings[far].player !== idx) s -= 5;
    s += Math.random() * 0.6;
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return { edge: best, score: bestScore };
}

function need(res, cost) {
  const n = {};
  for (const r of RESOURCES) {
    const d = (cost[r] || 0) - (res[r] || 0);
    if (d > 0) n[r] = d;
  }
  return n;
}

function chooseGoal(state, idx) {
  const p = state.players[idx];
  const cities = validCitySpots(state, idx);
  const settleSpots = validSettlementSpots(state, idx);
  const goals = [];
  if (cities.length && p.stock.city > 0) goals.push({ kind: 'city', cost: COSTS.city, prio: 5 });
  if (settleSpots.length && p.stock.settlement > 0) goals.push({ kind: 'settlement', cost: COSTS.settlement, prio: 5.5 });
  if (state.devDeck.length) goals.push({ kind: 'dev', cost: COSTS.dev, prio: 2.5 });
  if (p.stock.road > 0 && validRoadSpots(state, idx).length) {
    const noSpots = !settleSpots.length && p.stock.settlement > 0;
    goals.push({ kind: 'road', cost: COSTS.road, prio: noSpots ? 4.5 : 1.5 });
  }
  // Wähle das Ziel mit dem besten Verhältnis aus Priorität und fehlenden Karten
  let best = null;
  let bestScore = -Infinity;
  for (const g of goals) {
    const missing = resCount(need(p.resources, g.cost));
    const s = g.prio - missing * 1.3;
    if (s > bestScore) { bestScore = s; best = g; }
  }
  return best;
}

function tryBankTrade(state, idx, goal) {
  if (!goal) return null;
  const p = state.players[idx];
  const missing = need(p.resources, goal.cost);
  const want = Object.keys(missing)[0];
  if (!want || state.bank[want] <= 0) return null;
  const ratios = harborRatios(state, idx);
  let bestGive = null;
  for (const r of RESOURCES) {
    if (r === want) continue;
    const surplus = p.resources[r] - (goal.cost[r] || 0);
    if (surplus >= ratios[r]) {
      if (!bestGive || surplus - ratios[r] > bestGive.left) bestGive = { r, left: surplus - ratios[r] };
    }
  }
  if (!bestGive) return null;
  return { type: 'bankTrade', give: { [bestGive.r]: ratios[bestGive.r] }, get: { [want]: 1 } };
}

function bestRobberTarget(state, idx) {
  const leaderVP = (i) => playerVP(state, i, false);
  let best = null;
  let bestScore = -Infinity;
  for (const h of robberHexes(state)) {
    const hex = state.board.hexes[h];
    let s = 0;
    for (const v of hex.vertices) {
      const b = state.buildings[v];
      if (!b) continue;
      const w = (hex.number ? PIPS[hex.number] : 0) * (b.type === 'city' ? 2 : 1);
      if (b.player === idx) s -= w * 3;
      else s += w * (1 + leaderVP(b.player) * 0.25);
    }
    const cands = stealCandidates(state, h, idx);
    if (cands.length) s += 2;
    s += Math.random() * 0.3;
    if (s > bestScore) { bestScore = s; best = h; }
  }
  const cands = stealCandidates(state, best, idx);
  let victim;
  if (cands.length) {
    victim = cands.sort((a, b) => (leaderVP(b) - leaderVP(a)) || (resCount(state.players[b].resources) - resCount(state.players[a].resources)))[0];
  }
  return { type: 'moveRobber', hex: best, victim };
}

function discardAction(state, idx) {
  const count = state.turn.discards[idx];
  const res = { ...state.players[idx].resources };
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = RESOURCES.slice().sort((a, b) => res[b] - res[a])[0];
    res[r]--;
    out[r] = (out[r] || 0) + 1;
  }
  return { type: 'discard', resources: out };
}

function valueOf(res, weights) {
  return RESOURCES.reduce((s, r) => s + (res[r] || 0) * (weights[r] || 1), 0);
}

function respondToTrade(state, idx) {
  const t = state.trade;
  const me = state.players[idx];
  if (!hasRes(me.resources, t.get)) return { type: 'respondTrade', response: 'decline' };
  if (playerVP(state, t.from, false) >= state.vpToWin - 2) return { type: 'respondTrade', response: 'decline' };
  const goal = chooseGoal(state, idx);
  const missing = goal ? need(me.resources, goal.cost) : {};
  const weights = {};
  for (const r of RESOURCES) weights[r] = missing[r] ? 1.6 : (goal && goal.cost[r] ? 1.1 : 0.8);
  const gain = valueOf(t.give, weights);
  const loss = valueOf(t.get, weights);
  if (gain >= loss + 0.1) return { type: 'respondTrade', response: 'accept' };
  // Gegenangebot: 1:1 gegen etwas, das wir wirklich brauchen
  const wanted = Object.keys(missing).find((r) => (t.give[r] || 0) > 0) || Object.keys(missing)[0];
  const spare = RESOURCES.filter((r) => r !== wanted && me.resources[r] > (goal?.cost[r] || 0))
    .sort((a, b) => me.resources[b] - me.resources[a])[0];
  if (wanted && spare && Math.random() < 0.5) {
    return { type: 'respondTrade', response: 'counter', give: { [spare]: 1 }, get: { [wanted]: 1 } };
  }
  return { type: 'respondTrade', response: 'decline' };
}

export function botAction(state, idx) {
  const p = state.players[idx];
  if (state.phase === 'setup') {
    if (state.setup.step === 'settlement') return { type: 'placeSettlement', vertex: bestSetupSettlement(state, idx) };
    return { type: 'placeRoad', edge: bestRoad(state, idx, state.setup.lastVertex).edge };
  }
  if (state.phase !== 'play') return null;
  const t = state.turn;
  if (t.pending === 'discard') return t.discards[idx] ? discardAction(state, idx) : null;
  if (state.trade) {
    if (state.trade.status === 'pending' && state.trade.to === idx) return respondToTrade(state, idx);
    if (state.trade.status === 'countered' && state.trade.from === idx) {
      const c = state.trade.counter;
      const ok = hasRes(p.resources, c.get) && valueOf(c.give, {}) >= valueOf(c.get, {});
      return { type: 'respondTrade', response: ok ? 'accept' : 'decline' };
    }
    return null;
  }
  if (state.current !== idx) return null;
  if (t.pending === 'robber') return bestRobberTarget(state, idx);
  if (t.freeRoads > 0) {
    const r = bestRoad(state, idx);
    if (r) return { type: 'buildRoad', edge: r.edge };
  }

  const playable = (type) => !t.devPlayed && p.devCards.some((c) => c.type === type && c.bought < t.number);

  if (!t.rolled) {
    const robbed = state.board.hexes[state.robber].vertices.some((v) => state.buildings[v]?.player === idx);
    if (playable('knight') && (robbed || p.knights + 1 > (state.largestArmy.size || 2))) return { type: 'playDev', card: 'knight' };
    return { type: 'roll' };
  }

  // Nach dem Würfeln: bauen, handeln, Karten spielen
  if (p.stock.city > 0 && hasRes(p.resources, COSTS.city)) {
    const spots = validCitySpots(state, idx).sort((a, b) => vertexValue(state, b, idx) - vertexValue(state, a, idx));
    if (spots.length) return { type: 'buildCity', vertex: spots[0] };
  }
  if (p.stock.settlement > 0 && hasRes(p.resources, COSTS.settlement)) {
    const spots = validSettlementSpots(state, idx).sort((a, b) => vertexValue(state, b, idx) - vertexValue(state, a, idx));
    if (spots.length) return { type: 'buildSettlement', vertex: spots[0] };
  }
  const goal = chooseGoal(state, idx);

  if (playable('monopoly')) {
    const totals = {};
    for (const r of RESOURCES) totals[r] = state.players.reduce((s, o) => s + (o.idx === idx ? 0 : o.resources[r]), 0);
    const r = [...RESOURCES].sort((a, b) => totals[b] - totals[a])[0];
    if (totals[r] >= 4) return { type: 'playDev', card: 'monopoly', resource: r };
  }
  if (playable('yearOfPlenty') && goal) {
    const miss = need(p.resources, goal.cost);
    const picks = [];
    for (const [r, n] of Object.entries(miss)) for (let i = 0; i < n && picks.length < 2; i++) picks.push(r);
    while (picks.length < 2) picks.push('ore');
    const needBank = {};
    picks.forEach((r) => { needBank[r] = (needBank[r] || 0) + 1; });
    if (resCount(miss) > 0 && hasRes(state.bank, needBank)) return { type: 'playDev', card: 'yearOfPlenty', resources: picks };
  }
  if (playable('roadBuilding') && p.stock.road >= 1 && validRoadSpots(state, idx).length) return { type: 'playDev', card: 'roadBuilding' };
  if (playable('knight') && p.knights + 1 > state.largestArmy.size && p.knights + 1 >= 3) return { type: 'playDev', card: 'knight' };

  if (goal) {
    if (hasRes(p.resources, goal.cost)) {
      if (goal.kind === 'dev') return { type: 'buyDev' };
      if (goal.kind === 'road') {
        const r = bestRoad(state, idx);
        if (r) return { type: 'buildRoad', edge: r.edge };
      }
    }
    const trade = tryBankTrade(state, idx, goal);
    if (trade) return trade;
  }
  // Überschüssige Karten sinnvoll ausgeben, bevor der Räuber kommt
  if (resCount(p.resources) > 7) {
    if (hasRes(p.resources, COSTS.dev) && state.devDeck.length) return { type: 'buyDev' };
    if (hasRes(p.resources, COSTS.road) && p.stock.road > 0) {
      const r = bestRoad(state, idx);
      if (r && r.score > 0) return { type: 'buildRoad', edge: r.edge };
    }
  }
  return { type: 'endTurn' };
}

export function botDelay(state) {
  if (state.phase === 'setup') return 650;
  if (state.turn.pending === 'discard') return 500;
  if (state.trade) return 1300;
  return state.turn.rolled ? 750 : 1100;
}
