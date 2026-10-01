// Hauptanwendung: Verbindung, Startmenü, Lobby, Spieloberfläche, Hologramm-Vorschau, Kamerafahrten und Modals.
import {
  RESOURCES, RES_LABEL, TERRAIN_RESOURCE, TERRAIN_LABEL, COSTS, DEV_LABEL, DEV_TEXT, PLAYER_COLORS, PIPS,
  createGame, applyAction, viewFor, validSettlementSpots, validRoadSpots, validCitySpots, robberHexes, stealCandidates,
  hasRes, harborRatios, resCount,
} from '/shared/engine.js';
import { Board3D } from './board3d.js';
import { play, toggleSound, isSoundOn, SOUNDS } from './sound.js';
import { settings, onSettingsChange } from './settings.js';
import {
  resourceArt, portraitArt, iconArt, devArt, uiArt, ILLUS, emblem, icon, modeArt, expansionArt,
} from './art.js';

// Chronik-Einträge: Symbolname aus der Spiellogik → farbiges Motiv
const LOG_EMBLEM = {
  island: 'island', compass: 'compass', dice: 'dice', harvest: 'harvest', robber: 'robber', discard: 'discard', steal: 'steal',
  house: 'house', city: 'city', road: 'road', card: 'card', sword: 'sword', trade: 'trade', bank: 'bank', crown: 'crown', scroll: 'scroll',
};
const COLOR_HEX = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.hex]));
const COLOR_LABEL = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.label]));
const PACE_LABEL = { relaxed: 'Gemütlich', normal: 'Normal', fast: 'Zügig' };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get(k) { try { return localStorage.getItem(`siedlungen.${k}`); } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(`siedlungen.${k}`); else localStorage.setItem(`siedlungen.${k}`, v); } catch { /* ignorieren */ } },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Zustand ----------

const S = {
  ws: null,
  token: null,
  room: null,
  you: null,
  local: null, // Hot-Seat: alle Plätze dieses Geräts
  state: null,
  prev: null,
  mode: null,
  lastSeq: 0,
  board: null,
  games: [],
  chat: [],
  chatUnread: 0,
  autoModal: null,
  modalKey: null,
  pendingJoin: null,
  reconnectDelay: 500,
  demo: false,
  menuMode: 'ai',
  hsNames: null,
  pops: [],
  cineToken: 0,
  shownSeat: undefined,
};
window.__siedlungen = S; // für Debugging in der Konsole

// Aktueller Raum: pro Tab (sessionStorage) und zusätzlich als „zuletzt“ im localStorage
const roomStore = {
  get() {
    try { return sessionStorage.getItem('siedlungen.room') || (S.sharedIdentity ? store.get('room') : null); } catch { return null; }
  },
  set(code) {
    try { if (code) sessionStorage.setItem('siedlungen.room', code); else sessionStorage.removeItem('siedlungen.room'); } catch { /* ignorieren */ }
    store.set('room', code);
  },
};

// ---------- Identität pro Tab ----------
// Das Token (Sitzplatz) wird gespeichert, damit Neuladen den Platz zurückholt. Ist es schon in einem
// anderen offenen Tab aktiv, bekommt dieser Tab eine eigene Identität (mehrere Spieler im selben Browser).
async function resolveToken() {
  let own = null;
  try { own = sessionStorage.getItem('siedlungen.token'); } catch { /* ignorieren */ }
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('siedlungen') : null;
  let candidate = own || store.get('token');
  if (!own && candidate && channel) {
    const taken = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), 200);
      channel.onmessage = (e) => { if (e.data?.t === 'mine' && e.data.token === candidate) { clearTimeout(t); resolve(true); } };
      channel.postMessage({ t: 'who', token: candidate });
    });
    if (taken) candidate = null;
  }
  if (channel) {
    channel.onmessage = (e) => { if (e.data?.t === 'who' && e.data.token === S.token) channel.postMessage({ t: 'mine', token: S.token }); };
  }
  S.sharedIdentity = !!candidate && !own;
  return candidate;
}

function saveToken(token) {
  S.token = token;
  store.set('token', token);
  try { sessionStorage.setItem('siedlungen.token', token); } catch { /* ignorieren */ }
}

// ---------- Netzwerk ----------

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  S.ws = ws;
  setConn('Verbinde …');
  ws.onopen = () => {
    S.reconnectDelay = 500;
    setConn('');
    send({ t: 'hello', token: S.token });
  };
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    onMessage(msg);
  };
  ws.onclose = () => {
    setConn('Verbindung getrennt – neuer Versuch …');
    setTimeout(connect, S.reconnectDelay);
    S.reconnectDelay = Math.min(8000, S.reconnectDelay * 1.7);
  };
}

// Lebenszeichen, damit Leitungen nicht einschlafen (Cloudflare antwortet mit „pong“, Node ignoriert es)
setInterval(() => {
  if (S.ws && S.ws.readyState === 1) S.ws.send('ping');
}, 25_000);

function send(msg) {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg));
  else toast('Keine Verbindung zum Server.');
}

function act(type, payload = {}) {
  play('click');
  send({ t: 'action', seat: S.you, action: { type, ...payload } });
}

function setConn(text) {
  $('#conn-state').textContent = text;
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome': {
      saveToken(msg.token);
      const urlCode = new URLSearchParams(location.search).get('room');
      const code = (urlCode || roomStore.get() || '').toUpperCase();
      if (code) {
        S.pendingJoin = code;
        send({ t: 'joinRoom', code, name: myName() });
      }
      break;
    }
    case 'games':
      S.games = msg.games || [];
      renderResume();
      if (!$('#menu-games').hidden) renderGames();
      break;
    case 'room': {
      S.pendingJoin = null;
      S.room = msg.room;
      S.you = msg.you;
      S.local = msg.local || null;
      roomStore.set(msg.room.code);
      if (new URLSearchParams(location.search).get('room') !== msg.room.code) history.replaceState(null, '', `?room=${msg.room.code}`);
      if (!msg.room.started) showMenu('room');
      break;
    }
    case 'state':
      onState(msg.state);
      break;
    case 'error':
      if (S.pendingJoin) {
        S.pendingJoin = null;
        roomStore.set(null);
        const fromLink = new URLSearchParams(location.search).get('room');
        history.replaceState(null, '', location.pathname);
        if (fromLink) toast(msg.msg);
        return;
      }
      toast(msg.msg);
      play('error');
      break;
    case 'info':
      toast(msg.msg, true);
      break;
    case 'kicked':
    case 'left':
      if (msg.msg) toast(msg.msg);
      resetToMenu();
      break;
    case 'chat':
      S.chat.push(msg);
      if (!$('#chat').hidden) renderChat();
      else { S.chatUnread++; renderChatBadge(); }
      if (msg.seat !== S.you) play('click');
      break;
    default:
  }
}

function resetToMenu() {
  S.room = null;
  S.state = null;
  S.you = null;
  S.local = null;
  S.mode = null;
  S.chat = [];
  S.shownSeat = undefined;
  roomStore.set(null);
  history.replaceState(null, '', location.pathname);
  closeModal();
  hideCurtain();
  stopTour();
  showDemo();
  showMenu('home');
  send({ t: 'listGames' });
}

// ---------- Startmenü ----------

function myName() {
  return ($('.mode-panel:not([hidden]) .name-input')?.value || store.get('name') || '').trim();
}

function showMenu(view = 'home') {
  document.body.classList.add('menu-open');
  $('#menu-screen').hidden = false;
  S.menuView = view;
  for (const v of ['home', 'games', 'expansions', 'room']) $(`#menu-${v}`).hidden = view !== v;
  $$('#menu-nav [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#menu-shell').classList.toggle('in-room', view === 'room');
  if (view === 'room') renderRoom();
  if (view === 'games') renderGames();
  if (view === 'home') renderMenuMode();
  if (view === 'expansions') renderExpansions();
  $('#menu-stage').scrollTop = 0;
  requestAnimationFrame(frameMenuIsland);
}

function hideMenu() {
  document.body.classList.remove('menu-open');
  $('#menu-screen').hidden = true;
  S.board?.setViewShift(0);
  S.board?.setMenuMode(false);
}

// Die Insel im Hintergrund mittig in den freien Raum zwischen Navigation und Bühne rücken
function frameMenuIsland() {
  if (!S.board || $('#menu-screen').hidden) return;
  const nav = $('.menu-nav').getBoundingClientRect();
  const stage = $('#menu-stage').getBoundingClientRect();
  const wide = innerWidth > 900;
  S.board.setViewShift(wide ? (nav.right + stage.left) / 2 - innerWidth / 2 : 0);
  S.board.setMenuMode(true, wide ? stage.left - nav.right : innerWidth);
}
window.addEventListener('resize', () => requestAnimationFrame(frameMenuIsland));

// Eine zufällig besiedelte Insel als lebendiger Hintergrund des Menüs
function showDemo() {
  const st = createGame({
    players: [{ name: 'Du', color: 'red' }, { name: 'Eleonore', color: 'yellow', isBot: true }, { name: 'Rowan', color: 'blue', isBot: true }, { name: 'Finn', color: 'white', isBot: true }],
    seed: Math.floor(Math.random() * 1e9),
  });
  let guard = 0;
  while (st.phase === 'setup' && guard++ < 40) {
    const i = st.current;
    if (st.setup.step === 'settlement') {
      const spots = validSettlementSpots(st, i, true);
      const score = (v) => st.board.vertices[v].hexes.reduce((s, h) => s + (PIPS[st.board.hexes[h].number] || 0), 0);
      spots.sort((a, b) => score(b) - score(a));
      applyAction(st, i, { type: 'placeSettlement', vertex: spots[Math.floor(Math.random() * Math.min(6, spots.length))] });
    } else {
      const e = validRoadSpots(st, i, st.setup.lastVertex);
      applyAction(st, i, { type: 'placeRoad', edge: e[Math.floor(Math.random() * e.length)] });
    }
  }
  Object.values(st.buildings).slice(0, 3).forEach((b, i) => { if (i % 2 === 0) b.type = 'city'; });
  S.demo = true;
  S.you = 0;
  S.state = viewFor(st, 0);
  S.prev = null;
  ensureBoard();
  S.board.build(S.state);
  S.board.sync(S.state, (i) => COLOR_HEX[S.state.players[i].color]);
  S.board.setTargets(null);
  S.board.setGhosts([]);
  S.board.setBaseView('angled', false);
  S.board.setOrbit(true);
  render();
}

function renderResume() {
  const games = S.games.filter((g) => g.phase !== 'ended');
  $('#saved-count').textContent = String(S.games.length);
  $('#saved-count').hidden = !S.games.length;
  const last = games[0];
  $('#btn-continue').hidden = !last;
  if (!last) return;
  $('#continue-art').innerHTML = ILLUS.island;
  $('#continue-title').textContent = last.island;
  $('#continue-sub').textContent = `${last.phase === 'setup' ? 'Gründungsphase' : `Runde ${last.round || 1}`}${last.hotseat ? ' · an einem Gerät' : ''} · ${timeAgo(last.lastActive)}`;
}

function renderGames() {
  const list = $('#games-list');
  if (!S.games.length) {
    list.innerHTML = `<li class="games-empty">${emblem('island', 72)}<b>Noch keine gespeicherten Partien</b><span>Beginne ein neues Abenteuer – jede Insel wird automatisch gesichert.</span><button class="btn primary" data-goto="home">Neues Spiel</button></li>`;
    $('[data-goto]', list).addEventListener('click', () => { play('page'); showMenu('home'); });
    return;
  }
  list.innerHTML = S.games.map((g) => {
    const status = g.phase === 'ended'
      ? `${icon('crown', 12)} ${esc(g.players[g.winner]?.name || '')} hat gewonnen`
      : g.phase === 'setup' ? 'Gründungsphase' : `Runde ${g.round} · Zug ${g.turn}`;
    return `<li class="game-item">
      <div class="game-art">${ILLUS.island}</div>
      <div class="game-info">
        <b>${esc(g.island)}</b>
        <small>${status} · ${timeAgo(g.lastActive)}${g.hotseat ? ' · an einem Gerät' : ''}</small>
        <div class="game-players">${g.players.map((p, i) => `<span class="gp ${i === g.you ? 'me' : ''}" title="${esc(p.name)}">${portraitArt(i, COLOR_HEX[p.color], 24)}</span>`).join('')}
          <span class="gvp">${icon('crown', 12)} ${g.vp}/${g.vpToWin}</span></div>
      </div>
      <div class="game-actions">
        <button class="btn small primary" data-join="${g.code}">${g.phase === 'ended' ? 'Ansehen' : 'Fortsetzen'}</button>
        <button class="btn small ghost icon-btn" data-del="${g.code}" title="Aus der Liste entfernen">${icon('trash', 16)}</button>
      </div></li>`;
  }).join('');
  $$('[data-join]', list).forEach((b) => b.addEventListener('click', () => send({ t: 'joinRoom', code: b.dataset.join })));
  $$('[data-del]', list).forEach((b) => b.addEventListener('click', () => {
    if (confirm('Diese Partie aus deiner Liste entfernen? Du verlässt damit deinen Platz.')) send({ t: 'deleteGame', code: b.dataset.del });
  }));
}

// Erweiterungen: noch nicht spielbar, aber schon zu sehen
const EXPANSION_INFO = [
  {
    id: 'players', name: 'Für 5–6 Spieler', eyebrow: 'Mehr Platz am Tisch', players: '5–6 Siedler',
    text: 'Eine größere Insel mit 30 Landfeldern, zwei zusätzliche Hausfarben und eine Sonderbauphase, in der alle zwischen den Zügen bauen dürfen.',
    tags: [['users', 'Grün & Violett'], ['island', '30 Felder · 11 Häfen'], ['house', 'Sonderbauphase']],
  },
  {
    id: 'seafarers', name: 'Seefahrer', eyebrow: 'Setz die Segel', players: '3–4 Siedler',
    text: 'Schiffe verbinden ganze Inselgruppen, im Nebel warten unentdeckte Länder und Goldflüsse lassen dich deinen Rohstoff frei wählen.',
    tags: [['ship', 'Schiffe statt Straßen'], ['compass', 'Unbekannte Inseln'], ['coin', 'Goldfluss']],
  },
  {
    id: 'knights', name: 'Städte & Ritter', eyebrow: 'Wachse über dich hinaus', players: '3–4 Siedler',
    text: 'Handelswaren wie Tuch, Münzen und Papier, prächtige Stadtausbauten bis zur Metropole und Ritter, die die Insel gegen Barbaren verteidigen.',
    tags: [['helmet', 'Ritter & Barbaren'], ['city', 'Metropolen'], ['scroll', 'Fortschrittskarten']],
  },
  {
    id: 'merchants', name: 'Händler & Barbaren', eyebrow: 'Neue Geschichten', players: '2–4 Siedler',
    text: 'Szenarien voller Leben: Fischer am Ufer, Flüsse mit Brücken, Karawanen durch die Wüste und Händler, die über die Insel ziehen.',
    tags: [['bank', 'Fischer & Flüsse'], ['desert', 'Karawanen'], ['trade', 'Händlerzüge']],
  },
  {
    id: 'pirates', name: 'Entdecker & Piraten', eyebrow: 'Auf zu fernen Küsten', players: '3–4 Siedler',
    text: 'Gründe Siedlungen mit dem Schiff, erfülle Missionen, bekämpfe Piratenlager und bring Gewürze und Fisch zurück in deinen Hafen.',
    tags: [['chest', 'Missionen'], ['sword', 'Piratenlager'], ['harvest', 'Gewürzinseln']],
  },
];

function renderExpansions() {
  const grid = $('#exp-grid');
  if (grid.childElementCount) return;
  grid.innerHTML = EXPANSION_INFO.map((x) => `<article class="exp-card">
    <div class="exp-art">${expansionArt(x.id)}<span class="exp-ribbon">Coming soon</span></div>
    <div class="exp-body">
      <div class="eyebrow">${x.eyebrow} · ${x.players}</div>
      <h3>${x.name}</h3>
      <p>${x.text}</p>
      <ul class="exp-tags">${x.tags.map(([e, t]) => `<li>${emblem(e, 18)}${t}</li>`).join('')}</ul>
      <button class="btn small block" disabled>${icon('lock', 14)} Coming soon</button>
    </div></article>`).join('');
}

function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tag(en)`;
}

function renderMenuMode() {
  const m = S.menuMode;
  $$('.mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $$('.mode-panel').forEach((p) => { p.hidden = p.dataset.panel !== m; });
  const name = store.get('name') || '';
  $$('.name-input').forEach((i) => { if (!i.value) i.value = name; });
  if (m === 'ai') {
    const n = Number($('#solo-bots').value);
    $('#mode-desc').textContent = `Du und ${n === 1 ? 'ein KI-Siedler' : `${n} KI-Siedler`}. Eine frische Insel und ein Wettlauf zu ${$('#solo-vp').value} Siegpunkten.`;
    $('#btn-go').innerHTML = `Die Insel besiedeln ${icon('arrowRight', 18)}`;
  } else if (m === 'friends') {
    const code = $('#code-input').value.trim();
    $('#mode-desc').textContent = code
      ? `Tritt dem Raum ${code.toUpperCase()} bei.`
      : 'Erstelle einen privaten Raum und teile den Link. Freie Plätze kannst du mit KI-Siedlern füllen.';
    $('#btn-go').innerHTML = `${code ? 'Raum beitreten' : 'Raum erstellen'} ${icon('arrowRight', 18)}`;
  } else {
    renderHotseatNames();
    $('#mode-desc').textContent = 'Reicht das Gerät reihum weiter. Eure Karten bleiben verdeckt, bis ihr am Zug seid.';
    $('#btn-go').innerHTML = `Gemeinsam beginnen ${icon('arrowRight', 18)}`;
  }
}

function renderHotseatNames() {
  if (!S.hsNames) S.hsNames = [store.get('name') || 'Spieler 1', 'Spieler 2'];
  const box = $('#hotseat-names');
  box.innerHTML = S.hsNames.map((n, i) => `<div class="hs-row">
    ${portraitArt(i, PLAYER_COLORS[i].hex, 30)}
    <input maxlength="18" value="${esc(n)}" data-hs="${i}" placeholder="Spieler ${i + 1}" />
    ${S.hsNames.length > 2 ? `<button class="btn small ghost icon-btn" data-hs-del="${i}" title="Entfernen">${icon('close', 15)}</button>` : ''}
  </div>`).join('');
  $$('[data-hs]', box).forEach((inp) => inp.addEventListener('input', () => { S.hsNames[Number(inp.dataset.hs)] = inp.value; }));
  $$('[data-hs-del]', box).forEach((b) => b.addEventListener('click', () => { S.hsNames.splice(Number(b.dataset.hsDel), 1); renderHotseatNames(); }));
  const bots = Number($('#hs-bots').value);
  $('#hs-add').disabled = S.hsNames.length + bots >= 4;
  $$('#hs-bots option').forEach((o) => { o.disabled = Number(o.value) + S.hsNames.length > 4; });
}

function amHost() {
  return !!S.room && (S.local ? S.local.includes(S.room.host) : S.room.host === S.you);
}

function renderRoom() {
  const r = S.room;
  if (!r) return;
  const isHost = amHost();
  $('#room-code').textContent = r.code;
  const list = $('#seat-list');
  const used = new Set(r.seats.map((s) => s.color));
  list.innerHTML = r.seats.map((s, i) => {
    const mine = i === S.you;
    const canColor = !r.started && (mine || (isHost && s.isBot));
    const swatches = PLAYER_COLORS.map((c) => `<button class="swatch ${s.color === c.id ? 'sel' : ''}" style="background:${c.hex}" data-seat="${i}" data-color="${c.id}" ${canColor && (!used.has(c.id) || s.color === c.id) ? '' : 'disabled'} title="${c.label}"></button>`).join('');
    return `<li class="seat">
      ${portraitArt(i, COLOR_HEX[s.color], 40)}
      <div class="name">${esc(s.name)} ${mine ? `<span class="tag">(du)</span> <button class="btn small ghost icon-btn" id="btn-rename" title="Namen ändern">${icon('pencil', 15)}</button>` : ''}</div>
      <span class="tag status">${i === r.host ? `${icon('crown', 13)} Gastgeber` : s.isBot ? `${icon('bot', 13)} KI-Siedler` : s.connected ? '<i class="dot on"></i> bereit' : '<i class="dot"></i> getrennt'}</span>
      <div class="swatches">${swatches}</div>
      ${isHost && i !== r.host ? `<button class="btn small ghost icon-btn" data-remove="${i}" title="Entfernen">${icon('close', 15)}</button>` : ''}
    </li>`;
  }).join('') + Array.from({ length: 4 - r.seats.length }, () => `<li class="seat empty">${icon('users', 16)} Freier Platz – teile den Code</li>`).join('');
  $$('.swatch', list).forEach((b) => b.addEventListener('click', () => send({ t: 'setColor', color: b.dataset.color, seat: Number(b.dataset.seat) })));
  $$('[data-remove]', list).forEach((b) => b.addEventListener('click', () => send({ t: 'removeSeat', seat: Number(b.dataset.remove) })));
  $('#btn-rename', list)?.addEventListener('click', () => {
    const n = prompt('Dein Name:', r.seats[S.you]?.name || '');
    if (n && n.trim()) { store.set('name', n.trim()); send({ t: 'setName', name: n.trim() }); }
  });
  $('#room-options').style.display = isHost ? '' : 'none';
  $('#room-vp').value = String(r.vpToWin);
  $('#room-pace').value = r.pace || 'normal';
  $('#btn-add-bot').disabled = r.seats.length >= 4;
  $('#btn-start').hidden = !isHost;
  $('#room-hint').textContent = isHost
    ? (r.seats.length < 2 ? 'Lade Freunde ein oder füge KI-Siedler hinzu (mind. 2 Spieler).' : `${r.seats.length} Spieler bereit. Ziel: ${r.vpToWin} Siegpunkte.`)
    : 'Warte, bis der Gastgeber die Partie beginnt …';
}

function inviteLink() {
  return `${location.origin}${location.pathname}?room=${S.room?.code}`;
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteLink());
    toast('Einladungslink kopiert.', true);
  } catch {
    prompt('Link zum Teilen:', inviteLink());
  }
}

function bindMenu() {
  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) { $('#code-input').value = urlCode.toUpperCase(); S.menuMode = 'friends'; }
  $$('.mode').forEach((b) => b.addEventListener('click', () => { S.menuMode = b.dataset.mode; play('page'); renderMenuMode(); }));
  $$('.name-input').forEach((i) => i.addEventListener('change', () => {
    store.set('name', i.value.trim());
    $$('.name-input').forEach((o) => { o.value = i.value; });
  }));
  for (const id of ['#solo-bots', '#solo-vp', '#code-input', '#hs-bots']) $(id).addEventListener('input', renderMenuMode);
  $('#hs-add').addEventListener('click', () => {
    if (S.hsNames.length < 4) S.hsNames.push(`Spieler ${S.hsNames.length + 1}`);
    renderHotseatNames();
  });
  $('#code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-go').click(); });
  $('#btn-go').addEventListener('click', () => {
    const m = S.menuMode;
    if (m === 'hotseat') {
      const names = S.hsNames.map((n, i) => n.trim() || `Spieler ${i + 1}`);
      const bots = Number($('#hs-bots').value);
      if (names.length + bots < 2) { toast('Mindestens zwei Siedler.'); return; }
      store.set('name', names[0]);
      send({ t: 'createRoom', hotseat: true, players: names, bots, vpToWin: Number($('#hs-vp').value) });
      return;
    }
    const name = myName();
    if (!name) {
      $('.mode-panel:not([hidden]) .name-input').focus();
      toast('Bitte gib zuerst deinen Namen ein.');
      return;
    }
    store.set('name', name);
    if (m === 'ai') {
      send({ t: 'createRoom', name, solo: true, bots: Number($('#solo-bots').value), vpToWin: Number($('#solo-vp').value), pace: $('#solo-pace').value });
    } else {
      const code = $('#code-input').value.trim().toUpperCase();
      if (code) {
        if (code.length !== 5) { toast('Der Raumcode hat 5 Zeichen.'); return; }
        send({ t: 'joinRoom', code, name });
      } else {
        send({ t: 'createRoom', name });
      }
    }
  });
  $('#btn-continue').addEventListener('click', () => {
    const last = S.games.find((g) => g.phase !== 'ended');
    if (last) send({ t: 'joinRoom', code: last.code });
  });
  $$('#menu-nav [data-view]').forEach((b) => b.addEventListener('click', () => { play('page'); showMenu(b.dataset.view); }));
  $$('#menu-nav [data-action]').forEach((b) => b.addEventListener('click', () => (b.dataset.action === 'rules' ? openRules(0) : openSettings())));
  $$('[data-mode-art]').forEach((el) => { el.innerHTML = modeArt(el.dataset.modeArt); });
  $('#btn-copy-link').addEventListener('click', copyInvite);
  $('#btn-add-bot').addEventListener('click', () => send({ t: 'addBot' }));
  $('#room-vp').addEventListener('change', () => send({ t: 'setOptions', vpToWin: Number($('#room-vp').value) }));
  $('#room-pace').addEventListener('change', () => send({ t: 'setOptions', pace: $('#room-pace').value }));
  $('#btn-start').addEventListener('click', () => send({ t: 'start' }));
  $('#btn-leave-room').addEventListener('click', () => send({ t: 'leave' }));
}

// ---------- Spielansicht ----------

function ensureBoard() {
  if (S.board) return;
  S.board = new Board3D($('#board-canvas'), {
    onPick,
    onHover: showTooltip,
    quality: settings.quality,
    scenery: settings.scenery,
  });
  const slider = $('#zoom-slider');
  S.board.onCamera = () => {
    const z = S.board.getZoom();
    if (document.activeElement !== slider) slider.value = String(Math.round(z * 100));
    $('#zoom-val').textContent = `${Math.round(60 + z * 120)}%`;
  };
  slider.addEventListener('input', () => S.board.setZoom(Number(slider.value) / 100));
  $('#zoom-in').addEventListener('click', () => S.board.setZoom(S.board.getZoom() + 0.12));
  $('#zoom-out').addEventListener('click', () => S.board.setZoom(S.board.getZoom() - 0.12));
  $('#rot-left').addEventListener('click', () => S.board.rotate(-1));
  $('#rot-right').addEventListener('click', () => S.board.rotate(1));
  $('#cam-reset').addEventListener('click', () => S.board.resetView());
  $('#pan-toggle').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('active');
    e.currentTarget.classList.toggle('active', on);
    S.board.setPanMode(on);
  });
  $('#toggle-harbors').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('active');
    e.currentTarget.classList.toggle('active', on);
    S.board.setHarborLabels(on);
  });
  $('#island-tour').addEventListener('click', () => (S.tour ? stopTour() : startTour()));
  const camBtn = $('#cam-toggle');
  const syncCam = () => camBtn.classList.toggle('active', settings.cinematic);
  syncCam();
  onSettingsChange((k) => { if (k === 'cinematic') syncCam(); });
  camBtn.addEventListener('click', () => {
    settings.cinematic = !settings.cinematic;
    toast(settings.cinematic ? 'Kamerafahrten an' : 'Kamerafahrten aus – die Kamera bleibt, wo du sie hinstellst.', true);
  });
}

function onState(state) {
  const fromDemo = S.demo;
  const first = fromDemo || !S.state || S.state.islandName !== state.islandName || S.lastSeq > state.seq;
  S.demo = false;
  S.prev = first ? null : S.state;
  S.state = state;
  hideMenu();
  ensureBoard();
  S.board.setOrbit(false);
  S.board.build(state);
  S.board.sync(state, (i) => COLOR_HEX[state.players[i].color]);
  S.board.setBaseView(state.phase === 'setup' ? 'top' : 'angled', true);
  if (first) {
    S.lastSeq = state.seq;
    S.dismissedAuto = null;
    if (S.room?.hotseat) S.shownSeat = undefined;
    const lastRoll = [...state.events].reverse().find((e) => e.type === 'roll');
    if (lastRoll) S.board.showDice(lastRoll.dice, false);
    if (!store.get('tourDone') && state.phase === 'setup') setTimeout(() => startTour(), 900);
  } else {
    processEvents(state);
  }
  if (S.mode && !modeStillValid()) S.mode = null;
  render();
  checkCurtain();
}

function me() {
  return S.state && S.you !== null && S.you !== undefined ? S.state.players[S.you] : null;
}

function myColor() {
  const p = me();
  return p ? COLOR_HEX[p.color] : '#ffffff';
}

function avatar(p, size = 44) {
  return portraitArt(p.idx ?? 0, COLOR_HEX[p.color] || p.color, size);
}

function nameOf(i) {
  if (i === S.you && !S.room?.hotseat) return 'Du';
  return S.state.players[i]?.name ?? '?';
}

function isMyMainPhase() {
  const st = S.state;
  return st && !S.demo && st.phase === 'play' && st.current === S.you && st.turn.rolled && !st.turn.pending && !st.trade && st.turn.freeRoads === 0;
}

function render() {
  const st = S.state;
  if (!st) return;
  $('#island-name').textContent = st.islandName;
  $('#footnote').textContent = `Wer zuerst ${st.vpToWin} Siegpunkte erreicht, gewinnt`;
  const chip = $('#room-chip');
  chip.hidden = !S.room || S.room.hotseat;
  if (S.room) chip.textContent = `RAUM ${S.room.code}`;
  renderPlayers();
  renderTurnCard();
  renderChronicle();
  renderHand();
  renderDev();
  renderBuild();
  renderOverlays();
  if (S.demo) return;
  updateTargets();
  renderAutoModal();
  if (S.modalKey === 'trade' && S.redrawTrade) {
    if (isMyMainPhase()) S.redrawTrade();
    else closeModal();
  }
}

function renderPlayers() {
  const st = S.state;
  const seats = S.room?.seats || [];
  $('#player-list').innerHTML = st.players.map((p) => {
    const active = st.phase !== 'ended' && p.idx === st.current;
    const vp = p.vp ?? p.publicVP;
    const seat = seats[p.idx];
    const off = !S.demo && seat && !seat.isBot && !seat.connected;
    const discarding = st.turn.pending === 'discard' && st.turn.discards && st.turn.discards[p.idx];
    const isMe = p.idx === S.you;
    const extra = [p.knights ? `${icon('sword', 11)} ${p.knights}` : '', p.longestRoad >= 3 ? `${icon('road', 11)} ${p.longestRoad}` : ''].filter(Boolean).join(' · ');
    return `<li class="player ${active ? 'active' : ''} ${isMe ? 'me' : ''}" data-idx="${p.idx}" style="--pc:${COLOR_HEX[p.color]}">
      <div class="portrait-wrap">${portraitArt(p.idx, COLOR_HEX[p.color], 58)}</div>
      <div class="pinfo">
        <div class="pname">${esc(isMe && !S.room?.hotseat ? 'Du' : p.name)}${p.isBot ? '<small>KI</small>' : ''}</div>
        <div class="phouse">${esc(COLOR_LABEL[p.color] || '')}</div>
        <div class="pvp"><span class="crown">${icon('crown', 12)}</span> <b>${vp}</b> <span class="of">/ ${st.vpToWin}</span></div>
      </div>
      <div class="pstats">
        <span title="Rohstoffkarten"><i class="mini-card"></i>${p.resourceCount} ${p.resourceCount === 1 ? 'Karte' : 'Karten'}</span>
        ${extra ? `<span class="pextra" title="Ritter · längste eigene Straße">${extra}</span>` : ''}
        <span title="Entwicklungskarten">${p.devCount} Entw.</span>
      </div>
      ${off ? '<span class="pstate off">getrennt</span>' : discarding ? '<span class="pstate">wirft ab …</span>' : ''}
      ${popsFor(p.idx)}
    </li>`;
  }).join('');
  const lr = st.longestRoad;
  const la = st.largestArmy;
  $('#award-road').classList.toggle('held', lr.player !== null);
  $('#award-road-sub').textContent = lr.player !== null ? `${nameOf(lr.player)} · ${lr.length} Straßen` : '5 Straßen nötig';
  $('#award-army').classList.toggle('held', la.player !== null);
  $('#award-army-sub').textContent = la.player !== null ? `${nameOf(la.player)} · ${la.size} Ritter` : '3 Ritter nötig';
}

function renderTurnCard() {
  const st = S.state;
  const mine = st.current === S.you;
  const cur = st.players[st.current];
  const m = { who: '', status: `Zug ${Math.max(1, st.turn.number)}`, illus: 'hourglass', caption: '', title: '', desc: '', actions: [] };
  m.who = mine ? (S.room?.hotseat ? `${esc(cur.name)} ist dran` : 'Dein Zug') : `${esc(cur.name)} ist am Zug`;

  if (S.demo) {
    m.who = 'Willkommen';
    m.illus = 'island';
    m.title = 'Eine neue Insel wartet';
    m.desc = 'Wähle im Menü dein Abenteuer.';
  } else if (st.phase === 'ended') {
    const w = st.players[st.winner];
    m.who = st.winner === S.you && !S.room?.hotseat ? 'Du hast gewonnen!' : `${esc(w.name)} gewinnt`;
    m.illus = 'crown';
    m.caption = 'Das Spiel ist entschieden';
    m.title = 'Die Insel hat einen Meister';
    m.desc = `${esc(w.name)} erreicht ${w.vp} Siegpunkte.`;
    m.actions.push({ label: `${icon('trophy', 17)} Ergebnis ansehen`, primary: true, fn: () => { S.autoModal = null; renderAutoModal(true); } });
  } else if (st.phase === 'setup') {
    m.status = 'Gründungsphase';
    const second = st.setup.index >= st.players.length;
    if (mine && st.setup.step === 'settlement') {
      m.illus = 'house';
      m.caption = second ? 'Zweite Siedlung' : 'Ein Ort zum Ankommen';
      m.title = second ? 'Noch ein Zuhause' : 'Baue deine erste Siedlung';
      m.desc = `Wähle eine leuchtende Kreuzung. Die angrenzenden Felder versorgen dich mit Rohstoffen.${second ? ' Diese Siedlung bringt sofort Starterträge.' : ''}`;
    } else if (mine) {
      m.illus = 'road';
      m.caption = 'Gründungsphase';
      m.title = 'Ein Weg voller Möglichkeiten';
      m.desc = 'Wähle eine leuchtende Straße neben deiner neuen Siedlung.';
    } else {
      m.title = 'Ein Moment der Geduld';
      m.desc = `${esc(cur.name)} sucht einen Platz für ${st.setup.step === 'settlement' ? 'eine Siedlung' : 'eine Straße'}.`;
    }
  } else if (st.turn.pending === 'discard') {
    m.illus = 'robber';
    m.caption = 'Der ungebetene Gast der Insel';
    m.title = 'Der Räuber erwacht';
    const need = st.turn.discards?.[S.you];
    if (need) {
      m.desc = `Du hast zu viele Karten. Wirf ${need} davon ab.`;
      m.actions.push({ label: `Karten abwerfen (${need})`, primary: true, fn: () => { S.autoModal = null; renderAutoModal(true); } });
    } else {
      m.desc = 'Alle mit mehr als 7 Karten werfen die Hälfte ab …';
    }
  } else if (mine) {
    const t = st.turn;
    if (t.pending === 'robber') {
      m.illus = 'robber';
      m.caption = 'Der ungebetene Gast der Insel';
      m.title = 'Versetze den Räuber';
      m.desc = 'Wähle ein anderes Landfeld. Stiehl eine zufällige Karte von einem benachbarten Gegner.';
    } else if (t.freeRoads > 0) {
      m.illus = 'road';
      m.caption = 'Straßenbau';
      m.title = 'Neue Wege';
      m.desc = `Baue noch ${t.freeRoads} kostenlose Straße${t.freeRoads > 1 ? 'n' : ''} – wähle ein leuchtendes Hologramm.`;
    } else if (st.trade) {
      m.illus = 'trade';
      m.caption = 'Am Handelstisch';
      m.title = 'Ein Angebot liegt aus';
      const acc = Object.values(st.trade.responses).filter((r) => r === 'accepted').length;
      m.desc = acc ? `${acc === 1 ? 'Ein Mitspieler hat' : `${acc} Mitspieler haben`} zugesagt – wähle deinen Handelspartner.` : 'Dein Angebot liegt bei allen Mitspielern. Warte auf ihre Antworten.';
    } else if (!t.rolled) {
      m.illus = 'dice';
      m.caption = 'Der Würfelwurf';
      m.title = 'Lass die Insel sprechen';
      m.desc = 'Würfle. Felder mit der gewürfelten Zahl versorgen alle angrenzenden Siedlungen.';
      m.actions.push({ label: `${icon('dice', 17)} Würfeln`, primary: true, key: 'R', fn: () => act('roll') });
    } else {
      m.illus = 'house';
      m.caption = 'Bauen & Handeln';
      m.title = 'Was wirst du bauen?';
      const ghosts = computeGhosts().length;
      m.desc = ghosts && settings.holograms
        ? `Handle für das, was dir fehlt. ${ghosts === 1 ? 'Ein möglicher Bau leuchtet' : `${ghosts} mögliche Bauten leuchten`} als Hologramm auf der Insel.`
        : 'Handle für das, was dir fehlt, verbinde deine Straßen und lass deine Siedlungen wachsen.';
      m.actions.push({ label: `${icon('swap', 17)} Handeln`, key: 'T', fn: () => openTrade() });
      m.actions.push({ label: 'Zug beenden', primary: true, key: 'E', fn: () => { S.mode = null; act('endTurn'); } });
    }
  } else {
    m.title = 'Ein Moment der Geduld';
    if (st.turn.pending === 'robber') m.desc = `${esc(cur.name)} versetzt den Räuber …`;
    else if (st.trade) m.desc = `${esc(cur.name)} bietet allen einen Handel an.`;
    else m.desc = `${esc(cur.name)} überlegt den nächsten Zug.`;
  }

  const key = JSON.stringify([m.who, m.status, m.illus, m.title, m.desc, m.actions.map((a) => a.label)]);
  if (key === S.turnCardKey) return;
  const illusChanged = !S.turnCardKey || JSON.parse(S.turnCardKey)[2] !== m.illus;
  S.turnCardKey = key;
  const card = $('#turn-card');
  const saved = !S.demo && S.room ? `<span class="saved">${uiArt('quill', 13)} Automatisch gespeichert · ${m.status}</span>` : `<span class="saved">${m.status}</span>`;
  card.innerHTML = `
    <div class="medallion">${uiArt('compass', 34)}</div>
    <div class="turn-who">${m.who}</div>
    <div class="turn-status">${saved}</div>
    <div class="sep"><span></span></div>
    <div class="illus">${ILLUS[m.illus]}</div>
    ${m.caption ? `<div class="illus-caption">${m.caption}</div>` : ''}
    <div class="turn-title">${m.title}</div>
    <p class="turn-desc">${m.desc}</p>
    <div class="turn-actions">${m.actions.map((a, i) => `<button class="btn ${a.primary ? 'primary ornate-btn' : ''} block" data-a="${i}">${a.label}${a.key ? ` <small class="kbd">${a.key}</small>` : ''}</button>`).join('')}</div>`;
  if (illusChanged) {
    card.classList.remove('flip');
    void card.offsetWidth;
    card.classList.add('flip');
  }
  $$('[data-a]', card).forEach((b) => b.addEventListener('click', () => m.actions[Number(b.dataset.a)].fn()));
}

function renderChronicle() {
  const st = S.state;
  const items = st.log.slice(-80).reverse();
  const fresh = S.prev ? st.log.length - S.prev.log.length : 0;
  $('#chronicle').innerHTML = items.map((l, i) => {
    const p = l.player !== null && l.player !== undefined ? st.players[l.player] : null;
    return `<li class="${i < fresh ? 'fresh' : ''}"><span class="li-ico">${emblem(LOG_EMBLEM[l.icon] || 'scroll', 22)}</span><div>${esc(l.text)}
      <div class="li-meta">${p ? `<span class="li-avatar">${portraitArt(p.idx, COLOR_HEX[p.color], 18)}</span>` : ''}${l.turn ? `Zug ${l.turn}` : 'Gründung'}</div></div></li>`;
  }).join('');
}

function renderHand() {
  const p = me();
  const prev = S.prev && S.you !== null ? S.prev.players[S.you] : null;
  const el = $('#res-cards');
  if (!p || !p.resources) {
    el.innerHTML = '<div class="dev-empty">Du schaust zu.</div>';
    return;
  }
  const canTrade = isMyMainPhase();
  el.innerHTML = RESOURCES.map((r) => {
    const diff = prev && prev.resources && prev.idx === p.idx ? p.resources[r] - prev.resources[r] : 0;
    const tip = canTrade && p.resources[r] ? `${RES_LABEL[r]} – klicken zum Handeln` : RES_LABEL[r];
    return `<button class="rcard ${p.resources[r] ? '' : 'zero'} ${diff < 0 ? 'drop' : ''} ${canTrade && p.resources[r] ? 'tradable' : ''}" data-res="${r}" title="${tip}">
      <span class="lbl">${RES_LABEL[r]}</span><span class="art-box">${resourceArt(r, 50)}</span><span class="cnt">${p.resources[r]}</span></button>`;
  }).join('');
  $$('.rcard.tradable', el).forEach((c) => c.addEventListener('click', () => openTrade({ give: c.dataset.res })));
}

function devPlayable(card) {
  const st = S.state;
  const p = me();
  if (S.demo || !p || !p.devCards || st.phase !== 'play' || st.current !== S.you) return false;
  const t = st.turn;
  if (t.devPlayed || t.pending || t.freeRoads > 0 || st.trade || card === 'vp') return false;
  if (card !== 'knight' && !t.rolled) return false;
  return p.devCards.some((c) => c.type === card && c.bought < t.number);
}

function renderDev() {
  const p = me();
  const el = $('#dev-panel');
  const st = S.state;
  const head = (n) => `<div class="dev-head">${uiArt('devCard', 16)} Entwicklungskarten <span class="count">${n}</span></div>`;
  if (!p || !p.devCards) {
    el.innerHTML = `${head(st.devDeckCount)}<div class="dev-empty">Stapel: ${st.devDeckCount} Karten</div>`;
    return;
  }
  const groups = {};
  for (const c of p.devCards) {
    groups[c.type] = groups[c.type] || { n: 0, fresh: 0 };
    groups[c.type].n++;
    if (c.bought >= st.turn.number) groups[c.type].fresh++;
  }
  const order = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'vp'];
  const cards = order.filter((t) => groups[t]).map((t) => {
    const g = groups[t];
    const can = devPlayable(t);
    return `<div class="dev-card ${can ? 'ready' : ''}" title="${esc(DEV_TEXT[t])}">
      ${g.n > 1 ? `<span class="dev-n">×${g.n}</span>` : ''}
      <span class="de">${devArt(t, 34)}</span>
      <b>${DEV_LABEL[t]}</b>
      <small>${t === 'vp' ? 'zählt automatisch' : g.fresh ? 'ab nächstem Zug' : 'bereit'}</small>
      ${t === 'vp' ? '' : `<button data-dev="${t}" ${can ? '' : 'disabled'}>Ausspielen</button>`}</div>`;
  }).join('');
  el.innerHTML = `${head(p.devCards.length)}
    <div class="dev-list">${cards || `<div class="dev-intro"><span class="dev-illu">${uiArt('devCard', 54)}</span><div><b>Dein nächster Vorteil</b><small>Kaufe eine Karte, um zu beginnen · ${st.devDeckCount} im Stapel</small></div></div>`}</div>`;
  $$('[data-dev]', el).forEach((b) => b.addEventListener('click', () => playDevCard(b.dataset.dev)));
}

function playDevCard(card) {
  if (card === 'yearOfPlenty') openYearOfPlenty();
  else if (card === 'monopoly') openMonopoly();
  else act('playDev', { card });
}

const BUILDS = [
  { kind: 'road', icon: 'road', label: 'Straße', cost: COSTS.road },
  { kind: 'settlement', icon: 'settlement', label: 'Siedlung', cost: COSTS.settlement },
  { kind: 'city', icon: 'city', label: 'Stadt', cost: COSTS.city },
  { kind: 'dev', icon: 'card', label: 'Karte kaufen', cost: COSTS.dev },
];

function costArt(cost, size = 15) {
  return RESOURCES.flatMap((r) => Array(cost[r] || 0).fill(r)).map((r) => resourceArt(r, size)).join('');
}

function costText(cost) {
  return RESOURCES.filter((r) => cost[r]).map((r) => `${cost[r]} ${RES_LABEL[r]}`).join(', ');
}

function buildAvailable(kind) {
  const st = S.state;
  const p = me();
  if (!p || !p.resources || !isMyMainPhase()) return false;
  const b = BUILDS.find((x) => x.kind === kind);
  if (!hasRes(p.resources, b.cost)) return false;
  if (kind === 'dev') return st.devDeckCount > 0;
  if (p.stock[kind] <= 0) return false;
  if (kind === 'road') return validRoadSpots(st, S.you).length > 0;
  if (kind === 'settlement') return validSettlementSpots(st, S.you).length > 0;
  return validCitySpots(st, S.you).length > 0;
}

function missingText(cost) {
  const p = me();
  if (!p || !p.resources) return '';
  const miss = RESOURCES.filter((r) => (cost[r] || 0) > p.resources[r]).map((r) => `${cost[r] - p.resources[r]} ${RES_LABEL[r]}`);
  return miss.length ? `Es fehlt: ${miss.join(', ')}` : '';
}

function renderBuild() {
  const p = me();
  $('#build-buttons').innerHTML = BUILDS.map((b) => {
    const stock = p && p.stock && b.kind !== 'dev' ? `${p.stock[b.kind]} übrig` : `${S.state.devDeckCount} im Stapel`;
    const ok = buildAvailable(b.kind);
    const miss = missingText(b.cost);
    const title = ok ? `${b.label} bauen – ${costText(b.cost)}` : miss ? `${b.label}: ${miss}` : `${b.label}: ${costText(b.cost)}`;
    return `<button class="bbtn ${S.mode === b.kind ? 'active' : ''} ${ok ? 'ready' : ''}" data-build="${b.kind}" ${ok ? '' : 'disabled'} title="${title}">
      <span class="bi">${iconArt(b.icon, 30)}</span><span class="bl">${b.label}</span><span class="bc">${costArt(b.cost, 14)}</span><span class="stock">${stock}</span></button>`;
  }).join('');
  $$('[data-build]').forEach((btn) => btn.addEventListener('click', () => {
    const k = btn.dataset.build;
    if (k === 'dev') { act('buyDev'); return; }
    S.mode = S.mode === k ? null : k;
    play('click');
    render();
  }));
}

function modeStillValid() {
  return S.mode && buildAvailable(S.mode);
}

function renderOverlays() {
  const st = S.state;
  const cur = st.players[st.current];
  $('#round-info').textContent = S.demo ? '' : st.phase === 'setup'
    ? `Gründungsphase · ${st.current === S.you ? 'Du bist dran' : `${cur.name} ist dran`}`
    : st.phase === 'ended' ? 'Partie beendet' : `Runde ${st.turn.round} · ${st.current === S.you ? 'Dein Zug' : `${cur.name} ist am Zug`}`;
  const dice = st.turn.dice || [...st.events].reverse().find((e) => e.type === 'roll')?.dice;
  const chip = $('#dice-chip');
  chip.hidden = !dice || S.demo;
  if (dice) chip.innerHTML = `${icon('dice', 18)} ${dice[0] + dice[1]} <small>${dice[0]} + ${dice[1]}</small>`;
}

// ---------- Ziele & Hologramm-Vorschau ----------

function computeTargets() {
  const st = S.state;
  const i = S.you;
  if (!st || S.demo || i === null || i === undefined || st.phase === 'ended') return [null, []];
  if (st.phase === 'setup') {
    if (st.current !== i || st.setup.step !== 'settlement') return [null, []];
    return ['vertex', validSettlementSpots(st, i, true), { hoverGhost: { piece: 'settlement', color: myColor() } }];
  }
  if (st.current !== i) return [null, []];
  if (st.turn.pending === 'robber') return ['hex', robberHexes(st)];
  return [null, []];
}

// Welche Bauten erscheinen als Hologramm? Alle, die du dir gerade leisten kannst.
function computeGhosts() {
  const st = S.state;
  const i = S.you;
  const p = me();
  if (!st || S.demo || !p || !p.resources || st.phase === 'ended' || st.current !== i) return [];
  const list = [];
  const add = (piece, ids) => ids.forEach((id) => list.push({ piece, id }));
  if (st.phase === 'setup') {
    if (st.setup.step === 'road') add('road', validRoadSpots(st, i, st.setup.lastVertex));
    return list;
  }
  if (st.turn.pending || st.trade) return [];
  if (st.turn.freeRoads > 0) { add('road', validRoadSpots(st, i)); return list; }
  if (!st.turn.rolled) return [];
  const want = (kind) => (S.mode ? S.mode === kind : settings.holograms) && buildAvailable(kind);
  if (want('road')) add('road', validRoadSpots(st, i));
  if (want('settlement')) add('settlement', validSettlementSpots(st, i));
  if (want('city')) add('city', validCitySpots(st, i));
  return list;
}

function updateTargets() {
  if (S.tour) return; // die Tour zeigt eigene Hologramme
  const [kind, ids, opts] = computeTargets();
  S.board.setTargets(kind, ids, opts || {});
  const ghosts = computeGhosts();
  S.board.setGhosts(ghosts, myColor());
  const el = $('#placements');
  const count = kind ? ids.length : ghosts.length;
  el.hidden = !count;
  if (count) {
    const what = kind === 'hex' ? 'mögliche Felder' : kind === 'vertex' ? 'mögliche Plätze' : `mögliche${count === 1 ? 'r Bau' : ' Bauten'}`;
    el.innerHTML = `${icon('sparkle', 13)} ${count} ${what}${S.mode ? ' · Esc zum Abbrechen' : ''}`;
  }
}

function onPick(kind, id, piece) {
  const st = S.state;
  if (!st || S.demo) return;
  $('#tooltip').hidden = true;
  const setup = st.phase === 'setup';
  if (piece === 'road' || (kind === 'edge' && !piece)) act(setup ? 'placeRoad' : 'buildRoad', { edge: id });
  else if (piece === 'settlement' || (kind === 'vertex' && !piece && setup)) act(setup ? 'placeSettlement' : 'buildSettlement', { vertex: id });
  else if (piece === 'city') act('buildCity', { vertex: id });
  else if (kind === 'hexBlocked') {
    toast(id === st.robber ? 'Der Räuber steht schon hier – wähle ein anderes Feld.' : 'Dieses Feld kannst du gerade nicht wählen.');
    return;
  } else if (kind === 'hex') {
    const cands = stealCandidates(st, id, S.you);
    if (cands.length <= 1) act('moveRobber', { hex: id, victim: cands[0] });
    else openStealChooser(id, cands);
    return;
  }
  S.mode = null;
}

function siteRows(vid, isCity) {
  const st = S.state;
  const v = st.board.vertices[vid];
  return v.hexes.map((h) => st.board.hexes[h]).map((h) => {
    const r = TERRAIN_RESOURCE[h.terrain];
    const blocked = h.id === st.robber;
    return `<div class="tres"><span class="e">${r ? resourceArt(r, 24) : emblem('desert', 24)}</span>
      <span class="n">${r ? RES_LABEL[r] : 'Wüste'}<small>${r ? `${isCity ? 2 : 1} Karte · Chance ${'●'.repeat(PIPS[h.number])}${blocked ? ' · Räuber!' : ''}` : 'kein Ertrag'}</small></span>
      ${h.number ? `<span class="tnum ${h.number === 6 || h.number === 8 ? 'red' : ''}">${h.number}</span>` : ''}</div>`;
  }).join('') + (v.harbor ? `<div class="foot">${icon('anchor', 12)} Hafen: ${v.harbor === 'any' ? 'alles 3:1' : `${RES_LABEL[v.harbor]} 2:1`}</div>` : '');
}

function showTooltip(info) {
  const tip = $('#tooltip');
  const st = S.state;
  if (!info || !st || S.demo) { tip.hidden = true; return; }
  let html = '';
  if (info.kind === 'vertex') {
    const isCity = info.piece === 'city';
    const who = me() ? `${esc(nameOf(S.you))} · ` : '';
    html = `<h4>${iconArt(isCity ? 'city' : 'settlement', 22)} ${isCity ? 'Stadtausbau' : 'Siedlungsplatz'}</h4>
      <div class="sub">${who}${isCity ? 'Doppelter Ertrag nach dem Ausbau' : 'Rohstoffe nach dem Bauen'}</div>${siteRows(info.id, isCity)}
      ${info.piece ? `<div class="foot build-foot">Klicken zum Bauen · ${costArt(isCity ? COSTS.city : COSTS.settlement, 14)}</div>` : '<div class="foot">Zu jeder Siedlung bleibt mindestens eine Kreuzung frei.</div>'}`;
  } else if (info.kind === 'edge') {
    const free = st.phase === 'setup' || st.turn.freeRoads > 0;
    html = `<h4>${iconArt('road', 22)} Straße</h4><div class="sub">${free ? 'Kostenlos' : 'Verbindet deine Siedlungen'}</div>
      <div class="foot build-foot">Klicken zum Bauen${free ? '' : ` · ${costArt(COSTS.road, 14)}`}</div>`;
  } else if (info.kind === 'hexBlocked') {
    const h = st.board.hexes[info.id];
    html = `<h4>${TERRAIN_LABEL[h.terrain]}${h.number ? ` · ${h.number}` : ''}</h4><div class="foot">${info.id === st.robber ? 'Der Räuber steht schon hier. Er muss auf ein anderes Feld ziehen.' : 'Dieses Feld kannst du gerade nicht wählen.'}</div>`;
  } else if (info.kind === 'hex') {
    const h = st.board.hexes[info.id];
    const cands = stealCandidates(st, info.id, S.you);
    html = `<h4>${emblem('robber', 24)} Räuber hierher</h4><div class="sub">${TERRAIN_LABEL[h.terrain]}${h.number ? ` · Zahl ${h.number}` : ''}</div>
      <div class="foot">${cands.length ? `Stehlen möglich bei: ${cands.map((c) => esc(st.players[c].name)).join(', ')}` : 'Hier kannst du niemanden bestehlen.'}</div>`;
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const wrap = $('#board-wrap').getBoundingClientRect();
  const x = Math.min(info.x + 18, wrap.width - 250);
  const y = Math.min(info.y + 12, wrap.height - tip.offsetHeight - 10);
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

// ---------- Ereignisse, Kamerafahrten und Flug-Animationen ----------

function processEvents(state) {
  const fresh = state.events.filter((e) => e.seq > S.lastSeq);
  S.lastSeq = state.seq;
  for (const ev of fresh) handleEvent(ev, state);
  if (state.trade && state.trade.responses[S.you] === 'pending' && S.lastOfferId !== state.trade.id) {
    S.lastOfferId = state.trade.id;
    play('offer');
  }
}

// Stationen nacheinander abspielen; Kamerabewegungen nur mit aktivierten Kamerafahrten
async function runSequence(stops) {
  const token = ++S.cineToken;
  const b = S.board;
  let moving = settings.cinematic && !S.tour && document.visibilityState === 'visible';
  // Folgen mehrere Fahrten aufeinander, merken wir uns nur die Ansicht vor der ersten
  if (!S.cineActive) S.cineHome = { pos: b.camera.position.clone(), target: b.controls.target.clone(), moved: b.userMoved };
  S.cineActive = (S.cineActive || 0) + 1;
  const home = S.cineHome;
  let moved = false;
  try {
    for (const s of stops) {
      if (token !== S.cineToken) moving = false;
      // Einzelne Kamerafahrten lassen sich in den Einstellungen abschalten
      const allowed = moving && (!s.cam || settings[s.cam]);
      if (allowed && s.view) {
        const ok = await b.flyTo(s.view(), s.dur || 800);
        if (!ok) moving = false;
        else moved = true;
      }
      if (s.action) await s.action();
      if (allowed && moving && s.hold) await sleep(s.hold);
    }
    if (moving && moved && token === S.cineToken) await b.flyTo(home.moved ? home : b.baseViewSpec(), 950);
  } finally {
    S.cineActive--;
  }
}

function rollSequence(ev, st) {
  const sum = ev.dice[0] + ev.dice[1];
  const rolling = boardToast({ icon: 'dice', title: 'Lass die Würfel entscheiden', text: `${esc(nameOf(ev.player))} würfelt …`, sticky: true });
  play('dice');
  const producing = ev.robber ? [] : st.board.hexes.filter((h) => h.number === sum && h.id !== st.robber).map((h) => h.id);
  const stops = [
    { view: () => S.board.trayView(), dur: 600, cam: 'camDice' },
    { action: async () => { await S.board.showDice(ev.dice); rolling.dismiss(); } },
  ];
  if (ev.robber) {
    stops.push({
      view: () => { const p = S.board.robberPos(); return S.board.pointView(p.x, p.z, 3.4); },
      cam: 'camRobber',
      dur: 800,
      hold: 1300,
      action: async () => {
        S.board.awakenRobber();
        play('robber');
        boardToast({ num: 7, red: true, title: 'Der Räuber erwacht', text: 'Keine Erträge. Wer mehr als 7 Karten hat, gibt die Hälfte ab.' });
      },
    });
  } else if (producing.length) {
    stops.push({
      view: () => S.board.hexesView(producing),
      cam: 'camHarvest',
      dur: 800,
      hold: 1500,
      action: async () => {
        S.board.flashHexes(producing);
        const items = [];
        for (const hid of producing) {
          const h = st.board.hexes[hid];
          const res = TERRAIN_RESOURCE[h.terrain];
          for (const vid of h.vertices) {
            const b = st.buildings[vid];
            if (!b) continue;
            const v = st.board.vertices[vid];
            items.push({ x: v.x, z: v.y, res, count: b.type === 'city' ? 2 : 1, player: b.player });
          }
        }
        S.board.floatResources(items);
        if (items.length) play('harvest');
        const g = ev.gains[S.you];
        const gains = g ? RESOURCES.filter((r) => g[r]).map((r) => `<span class="gain">${resourceArt(r, 18)} +${g[r]} ${RES_LABEL[r]}</span>`) : [];
        const who = Object.keys(ev.gains).length;
        boardToast({ num: sum, red: sum === 6 || sum === 8, title: 'Die Insel liefert', text: gains.length ? '' : who ? `${who} Siedler erhalten Rohstoffe.` : 'Diesmal bringt kein Feld Ertrag.', gainsHtml: gains.join('') });
        setTimeout(() => flyGains(ev, items), 650);
      },
    });
  } else {
    stops.push({ action: async () => { boardToast({ num: sum, title: 'Die Insel schweigt', text: 'Kein Feld mit dieser Zahl bringt Ertrag.' }); } });
  }
  runSequence(stops);
}

// Karten fliegen vom Brett in die Hand bzw. zum Porträt
function flyGains(ev, items) {
  for (const [pi, g] of Object.entries(ev.gains)) {
    const idx = Number(pi);
    let delay = 0;
    for (const r of RESOURCES) {
      for (let k = 0; k < (g[r] || 0); k++) {
        const it = items.find((x) => x.player === idx && x.res === r) || items[0];
        const from = it ? boardPointToPage(it.x, 0.2, it.z) : null;
        const target = idx === S.you ? $(`.rcard[data-res="${r}"]`) : $(`.player[data-idx="${idx}"] .portrait-wrap`);
        flyArt(resourceArt(r, idx === S.you ? 40 : 26), from, target, delay, () => { if (idx === S.you) bumpCard(r); });
        delay += 110;
      }
    }
    popOnPlayer(idx, `+${resCount(g)}`);
  }
}

function boardPointToPage(x, y, z) {
  const p = S.board.worldToScreen(x, y, z);
  const rect = $('#board-wrap').getBoundingClientRect();
  return { x: rect.left + p.x, y: rect.top + p.y };
}

function elCenter(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function flyArt(html, from, targetEl, delay = 0, done) {
  const to = elCenter(targetEl);
  if (!from || !to) { if (done) done(); return; }
  const el = document.createElement('div');
  el.className = 'flyer';
  el.innerHTML = html;
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  $('#fly-layer').appendChild(el);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const anim = el.animate([
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * 0.15}px), calc(-50% + ${dy * 0.15 - 60}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 },
  ], { duration: 900, delay, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
  anim.onfinish = () => { el.remove(); if (done) done(); };
}

function bumpCard(r) {
  const card = $(`.rcard[data-res="${r}"]`);
  if (!card) return;
  card.classList.remove('bump');
  void card.offsetWidth;
  card.classList.add('bump');
  play('card');
}

function handleEvent(ev, st) {
  const mine = (i) => i === S.you;
  switch (ev.type) {
    case 'roll':
      rollSequence(ev, st);
      break;
    case 'steal': {
      let text;
      if (mine(ev.thief)) text = `Du stiehlst ${ev.res ? `1 ${RES_LABEL[ev.res]}` : 'eine Karte'} von ${esc(st.players[ev.victim].name)}.`;
      else if (mine(ev.victim)) text = `${esc(st.players[ev.thief].name)} stiehlt dir ${ev.res ? `1 ${RES_LABEL[ev.res]}` : 'eine Karte'}.`;
      else text = `${esc(st.players[ev.thief].name)} stiehlt eine Karte von ${esc(st.players[ev.victim].name)}.`;
      banner('Eine Karte wurde gestohlen', text);
      play('steal');
      const fromEl = $(`.player[data-idx="${ev.victim}"] .portrait-wrap`);
      const toEl = mine(ev.thief) && ev.res ? $(`.rcard[data-res="${ev.res}"]`) : $(`.player[data-idx="${ev.thief}"] .portrait-wrap`);
      const art = ev.res && (mine(ev.thief) || mine(ev.victim)) ? resourceArt(ev.res, 34) : '<div class="card-back"></div>';
      flyArt(art, elCenter(fromEl), toEl, 150, () => { if (mine(ev.thief) && ev.res) bumpCard(ev.res); });
      popOnPlayer(ev.victim, '−1', true);
      popOnPlayer(ev.thief, '+1');
      break;
    }
    case 'robber':
      play('robber');
      if (!mine(ev.player)) {
        const h = st.board.hexes[ev.hex];
        runSequence([{ view: () => S.board.pointView(h.x, h.y, 3.8), cam: 'camRobber', dur: 800, hold: 1300 }]);
      }
      break;
    case 'build':
      play(ev.kind === 'city' ? 'city' : ev.kind === 'road' ? 'road' : 'build');
      if (!mine(ev.player)) queueBuildFocus(ev, st);
      break;
    case 'buyDev':
      play('card');
      if (mine(ev.player) && ev.card) {
        flyArt(devArt(ev.card, 44), elCenter($('[data-build="dev"]')), $('#dev-panel'), 0);
        boardToast({ iconHtml: devArt(ev.card, 30), title: `Neue Karte: ${DEV_LABEL[ev.card]}`, text: DEV_TEXT[ev.card] });
      }
      break;
    case 'playDev':
      play('card');
      if (!mine(ev.player)) banner(`${esc(st.players[ev.player].name)} spielt ${DEV_LABEL[ev.card]}`, DEV_TEXT[ev.card]);
      break;
    case 'monopoly':
      banner(`Monopol auf ${RES_LABEL[ev.res]}`, `${mine(ev.player) ? 'Du erhältst' : `${esc(st.players[ev.player].name)} erhält`} ${ev.total} Karten.`);
      break;
    case 'trade':
      play('coin');
      if (mine(ev.a) || mine(ev.b)) boardToast({ icon: 'trade', title: 'Handel abgeschlossen', text: `${esc(nameOf(ev.a))} und ${esc(nameOf(ev.b))} tauschen.` });
      break;
    case 'tradeDeclined':
      if (mine(ev.from)) boardToast({ icon: 'hand', title: 'Niemand möchte tauschen', text: 'Alle Mitspieler haben dein Angebot abgelehnt.' });
      break;
    case 'tradeAccepted':
      if (mine(ev.from)) { play('coin'); boardToast({ icon: 'trade', title: `${esc(st.players[ev.by].name)} nimmt an`, text: 'Wähle im Handelsdialog, mit wem du tauschst.' }); }
      break;
    case 'bankTrade':
      play('coin');
      break;
    case 'award':
      play('award');
      banner(ev.award === 'longestRoad' ? `${emblem('road', 24)} Längste Handelsstraße` : `${emblem('sword', 24)} Größte Rittermacht`, `${mine(ev.player) ? 'Du erhältst' : `${esc(st.players[ev.player].name)} erhält`} 2 Siegpunkte.`);
      break;
    case 'turn':
      if (mine(ev.player)) { play('turn'); banner(S.room?.hotseat ? `${esc(st.players[ev.player].name)} ist dran` : 'Du bist am Zug', 'Würfle, um die Insel sprechen zu lassen.'); }
      break;
    case 'win':
      play('win');
      S.board.celebrate();
      confetti();
      break;
    default:
  }
}

// Bauten der Mitspieler kurz zeigen; schnell aufeinanderfolgende Bauten werden zusammengefasst
const BUILD_LABEL = { road: 'eine Straße', settlement: 'eine Siedlung', city: 'eine Stadt' };
function queueBuildFocus(ev, st) {
  const pos = ev.kind === 'road' ? st.board.edges[ev.id] : st.board.vertices[ev.id];
  const color = COLOR_HEX[st.players[ev.player].color];
  const batch = S.buildBatch && S.buildBatch.player === ev.player ? S.buildBatch : { player: ev.player, items: [] };
  batch.items.push({ x: pos.x, z: pos.y, kind: ev.kind, color });
  S.buildBatch = batch;
  clearTimeout(batch.timer);
  batch.timer = setTimeout(() => {
    S.buildBatch = null;
    const items = batch.items;
    const cx = items.reduce((a, i) => a + i.x, 0) / items.length;
    const cz = items.reduce((a, i) => a + i.z, 0) / items.length;
    const spread = Math.max(0, ...items.map((i) => Math.hypot(i.x - cx, i.z - cz)));
    const name = esc(st.players[batch.player].name);
    const what = items.map((i) => BUILD_LABEL[i.kind]).join(', ');
    runSequence([{
      view: () => S.board.pointView(cx, cz, 3.6 + spread * 1.4),
      cam: 'camBuild',
      dur: 750,
      hold: 1300,
      action: async () => {
        for (const i of items) S.board.dust(i.x, i.z, 14, i.color);
        if (st.phase !== 'setup') banner(`${name} baut`, what);
      },
    }]);
  }, 450);
}

function popsFor(idx) {
  const now = performance.now();
  S.pops = S.pops.filter((p) => now - p.at < 2200);
  return S.pops.filter((p) => p.idx === idx)
    .map((p, i) => `<span class="gain-pop ${p.loss ? 'loss' : ''}" style="animation-delay:-${Math.round(now - p.at)}ms;bottom:${22 + i * 16}px">${esc(p.text)}</span>`).join('');
}

function popOnPlayer(idx, text, loss = false) {
  S.pops.push({ idx, text, loss, at: performance.now() });
  const li = $(`.player[data-idx="${idx}"]`);
  if (!li) return;
  $$('.gain-pop', li).forEach((x) => x.remove());
  li.insertAdjacentHTML('beforeend', popsFor(idx));
}

function boardToast({ num, red, icon: iconName, iconHtml, title, text, gainsHtml = '', sticky = false }) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${num ? `<span class="num ${red ? 'red' : ''}">${num}</span>` : `<span class="num art-num">${iconHtml || emblem(iconName || 'scroll', 26)}</span>`}
    <div><b>${esc(title)}</b>${text ? `<small>${text}</small>` : ''}${gainsHtml ? `<div class="gains">${gainsHtml}</div>` : ''}</div>
    <button class="close" aria-label="Schließen">${icon('close', 11)}</button>`;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  const kill = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.querySelector('.close').addEventListener('click', kill);
  setTimeout(kill, sticky ? 6000 : 4500);
  return { dismiss: kill };
}

let bannerTimer = null;
function banner(title, text) {
  const el = $('#banner');
  el.innerHTML = `${title}<small>${text}</small>`;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

let toastTimer = null;
function toast(msg, ok = false) {
  const el = $('#global-toast');
  el.textContent = msg;
  el.className = `global-toast ${ok ? 'ok' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// Konfetti-Regen beim Sieg
function confetti() {
  const c = $('#confetti');
  c.hidden = false;
  c.width = innerWidth;
  c.height = innerHeight;
  const ctx = c.getContext('2d');
  const colors = ['#d6a93c', '#b8322a', '#2f5fa8', '#3d8a45', '#f4ead3', '#e0a92a'];
  const parts = Array.from({ length: 180 }, () => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
    r: Math.random() * 6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: colors[Math.floor(Math.random() * colors.length)], spin: (Math.random() - 0.5) * 0.3,
  }));
  const start = performance.now();
  const tick = (now) => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.x += p.vx + Math.sin((now + p.y) / 400) * 0.6;
      p.y += p.vy;
      p.r += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (now - start < 5500) requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, c.width, c.height); c.hidden = true; }
  };
  requestAnimationFrame(tick);
}

// ---------- Hot-Seat: Gerät weitergeben ----------

function checkCurtain() {
  const st = S.state;
  if (!S.room?.hotseat || !st || st.phase === 'ended' || S.demo) { hideCurtain(); return; }
  const seat = S.you;
  if (S.shownSeat === undefined) { S.shownSeat = seat; return; }
  if (seat === S.shownSeat) return;
  const p = st.players[seat];
  if (!p || p.isBot) return;
  const c = $('#curtain');
  c.innerHTML = `<div class="curtain-card parchment">
    <div class="eyebrow">An einem Gerät</div>
    ${portraitArt(seat, COLOR_HEX[p.color], 110)}
    <h2>Gib das Gerät an ${esc(p.name)} weiter</h2>
    <p>Die Karten bleiben verdeckt, bis ${esc(p.name)} bereit ist.</p>
    <button class="btn primary big" id="curtain-go">Ich bin ${esc(p.name)} – weiter ${icon('arrowRight', 18)}</button></div>`;
  c.hidden = false;
  $('#curtain-go').addEventListener('click', () => { S.shownSeat = seat; hideCurtain(); play('page'); });
}

function hideCurtain() {
  $('#curtain').hidden = true;
}

// ---------- Modals ----------

function openModal(key, html, { wide = false, closable = true, onClose } = {}) {
  const root = $('#modal-root');
  const base = (k) => String(k || '').split(':').slice(0, 2).join(':');
  const still = S.modalKey && key && base(S.modalKey) === base(key);
  root.innerHTML = `<div class="modal-backdrop ${still ? 'still' : ''}"><div class="modal parchment ${wide ? 'wide' : ''} ${still ? 'still' : ''}" role="dialog" aria-modal="true">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    ${closable ? `<button class="modal-close" aria-label="Schließen">${icon('close', 16)}</button>` : ''}<div class="modal-body">${html}</div></div></div>`;
  S.modalKey = key;
  S.modalOnClose = onClose;
  const close = () => { closeModal(); if (onClose) onClose(); };
  if (closable) {
    $('.modal-close', root).addEventListener('click', close);
    $('.modal-backdrop', root).addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) close(); });
  }
  return $('.modal', root);
}

function closeModal() {
  $('#modal-root').innerHTML = '';
  S.modalKey = null;
  S.autoModal = null;
  S.redrawTrade = null;
}

function desiredAutoModal() {
  const st = S.state;
  if (!st || S.demo) return null;
  if (st.phase === 'ended') return 'winner';
  if (S.you === null || S.you === undefined) return null;
  if (st.turn.pending === 'discard' && st.turn.discards?.[S.you]) return `discard:${st.turn.number}:${S.you}`;
  const t = st.trade;
  if (t) {
    if (t.from === S.you) return `offer:${t.id}:${Object.values(t.responses).join(',')}`;
    if (t.responses[S.you] === 'pending') return `incoming:${t.id}:${Object.values(t.responses).join(',')}`;
    if (t.responses[S.you] === 'accepted') return `accepted:${t.id}`;
  }
  return null;
}

function renderAutoModal(force = false) {
  const want = desiredAutoModal();
  if (!force && want === S.autoModal) return;
  if (!want) {
    if (S.autoModal && S.modalKey === S.autoModal) closeModal();
    S.autoModal = null;
    return;
  }
  if (!force && S.dismissedAuto === want) return;
  S.autoModal = want;
  const [kind] = want.split(':');
  const dismiss = () => { S.dismissedAuto = want; };
  if (kind === 'winner' && !force) {
    // Sieg erst nach dem Feuerwerk zeigen
    setTimeout(() => { if (S.autoModal === 'winner' && S.dismissedAuto !== 'winner' && S.modalKey !== 'winner') openWinner(dismiss); }, 1800);
    return;
  }
  if (kind === 'discard') openDiscard();
  else if (kind === 'incoming') openIncoming();
  else if (kind === 'offer') openOfferStatus();
  else if (kind === 'accepted') openAcceptedWait();
  else if (kind === 'winner') openWinner(dismiss);
  S.autoModal = want;
}

function resList(res) {
  const parts = RESOURCES.filter((r) => res[r]).map((r) => `<span class="rl">${resourceArt(r, 22)} ${res[r]} ${RES_LABEL[r]}</span>`);
  return parts.length ? parts.join(' ') : '—';
}

function pickGrid(id, { counts, have, disabled = () => false, showHave = true, note = () => '' }) {
  return `<div class="pick-grid" id="${id}">${RESOURCES.map((r) => `
    <button class="pick ${counts[r] ? 'on' : ''}" data-r="${r}" ${disabled(r) ? 'disabled' : ''}>
      ${counts[r] ? `<span class="sel">${counts[r]}</span>` : ''}
      <span class="emo">${resourceArt(r, 36)}</span><span class="lbl">${RES_LABEL[r]}</span>
      <span class="have">${showHave && have ? `${have[r]} auf der Hand` : ''}${note(r)}</span>
      ${counts[r] ? `<span class="minus" data-minus="${r}">−</span>` : ''}
    </button>`).join('')}</div>`;
}

function bindPickGrid(root, id, onChange) {
  $$(`#${id} .pick`, root).forEach((b) => b.addEventListener('click', (e) => {
    const minus = e.target.closest('[data-minus]');
    onChange(b.dataset.r, minus ? -1 : 1);
  }));
}

function openDiscard() {
  const st = S.state;
  const need = st.turn.discards[S.you];
  const p = me();
  const sel = Object.fromEntries(RESOURCES.map((r) => [r, 0]));
  const draw = () => {
    const total = resCount(sel);
    const m = openModal(S.autoModal || 'discard', `
      <h2>Der Räuber erwacht</h2>
      <div class="modal-lede"><span class="lede-art">${ILLUS.robber}</span><div><b>Wirf ${need} Karten ab</b><span class="hint">Du hältst mehr als 7 Karten. Die Hälfte geht zurück an die Bank.</span></div></div>
      ${pickGrid('discard-grid', { counts: sel, have: p.resources, disabled: (r) => p.resources[r] - sel[r] <= 0 && !sel[r] })}
      <div class="modal-actions"><span class="hint" style="margin-right:auto">${total} / ${need} gewählt</span>
      <button class="btn primary" id="discard-ok" ${total === need ? '' : 'disabled'}>Abwerfen</button></div>`, { closable: false });
    bindPickGrid(m, 'discard-grid', (r, d) => {
      if (d > 0 && (sel[r] >= p.resources[r] || resCount(sel) >= need)) return;
      sel[r] = Math.max(0, sel[r] + d);
      play('card');
      draw();
    });
    $('#discard-ok', m).addEventListener('click', () => {
      const out = {};
      for (const r of RESOURCES) if (sel[r]) out[r] = sel[r];
      act('discard', { resources: out });
      closeModal();
      S.autoModal = desiredAutoModal();
      S.dismissedAuto = S.autoModal;
    });
  };
  draw();
}

function openIncoming() {
  const st = S.state;
  const t = st.trade;
  const from = st.players[t.from];
  const p = me();
  const canAccept = hasRes(p.resources, t.get);
  const others = Object.entries(t.responses).filter(([i]) => Number(i) !== S.you);
  const m = openModal(S.autoModal, `
    <h2>Ein Angebot an alle</h2>
    <div class="modal-lede">${avatar(from, 56)}<div><span class="eyebrow">Ein Tausch unter Siedlern</span><b>${esc(from.name)} sucht einen Handelspartner</b><span class="hint">Nimmst du an, entscheidet ${esc(from.name)}, mit wem getauscht wird.</span></div></div>
    <div class="trade-summary">
      <div class="side"><small>Du erhältst</small><div class="items">${resList(t.give)}</div></div>
      <div class="swap">${icon('swap', 20)}</div>
      <div class="side"><small>Du gibst</small><div class="items">${resList(t.get)}</div></div>
    </div>
    ${others.length ? `<div class="resp-mini">${others.map(([i, r]) => `<span class="rm ${r}" title="${esc(st.players[i].name)}">${avatar(st.players[i], 22)}${r === 'accepted' ? icon('check', 13) : r === 'declined' ? icon('close', 13) : '…'}</span>`).join('')}</div>` : ''}
    ${canAccept ? '' : '<p class="hint center">Dir fehlen die gewünschten Karten.</p>'}
    <div class="modal-actions">
      <button class="btn danger" id="tr-decline">Ablehnen</button>
      <button class="btn primary" id="tr-accept" ${canAccept ? '' : 'disabled'}>Annehmen</button>
    </div>`, { closable: false });
  $('#tr-accept', m).addEventListener('click', () => act('respondTrade', { response: 'accept' }));
  $('#tr-decline', m).addEventListener('click', () => act('respondTrade', { response: 'decline' }));
}

// Status für den Anbieter: wer hat zugesagt? Mit wem wird getauscht?
function openOfferStatus() {
  const st = S.state;
  const t = st.trade;
  const you = me();
  const LABEL = { pending: 'überlegt …', accepted: 'nimmt an', declined: 'lehnt ab' };
  const rows = Object.entries(t.responses).map(([i, r]) => {
    const o = st.players[i];
    return `<li class="resp ${r}">${avatar(o, 38)}<div><b>${esc(o.name)}</b><small>${LABEL[r]}</small></div>
      ${r === 'accepted' ? `<button class="btn primary small" data-with="${i}">Mit ${esc(o.name)} tauschen</button>` : r === 'pending' ? '<span class="dots"><i></i><i></i><i></i></span>' : `<span class="no">${icon('close', 16)}</span>`}</li>`;
  }).join('');
  const accepted = Object.values(t.responses).filter((r) => r === 'accepted').length;
  const m = openModal(S.autoModal, `
    <h2>Dein Angebot an alle</h2>
    <div class="trade-summary">
      <div class="side">${avatar(you, 44)}<b>${esc(nameOf(S.you))}</b><small>gibt</small><div class="items">${resList(t.give)}</div></div>
      <div class="swap ${accepted ? '' : 'waiting'}">${icon('swap', 20)}</div>
      <div class="side"><span class="side-art">${emblem('users', 44)}</span><b>Mitspieler</b><small>geben</small><div class="items">${resList(t.get)}</div></div>
    </div>
    <p class="hint center">${accepted ? 'Wähle, mit wem du tauschen möchtest.' : 'Deine Karten bleiben auf der Hand, bis du einen Handelspartner wählst.'}</p>
    <ul class="resp-list">${rows}</ul>
    <div class="modal-actions"><button class="btn ghost block" id="tr-cancel">Angebot zurückziehen</button></div>`, { closable: false });
  $$('[data-with]', m).forEach((b) => b.addEventListener('click', () => act('confirmTrade', { with: Number(b.dataset.with) })));
  $('#tr-cancel', m).addEventListener('click', () => act('cancelTrade'));
}

function openAcceptedWait() {
  const st = S.state;
  const t = st.trade;
  const from = st.players[t.from];
  const m = openModal(S.autoModal, `
    <h2>Du hast angenommen</h2>
    <div class="modal-lede"><span class="lede-art">${ILLUS.hourglass}</span><div><b>${esc(from.name)} wählt einen Handelspartner …</b>
    <span class="hint">Du erhältst ${resList(t.give)} und gibst ${resList(t.get)}.</span></div></div>
    <div class="modal-actions"><button class="btn ghost" id="tr-withdraw">Doch ablehnen</button></div>`, { closable: false });
  $('#tr-withdraw', m).addEventListener('click', () => act('respondTrade', { response: 'decline' }));
}



// ---------- Handelsbereich „Du gibst / Du erhältst“ ----------

const RATIO_LABEL = { 2: 'Spezialhafen', 3: 'Hafen', 4: 'Bank' };

function bankCredits(T, ratios) {
  return RESOURCES.reduce((sum, r) => sum + Math.floor(T.give[r] / ratios[r]), 0);
}

function canTakeMore(T, r) {
  const st = S.state;
  if (T.give[r] > 0) return false;
  if (T.partner !== 'bank') return true;
  return resCount(T.get) < bankCredits(T, harborRatios(st, S.you)) && st.bank[r] - T.get[r] > 0;
}

function stepper(kind, r, n, canPlus) {
  return `<div class="tx-step">
    <button class="tx-btn" data-${kind}="${r}" data-d="-1" ${n ? '' : 'disabled'} aria-label="Eine weniger">${icon('minus', 14)}</button>
    <span class="tx-n">${n}</span>
    <button class="tx-btn" data-${kind}="${r}" data-d="1" ${canPlus ? '' : 'disabled'} aria-label="Eine mehr">${icon('plus', 14)}</button></div>`;
}

function itemList(res) {
  const parts = RESOURCES.filter((r) => res[r]).map((r) => `<span class="tx-item">${resourceArt(r, 20)}<b>${res[r]}</b> ${RES_LABEL[r]}</span>`);
  return parts.join('<span class="tx-plus">+</span>');
}

function tradeExchange({ bank, p, st, ratios, T }) {
  const credits = bank ? bankCredits(T, ratios) : 0;
  const picked = resCount(T.get);
  const giveTiles = RESOURCES.map((r) => {
    const have = p.resources[r];
    const n = T.give[r];
    const step = bank ? ratios[r] : 1;
    const canPlus = have - n >= step;
    const off = !n && !canPlus;
    return `<div class="tx-tile give ${n ? 'on' : ''} ${off ? 'off' : ''}" data-tile-give="${r}" title="${RES_LABEL[r]}: ${have} auf der Hand${bank ? ` · Kurs ${step}:1 (${RATIO_LABEL[step]})` : ''}">
      ${bank ? `<span class="tx-ratio r${step}">${step}:1</span>` : ''}
      ${n ? `<span class="tx-badge minus">−${n}</span>` : ''}
      <span class="tx-art">${resourceArt(r, 46)}</span>
      <b class="tx-name">${RES_LABEL[r]}</b>
      <span class="tx-have">Auf der Hand <b>${have}</b></span>
      ${off ? `<span class="tx-why">${have ? `Brauchst ${step}` : 'Keine Karte'}</span>` : stepper('give', r, n, canPlus)}
    </div>`;
  }).join('');
  const getTiles = RESOURCES.map((r) => {
    const n = T.get[r];
    const blocked = T.give[r] > 0;
    const empty = bank && st.bank[r] <= 0;
    const canPlus = canTakeMore(T, r);
    const off = !n && (blocked || empty);
    return `<div class="tx-tile get ${n ? 'on' : ''} ${off ? 'off' : ''} ${!off && !n && !canPlus ? 'wait' : ''}" data-tile-get="${r}">
      ${n ? `<span class="tx-badge plus">+${n}</span>` : ''}
      <span class="tx-art">${resourceArt(r, 46)}</span>
      <b class="tx-name">${RES_LABEL[r]}</b>
      <span class="tx-have">${bank ? `In der Bank <b>${st.bank[r]}</b>` : 'Von Mitspielern'}</span>
      ${off ? `<span class="tx-why">${blocked ? 'Gibst du ab' : 'Bank ist leer'}</span>` : stepper('get', r, n, canPlus)}
    </div>`;
  }).join('');

  // Leitfaden zwischen den Reihen: was passiert gerade, was ist der nächste Schritt?
  const giving = resCount(T.give);
  let flow;
  if (!giving && !picked) flow = `<span class="tx-hint">${icon('give', 15)} Wähle oben, was du abgibst${bank ? ' – bei der Bank immer im ganzen Paket' : ''}.</span>`;
  else if (bank && !credits) flow = `<span class="tx-hint">${icon('info', 15)} Für eine Karte aus der Bank brauchst du ein volles Paket.</span>`;
  else flow = `<span class="tx-side">${giving ? itemList(T.give) : '<i>nichts</i>'}</span><span class="tx-arrow">${icon('arrowRight', 18)}</span><span class="tx-side">${picked ? itemList(T.get) : `<i>${bank ? `${credits} Karte${credits === 1 ? '' : 'n'} deiner Wahl` : 'deine Wünsche'}</i>`}</span>`;

  const credit = bank
    ? `<span class="tx-credit ${credits && picked === credits ? 'done' : ''}">${credits
      ? `${picked === credits ? `${icon('check', 14)} Bereit zum Tausch` : `Noch <b>${credits - picked}</b> wählen`}<span class="pips">${Array.from({ length: credits }, (_, i) => `<i class="${i < picked ? 'on' : ''}"></i>`).join('')}</span>`
      : 'Erst abgeben, dann wählen'}</span>`
    : `<span class="tx-credit">${picked ? `${picked} Karte${picked === 1 ? '' : 'n'} gewünscht` : 'Was wünschst du dir?'}</span>`;

  return `<div class="tx">
    <section class="tx-row">
      <header class="tx-head"><h3>${icon('give', 18)} Du gibst</h3>
        <span class="tx-legend">${bank ? `Dein Kurs: <span class="tx-ratio r4">4:1</span> Bank · <span class="tx-ratio r3">3:1</span> Hafen · <span class="tx-ratio r2">2:1</span> Spezialhafen` : 'Karten aus deiner Hand'}</span></header>
      <div class="tx-grid">${giveTiles}</div>
    </section>
    <div class="tx-flow">${flow}</div>
    <section class="tx-row">
      <header class="tx-head"><h3>${icon('receive', 18)} Du erhältst</h3>${credit}</header>
      <div class="tx-grid">${getTiles}</div>
    </section>
  </div>`;
}

function bindExchange(root, stepGive, stepGet) {
  $$('[data-give]', root).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); stepGive(b.dataset.give, Number(b.dataset.d)); }));
  $$('[data-get]', root).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); stepGet(b.dataset.get, Number(b.dataset.d)); }));
  // Ein Klick auf die Karte selbst legt ein Paket bzw. eine Karte dazu
  $$('[data-tile-give]', root).forEach((t) => t.addEventListener('click', () => { if (!t.classList.contains('off')) stepGive(t.dataset.tileGive, 1); }));
  $$('[data-tile-get]', root).forEach((t) => t.addEventListener('click', () => { if (!t.classList.contains('off')) stepGet(t.dataset.tileGet, 1); }));
}

// Handelstisch: Tausch mit Bank & Häfen oder ein Angebot an alle Mitspieler
function openTrade({ give: preset = null } = {}) {
  if (!me()) return;
  if (!isMyMainPhase()) { toast('Handeln ist nur in deinem Zug nach dem Würfeln möglich.'); return; }
  const st0 = S.state;
  const T = {
    partner: S.lastTradePartner || 'bank',
    give: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
    get: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
  };
  if (preset) T.give[preset] = Math.min(me().resources[preset], T.partner === 'bank' ? harborRatios(st0, S.you)[preset] : 1);
  const draw = () => {
    const st = S.state;
    const p = me();
    const others = st.players.filter((o) => o.idx !== S.you);
    const ratios = harborRatios(st, S.you);
    const bank = T.partner === 'bank';
    for (const r of RESOURCES) T.give[r] = Math.min(T.give[r], p.resources[r] - (p.resources[r] % (bank ? ratios[r] : 1)));
    if (bank) {
      const credits = bankCredits(T, ratios);
      for (const r of [...RESOURCES].reverse()) while (resCount(T.get) > credits && T.get[r]) T.get[r]--;
    }
    let valid = resCount(T.give) > 0 && resCount(T.get) > 0 && hasRes(p.resources, T.give) && !RESOURCES.some((r) => T.give[r] && T.get[r]);
    let note = '';
    if (bank) {
      let credits = 0;
      let ok = true;
      for (const r of RESOURCES) {
        if (T.give[r] % ratios[r]) ok = false;
        credits += Math.floor(T.give[r] / ratios[r]);
      }
      if (!ok) valid = false;
      else if (credits !== resCount(T.get)) valid = false;
      if (!hasRes(st.bank, T.get)) { valid = false; note = 'Die Bank hat nicht genug davon.'; }
    }
    const m = openModal('trade', `
      <h2>Der Handelstisch</h2>
      <div class="modal-lede"><span class="lede-art">${ILLUS.trade}</span><div><span class="eyebrow">Ein guter Tausch, eine wachsende Insel</span><b>Schaffe Raum für Möglichkeiten.</b><span class="hint">Tausche mit der Bank oder lege ein Angebot für alle auf den Tisch.</span></div></div>
      <div class="partner-tabs two">
        <button class="partner ${bank ? 'active' : ''}" data-partner="bank"><span class="partner-art">${emblem('bank', 34)}</span><div><b>Bank & Häfen</b><small>Sofort tauschen · ${Math.min(...Object.values(ratios))}:1 bestes Verhältnis</small></div></button>
        <button class="partner ${bank ? '' : 'active'}" data-partner="all"><span class="avatars">${others.map((o) => avatar(o, 26)).join('')}</span><div><b>An alle Mitspieler</b><small>${others.length} Siedler · sie entscheiden selbst</small></div></button>
      </div>
      <div class="trade-summary">
        <div class="side">${avatar(p, 44)}<b>${esc(nameOf(S.you))}</b><small>gibt</small><div class="items">${resList(T.give)}</div></div>
        <div class="swap">${icon('swap', 20)}</div>
        <div class="side">${bank ? `<span class="side-art">${emblem('bank', 44)}</span><b>Bank</b>` : `<span class="side-art">${emblem('users', 44)}</span><b>Mitspieler</b>`}<small>${bank ? 'gibt' : 'geben'}</small><div class="items">${resList(T.get)}</div></div>
      </div>
      ${tradeExchange({ bank, p, st, ratios, T })}
      ${note ? `<p class="trade-note">${note}</p>` : ''}
      <div class="modal-actions">
        <button class="btn ghost" id="tr-reset">Zurücksetzen</button>
        <button class="btn primary" id="tr-submit" ${valid ? '' : 'disabled'}>${bank ? 'Mit der Bank tauschen' : 'Angebot an alle senden'}</button>
      </div>`, { wide: true });
    $$('[data-partner]', m).forEach((b) => b.addEventListener('click', () => {
      T.partner = b.dataset.partner;
      S.lastTradePartner = T.partner;
      play('click');
      draw();
    }));
    const stepGive = (r, d) => {
      const step = T.partner === 'bank' ? harborRatios(S.state, S.you)[r] : 1;
      const next = T.give[r] + d * step;
      if (next < 0 || next > me().resources[r]) return;
      T.give[r] = next;
      if (next) T.get[r] = 0;
      // Bei der Bank nie mehr Karten gewählt lassen, als die abgegebenen Pakete erlauben
      if (T.partner === 'bank') {
        const credits = bankCredits(T, harborRatios(S.state, S.you));
        for (const x of [...RESOURCES].reverse()) while (resCount(T.get) > credits && T.get[x]) T.get[x]--;
      }
      play('card');
      draw();
    };
    const stepGet = (r, d) => {
      if (d > 0 && !canTakeMore(T, r)) return;
      T.get[r] = Math.max(0, T.get[r] + d);
      play('card');
      draw();
    };
    bindExchange(m, stepGive, stepGet);
    $('#tr-reset', m).addEventListener('click', () => { for (const r of RESOURCES) { T.give[r] = 0; T.get[r] = 0; } draw(); });
    $('#tr-submit', m).addEventListener('click', () => {
      const give = Object.fromEntries(RESOURCES.filter((r) => T.give[r]).map((r) => [r, T.give[r]]));
      const get = Object.fromEntries(RESOURCES.filter((r) => T.get[r]).map((r) => [r, T.get[r]]));
      if (T.partner === 'bank') {
        act('bankTrade', { give, get });
        for (const r of RESOURCES) { T.give[r] = 0; T.get[r] = 0; }
      } else {
        act('offerTrade', { give, get });
        closeModal();
      }
    });
    S.redrawTrade = draw;
  };
  draw();
}

function openStealChooser(hex, cands) {
  const st = S.state;
  const m = openModal('steal', `
    <h2>Von wem stehlen?</h2>
    <p>Mehrere Nachbarn grenzen an dieses Feld. Wähle, wem du eine zufällige Karte abnimmst.</p>
    <div class="partner-tabs">${cands.map((c) => {
      const o = st.players[c];
      return `<button class="partner" data-victim="${c}">${avatar(o, 36)}<div><b>${esc(o.name)}</b><small>${o.resourceCount} Karten · ${o.publicVP} Punkte</small></div></button>`;
    }).join('')}</div>`);
  $$('[data-victim]', m).forEach((b) => b.addEventListener('click', () => {
    act('moveRobber', { hex, victim: Number(b.dataset.victim) });
    closeModal();
  }));
}

function openYearOfPlenty() {
  const st = S.state;
  const sel = Object.fromEntries(RESOURCES.map((r) => [r, 0]));
  const draw = () => {
    const n = resCount(sel);
    const m = openModal('yop', `
      <h2>${devArt('yearOfPlenty', 32)} Erfindung</h2><p>Nimm dir zwei beliebige Rohstoffe aus der Bank.</p>
      ${pickGrid('yop-grid', { counts: sel, showHave: false, disabled: (r) => st.bank[r] - sel[r] <= 0 && !sel[r], note: (r) => `${st.bank[r]} in der Bank` })}
      <div class="modal-actions"><button class="btn primary" id="yop-ok" ${n === 2 ? '' : 'disabled'}>Nehmen (${n}/2)</button></div>`);
    bindPickGrid(m, 'yop-grid', (r, d) => {
      if (d > 0 && (resCount(sel) >= 2 || sel[r] >= st.bank[r])) return;
      sel[r] = Math.max(0, sel[r] + d);
      draw();
    });
    $('#yop-ok', m).addEventListener('click', () => {
      act('playDev', { card: 'yearOfPlenty', resources: RESOURCES.flatMap((r) => Array(sel[r]).fill(r)) });
      closeModal();
    });
  };
  draw();
}

function openMonopoly() {
  const m = openModal('mono', `
    <h2>${devArt('monopoly', 32)} Monopol</h2><p>Wähle einen Rohstoff. Alle Mitspieler geben dir sämtliche Karten davon.</p>
    ${pickGrid('mono-grid', { counts: {}, showHave: false })}`);
  bindPickGrid(m, 'mono-grid', (r) => {
    act('playDev', { card: 'monopoly', resource: r });
    closeModal();
  });
}

function openWinner(onDismiss) {
  const st = S.state;
  const ranked = [...st.players].sort((a, b) => (b.vp ?? b.publicVP) - (a.vp ?? a.publicVP));
  const w = st.players[st.winner];
  const m = openModal('winner', `
    <div class="illus big">${ILLUS.crown}</div>
    <h2 class="center">${st.winner === S.you && !S.room?.hotseat ? 'Du hast gewonnen!' : `${esc(w.name)} gewinnt!`}</h2>
    <p class="center">Nach ${st.turn.number} Zügen ist die Insel ${esc(st.islandName)} entschieden.</p>
    <ol class="winner-list">${ranked.map((p, i) => `<li class="${i === 0 ? 'first' : ''}">${avatar(p, 38)}<b>${esc(p.idx === S.you && !S.room?.hotseat ? 'Du' : p.name)}</b>
      <span class="hint">${p.knights} Ritter · ${p.longestRoad} Straßen</span><span class="vp">${p.vp ?? p.publicVP}</span></li>`).join('')}</ol>
    <div class="modal-actions">
      <button class="btn ghost" id="w-menu">Zum Menü</button>
      ${amHost() ? '<button class="btn primary" id="w-again">Neue Partie</button>' : '<span class="hint">Der Gastgeber kann eine neue Partie starten.</span>'}
    </div>`, { onClose: onDismiss });
  $('#w-menu', m).addEventListener('click', () => send({ t: 'leave' }));
  $('#w-again', m)?.addEventListener('click', () => { closeModal(); send({ t: 'rematch' }); });
}

// ---------- Regelbuch ----------

function probabilityRow() {
  const ways = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  return `<div class="prob-row">${Object.entries(ways).map(([n, w]) => `
    <div class="prob"><div class="bar ${n === '6' || n === '8' ? 'red' : n === '7' ? 'robber' : ''}" style="height:${w * 9}px"></div>
    <span class="ptok ${n === '6' || n === '8' ? 'red' : ''}">${n === '7' ? emblem('robber', 20) : n}</span><small>${Math.round((w / 36) * 100)}%</small></div>`).join('')}</div>`;
}

const RULES = [
  {
    tab: 'Ein Platz zum Beginnen', html: () => `<h3><span class="num-badge">1</span> Ein Platz zum Beginnen</h3>
    <div class="rule-split"><div>
    <p>Reihum setzt jeder eine <b>Siedlung</b> auf eine Kreuzung und eine angrenzende <b>Straße</b>. Danach geht es in umgekehrter Reihenfolge weiter: Jeder setzt eine zweite Siedlung mit Straße.</p>
    <p>Die zweite Siedlung bringt sofort je einen Rohstoff der angrenzenden Felder.</p>
    <ul><li><b>Abstandsregel:</b> Zwischen zwei Siedlungen liegt immer mindestens eine freie Kreuzung.</li><li>Später baust du nur dort, wo deine Straßen hinführen.</li></ul>
    </div><div class="rule-art">${ILLUS.house}</div></div>`,
  },
  {
    tab: 'Die Insel liefert', html: () => `<h3><span class="num-badge">2</span> Die Insel liefert</h3>
    <p>Zu Beginn deines Zuges würfelst du mit zwei Würfeln. Jedes Feld mit dieser Zahl liefert Rohstoffe an alle angrenzenden Siedlungen (1 Karte) und Städte (2 Karten).</p>
    <div class="res-legend">${[['forest', 'wood'], ['hills', 'brick'], ['pasture', 'sheep'], ['fields', 'wheat'], ['mountains', 'ore']].map(([t, r]) => `<div>${resourceArt(r, 44)}<b>${RES_LABEL[r]}</b><small>${TERRAIN_LABEL[t]}</small></div>`).join('')}</div>
    <p>Die Wüste bringt nichts. Die Punkte unter den Zahlen zeigen die Wahrscheinlichkeit – 6 und 8 fallen am häufigsten:</p>
    ${probabilityRow()}`,
  },
  {
    tab: 'Handel & Bau', html: () => `<h3><span class="num-badge">3</span> Handel & Bau</h3>
    <p>Nach dem Würfeln tauschst du mit der Bank (4:1 immer, 3:1 an einem allgemeinen Hafen, 2:1 an einem Spezialhafen) oder legst ein <b>Angebot für alle Mitspieler</b> auf den Tisch. Jeder nimmt an oder lehnt ab – nehmen mehrere an, wählst du, mit wem du tauschst.</p>
    <p>Hast du genug Rohstoffe, erscheinen mögliche Bauten als <b>leuchtende Hologramme</b> auf der Insel – ein Klick genügt.</p>
    <table class="cost-table">
      <tr><td>${iconArt('road', 26)} Straße</td><td>${costArt(COSTS.road, 22)}</td></tr>
      <tr><td>${iconArt('settlement', 26)} Siedlung <small>1 Punkt</small></td><td>${costArt(COSTS.settlement, 22)}</td></tr>
      <tr><td>${iconArt('city', 26)} Stadt <small>2 Punkte, ersetzt Siedlung</small></td><td>${costArt(COSTS.city, 22)}</td></tr>
      <tr><td>${iconArt('card', 26)} Entwicklungskarte</td><td>${costArt(COSTS.dev, 22)}</td></tr>
    </table>
    <p class="hint">Vorrat pro Spieler: 15 Straßen, 5 Siedlungen, 4 Städte.</p>`,
  },
  {
    tab: 'Der Räuber', html: () => `<h3><span class="num-badge">4</span> Der Räuber</h3>
    <div class="rule-split"><div>
    <p>Fällt eine <b>7</b>, erhält niemand Rohstoffe. Wer mehr als 7 Karten hat, wirft die Hälfte (abgerundet) ab.</p>
    <p>Dann versetzt der Würfelnde den Räuber auf ein anderes Feld und zieht eine zufällige Karte von einem Gegner, der dort angrenzt. Solange der Räuber dort steht, liefert das Feld nichts.</p>
    </div><div class="rule-art">${ILLUS.robber}</div></div>`,
  },
  {
    tab: 'Karten & Siegpunkte', html: () => `<h3><span class="num-badge">5</span> Karten & Siegpunkte</h3>
    <div class="dev-legend">${Object.keys(DEV_LABEL).map((k) => `<div>${devArt(k, 40)}<div><b>${DEV_LABEL[k]}</b><small>${DEV_TEXT[k]}</small></div></div>`).join('')}</div>
    <p>Pro Zug darfst du eine Karte ausspielen – nicht in dem Zug, in dem du sie gekauft hast. Einen Ritter darfst du auch vor dem Würfeln spielen.</p>
    <ul><li>Siedlung 1 · Stadt 2 · Siegpunktkarte 1</li><li>${emblem('road', 20)} Längste Handelsstraße (mind. 5 zusammenhängende Straßen): 2</li><li>${emblem('sword', 20)} Größte Rittermacht (mind. 3 Ritter): 2</li></ul>
    <p>Wer in seinem Zug die Zielpunktzahl erreicht, gewinnt sofort.</p>`,
  },
];

function openRules(tab = 0) {
  play('page');
  const m = openModal('rules', `
    <h2 class="modal-title">Das Regelbuch der Siedler</h2>
    <div class="rules-hero"><div class="art">${ILLUS.island}</div><div><div class="eyebrow">Ein Leitfaden für die Insel</div>
      <h2>Von der ersten Hütte zum Inselerbe.</h2>
      <p>Sammle Rohstoffe, handle mit deinen Nachbarn und baue dich zu <b>${S.state?.vpToWin || 10} Siegpunkten</b> – in deinem eigenen Zug.</p>
      <div class="vp-badge">${emblem('crown', 30)} <b>${S.state?.vpToWin || 10}</b> <small>Siegpunkte<br />gewinnen die Insel</small></div></div></div>
    <div class="rules-tabs">${RULES.map((r, i) => `<button class="rules-tab ${i === tab ? 'active' : ''}" data-tab="${i}"><span>${i + 1}</span> ${r.tab}</button>`).join('')}</div>
    <div class="rules-body">${RULES[tab].html()}</div>`, { wide: true });
  $$('[data-tab]', m).forEach((b) => b.addEventListener('click', () => openRules(Number(b.dataset.tab))));
}

// ---------- Einstellungen „An deinem Tisch“ ----------

function toggleHtml(id, on, label) {
  return `<label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} /><span class="track"><span class="knob"></span></span><span>${label}</span></label>`;
}

function openSettings() {
  play('page');
  const isHost = amHost();
  const pace = S.room?.pace || 'normal';
  const m = openModal('settings', `
    <h2 class="modal-title">An deinem Tisch</h2>
    <div class="settings-hero"><span class="lede-art">${ILLUS.island}</span><div><b>Eine Welt nach deinem Geschmack.</b><span class="hint">Stelle Detail, Klang, Tempo und Bewegung der Insel ein.</span></div></div>
    <div class="settings-grid">
      <section><h3>${emblem('island', 28)} Die Ansicht</h3><p class="hint">Wie fein die Insel gezeichnet wird.</p>
        <label class="mini">Grafikqualität
          <select id="set-quality"><option value="ultra">Ultra – feinste Texturen, weiche Schatten & Tiefe</option><option value="high">Hoch – Schatten & volle Details</option><option value="medium">Mittel</option><option value="low">Niedrig – für schwächere Geräte</option></select></label>
        ${toggleHtml('set-holo', settings.holograms, 'Bauvorschau als Hologramme')}
      </section>
      <section><h3>${emblem('bell', 28)} Der Klang</h3><p class="hint">Würfel, Pergament, Holz, Stein und warme Glocken.</p>
        ${toggleHtml('set-sound', settings.sound, 'Klang an')}
        ${toggleHtml('set-amb', settings.ambience, 'Meeresrauschen')}
        <label class="mini">Lautstärke <span id="vol-val">${Math.round(settings.volume * 100)}%</span><input type="range" id="set-volume" min="0" max="100" value="${Math.round(settings.volume * 100)}" /></label>
        <div class="sound-grid">${Object.entries(SOUNDS).filter(([k]) => k !== 'error').map(([k, s]) => `<button class="sound-btn" data-sound="${k}">${emblem(s.icon, 20)} ${s.label}</button>`).join('')}</div>
      </section>
      <section><h3>${emblem('hourglass', 28)} Das Tempo</h3><p class="hint">Lass deine Mitspieler sich Zeit nehmen – oder halte das Spiel in Bewegung.</p>
        <div class="seg" id="set-pace">${Object.entries(PACE_LABEL).map(([k, l]) => `<button data-pace="${k}" class="${pace === k ? 'on' : ''}" ${isHost ? '' : 'disabled'}>${l}</button>`).join('')}</div>
        ${isHost ? '' : '<p class="hint">Nur der Gastgeber kann das Tempo ändern.</p>'}
      </section>
      <section><h3>${emblem('ship', 28)} Die Bewegung</h3><p class="hint">Lieber einen ruhigen Tisch? Halte Wasser und Kamera still.</p>
        ${toggleHtml('set-cine', settings.cinematic, 'Kamerafahrten (alle)')}
        <div class="sub-toggles">
          ${toggleHtml('set-camDice', settings.camDice, 'Zur Würfelschale')}
          ${toggleHtml('set-camHarvest', settings.camHarvest, 'Zu den Feldern mit Ertrag')}
          ${toggleHtml('set-camRobber', settings.camRobber, 'Zum Räuber')}
          ${toggleHtml('set-camBuild', settings.camBuild, 'Zu neuen Bauten der Mitspieler')}
        </div>
        ${toggleHtml('set-scene', settings.scenery, 'Bewegte Szenerie (Wellen, Boote, Wolken)')}
      </section>
    </div>`, { wide: true });
  $('#set-quality', m).value = settings.quality;
  $('#set-quality', m).addEventListener('change', (e) => { settings.quality = e.target.value; });
  $('#set-holo', m).addEventListener('change', (e) => { settings.holograms = e.target.checked; });
  $('#set-sound', m).addEventListener('change', (e) => { settings.sound = e.target.checked; updateSoundBtn(); });
  $('#set-amb', m).addEventListener('change', (e) => { settings.ambience = e.target.checked; });
  $('#set-volume', m).addEventListener('input', (e) => { settings.volume = Number(e.target.value) / 100; $('#vol-val', m).textContent = `${e.target.value}%`; });
  $('#set-cine', m).addEventListener('change', (e) => { settings.cinematic = e.target.checked; });
  for (const k of ['camDice', 'camHarvest', 'camRobber', 'camBuild']) {
    $(`#set-${k}`, m).addEventListener('change', (e) => { settings[k] = e.target.checked; });
  }
  $('#set-scene', m).addEventListener('change', (e) => { settings.scenery = e.target.checked; });
  $$('[data-sound]', m).forEach((b) => b.addEventListener('click', () => play(b.dataset.sound, true)));
  $$('[data-pace]', m).forEach((b) => b.addEventListener('click', () => {
    send({ t: 'setOptions', pace: b.dataset.pace });
    $$('[data-pace]', m).forEach((x) => x.classList.toggle('on', x === b));
  }));
}

onSettingsChange((key, value) => {
  if (!S.board) return;
  if (key === 'quality') S.board.setQuality(value);
  if (key === 'scenery') S.board.setScenery(value);
  if (key === 'holograms') render();
});

// ---------- Geführte Inseltour ----------

function tourSteps() {
  const st = S.state;
  const b = st.board;
  const fields = b.hexes.filter((h) => h.number).sort((x, y) => (PIPS[y.number] - PIPS[x.number]) || ((y.terrain === 'fields') - (x.terrain === 'fields')))[0];
  const score = (v) => b.vertices[v].hexes.reduce((s, h) => s + (PIPS[b.hexes[h].number] || 0), 0);
  const free = validSettlementSpots(st, 0, true);
  const home = (free.length ? free : b.vertices.map((v) => v.id)).sort((x, y) => score(y) - score(x))[0];
  const harbor = b.harbors.find((h) => h.type !== 'any') || b.harbors[0];
  const robberHex = b.hexes[st.robber];
  const hv = b.vertices[home];
  // Das Tour-Panel liegt unten über dem Brett: Fokus etwas nach oben rücken
  const wrap = $('#board-wrap');
  const lift = wrap.clientHeight > wrap.clientWidth ? 1.5 : 0.8;
  return [
    { art: `${resourceArt('wood', 44)}<span class="arrow">${icon('arrowRight', 18)}</span>${ILLUS.trade}<span class="arrow">${icon('arrowRight', 18)}</span>${iconArt('settlement', 44)}`, title: 'Deine Insel, deine Geschichte', text: 'Sammle Rohstoffe, handle mit deinen Nachbarn und baue. Wer zuerst die Zielpunktzahl erreicht, gewinnt.', view: () => S.board.baseViewSpec() },
    { art: resourceArt(TERRAIN_RESOURCE[fields.terrain], 64), title: 'Das Land gibt', text: `Jedes Feld liefert einen Rohstoff, sobald seine Zahl fällt. Die ${fields.number} gehört zu den häufigsten Würfen.`, view: () => S.board.hexesView([fields.id], lift), ring: [fields.x, fields.y, 0.95] },
    { art: iconArt('settlement', 60), title: 'Ein Zuhause. Benachbarte Felder.', text: 'Siedlungen stehen auf Kreuzungen und ernten von bis zu drei Feldern. Fahre über einen leuchtenden Platz, um zu sehen, was er bringt.', view: () => S.board.pointView(hv.x, hv.y, 3.4, lift * 0.7), ghost: home, ring: [hv.x, hv.y, 0.45] },
    { art: emblem('anchor', 64), title: 'Ein besserer Handel', text: `Baue neben diesem Steg, um ${harbor.type === 'any' ? 'alle Rohstoffe 3:1' : `${RES_LABEL[harbor.type]} 2:1`} zu tauschen.`, view: () => S.board.pointView(harbor.x + harbor.nx * 0.4, harbor.y + harbor.ny * 0.4, 3.4, lift * 0.7), ring: [harbor.x + harbor.nx * 0.55, harbor.y + harbor.ny * 0.55, 0.45] },
    { art: ILLUS.robber, title: 'Der ungebetene Gast', text: 'Fällt eine 7, erwacht der Räuber. Er blockiert ein Feld und stiehlt eine Karte. Halte deine Hand klein!', view: () => S.board.pointView(robberHex.x, robberHex.y, 3.6, lift * 0.8), ring: [robberHex.x, robberHex.y, 0.95] },
  ];
}

function startTour() {
  if (!S.state || S.demo) return;
  closeModal();
  S.tour = { step: 0, steps: tourSteps(), paused: false };
  $('#island-tour').classList.add('active');
  S.board.setTargets(null);
  S.board.setGhosts([]);
  showTourStep();
}

function showTourStep() {
  const T = S.tour;
  if (!T) return;
  const s = T.steps[T.step];
  const panel = $('#tour-panel');
  panel.hidden = false;
  panel.innerHTML = `
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="tour-top"><span class="eyebrow">Entdecke ${esc(S.state.islandName)} · ${T.step + 1} von ${T.steps.length}</span><button class="link" id="tour-skip">Tour überspringen</button></div>
    <div class="tour-body"><div class="tour-art">${s.art}</div><div><h3>${s.title}</h3><p>${s.text}</p></div></div>
    <div class="tour-controls">
      <button class="link" id="tour-back" ${T.step ? '' : 'disabled'}>Zurück</button>
      <div class="tour-dots">${T.steps.map((_, i) => `<span class="${i === T.step ? 'on' : ''}"></span>`).join('')}</div>
      <span class="spacer"></span>
      <button class="link" id="tour-pause">${T.paused ? 'Abspielen' : 'Pause'}</button>
      <button class="btn primary small" id="tour-next">${T.step === T.steps.length - 1 ? 'Los geht’s' : 'Weiter'}</button>
    </div>`;
  panel.classList.remove('flip');
  void panel.offsetWidth;
  panel.classList.add('flip');
  play('page');
  $('#tour-skip').addEventListener('click', stopTour);
  $('#tour-back').addEventListener('click', () => { T.step--; showTourStep(); });
  $('#tour-next').addEventListener('click', () => { if (T.step === T.steps.length - 1) stopTour(); else { T.step++; showTourStep(); } });
  $('#tour-pause').addEventListener('click', () => { T.paused = !T.paused; showTourStep(); });
  S.board.clearFocusRing();
  S.board.setGhosts(s.ghost !== undefined ? [{ piece: 'settlement', id: s.ghost }] : [], myColor());
  S.board.setOrbit(false);
  S.board.flyTo(s.view(), 1300).then(() => {
    if (S.tour !== T) return;
    if (s.ring) S.board.showFocusRing(...s.ring);
    if (T.step === 0) S.board.setOrbit(true);
  });
  clearTimeout(T.timer);
  if (!T.paused) {
    T.timer = setTimeout(() => {
      if (S.tour !== T || T.paused) return;
      if (T.step < T.steps.length - 1) { T.step++; showTourStep(); } else stopTour();
    }, 9000);
  }
}

function stopTour() {
  if (!S.tour) return;
  clearTimeout(S.tour.timer);
  S.tour = null;
  store.set('tourDone', '1');
  $('#tour-panel').hidden = true;
  $('#island-tour').classList.remove('active');
  if (!S.board) return;
  S.board.setOrbit(false);
  S.board.clearFocusRing();
  S.board.ghostKey = '';
  S.board.flyTo(S.board.baseViewSpec(), 1100);
  render();
}

// ---------- Menü im Spiel ----------

function openGameMenu() {
  const inRoom = !!S.room;
  const solo = S.room && (S.room.hotseat || S.room.seats.filter((s) => !s.isBot).length <= 1);
  const m = openModal('menu', `
    <h2 class="modal-title">Menü</h2>
    ${inRoom && !S.room.hotseat ? `<p>Raumcode: <b class="code">${S.room.code}</b> – teile den Link, damit andere zuschauen oder beitreten können.</p>` : ''}
    <div class="menu-list">
      ${inRoom && !S.room.hotseat ? `<button class="btn" id="m-copy">${icon('link', 17)} Einladungslink kopieren</button>` : ''}
      <button class="btn" id="m-tour">${icon('compass', 17)} Inseltour starten</button>
      <button class="btn" id="m-rules">${icon('book', 17)} Regelbuch</button>
      <button class="btn" id="m-settings">${icon('cog', 17)} An deinem Tisch (Einstellungen)</button>
      <button class="btn ${solo ? '' : 'danger'}" id="m-leave">${solo ? `${icon('chest', 17)} Speichern & zum Hauptmenü` : `${icon('leave', 17)} Partie verlassen (KI übernimmt)`}</button>
    </div>
    <h3>Tastenkürzel</h3>
    <p class="hint">R Würfeln · E Zug beenden · T Handeln · Esc Abbrechen · WASD Kamera schwenken · Leertaste + Ziehen schwenken</p>`);
  $('#m-copy', m)?.addEventListener('click', copyInvite);
  $('#m-tour', m).addEventListener('click', () => { closeModal(); startTour(); });
  $('#m-rules', m).addEventListener('click', () => openRules(0));
  $('#m-settings', m).addEventListener('click', () => openSettings());
  $('#m-leave', m).addEventListener('click', () => {
    if (solo || confirm('Partie wirklich verlassen? Eine KI übernimmt deinen Platz.')) send({ t: 'leave' });
  });
}

function updateSoundBtn() {
  $('#btn-sound').innerHTML = uiArt(isSoundOn() ? 'soundOn' : 'soundOff', 18);
}

function fillArt(root = document) {
  $$('[data-art]', root).forEach((el) => {
    const [name, size] = el.dataset.art.split(':');
    el.innerHTML = uiArt(name, Number(size) || 24);
  });
  $$('[data-icon]', root).forEach((el) => {
    const [name, size] = el.dataset.icon.split(':');
    el.outerHTML = icon(name, Number(size) || 16);
  });
  $$('[data-emblem]', root).forEach((el) => {
    const [name, size] = el.dataset.emblem.split(':');
    el.innerHTML = emblem(name, Number(size) || 24);
  });
}

// ---------- Chat ----------

function renderChat() {
  $('#chat-list').innerHTML = S.chat.map((c) => `<li><b style="color:${COLOR_HEX[c.color]}">${esc(c.name)}:</b> ${esc(c.text)}</li>`).join('');
  const l = $('#chat-list');
  l.scrollTop = l.scrollHeight;
}

function renderChatBadge() {
  const b = $('#chat-badge');
  b.hidden = !S.chatUnread;
  b.textContent = String(S.chatUnread);
}

function bindGame() {
  $('#btn-rules').addEventListener('click', () => openRules(0));
  $('#btn-menu').addEventListener('click', () => (S.demo ? showMenu('home') : openGameMenu()));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-sound').addEventListener('click', () => { toggleSound(); updateSoundBtn(); });
  $('#room-chip').addEventListener('click', copyInvite);
  $('#foot-trade').addEventListener('click', () => openTrade());
  updateSoundBtn();
  $$('.log-tab').forEach((b) => b.addEventListener('click', () => {
    $$('.log-tab').forEach((x) => x.classList.toggle('active', x === b));
    const chat = b.dataset.tab === 'chat';
    $('#chat').hidden = !chat;
    $('#chronicle').hidden = chat;
    if (chat) { S.chatUnread = 0; renderChatBadge(); renderChat(); $('#chat-input').focus(); }
  }));
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#chat-input').value.trim();
    if (!text) return;
    send({ t: 'chat', seat: S.you, text });
    $('#chat-input').value = '';
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || !S.state || S.demo) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (S.tour) { stopTour(); return; }
      if (S.modalKey && !['discard', 'incoming', 'offer', 'accepted'].some((x) => (S.modalKey || '').startsWith(x))) {
        const cb = S.modalOnClose;
        closeModal();
        if (cb) cb();
      } else if (S.mode) { S.mode = null; render(); }
      return;
    }
    if (S.modalKey || !$('#curtain').hidden) return;
    const st = S.state;
    if (k === 'r' && st.phase === 'play' && st.current === S.you && !st.turn.rolled && !st.turn.pending) act('roll');
    if (k === 'e' && isMyMainPhase()) { S.mode = null; act('endTurn'); }
    if (k === 't' && isMyMainPhase()) openTrade();
  });
}

// ---------- Start ----------

fillArt();
bindMenu();
bindGame();
showDemo();
showMenu('home');
resolveToken().then((token) => {
  S.token = token;
  connect();
});
