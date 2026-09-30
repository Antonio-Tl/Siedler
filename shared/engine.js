// Regel-Engine für Siedlungen (Catan-Basisspiel).
// Läuft identisch auf Server (autoritativ) und Client (Hilfsfunktionen für gültige Plätze).

export const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export const RES_LABEL = { wood: 'Holz', brick: 'Lehm', sheep: 'Wolle', wheat: 'Getreide', ore: 'Erz' };

export const TERRAIN_RESOURCE = {
  forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore', desert: null,
};

export const TERRAIN_LABEL = {
  forest: 'Wald', hills: 'Hügelland', pasture: 'Weideland', fields: 'Ackerland', mountains: 'Gebirge', desert: 'Wüste',
};

export const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  dev: { sheep: 1, wheat: 1, ore: 1 },
};

export const LIMITS = { road: 15, settlement: 5, city: 4 };

export const DEV_LABEL = {
  knight: 'Ritter', vp: 'Siegpunkt', roadBuilding: 'Straßenbau', yearOfPlenty: 'Erfindung', monopoly: 'Monopol',
};

export const DEV_TEXT = {
  knight: 'Versetze den Räuber und ziehe eine Karte von einem Nachbarn.',
  vp: 'Ein verborgener Siegpunkt. Zählt automatisch.',
  roadBuilding: 'Baue sofort zwei Straßen kostenlos.',
  yearOfPlenty: 'Nimm dir zwei beliebige Rohstoffe aus der Bank.',
  monopoly: 'Alle Mitspieler geben dir sämtliche Karten eines Rohstoffs.',
};

export const PLAYER_COLORS = [
  { id: 'red', label: 'Rotes Haus', hex: '#b8322a' },
  { id: 'yellow', label: 'Gelbes Haus', hex: '#e0a92a' },
  { id: 'blue', label: 'Blaues Haus', hex: '#2f5fa8' },
  { id: 'white', label: 'Weißes Haus', hex: '#ece6d6' },
  { id: 'green', label: 'Grünes Haus', hex: '#3d8a45' },
  { id: 'purple', label: 'Violettes Haus', hex: '#7a4a9c' },
];

export const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

const SQ3 = Math.sqrt(3);
const TERRAIN_POOL = [
  ...Array(4).fill('forest'), ...Array(3).fill('hills'), ...Array(4).fill('pasture'),
  ...Array(4).fill('fields'), ...Array(3).fill('mountains'), 'desert',
];
const NUMBER_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const HARBOR_POOL = ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore'];
const HARBOR_SPACING = [3, 3, 4, 3, 3, 4, 3, 3, 4];
const AXIAL_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const ISLAND_NAMES = [
  'Insel Sonnmeer', 'Nebelhafen', 'Bernsteinküste', 'Möwenfels', 'Grünwacht', 'Salzkrone', 'Windinsel', 'Eichenbucht',
];

// ---------- Zufall (deterministisch, im Zustand gespeichert) ----------

export function rand(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state, n) {
  return Math.floor(rand(state) * n);
}

function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Brettgeometrie ----------

export function buildBoard(state) {
  const hexes = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) <= 2) hexes.push({ id: hexes.length, q, r });
    }
  }
  const vertices = [];
  const edges = [];
  const vKey = new Map();
  const eKey = new Map();

  for (const h of hexes) {
    h.x = SQ3 * (h.q + h.r / 2);
    h.y = 1.5 * h.r;
    h.vertices = [];
    h.edges = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const x = h.x + Math.cos(a);
      const y = h.y + Math.sin(a);
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
      let v = vKey.get(key);
      if (v === undefined) {
        v = vertices.length;
        vKey.set(key, v);
        vertices.push({ id: v, x: round3(x), y: round3(y), hexes: [], edges: [], neighbors: [], harbor: null });
      }
      vertices[v].hexes.push(h.id);
      h.vertices.push(v);
    }
    for (let i = 0; i < 6; i++) {
      const a = h.vertices[i];
      const b = h.vertices[(i + 1) % 6];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      let e = eKey.get(key);
      if (e === undefined) {
        e = edges.length;
        eKey.set(key, e);
        edges.push({ id: e, v: [Math.min(a, b), Math.max(a, b)], hexes: [] });
      }
      edges[e].hexes.push(h.id);
      h.edges.push(e);
    }
  }
  for (const e of edges) {
    const [a, b] = e.v;
    vertices[a].edges.push(e.id);
    vertices[b].edges.push(e.id);
    vertices[a].neighbors.push(b);
    vertices[b].neighbors.push(a);
    e.x = round3((vertices[a].x + vertices[b].x) / 2);
    e.y = round3((vertices[a].y + vertices[b].y) / 2);
  }
  const byAxial = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.id]));
  for (const h of hexes) {
    h.neighbors = AXIAL_DIRS.map(([dq, dr]) => byAxial.get(`${h.q + dq},${h.r + dr}`)).filter((n) => n !== undefined);
  }

  // Gelände und Zahlen
  const terrains = shuffle(state, [...TERRAIN_POOL]);
  hexes.forEach((h, i) => { h.terrain = terrains[i]; h.number = null; });
  const producing = hexes.filter((h) => h.terrain !== 'desert');
  for (let attempt = 0; attempt < 500; attempt++) {
    const nums = shuffle(state, [...NUMBER_POOL]);
    producing.forEach((h, i) => { h.number = nums[i]; });
    const bad = producing.some((h) => (h.number === 6 || h.number === 8)
      && h.neighbors.some((n) => hexes[n].number === 6 || hexes[n].number === 8));
    if (!bad) break;
  }

  // Häfen an der Küste
  const coastal = edges.filter((e) => e.hexes.length === 1)
    .map((e) => ({ e, ang: Math.atan2(e.y, e.x) }))
    .sort((a, b) => a.ang - b.ang)
    .map((o) => o.e);
  const harborTypes = shuffle(state, [...HARBOR_POOL]);
  const harbors = [];
  let idx = randInt(state, 3);
  HARBOR_SPACING.forEach((step, i) => {
    const e = coastal[idx % coastal.length];
    const h = hexes[e.hexes[0]];
    const nx = e.x - h.x;
    const ny = e.y - h.y;
    const len = Math.hypot(nx, ny);
    const harbor = { id: i, edge: e.id, type: harborTypes[i], x: e.x, y: e.y, nx: round3(nx / len), ny: round3(ny / len) };
    harbors.push(harbor);
    for (const v of e.v) vertices[v].harbor = harbor.type;
    idx += step;
  });

  return { hexes, vertices, edges, harbors };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------- Spielzustand ----------

function emptyRes(n = 0) {
  return { wood: n, brick: n, sheep: n, wheat: n, ore: n };
}

export function createGame({ players, seed = Date.now(), vpToWin = 10, name } = {}) {
  const state = { rng: seed >>> 0, seq: 0 };
  state.board = buildBoard(state);
  state.islandName = name || ISLAND_NAMES[randInt(state, ISLAND_NAMES.length)];
  state.vpToWin = vpToWin;
  state.robber = state.board.hexes.find((h) => h.terrain === 'desert').id;
  state.players = players.map((p, i) => ({
    idx: i,
    name: p.name,
    color: p.color,
    isBot: !!p.isBot,
    resources: emptyRes(),
    devCards: [],
    knights: 0,
    stock: { ...LIMITS },
  }));
  state.buildings = {}; // vertexId -> { player, type }
  state.roads = {}; // edgeId -> player
  state.bank = emptyRes(19);
  state.devDeck = shuffle(state, [
    ...Array(14).fill('knight'), ...Array(5).fill('vp'), ...Array(2).fill('roadBuilding'),
    ...Array(2).fill('yearOfPlenty'), ...Array(2).fill('monopoly'),
  ]);
  const n = players.length;
  const start = randInt(state, n);
  const forward = Array.from({ length: n }, (_, i) => (start + i) % n);
  state.phase = 'setup';
  state.setup = { order: [...forward, ...[...forward].reverse()], index: 0, step: 'settlement', lastVertex: null };
  state.current = forward[0];
  state.turn = { number: 0, round: 0, rolled: false, dice: null, devPlayed: false, pending: null, discards: null, freeRoads: 0, afterRobber: null };
  state.trade = null;
  state.longestRoad = { player: null, length: 0 };
  state.largestArmy = { player: null, size: 0 };
  state.log = [];
  state.events = [];
  state.winner = null;
  addLog(state, null, 'Eine neue Insel erwartet euch. Setzt reihum je zwei Siedlungen und Straßen – in der zweiten Runde rückwärts.', 'island');
  return state;
}

function addLog(state, player, text, icon = 'scroll') {
  state.log.push({ player, text, icon, turn: state.turn ? state.turn.number : 0 });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

function addEvent(state, ev) {
  state.seq += 1;
  state.events.push({ ...ev, seq: state.seq });
  if (state.events.length > 30) state.events.splice(0, state.events.length - 30);
}

// ---------- Hilfsfunktionen ----------

export function resCount(res) {
  return RESOURCES.reduce((s, r) => s + (res[r] || 0), 0);
}

export function hasRes(res, cost) {
  return RESOURCES.every((r) => (res[r] || 0) >= (cost[r] || 0));
}

function pay(state, p, cost) {
  for (const r of RESOURCES) {
    const n = cost[r] || 0;
    p.resources[r] -= n;
    state.bank[r] += n;
  }
}

function fmtRes(res) {
  return RESOURCES.filter((r) => res[r]).map((r) => `${res[r]} ${RES_LABEL[r]}`).join(', ');
}

export function playerVP(state, idx, includeHidden = true) {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.player === idx) vp += b.type === 'city' ? 2 : 1;
  }
  if (state.longestRoad.player === idx) vp += 2;
  if (state.largestArmy.player === idx) vp += 2;
  if (includeHidden) {
    const p = state.players[idx];
    if (Array.isArray(p.devCards)) vp += p.devCards.filter((c) => c.type === 'vp').length;
  }
  return vp;
}

export function harborRatios(state, idx) {
  const ratios = emptyRes(4);
  for (const [vid, b] of Object.entries(state.buildings)) {
    if (b.player !== idx) continue;
    const h = state.board.vertices[vid].harbor;
    if (!h) continue;
    if (h === 'any') {
      for (const r of RESOURCES) ratios[r] = Math.min(ratios[r], 3);
    } else {
      ratios[h] = 2;
    }
  }
  return ratios;
}

export function canPlaceSettlement(state, idx, v, setup = false) {
  const vert = state.board.vertices[v];
  if (!vert || state.buildings[v]) return false;
  if (vert.neighbors.some((n) => state.buildings[n])) return false;
  if (setup) return true;
  return vert.edges.some((e) => state.roads[e] === idx);
}

export function canPlaceRoad(state, idx, e, setupVertex = null) {
  const edge = state.board.edges[e];
  if (!edge || state.roads[e] !== undefined) return false;
  if (setupVertex !== null && setupVertex !== undefined) return edge.v.includes(setupVertex);
  return edge.v.some((v) => {
    const b = state.buildings[v];
    if (b && b.player === idx) return true;
    if (b && b.player !== idx) return false;
    return state.board.vertices[v].edges.some((e2) => e2 !== e && state.roads[e2] === idx);
  });
}

export function canPlaceCity(state, idx, v) {
  const b = state.buildings[v];
  return !!b && b.player === idx && b.type === 'settlement';
}

export function validSettlementSpots(state, idx, setup = false) {
  return state.board.vertices.filter((v) => canPlaceSettlement(state, idx, v.id, setup)).map((v) => v.id);
}

export function validRoadSpots(state, idx, setupVertex = null) {
  return state.board.edges.filter((e) => canPlaceRoad(state, idx, e.id, setupVertex)).map((e) => e.id);
}

export function validCitySpots(state, idx) {
  return Object.keys(state.buildings).map(Number).filter((v) => canPlaceCity(state, idx, v));
}

export function robberHexes(state) {
  return state.board.hexes.filter((h) => h.id !== state.robber).map((h) => h.id);
}

export function stealCandidates(state, hexId, thief) {
  const set = new Set();
  for (const v of state.board.hexes[hexId].vertices) {
    const b = state.buildings[v];
    if (b && b.player !== thief) {
      const p = state.players[b.player];
      const count = p.resourceCount !== undefined ? p.resourceCount : resCount(p.resources);
      if (count > 0) set.add(b.player);
    }
  }
  return [...set];
}

export function longestRoadFor(state, idx) {
  const mine = Object.keys(state.roads).map(Number).filter((e) => state.roads[e] === idx);
  if (!mine.length) return 0;
  const { edges, vertices } = state.board;
  const blocked = (v) => {
    const b = state.buildings[v];
    return b && b.player !== idx;
  };
  let best = 0;
  const used = new Set();
  const dfs = (v, len) => {
    if (len > best) best = len;
    if (blocked(v)) return;
    for (const e of vertices[v].edges) {
      if (state.roads[e] !== idx || used.has(e)) continue;
      used.add(e);
      const next = edges[e].v[0] === v ? edges[e].v[1] : edges[e].v[0];
      dfs(next, len + 1);
      used.delete(e);
    }
  };
  for (const e of mine) {
    for (const start of edges[e].v) {
      used.add(e);
      const other = edges[e].v[0] === start ? edges[e].v[1] : edges[e].v[0];
      dfs(other, 1);
      used.delete(e);
    }
  }
  return best;
}

function updateLongestRoad(state) {
  const lens = state.players.map((p) => longestRoadFor(state, p.idx));
  const max = Math.max(...lens);
  const prev = state.longestRoad.player;
  if (max < 5) {
    state.longestRoad = { player: null, length: max };
  } else if (prev !== null && lens[prev] === max) {
    state.longestRoad = { player: prev, length: max };
  } else {
    const top = lens.map((l, i) => (l === max ? i : -1)).filter((i) => i >= 0);
    state.longestRoad = { player: top.length === 1 ? top[0] : null, length: max };
  }
  const now = state.longestRoad.player;
  if (now !== prev) {
    if (now !== null) {
      addLog(state, now, `${state.players[now].name} erhält die längste Handelsstraße (${max}).`, 'road');
      addEvent(state, { type: 'award', award: 'longestRoad', player: now });
    } else if (prev !== null) {
      addLog(state, prev, 'Die längste Handelsstraße ist unterbrochen – niemand hält sie.', 'road');
    }
  }
}

function updateLargestArmy(state, idx) {
  const k = state.players[idx].knights;
  const cur = state.largestArmy;
  if (k >= 3 && (cur.player === null ? true : k > cur.size) && cur.player !== idx) {
    state.largestArmy = { player: idx, size: k };
    addLog(state, idx, `${state.players[idx].name} führt nun die größte Rittermacht an.`, 'sword');
    addEvent(state, { type: 'award', award: 'largestArmy', player: idx });
  } else if (cur.player === idx) {
    cur.size = k;
  }
}

function checkWin(state) {
  if (state.phase !== 'play') return;
  const idx = state.current;
  const vp = playerVP(state, idx, true);
  if (vp >= state.vpToWin) {
    state.phase = 'ended';
    state.winner = idx;
    state.trade = null;
    addLog(state, idx, `${state.players[idx].name} gewinnt mit ${vp} Siegpunkten!`, 'crown');
    addEvent(state, { type: 'win', player: idx, vp });
  }
}

// ---------- Wer muss handeln? ----------

export function pendingActors(state) {
  if (state.phase === 'setup') return [state.current];
  if (state.phase !== 'play') return [];
  if (state.turn.pending === 'discard') return Object.keys(state.turn.discards).map(Number);
  if (state.trade) {
    const waiting = Object.entries(state.trade.responses).filter(([, r]) => r === 'pending').map(([i]) => Number(i));
    return waiting.length ? waiting : [state.trade.from];
  }
  return [state.current];
}

// ---------- Aktionen ----------

export function applyAction(state, idx, action) {
  try {
    const fn = HANDLERS[action && action.type];
    if (!fn) return { ok: false, error: 'Unbekannte Aktion.' };
    const err = fn(state, idx, action);
    if (err) return { ok: false, error: err };
    checkWin(state);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function requireTurn(state, idx) {
  if (state.phase !== 'play') return 'Das Spiel läuft gerade nicht.';
  if (state.current !== idx) return 'Du bist nicht am Zug.';
  return null;
}

function requireMain(state, idx) {
  const e = requireTurn(state, idx);
  if (e) return e;
  if (state.turn.pending) return 'Zuerst muss die laufende Aktion abgeschlossen werden.';
  if (state.turn.freeRoads > 0) return 'Baue zuerst deine kostenlosen Straßen.';
  if (!state.turn.rolled) return 'Zuerst würfeln.';
  if (state.trade) return 'Ein Handelsangebot ist noch offen.';
  return null;
}

function validResMap(m) {
  if (!m || typeof m !== 'object') return false;
  return Object.entries(m).every(([k, v]) => RESOURCES.includes(k) && Number.isInteger(v) && v >= 0);
}

const HANDLERS = {
  placeSettlement(state, idx, { vertex }) {
    if (state.phase !== 'setup') return 'Nur in der Gründungsphase.';
    if (state.current !== idx) return 'Du bist nicht am Zug.';
    if (state.setup.step !== 'settlement') return 'Setze jetzt eine Straße.';
    if (!canPlaceSettlement(state, idx, vertex, true)) return 'Hier ist kein Platz für eine Siedlung.';
    const p = state.players[idx];
    state.buildings[vertex] = { player: idx, type: 'settlement' };
    p.stock.settlement--;
    state.setup.lastVertex = vertex;
    state.setup.step = 'road';
    const second = state.setup.index >= state.players.length;
    let gained = null;
    if (second) {
      gained = emptyRes();
      for (const h of state.board.vertices[vertex].hexes) {
        const r = TERRAIN_RESOURCE[state.board.hexes[h].terrain];
        if (r && state.bank[r] > 0) {
          p.resources[r]++;
          state.bank[r]--;
          gained[r]++;
        }
      }
    }
    addLog(state, idx, `${p.name} gründet eine Siedlung.${gained && resCount(gained) ? ` Startertrag: ${fmtRes(gained)}.` : ''}`, 'house');
    addEvent(state, { type: 'build', kind: 'settlement', player: idx, id: vertex });
    return null;
  },

  placeRoad(state, idx, { edge }) {
    if (state.phase !== 'setup') return 'Nur in der Gründungsphase.';
    if (state.current !== idx) return 'Du bist nicht am Zug.';
    if (state.setup.step !== 'road') return 'Setze zuerst eine Siedlung.';
    if (!canPlaceRoad(state, idx, edge, state.setup.lastVertex)) return 'Die Straße muss an deine neue Siedlung grenzen.';
    const p = state.players[idx];
    state.roads[edge] = idx;
    p.stock.road--;
    addLog(state, idx, `${p.name} baut eine Straße.`, 'road');
    addEvent(state, { type: 'build', kind: 'road', player: idx, id: edge });
    state.setup.index++;
    state.setup.step = 'settlement';
    state.setup.lastVertex = null;
    if (state.setup.index >= state.setup.order.length) {
      state.phase = 'play';
      state.current = state.setup.order[0];
      state.turn = { number: 1, round: 1, rolled: false, dice: null, devPlayed: false, pending: null, discards: null, freeRoads: 0, afterRobber: null };
      addLog(state, null, 'Die Insel ist besiedelt. Würfelt, um zu beginnen.', 'island');
      addLog(state, state.current, `${state.players[state.current].name} beginnt den Zug.`, 'compass');
    } else {
      state.current = state.setup.order[state.setup.index];
    }
    return null;
  },

  roll(state, idx, action) {
    const e = requireTurn(state, idx);
    if (e) return e;
    if (state.turn.rolled) return 'Du hast bereits gewürfelt.';
    if (state.turn.pending) return 'Zuerst die laufende Aktion abschließen.';
    const d1 = action.forced ? action.forced[0] : randInt(state, 6) + 1;
    const d2 = action.forced ? action.forced[1] : randInt(state, 6) + 1;
    const sum = d1 + d2;
    state.turn.rolled = true;
    state.turn.dice = [d1, d2];
    const p = state.players[idx];
    addLog(state, idx, `${p.name} würfelt ${sum}.`, 'dice');
    if (sum === 7) {
      const discards = {};
      for (const pl of state.players) {
        const c = resCount(pl.resources);
        if (c > 7) discards[pl.idx] = Math.floor(c / 2);
      }
      addEvent(state, { type: 'roll', player: idx, dice: [d1, d2], gains: {}, robber: true });
      addLog(state, null, 'Der Räuber erwacht! Wer mehr als 7 Karten hat, muss die Hälfte abgeben.', 'robber');
      if (Object.keys(discards).length) {
        state.turn.pending = 'discard';
        state.turn.discards = discards;
      } else {
        state.turn.pending = 'robber';
      }
      return null;
    }
    const gains = produce(state, sum);
    addEvent(state, { type: 'roll', player: idx, dice: [d1, d2], gains });
    return null;
  },

  discard(state, idx, { resources }) {
    if (state.phase !== 'play' || state.turn.pending !== 'discard') return 'Gerade muss niemand abwerfen.';
    const need = state.turn.discards[idx];
    if (!need) return 'Du musst nichts abwerfen.';
    if (!validResMap(resources)) return 'Ungültige Auswahl.';
    if (resCount(resources) !== need) return `Wirf genau ${need} Karten ab.`;
    const p = state.players[idx];
    if (!hasRes(p.resources, resources)) return 'So viele Karten hast du nicht.';
    pay(state, p, resources);
    delete state.turn.discards[idx];
    addLog(state, idx, `${p.name} wirft ${need} Karten ab.`, 'discard');
    if (!Object.keys(state.turn.discards).length) {
      state.turn.pending = 'robber';
      state.turn.discards = null;
    }
    return null;
  },

  moveRobber(state, idx, { hex, victim }) {
    const e = requireTurn(state, idx);
    if (e) return e;
    if (state.turn.pending !== 'robber') return 'Der Räuber kann gerade nicht versetzt werden.';
    if (!state.board.hexes[hex] || hex === state.robber) return 'Wähle ein anderes Landfeld.';
    const cands = stealCandidates(state, hex, idx);
    if (cands.length && !cands.includes(victim)) return 'Wähle, von wem du stehlen willst.';
    state.robber = hex;
    const p = state.players[idx];
    const h = state.board.hexes[hex];
    addLog(state, idx, `${p.name} versetzt den Räuber auf ${TERRAIN_LABEL[h.terrain]}${h.number ? ` (${h.number})` : ''}.`, 'robber');
    addEvent(state, { type: 'robber', player: idx, hex });
    if (cands.length) {
      const v = state.players[victim];
      const pool = RESOURCES.flatMap((r) => Array(v.resources[r]).fill(r));
      const res = pool[randInt(state, pool.length)];
      v.resources[res]--;
      p.resources[res]++;
      addLog(state, idx, `${p.name} stiehlt eine Karte von ${v.name}.`, 'steal');
      addEvent(state, { type: 'steal', thief: idx, victim, res });
    }
    state.turn.pending = null;
    return null;
  },

  buildRoad(state, idx, { edge }) {
    const e = requireTurn(state, idx);
    if (e) return e;
    const p = state.players[idx];
    const free = state.turn.freeRoads > 0;
    if (!free) {
      const m = requireMain(state, idx);
      if (m) return m;
      if (!hasRes(p.resources, COSTS.road)) return 'Dir fehlen Rohstoffe für eine Straße.';
    } else if (state.turn.pending) {
      return 'Zuerst die laufende Aktion abschließen.';
    }
    if (p.stock.road <= 0) return 'Du hast keine Straßen mehr.';
    if (!canPlaceRoad(state, idx, edge)) return 'Hier kannst du keine Straße bauen.';
    if (free) state.turn.freeRoads--;
    else pay(state, p, COSTS.road);
    state.roads[edge] = idx;
    p.stock.road--;
    addLog(state, idx, `${p.name} baut eine Straße${free ? ' (kostenlos)' : ''}.`, 'road');
    addEvent(state, { type: 'build', kind: 'road', player: idx, id: edge });
    if (state.turn.freeRoads > 0 && (p.stock.road <= 0 || !validRoadSpots(state, idx).length)) state.turn.freeRoads = 0;
    updateLongestRoad(state);
    return null;
  },

  buildSettlement(state, idx, { vertex }) {
    const e = requireMain(state, idx);
    if (e) return e;
    const p = state.players[idx];
    if (!hasRes(p.resources, COSTS.settlement)) return 'Dir fehlen Rohstoffe für eine Siedlung.';
    if (p.stock.settlement <= 0) return 'Du hast keine Siedlungen mehr.';
    if (!canPlaceSettlement(state, idx, vertex)) return 'Hier ist kein Platz für eine Siedlung.';
    pay(state, p, COSTS.settlement);
    state.buildings[vertex] = { player: idx, type: 'settlement' };
    p.stock.settlement--;
    addLog(state, idx, `${p.name} gründet eine Siedlung.`, 'house');
    addEvent(state, { type: 'build', kind: 'settlement', player: idx, id: vertex });
    updateLongestRoad(state);
    return null;
  },

  buildCity(state, idx, { vertex }) {
    const e = requireMain(state, idx);
    if (e) return e;
    const p = state.players[idx];
    if (!hasRes(p.resources, COSTS.city)) return 'Dir fehlen Rohstoffe für eine Stadt.';
    if (p.stock.city <= 0) return 'Du hast keine Städte mehr.';
    if (!canPlaceCity(state, idx, vertex)) return 'Nur eigene Siedlungen können zur Stadt ausgebaut werden.';
    pay(state, p, COSTS.city);
    state.buildings[vertex] = { player: idx, type: 'city' };
    p.stock.city--;
    p.stock.settlement++;
    addLog(state, idx, `${p.name} baut eine Stadt.`, 'city');
    addEvent(state, { type: 'build', kind: 'city', player: idx, id: vertex });
    return null;
  },

  buyDev(state, idx) {
    const e = requireMain(state, idx);
    if (e) return e;
    const p = state.players[idx];
    if (!hasRes(p.resources, COSTS.dev)) return 'Dir fehlen Rohstoffe für eine Entwicklungskarte.';
    if (!state.devDeck.length) return 'Der Stapel ist leer.';
    pay(state, p, COSTS.dev);
    const type = state.devDeck.pop();
    p.devCards.push({ type, bought: state.turn.number });
    addLog(state, idx, `${p.name} kauft eine Entwicklungskarte.`, 'card');
    addEvent(state, { type: 'buyDev', player: idx, card: type });
    return null;
  },

  playDev(state, idx, action) {
    const e = requireTurn(state, idx);
    if (e) return e;
    const { card } = action;
    if (state.turn.pending || state.turn.freeRoads > 0) return 'Zuerst die laufende Aktion abschließen.';
    if (state.trade) return 'Ein Handelsangebot ist noch offen.';
    if (card === 'vp') return 'Siegpunktkarten zählen automatisch.';
    if (state.turn.devPlayed) return 'Pro Zug nur eine Entwicklungskarte.';
    if (card !== 'knight' && !state.turn.rolled) return 'Diese Karte erst nach dem Würfeln spielen.';
    const p = state.players[idx];
    const i = p.devCards.findIndex((c) => c.type === card && c.bought < state.turn.number);
    if (i < 0) return 'Keine spielbare Karte dieses Typs (neu gekaufte Karten erst ab dem nächsten Zug).';

    if (card === 'yearOfPlenty') {
      const picks = action.resources;
      if (!Array.isArray(picks) || picks.length !== 2 || !picks.every((r) => RESOURCES.includes(r))) return 'Wähle zwei Rohstoffe.';
      const need = emptyRes();
      picks.forEach((r) => need[r]++);
      if (!hasRes(state.bank, need)) return 'Die Bank hat nicht genug davon.';
      for (const r of picks) { state.bank[r]--; p.resources[r]++; }
      addLog(state, idx, `${p.name} spielt Erfindung und nimmt ${fmtRes(need)}.`, 'card');
    } else if (card === 'monopoly') {
      const r = action.resource;
      if (!RESOURCES.includes(r)) return 'Wähle einen Rohstoff.';
      let total = 0;
      for (const o of state.players) {
        if (o.idx === idx) continue;
        total += o.resources[r];
        p.resources[r] += o.resources[r];
        o.resources[r] = 0;
      }
      addLog(state, idx, `${p.name} spielt Monopol auf ${RES_LABEL[r]} und erhält ${total} Karten.`, 'card');
      addEvent(state, { type: 'monopoly', player: idx, res: r, total });
    } else if (card === 'roadBuilding') {
      if (p.stock.road <= 0 || !validRoadSpots(state, idx).length) return 'Du kannst gerade keine Straße bauen.';
      state.turn.freeRoads = Math.min(2, p.stock.road);
      addLog(state, idx, `${p.name} spielt Straßenbau.`, 'card');
    } else if (card === 'knight') {
      p.knights++;
      state.turn.pending = 'robber';
      addLog(state, idx, `${p.name} spielt einen Ritter.`, 'sword');
      updateLargestArmy(state, idx);
    } else {
      return 'Unbekannte Karte.';
    }
    p.devCards.splice(i, 1);
    state.turn.devPlayed = true;
    addEvent(state, { type: 'playDev', player: idx, card });
    return null;
  },

  bankTrade(state, idx, { give, get }) {
    const e = requireMain(state, idx);
    if (e) return e;
    if (!validResMap(give) || !validResMap(get)) return 'Ungültiger Handel.';
    const p = state.players[idx];
    const ratios = harborRatios(state, idx);
    let credits = 0;
    for (const r of RESOURCES) {
      const n = give[r] || 0;
      if (n % ratios[r] !== 0) return `${RES_LABEL[r]} tauschst du im Verhältnis ${ratios[r]}:1.`;
      credits += n / ratios[r];
    }
    const want = resCount(get);
    if (!want || credits !== want) return 'Angebot und Nachfrage passen nicht zusammen.';
    if (RESOURCES.some((r) => give[r] && get[r])) return 'Tausche nicht denselben Rohstoff.';
    if (!hasRes(p.resources, give)) return 'So viele Karten hast du nicht.';
    if (!hasRes(state.bank, get)) return 'Die Bank hat nicht genug davon.';
    pay(state, p, give);
    for (const r of RESOURCES) { const n = get[r] || 0; state.bank[r] -= n; p.resources[r] += n; }
    addLog(state, idx, `${p.name} tauscht ${fmtRes(give)} gegen ${fmtRes(get)}.`, 'trade');
    addEvent(state, { type: 'bankTrade', player: idx, give, get });
    return null;
  },

  // Angebot an alle Mitspieler; jeder nimmt an oder lehnt ab, der Anbieter wählt unter den Zusagen
  offerTrade(state, idx, { give, get }) {
    const e = requireMain(state, idx);
    if (e) return e;
    if (!validResMap(give) || !validResMap(get)) return 'Ungültiges Angebot.';
    if (!resCount(give) || !resCount(get)) return 'Biete etwas an und wünsche dir etwas.';
    if (RESOURCES.some((r) => give[r] && get[r])) return 'Tausche nicht denselben Rohstoff.';
    const p = state.players[idx];
    if (!hasRes(p.resources, give)) return 'So viele Karten hast du nicht.';
    state.tradeSeq = (state.tradeSeq || 0) + 1;
    const responses = {};
    for (const o of state.players) if (o.idx !== idx) responses[o.idx] = 'pending';
    state.trade = { id: state.tradeSeq, from: idx, give: { ...give }, get: { ...get }, responses };
    addLog(state, idx, `${p.name} bietet allen ${fmtRes(give)} für ${fmtRes(get)}.`, 'trade');
    addEvent(state, { type: 'tradeOffer', from: idx, id: state.tradeSeq });
    return null;
  },

  respondTrade(state, idx, { response }) {
    const t = state.trade;
    if (!t) return 'Kein offenes Angebot.';
    if (t.from === idx || !(idx in t.responses)) return 'Dieses Angebot gilt nicht dir.';
    const me = state.players[idx];
    if (response === 'accept') {
      if (t.responses[idx] === 'accepted') return null;
      if (t.responses[idx] === 'declined') return 'Du hast bereits abgelehnt.';
      if (!hasRes(me.resources, t.get)) return 'Dir fehlen die gewünschten Karten.';
      t.responses[idx] = 'accepted';
      addLog(state, idx, `${me.name} nimmt das Angebot an.`, 'trade');
      addEvent(state, { type: 'tradeAccepted', from: t.from, by: idx });
      return null;
    }
    if (response === 'decline') {
      if (t.responses[idx] === 'declined') return null;
      t.responses[idx] = 'declined';
      addLog(state, idx, `${me.name} lehnt das Angebot ab.`, 'trade');
      if (Object.values(t.responses).every((r) => r === 'declined')) {
        addLog(state, t.from, 'Niemand möchte tauschen – das Angebot ist vom Tisch.', 'trade');
        addEvent(state, { type: 'tradeDeclined', from: t.from });
        state.trade = null;
      }
      return null;
    }
    return 'Ungültige Antwort.';
  },

  // Der Anbieter wählt, mit wem er tauscht
  confirmTrade(state, idx, { with: partner }) {
    const t = state.trade;
    if (!t || t.from !== idx) return 'Kein eigenes offenes Angebot.';
    if (t.responses[partner] !== 'accepted') return 'Dieser Spieler hat nicht angenommen.';
    const me = state.players[idx];
    const other = state.players[partner];
    if (!hasRes(me.resources, t.give)) return 'Dir fehlen die angebotenen Karten.';
    if (!hasRes(other.resources, t.get)) {
      t.responses[partner] = 'declined';
      return `${other.name} hat die Karten nicht mehr.`;
    }
    swap(state, me, other, t.give, t.get);
    state.trade = null;
    return null;
  },

  cancelTrade(state, idx) {
    if (!state.trade || state.trade.from !== idx) return 'Kein eigenes offenes Angebot.';
    state.trade = null;
    addLog(state, idx, `${state.players[idx].name} zieht das Angebot zurück.`, 'trade');
    return null;
  },

  endTurn(state, idx) {
    const e = requireTurn(state, idx);
    if (e) return e;
    if (!state.turn.rolled) return 'Zuerst würfeln.';
    if (state.turn.pending) return 'Zuerst die laufende Aktion abschließen.';
    if (state.turn.freeRoads > 0) return 'Baue zuerst deine kostenlosen Straßen.';
    state.trade = null;
    const n = state.players.length;
    const nextIdx = (idx + 1) % n;
    const number = state.turn.number + 1;
    const round = nextIdx === state.setup.order[0] ? state.turn.round + 1 : state.turn.round;
    state.current = nextIdx;
    state.turn = { number, round, rolled: false, dice: null, devPlayed: false, pending: null, discards: null, freeRoads: 0, afterRobber: null };
    addLog(state, nextIdx, `${state.players[nextIdx].name} beginnt den Zug.`, 'compass');
    addEvent(state, { type: 'turn', player: nextIdx });
    return null;
  },
};

function swap(state, a, b, aGives, bGives) {
  for (const r of RESOURCES) {
    const x = aGives[r] || 0;
    const y = bGives[r] || 0;
    a.resources[r] += y - x;
    b.resources[r] += x - y;
  }
  addLog(state, a.idx, `${a.name} und ${b.name} handeln: ${fmtRes(aGives)} gegen ${fmtRes(bGives)}.`, 'trade');
  addEvent(state, { type: 'trade', a: a.idx, b: b.idx, aGives, bGives });
}

function produce(state, sum) {
  const demand = {}; // res -> { playerIdx: n }
  for (const h of state.board.hexes) {
    if (h.number !== sum || h.id === state.robber) continue;
    const r = TERRAIN_RESOURCE[h.terrain];
    for (const v of h.vertices) {
      const b = state.buildings[v];
      if (!b) continue;
      demand[r] = demand[r] || {};
      demand[r][b.player] = (demand[r][b.player] || 0) + (b.type === 'city' ? 2 : 1);
    }
  }
  const gains = {};
  for (const [r, byPlayer] of Object.entries(demand)) {
    const total = Object.values(byPlayer).reduce((a, b) => a + b, 0);
    const owners = Object.keys(byPlayer);
    let give = byPlayer;
    if (total > state.bank[r]) {
      if (owners.length > 1) {
        addLog(state, null, `Die Bank hat nicht genug ${RES_LABEL[r]} – niemand erhält etwas davon.`, 'bank');
        continue;
      }
      give = { [owners[0]]: state.bank[r] };
    }
    for (const [pi, n] of Object.entries(give)) {
      if (!n) continue;
      state.players[pi].resources[r] += n;
      state.bank[r] -= n;
      gains[pi] = gains[pi] || {};
      gains[pi][r] = (gains[pi][r] || 0) + n;
    }
  }
  if (!Object.keys(gains).length) addLog(state, null, 'Diesmal bringt die Insel keinen Ertrag.', 'island');
  for (const [pi, g] of Object.entries(gains)) {
    addLog(state, Number(pi), `${state.players[pi].name} erhält ${fmtRes(g)}.`, 'harvest');
  }
  return gains;
}

// ---------- Sicht eines Spielers (verdeckte Informationen entfernen) ----------

export function viewFor(state, viewer) {
  const v = structuredClone(state);
  delete v.rng;
  v.devDeckCount = state.devDeck.length;
  delete v.devDeck;
  v.players = state.players.map((p) => {
    const q = structuredClone(p);
    q.resourceCount = resCount(p.resources);
    q.devCount = p.devCards.length;
    q.publicVP = playerVP(state, p.idx, false);
    q.longestRoad = longestRoadFor(state, p.idx);
    if (p.idx === viewer || state.phase === 'ended') {
      q.vp = playerVP(state, p.idx, true);
    } else {
      q.resources = null;
      q.devCards = null;
    }
    return q;
  });
  v.events = state.events.map((ev) => {
    if (ev.type === 'steal' && viewer !== ev.thief && viewer !== ev.victim) return { ...ev, res: null };
    if (ev.type === 'buyDev' && viewer !== ev.player) return { ...ev, card: null };
    return ev;
  });
  v.you = viewer;
  return v;
}
