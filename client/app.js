// Hauptanwendung: Verbindung, Lobby, Spieloberfläche, Modals und Ereignisse.
import {
  RESOURCES, RES_LABEL, TERRAIN_RESOURCE, TERRAIN_LABEL, COSTS, DEV_LABEL, DEV_TEXT, PLAYER_COLORS, PIPS,
  validSettlementSpots, validRoadSpots, validCitySpots, robberHexes, stealCandidates, hasRes, harborRatios, resCount,
} from '/shared/engine.js';
import { Board3D } from './board3d.js';
import { play, toggleSound, isSoundOn } from './sound.js';

const RES_EMOJI = { wood: '🪵', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '🪨' };
const TERRAIN_EMOJI = { forest: '🌲', hills: '🧱', pasture: '🐑', fields: '🌾', mountains: '⛰️', desert: '🏜️' };
const DEV_EMOJI = { knight: '⚔️', vp: '👑', roadBuilding: '🛤️', yearOfPlenty: '🎁', monopoly: '💰' };
const LOG_ICON = {
  island: '🏝️', compass: '🧭', dice: '🎲', harvest: '🌾', robber: '🥷', discard: '🗑️', steal: '🫳', house: '🏠', city: '🏰',
  road: '🛤️', card: '🃏', sword: '⚔️', trade: '🤝', bank: '🏦', crown: '👑', scroll: '📜',
};
const COLOR_HEX = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.hex]));
const COLOR_LABEL = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.label]));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(k) { try { return localStorage.getItem(`siedlungen.${k}`); } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(`siedlungen.${k}`); else localStorage.setItem(`siedlungen.${k}`, v); } catch { /* ignorieren */ } },
};

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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Zustand ----------

const S = {
  ws: null,
  token: null,
  connected: false,
  room: null,
  you: null,
  state: null,
  prev: null,
  mode: null,
  lastSeq: 0,
  board: null,
  chat: [],
  chatUnread: 0,
  autoModal: null,
  userModal: null,
  pendingJoin: null,
  reconnectDelay: 500,
};

// ---------- Identität pro Tab ----------
// Das Token (Sitzplatz) wird gespeichert, damit ein Neuladen oder erneutes Öffnen den Platz zurückholt.
// Ist dasselbe Token schon in einem anderen offenen Tab aktiv, bekommt dieser Tab eine eigene Identität –
// so können mehrere Spieler im selben Browser testen.
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
    S.connected = true;
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
    S.connected = false;
    setConn('Verbindung getrennt – neuer Versuch …');
    setTimeout(connect, S.reconnectDelay);
    S.reconnectDelay = Math.min(8000, S.reconnectDelay * 1.7);
  };
}

function send(msg) {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg));
  else toast('Keine Verbindung zum Server.');
}

function act(type, payload = {}) {
  play('click');
  send({ t: 'action', action: { type, ...payload } });
}

function setConn(text) {
  $('#conn-state').textContent = text;
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome': {
      saveToken(msg.token);
      const urlCode = new URLSearchParams(location.search).get('room');
      const saved = roomStore.get();
      const code = (urlCode || saved || '').toUpperCase();
      if (code) {
        S.pendingJoin = code;
        send({ t: 'joinRoom', code, name: myName() });
      }
      break;
    }
    case 'room':
      S.pendingJoin = null;
      S.room = msg.room;
      S.you = msg.you;
      roomStore.set(msg.room.code);
      if (new URLSearchParams(location.search).get('room') !== msg.room.code) {
        history.replaceState(null, '', `?room=${msg.room.code}`);
      }
      if (!msg.room.started) showRoom();
      break;
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
        showMenu();
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
  S.mode = null;
  S.chat = [];
  roomStore.set(null);
  history.replaceState(null, '', location.pathname);
  closeModal();
  showMenu();
}

// ---------- Menü & Lobby ----------

function myName() {
  return ($('#name-input').value || store.get('name') || '').trim();
}

function showMenu() {
  $('#game-screen').hidden = true;
  $('#menu-screen').hidden = false;
  $('#menu-home').hidden = false;
  $('#menu-room').hidden = true;
}

function showRoom() {
  $('#game-screen').hidden = true;
  $('#menu-screen').hidden = false;
  $('#menu-home').hidden = true;
  $('#menu-room').hidden = false;
  const r = S.room;
  const isHost = r.host === S.you;
  $('#room-code').textContent = r.code;
  const list = $('#seat-list');
  const used = new Set(r.seats.map((s) => s.color));
  list.innerHTML = r.seats.map((s, i) => {
    const mine = i === S.you;
    const canColor = !r.started && (mine || (isHost && s.isBot));
    const swatches = PLAYER_COLORS.map((c) => `<button class="swatch ${s.color === c.id ? 'sel' : ''}" style="background:${c.hex}" data-seat="${i}" data-color="${c.id}" ${canColor && (!used.has(c.id) || s.color === c.id) ? '' : 'disabled'} title="${c.label}"></button>`).join('');
    return `<li class="seat">
      ${avatar(s.name, s.color)}
      <div class="name">${esc(s.name)} ${mine ? '<span class="tag">(du)</span> <button class="btn small ghost" id="btn-rename" title="Namen ändern">✎</button>' : ''}</div>
      <span class="tag">${i === r.host ? '👑 Gastgeber' : s.isBot ? '🤖 Bot' : s.connected ? '🟢 bereit' : '⚪ getrennt'}</span>
      <div class="swatches">${swatches}</div>
      ${isHost && i !== r.host ? `<button class="btn small ghost" data-remove="${i}" title="Entfernen">✕</button>` : ''}
    </li>`;
  }).join('') + Array.from({ length: 4 - r.seats.length }, () => '<li class="seat empty">Freier Platz – teile den Code</li>').join('');
  $$('.swatch', list).forEach((b) => b.addEventListener('click', () => send({ t: 'setColor', color: b.dataset.color, seat: Number(b.dataset.seat) })));
  $('#btn-rename', list)?.addEventListener('click', () => {
    const n = prompt('Dein Name:', r.seats[S.you]?.name || '');
    if (n && n.trim()) { store.set('name', n.trim()); send({ t: 'setName', name: n.trim() }); }
  });
  $$('[data-remove]', list).forEach((b) => b.addEventListener('click', () => send({ t: 'removeSeat', seat: Number(b.dataset.remove) })));
  $('#room-options').style.display = isHost ? '' : 'none';
  $('#room-vp').value = String(r.vpToWin);
  $('#btn-add-bot').disabled = r.seats.length >= 4;
  $('#btn-start').hidden = !isHost;
  $('#room-hint').textContent = isHost
    ? (r.seats.length < 2 ? 'Lade Freunde ein oder füge Bots hinzu (mind. 2 Spieler).' : `${r.seats.length} Spieler bereit. Ziel: ${r.vpToWin} Siegpunkte.`)
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
  $('#name-input').value = store.get('name') || '';
  $('#name-input').addEventListener('change', () => store.set('name', $('#name-input').value.trim()));
  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) $('#code-input').value = urlCode.toUpperCase();
  const needName = () => {
    const n = myName();
    if (!n) {
      $('#name-input').focus();
      toast('Bitte gib zuerst deinen Namen ein.');
      return null;
    }
    store.set('name', n);
    return n;
  };
  $('#btn-solo').addEventListener('click', () => {
    const name = needName();
    if (!name) return;
    send({ t: 'createRoom', name, solo: true, bots: Number($('#solo-bots').value), vpToWin: Number($('#solo-vp').value) });
  });
  $('#btn-create').addEventListener('click', () => {
    const name = needName();
    if (name) send({ t: 'createRoom', name });
  });
  const join = () => {
    const name = needName();
    const code = $('#code-input').value.trim().toUpperCase();
    if (!name) return;
    if (code.length !== 5) { toast('Der Raumcode hat 5 Zeichen.'); return; }
    send({ t: 'joinRoom', code, name });
  };
  $('#btn-join').addEventListener('click', join);
  $('#code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('#btn-copy-link').addEventListener('click', copyInvite);
  $('#btn-add-bot').addEventListener('click', () => send({ t: 'addBot' }));
  $('#room-vp').addEventListener('change', () => send({ t: 'setOptions', vpToWin: Number($('#room-vp').value) }));
  $('#btn-start').addEventListener('click', () => send({ t: 'start' }));
  $('#btn-leave-room').addEventListener('click', () => send({ t: 'leave' }));
}

// ---------- Spielansicht ----------

function ensureBoard() {
  if (S.board) return;
  S.board = new Board3D($('#board-canvas'), {
    onPick,
    onHover: showTooltip,
  });
  const slider = $('#zoom-slider');
  const syncZoom = () => {
    const z = S.board.getZoom();
    if (document.activeElement !== slider) slider.value = String(Math.round(z * 100));
    $('#zoom-val').textContent = `${Math.round(60 + z * 120)}%`;
  };
  S.board.onCamera = syncZoom;
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
  $('#island-tour').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (btn.classList.contains('active')) { S.board.stopTour(); return; }
    btn.classList.add('active');
    S.board.startTour(() => btn.classList.remove('active'));
  });
}

function onState(state) {
  const first = !S.state || S.state.islandName !== state.islandName || S.lastSeq > state.seq;
  S.prev = first ? null : S.state;
  S.state = state;
  $('#menu-screen').hidden = true;
  $('#game-screen').hidden = false;
  ensureBoard();
  S.board.build(state);
  S.board.sync(state, (i) => COLOR_HEX[state.players[i].color]);
  if (first) {
    S.lastSeq = state.seq;
    S.dismissedAuto = null;
    const lastRoll = [...state.events].reverse().find((e) => e.type === 'roll');
    if (lastRoll) S.board.showDice(lastRoll.dice, false);
    maybeOnboarding();
  } else {
    processEvents(state);
  }
  if (S.mode && !modeStillValid()) S.mode = null;
  render();
}

function me() {
  return S.state && S.you !== null && S.you !== undefined ? S.state.players[S.you] : null;
}

function colorOf(i) {
  return COLOR_HEX[S.state.players[i].color];
}

function avatar(name, color, extra = '') {
  const hex = COLOR_HEX[color] || color;
  const light = color === 'white' || color === 'yellow';
  return `<div class="avatar" style="background:radial-gradient(circle at 35% 30%, ${hex}, ${shadeHex(hex, -0.45)});${light ? 'color:#3a2a18;text-shadow:none;' : ''}${extra}">${esc((name || '?').trim()[0]?.toUpperCase() || '?')}</div>`;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  r = Math.round(r + (t - r) * p);
  g = Math.round(g + (t - g) * p);
  b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}

function nameOf(i) {
  if (i === S.you) return 'Du';
  return S.state.players[i]?.name ?? '?';
}

function isMyMainPhase() {
  const st = S.state;
  return st && st.phase === 'play' && st.current === S.you && st.turn.rolled && !st.turn.pending && !st.trade && st.turn.freeRoads === 0;
}

function render() {
  const st = S.state;
  if (!st) return;
  $('#island-name').textContent = st.islandName;
  $('#footnote').textContent = `Wer zuerst ${st.vpToWin} Siegpunkte erreicht, gewinnt`;
  const chip = $('#room-chip');
  chip.hidden = !S.room;
  if (S.room) chip.textContent = `RAUM ${S.room.code}`;
  renderPlayers();
  renderTurnCard();
  renderChronicle();
  renderHand();
  renderDev();
  renderBuild();
  renderOverlays();
  updateTargets();
  renderAutoModal();
  if (S.modalKey === 'trade' && S.redrawTrade) {
    if (isMyMainPhase()) S.redrawTrade();
    else closeModal();
  }
  if (S.modalKey === 'counter' && !(st.trade && st.trade.status === 'pending' && st.trade.to === S.you)) closeModal();
}

function renderPlayers() {
  const st = S.state;
  const seats = S.room?.seats || [];
  $('#player-list').innerHTML = st.players.map((p) => {
    const active = st.phase !== 'ended' && p.idx === st.current;
    const vp = p.vp ?? p.publicVP;
    const seat = seats[p.idx];
    const off = seat && !seat.isBot && !seat.connected;
    const discarding = st.turn.pending === 'discard' && st.turn.discards && st.turn.discards[p.idx];
    return `<li class="player ${active ? 'active' : ''}" data-idx="${p.idx}">
      ${avatar(p.name, p.color)}
      <div>
        <div class="pname">${esc(p.idx === S.you ? 'Du' : p.name)}${p.isBot ? '<small>BOT</small>' : ''}</div>
        <div class="phouse">${esc(COLOR_LABEL[p.color] || '')}</div>
      </div>
      <div class="pvp">👑 <b>${vp}</b> / ${st.vpToWin}</div>
      <div class="pstats">
        <span title="Rohstoffkarten">🂠 ${p.resourceCount}</span>
        <span title="Entwicklungskarten">🃏 ${p.devCount}</span>
        <span title="Gespielte Ritter">⚔️ ${p.knights}</span>
        <span title="Längste eigene Straße">🛤️ ${p.longestRoad}</span>
      </div>
      ${off ? '<span class="pstate off">getrennt</span>' : discarding ? '<span class="pstate">wirft ab …</span>' : active ? '<span class="pstate">am Zug</span>' : ''}
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

// ---------- Illustrationen ----------

const ILLUS = {
  house: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="100" rx="56" ry="7" fill="#000" opacity=".15"/><path d="M40 98 L40 58 L70 34 L100 58 L100 98 Z" fill="#ead7ad" stroke="#5a3a22" stroke-width="3"/><path d="M30 60 L70 26 L110 60" fill="none" stroke="#7a2e1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><rect x="88" y="28" width="10" height="20" fill="#6b4a2d"/><path d="M93 22 q6 -8 0 -14 q-6 -6 2 -12" stroke="#bbb" stroke-width="3" fill="none" opacity=".7"/><rect x="62" y="70" width="16" height="28" rx="2" fill="#5a3a22"/><rect x="46" y="64" width="11" height="11" fill="#8fc0d4" stroke="#5a3a22" stroke-width="2"/><rect x="83" y="64" width="11" height="11" fill="#8fc0d4" stroke="#5a3a22" stroke-width="2"/><path d="M20 98 q8 -18 16 0 z M108 98 q8 -22 18 0z" fill="#4f7a3a"/></svg>`,
  road: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="100" rx="56" ry="7" fill="#000" opacity=".15"/><path d="M20 100 L58 40 L82 40 L120 100 Z" fill="#c9a36b"/><path d="M70 44 L70 56 M70 64 L70 78 M70 86 L70 98" stroke="#f4ead3" stroke-width="4"/><rect x="100" y="30" width="5" height="60" fill="#5a3a22"/><path d="M92 36 L122 36 L128 43 L122 50 L92 50 Z" fill="#8a6038"/><path d="M10 100 q14 -30 28 0z" fill="#4f7a3a"/></svg>`,
  robber: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="102" rx="40" ry="6" fill="#000" opacity=".2"/><path d="M70 12 C52 12 46 30 48 44 C40 52 36 70 38 100 L102 100 C104 70 100 52 92 44 C94 30 88 12 70 12 Z" fill="#2a2a30"/><path d="M58 38 C60 28 80 28 82 38 C80 46 60 46 58 38 Z" fill="#111"/><circle cx="64" cy="38" r="2.4" fill="#e6c36b"/><circle cx="76" cy="38" r="2.4" fill="#e6c36b"/><path d="M50 60 L90 60" stroke="#6b4a2d" stroke-width="5"/><rect x="66" y="56" width="8" height="8" fill="#c9a15b"/></svg>`,
  dice: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="100" rx="56" ry="7" fill="#000" opacity=".15"/><g transform="rotate(-12 48 62)"><rect x="22" y="36" width="52" height="52" rx="9" fill="#f6f1e6" stroke="#8f7040" stroke-width="2"/><circle cx="36" cy="50" r="5" fill="#222"/><circle cx="48" cy="62" r="5" fill="#222"/><circle cx="60" cy="74" r="5" fill="#222"/></g><g transform="rotate(14 94 60)"><rect x="70" y="32" width="50" height="50" rx="9" fill="#f6f1e6" stroke="#8f7040" stroke-width="2"/><circle cx="83" cy="45" r="5" fill="#222"/><circle cx="107" cy="45" r="5" fill="#222"/><circle cx="83" cy="69" r="5" fill="#222"/><circle cx="107" cy="69" r="5" fill="#222"/></g></svg>`,
  trade: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="100" rx="50" ry="7" fill="#000" opacity=".15"/><rect x="67" y="22" width="6" height="72" fill="#6b4a2d"/><rect x="50" y="90" width="40" height="8" rx="3" fill="#5a3a22"/><rect x="24" y="26" width="92" height="5" rx="2" fill="#8a6038"/><path d="M30 31 L18 62 L50 62 Z M110 31 L92 62 L124 62 Z" fill="none" stroke="#8a6038" stroke-width="2"/><path d="M14 62 q20 14 40 0 z" fill="#c9a15b"/><path d="M88 62 q20 14 40 0 z" fill="#c9a15b"/><text x="34" y="60" font-size="18" text-anchor="middle">🌾</text><text x="108" y="60" font-size="18" text-anchor="middle">🪨</text></svg>`,
  hourglass: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="102" rx="36" ry="6" fill="#000" opacity=".15"/><rect x="42" y="10" width="56" height="8" rx="3" fill="#6b4a2d"/><rect x="42" y="92" width="56" height="8" rx="3" fill="#6b4a2d"/><path d="M50 18 C50 44 66 50 66 55 C66 60 50 66 50 92 L90 92 C90 66 74 60 74 55 C74 50 90 44 90 18 Z" fill="#f4ead3" stroke="#8f7040" stroke-width="2.5"/><path d="M56 30 L84 30 C80 44 72 48 70 54 C68 48 60 44 56 30 Z" fill="#d9b566"/><path d="M56 90 C58 76 66 72 70 70 C74 72 82 76 84 90 Z" fill="#d9b566"/></svg>`,
  crown: `<svg viewBox="0 0 140 110"><ellipse cx="70" cy="100" rx="50" ry="7" fill="#000" opacity=".15"/><path d="M24 84 L18 34 L46 56 L70 20 L94 56 L122 34 L116 84 Z" fill="#d6a93c" stroke="#8a6320" stroke-width="3"/><rect x="24" y="84" width="92" height="12" rx="3" fill="#b88a2a"/><circle cx="70" cy="60" r="7" fill="#a3261c"/><circle cx="44" cy="68" r="5" fill="#2f5fa8"/><circle cx="96" cy="68" r="5" fill="#3d8a45"/></svg>`,
};

function renderTurnCard() {
  const st = S.state;
  const mine = st.current === S.you;
  const cur = st.players[st.current];
  const m = { who: '', status: `Zug ${Math.max(1, st.turn.number)}`, illus: 'hourglass', caption: '', title: '', desc: '', actions: [] };
  m.who = mine ? 'Dein Zug' : `${esc(cur.name)} ist am Zug`;

  if (st.phase === 'ended') {
    const w = st.players[st.winner];
    m.who = st.winner === S.you ? 'Du hast gewonnen!' : `${esc(w.name)} gewinnt`;
    m.illus = 'crown';
    m.caption = 'Das Spiel ist entschieden';
    m.title = 'Die Insel hat einen Meister';
    m.desc = `${esc(w.name)} erreicht ${w.vp} Siegpunkte.`;
    m.actions.push({ label: '🏆 Ergebnis ansehen', primary: true, fn: () => { S.autoModal = null; renderAutoModal(true); } });
  } else if (st.phase === 'setup') {
    m.status = 'Gründungsphase';
    const second = st.setup.index >= st.players.length;
    if (mine && st.setup.step === 'settlement') {
      m.illus = 'house';
      m.caption = second ? 'Zweite Siedlung' : 'Erste Siedlung';
      m.title = 'Ein Zuhause auf der Insel';
      m.desc = `Wähle eine leuchtende Kreuzung. Die angrenzenden Felder versorgen dich mit Rohstoffen.${second ? ' Diese Siedlung bringt sofort Starterträge.' : ''}`;
    } else if (mine) {
      m.illus = 'road';
      m.caption = 'Gründungsphase';
      m.title = 'Ein Weg ins Ungewisse';
      m.desc = 'Wähle einen leuchtenden Weg neben deiner neuen Siedlung.';
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
      m.desc = `Baue noch ${t.freeRoads} kostenlose Straße${t.freeRoads > 1 ? 'n' : ''}.`;
    } else if (st.trade) {
      m.illus = 'trade';
      m.caption = 'Am Handelstisch';
      m.title = 'Ein Angebot liegt aus';
      m.desc = `Warte auf die Antwort von ${esc(st.players[st.trade.to].name)}.`;
    } else if (!t.rolled) {
      m.illus = 'dice';
      m.caption = 'Der Würfelwurf';
      m.title = 'Lass die Insel sprechen';
      m.desc = 'Würfle. Felder mit der gewürfelten Zahl versorgen alle angrenzenden Siedlungen.';
      m.actions.push({ label: '🎲 Würfeln', primary: true, key: 'R', fn: () => act('roll') });
    } else {
      m.illus = 'house';
      m.caption = 'Bauen & Handeln';
      m.title = 'Was wirst du bauen?';
      m.desc = 'Handle für das, was dir fehlt, verbinde deine Straßen und lass deine Siedlungen wachsen.';
      m.actions.push({ label: '⇄ Handeln', key: 'T', fn: () => openTrade() });
      m.actions.push({ label: 'Zug beenden', primary: true, key: 'E', fn: () => { S.mode = null; act('endTurn'); } });
    }
  } else {
    m.title = 'Ein Moment der Geduld';
    if (st.turn.pending === 'robber') m.desc = `${esc(cur.name)} versetzt den Räuber …`;
    else if (st.trade && st.trade.to !== S.you) m.desc = `${esc(cur.name)} verhandelt mit ${esc(st.players[st.trade.to].name)}.`;
    else m.desc = `${esc(cur.name)} überlegt den nächsten Zug.`;
  }

  const card = $('#turn-card');
  card.innerHTML = `
    <div class="turn-who">${m.who}</div>
    <div class="turn-status">⏳ ${m.status}</div>
    <div class="illus">${ILLUS[m.illus]}</div>
    ${m.caption ? `<div class="illus-caption">${m.caption}</div>` : ''}
    <div class="turn-title">${m.title}</div>
    <p class="turn-desc">${m.desc}</p>
    <div class="turn-actions">${m.actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} block" data-a="${i}">${a.label}${a.key ? ` <small style="opacity:.55;font-family:var(--sans);font-size:10px">${a.key}</small>` : ''}</button>`).join('')}</div>`;
  $$('[data-a]', card).forEach((b) => b.addEventListener('click', () => m.actions[Number(b.dataset.a)].fn()));
  S.turnActions = m.actions;
}

function renderChronicle() {
  const st = S.state;
  const items = st.log.slice(-80).reverse();
  $('#chronicle').innerHTML = items.map((l) => {
    const p = l.player !== null && l.player !== undefined ? st.players[l.player] : null;
    return `<li><span class="li-ico">${LOG_ICON[l.icon] || '📜'}</span><div>${esc(l.text)}
      <div class="li-meta">${p ? `<span class="dot" style="background:${COLOR_HEX[p.color]}"></span>` : ''}${l.turn ? `Zug ${l.turn}` : 'Gründung'}</div></div></li>`;
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
  el.innerHTML = RESOURCES.map((r) => {
    const up = prev && prev.resources && p.resources[r] > prev.resources[r];
    return `<div class="rcard ${p.resources[r] ? '' : 'zero'} ${up ? 'bump' : ''}" title="${RES_LABEL[r]}">
      <span class="lbl">${RES_LABEL[r]}</span><span class="emo">${RES_EMOJI[r]}</span><span class="cnt">${p.resources[r]}</span></div>`;
  }).join('');
}

function devPlayable(card) {
  const st = S.state;
  const p = me();
  if (!p || !p.devCards || st.phase !== 'play' || st.current !== S.you) return false;
  const t = st.turn;
  if (t.devPlayed || t.pending || t.freeRoads > 0 || st.trade || card === 'vp') return false;
  if (card !== 'knight' && !t.rolled) return false;
  return p.devCards.some((c) => c.type === card && c.bought < t.number);
}

function renderDev() {
  const p = me();
  const el = $('#dev-panel');
  const st = S.state;
  if (!p || !p.devCards) {
    el.innerHTML = `<div class="dev-head">Entwicklungskarten <span class="count">${st.devDeckCount}</span></div><div class="dev-empty">Stapel: ${st.devDeckCount} Karten</div>`;
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
    return `<div class="dev-card" title="${esc(DEV_TEXT[t])}"><span class="de">${DEV_EMOJI[t]}</span>
      <div><b>${DEV_LABEL[t]}${g.n > 1 ? ` ×${g.n}` : ''}</b><small>${t === 'vp' ? 'zählt automatisch' : g.fresh ? `${g.fresh} neu – ab nächstem Zug` : 'bereit'}</small></div>
      ${t === 'vp' ? '' : `<button data-dev="${t}" ${can ? '' : 'disabled'}>Ausspielen</button>`}</div>`;
  }).join('');
  el.innerHTML = `<div class="dev-head">🃏 Entwicklungskarten <span class="count">${p.devCards.length}</span></div>
    <div class="dev-list">${cards || `<div class="dev-empty">📜 Deine nächste Chance – kaufe eine Karte. <span>(${st.devDeckCount} im Stapel)</span></div>`}</div>`;
  $$('[data-dev]', el).forEach((b) => b.addEventListener('click', () => playDevCard(b.dataset.dev)));
}

function playDevCard(card) {
  if (card === 'yearOfPlenty') openYearOfPlenty();
  else if (card === 'monopoly') openMonopoly();
  else act('playDev', { card });
}

const BUILDS = [
  { kind: 'road', icon: '🛤️', label: 'Straße', cost: COSTS.road },
  { kind: 'settlement', icon: '🏠', label: 'Siedlung', cost: COSTS.settlement },
  { kind: 'city', icon: '🏰', label: 'Stadt', cost: COSTS.city },
  { kind: 'dev', icon: '🃏', label: 'Karte kaufen', cost: COSTS.dev },
];

function costStr(cost) {
  return RESOURCES.flatMap((r) => Array(cost[r] || 0).fill(RES_EMOJI[r])).join('');
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

function renderBuild() {
  const p = me();
  $('#build-buttons').innerHTML = BUILDS.map((b) => {
    const stock = p && b.kind !== 'dev' ? `${p.stock[b.kind]} übrig` : `${S.state.devDeckCount} im Stapel`;
    return `<button class="bbtn ${S.mode === b.kind ? 'active' : ''}" data-build="${b.kind}" ${buildAvailable(b.kind) ? '' : 'disabled'} title="${b.label}: ${costStr(b.cost)}">
      <span class="bi">${b.icon}</span><span class="bl">${b.label}</span><span class="bc">${costStr(b.cost)}</span><span class="stock">${stock}</span></button>`;
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
  $('#round-info').textContent = st.phase === 'setup'
    ? `Gründungsphase · ${st.current === S.you ? 'Du bist dran' : `${cur.name} ist dran`}`
    : st.phase === 'ended' ? 'Partie beendet' : `Runde ${st.turn.round} · ${st.current === S.you ? 'Dein Zug' : `${cur.name} ist am Zug`}`;
  const dice = st.turn.dice || [...st.events].reverse().find((e) => e.type === 'roll')?.dice;
  const chip = $('#dice-chip');
  chip.hidden = !dice;
  if (dice) chip.innerHTML = `🎲 ${dice[0] + dice[1]} <small>${dice[0]} + ${dice[1]}</small>`;
}

// ---------- Ziele & Auswahl auf dem Brett ----------

function computeTargets() {
  const st = S.state;
  const i = S.you;
  if (!st || i === null || i === undefined || st.phase === 'ended') return [null, []];
  if (st.phase === 'setup') {
    if (st.current !== i) return [null, []];
    return st.setup.step === 'settlement'
      ? ['vertex', validSettlementSpots(st, i, true)]
      : ['edge', validRoadSpots(st, i, st.setup.lastVertex)];
  }
  if (st.current !== i) return [null, []];
  if (st.turn.pending === 'robber') return ['hex', robberHexes(st)];
  if (st.turn.pending || st.trade) return [null, []];
  if (st.turn.freeRoads > 0) return ['edge', validRoadSpots(st, i)];
  if (S.mode === 'road') return ['edge', validRoadSpots(st, i)];
  if (S.mode === 'settlement') return ['vertex', validSettlementSpots(st, i)];
  if (S.mode === 'city') return ['vertex', validCitySpots(st, i)];
  return [null, []];
}

function updateTargets() {
  const [kind, ids] = computeTargets();
  S.board.setTargets(kind, ids);
  const el = $('#placements');
  el.hidden = !kind;
  if (kind) {
    const what = { vertex: 'mögliche Plätze', edge: 'mögliche Wege', hex: 'mögliche Felder' }[kind];
    el.textContent = `${ids.length} ${what}${S.mode ? ' · Esc zum Abbrechen' : ''}`;
  }
}

function onPick(kind, id) {
  const st = S.state;
  if (!st) return;
  $('#tooltip').hidden = true;
  if (kind === 'vertex') {
    if (st.phase === 'setup') act('placeSettlement', { vertex: id });
    else if (S.mode === 'settlement') act('buildSettlement', { vertex: id });
    else if (S.mode === 'city') act('buildCity', { vertex: id });
    S.mode = null;
  } else if (kind === 'edge') {
    if (st.phase === 'setup') act('placeRoad', { edge: id });
    else act('buildRoad', { edge: id });
    if (S.mode === 'road') S.mode = null;
  } else if (kind === 'hex') {
    const cands = stealCandidates(st, id, S.you);
    if (cands.length <= 1) act('moveRobber', { hex: id, victim: cands[0] });
    else openStealChooser(id, cands);
  }
}

function showTooltip(info) {
  const tip = $('#tooltip');
  const st = S.state;
  if (!info || !st || (info.kind !== 'vertex' && info.kind !== 'hex')) { tip.hidden = true; return; }
  let html = '';
  if (info.kind === 'vertex') {
    const v = st.board.vertices[info.id];
    const isCity = S.mode === 'city';
    const rows = v.hexes.map((h) => st.board.hexes[h]).map((h) => {
      const r = TERRAIN_RESOURCE[h.terrain];
      const blocked = h.id === st.robber;
      return `<div class="tres"><span class="e">${r ? RES_EMOJI[r] : TERRAIN_EMOJI.desert}</span>
        <span class="n">${r ? RES_LABEL[r] : 'Wüste'}<small>${r ? `${isCity ? 2 : 1} Karte · Chance ${'●'.repeat(PIPS[h.number])}${blocked ? ' · Räuber!' : ''}` : 'kein Ertrag'}</small></span>
        ${h.number ? `<span class="tnum ${h.number === 6 || h.number === 8 ? 'red' : ''}">${h.number}</span>` : ''}</div>`;
    }).join('');
    const harbor = v.harbor ? `<div class="foot">⚓ Hafen: ${v.harbor === 'any' ? 'alles 3:1' : `${RES_LABEL[v.harbor]} 2:1`}</div>` : '';
    html = `<h4>${isCity ? '🏰 Stadtausbau' : '🏠 Siedlungsplatz'}</h4><div class="sub">${isCity ? 'Doppelter Ertrag nach dem Ausbau' : 'Rohstoffe nach dem Bauen'}</div>${rows}${harbor}
      ${isCity ? '' : '<div class="foot">Zu jeder Siedlung bleibt mindestens eine Kreuzung frei.</div>'}`;
  } else {
    const h = st.board.hexes[info.id];
    const cands = stealCandidates(st, info.id, S.you);
    html = `<h4>🥷 Räuber hierher</h4><div class="sub">${TERRAIN_LABEL[h.terrain]}${h.number ? ` · Zahl ${h.number}` : ''}</div>
      <div class="foot">${cands.length ? `Stehlen möglich bei: ${cands.map((c) => esc(st.players[c].name)).join(', ')}` : 'Hier kannst du niemanden bestehlen.'}</div>`;
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const wrap = $('#board-wrap').getBoundingClientRect();
  const x = Math.min(info.x + 18, wrap.width - 240);
  const y = Math.min(info.y + 12, wrap.height - tip.offsetHeight - 10);
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

// ---------- Ereignisse (Würfel, Diebstahl, Bau …) ----------

function processEvents(state) {
  const fresh = state.events.filter((e) => e.seq > S.lastSeq);
  S.lastSeq = state.seq;
  for (const ev of fresh) handleEvent(ev, state);
}

function handleEvent(ev, st) {
  const mine = (i) => i === S.you;
  switch (ev.type) {
    case 'roll': {
      play('dice');
      const sum = ev.dice[0] + ev.dice[1];
      S.board.showDice(ev.dice).then(() => {
        if (ev.robber) {
          play('robber');
          boardToast({ num: 7, red: true, title: 'Der Räuber erwacht', text: 'Keine Erträge. Wer mehr als 7 Karten hat, gibt die Hälfte ab.' });
        } else {
          const g = ev.gains[S.you];
          const gains = g ? RESOURCES.filter((r) => g[r]).map((r) => `+${g[r]} ${RES_EMOJI[r]} ${RES_LABEL[r]}`) : [];
          const who = Object.keys(ev.gains).length;
          boardToast({
            num: sum, red: sum === 6 || sum === 8, title: 'Die Insel liefert',
            text: gains.length ? '' : who ? `${who} Siedler erhalten Rohstoffe.` : 'Diesmal bringt kein Feld Ertrag.',
            gains,
          });
          if (g) play('coin');
          for (const [pi, gg] of Object.entries(ev.gains)) popOnPlayer(Number(pi), `+${resCount(gg)}`);
        }
      });
      break;
    }
    case 'steal': {
      let text;
      if (mine(ev.thief)) text = `Du stiehlst ${ev.res ? `1 ${RES_EMOJI[ev.res]} ${RES_LABEL[ev.res]}` : 'eine Karte'} von ${esc(st.players[ev.victim].name)}.`;
      else if (mine(ev.victim)) text = `${esc(st.players[ev.thief].name)} stiehlt dir ${ev.res ? `1 ${RES_EMOJI[ev.res]} ${RES_LABEL[ev.res]}` : 'eine Karte'}.`;
      else text = `${esc(st.players[ev.thief].name)} stiehlt eine Karte von ${esc(st.players[ev.victim].name)}.`;
      banner('Eine Karte wurde gestohlen', text);
      popOnPlayer(ev.victim, '−1', true);
      popOnPlayer(ev.thief, '+1');
      break;
    }
    case 'robber':
      play('robber');
      break;
    case 'build':
      play(ev.kind === 'city' ? 'city' : 'build');
      break;
    case 'buyDev':
      play('card');
      if (mine(ev.player) && ev.card) boardToast({ icon: DEV_EMOJI[ev.card], title: `Neue Karte: ${DEV_LABEL[ev.card]}`, text: DEV_TEXT[ev.card] });
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
      if (mine(ev.a) || mine(ev.b)) boardToast({ icon: '🤝', title: 'Handel abgeschlossen', text: `${esc(nameOf(ev.a))} und ${esc(nameOf(ev.b))} tauschen.` });
      break;
    case 'tradeDeclined':
      if (mine(ev.from)) boardToast({ icon: '✋', title: 'Angebot abgelehnt', text: `${esc(st.players[ev.to].name)} möchte nicht tauschen.` });
      break;
    case 'bankTrade':
      play('coin');
      break;
    case 'award':
      banner(ev.award === 'longestRoad' ? '🛤️ Längste Handelsstraße' : '⚔️ Größte Rittermacht', `${mine(ev.player) ? 'Du erhältst' : `${esc(st.players[ev.player].name)} erhält`} 2 Siegpunkte.`);
      break;
    case 'turn':
      if (mine(ev.player)) { play('turn'); banner('Du bist am Zug', 'Würfle, um die Insel sprechen zu lassen.'); }
      break;
    case 'win':
      play('win');
      break;
    default:
  }
}

// Kleine „+2“-Anzeigen an den Spielern; überleben Neu-Renderings dank negativer Animationsverzögerung
S.pops = [];
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

function boardToast({ num, red, icon, title, text, gains = [] }) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${num ? `<span class="num ${red ? 'red' : ''}">${num}</span>` : `<span class="num">${icon || '📜'}</span>`}
    <div><b>${esc(title)}</b>${text ? `<small>${text}</small>` : ''}${gains.length ? `<div class="gains">${gains.map((g) => `<span>${g}</span>`).join('')}</div>` : ''}</div>
    <button class="close" aria-label="Schließen">✕</button>`;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.querySelector('.close').addEventListener('click', kill);
  setTimeout(kill, 4200);
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

// ---------- Modals ----------

function openModal(key, html, { wide = false, closable = true, onClose } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal parchment ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    ${closable ? '<button class="modal-close" aria-label="Schließen">✕</button>' : ''}${html}</div></div>`;
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
}

// Modals, die sich aus dem Spielzustand ergeben (Abwerfen, Handelsangebote, Sieg)
function desiredAutoModal() {
  const st = S.state;
  if (!st || S.you === null || S.you === undefined) return st && st.phase === 'ended' ? 'winner' : null;
  if (st.phase === 'ended') return 'winner';
  if (st.turn.pending === 'discard' && st.turn.discards?.[S.you]) return `discard:${st.turn.number}`;
  const t = st.trade;
  if (t) {
    if (t.status === 'pending' && t.to === S.you) return `incoming:${t.id}`;
    if (t.status === 'pending' && t.from === S.you) return `waiting:${t.id}`;
    if (t.status === 'countered' && t.from === S.you) return `countered:${t.id}`;
    if (t.status === 'countered' && t.to === S.you) return `counterwait:${t.id}`;
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
  if (S.modalKey === 'counter' && want.startsWith('incoming')) return; // Gegenangebot wird gerade erstellt
  S.autoModal = want;
  const [kind] = want.split(':');
  const dismiss = () => { S.dismissedAuto = want; };
  if (kind === 'discard') openDiscard();
  else if (kind === 'incoming') openIncoming();
  else if (kind === 'waiting') openWaiting();
  else if (kind === 'countered') openCountered();
  else if (kind === 'counterwait') openCounterWait();
  else if (kind === 'winner') openWinner(dismiss);
  S.autoModal = want;
}

function resList(res) {
  const parts = RESOURCES.filter((r) => res[r]).map((r) => `${res[r]} ${RES_EMOJI[r]} ${RES_LABEL[r]}`);
  return parts.length ? parts.join(', ') : '—';
}

function pickGrid(id, { counts, have, max, disabled = () => false, showHave = true, note = () => '' }) {
  return `<div class="pick-grid" id="${id}">${RESOURCES.map((r) => `
    <button class="pick ${counts[r] ? 'on' : ''}" data-r="${r}" ${disabled(r) ? 'disabled' : ''}>
      ${counts[r] ? `<span class="sel">${counts[r]}</span>` : ''}
      <span class="emo">${RES_EMOJI[r]}</span><span class="lbl">${RES_LABEL[r]}</span>
      ${showHave ? `<span class="have">${have ? `${have[r]} auf der Hand` : ''}${note(r)}</span>` : `<span class="have">${note(r)}</span>`}
      ${counts[r] ? `<span class="minus" data-minus="${r}">−</span>` : ''}
    </button>`).join('')}</div>`;
}

function bindPickGrid(root, id, onChange) {
  $$(`#${id} .pick`, root).forEach((b) => b.addEventListener('click', (e) => {
    const r = b.dataset.r;
    const minus = e.target.closest('[data-minus]');
    onChange(r, minus ? -1 : 1);
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
      <div class="modal-lede"><span class="big-emo">🥷</span><div><b>Wirf ${need} Karten ab</b><span class="hint">Du hältst mehr als 7 Karten. Die Hälfte geht zurück an die Bank.</span></div></div>
      ${pickGrid('discard-grid', { counts: sel, have: p.resources, disabled: (r) => p.resources[r] - sel[r] <= 0 && !sel[r] })}
      <div class="modal-actions"><span class="hint" style="margin-right:auto">${total} / ${need} gewählt</span>
      <button class="btn primary" id="discard-ok" ${total === need ? '' : 'disabled'}>Abwerfen</button></div>`, { closable: false });
    bindPickGrid(m, 'discard-grid', (r, d) => {
      if (d > 0 && (sel[r] >= p.resources[r] || resCount(sel) >= need)) return;
      sel[r] = Math.max(0, sel[r] + d);
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
  const m = openModal(S.autoModal, `
    <h2>Ein Angebot für dich</h2>
    <div class="modal-lede">${avatar(from.name, from.color)}<div><b>${esc(from.name)} schlägt einen Handel vor</b><span class="hint">Du kannst annehmen, ein Gegenangebot machen oder ablehnen.</span></div></div>
    <div class="trade-summary">
      <div class="side"><small>Du erhältst</small><div class="items">${resList(t.give)}</div></div>
      <div>⇄</div>
      <div class="side"><small>Du gibst</small><div class="items">${resList(t.get)}</div></div>
    </div>
    ${canAccept ? '' : '<p class="hint" style="text-align:center">Dir fehlen die gewünschten Karten.</p>'}
    <div class="modal-actions">
      <button class="btn danger" id="tr-decline">Ablehnen</button>
      <button class="btn" id="tr-counter">Gegenangebot</button>
      <button class="btn primary" id="tr-accept" ${canAccept ? '' : 'disabled'}>Annehmen</button>
    </div>`, { closable: false });
  $('#tr-accept', m).addEventListener('click', () => act('respondTrade', { response: 'accept' }));
  $('#tr-decline', m).addEventListener('click', () => act('respondTrade', { response: 'decline' }));
  $('#tr-counter', m).addEventListener('click', () => openTrade({ counter: true }));
}

function openWaiting() {
  const st = S.state;
  const t = st.trade;
  const to = st.players[t.to];
  const you = me();
  const m = openModal(S.autoModal, `
    <h2>Warte auf Antwort</h2>
    <div class="modal-lede"><span class="big-emo">🤝</span><div><b>Ein Vorschlag für ${esc(to.name)}</b><span class="hint">Deine Karten bleiben auf der Hand, bis das Angebot angenommen wird.</span></div></div>
    <div class="trade-summary">
      <div class="side">${avatar(you.name, you.color, 'margin:0 auto')}<b>Du</b><small>gibst</small><div class="items">${resList(t.give)}</div></div>
      <div>⇄</div>
      <div class="side">${avatar(to.name, to.color, 'margin:0 auto')}<b>${esc(to.name)}</b><small>gibt</small><div class="items">${resList(t.get)}</div></div>
    </div>
    <div class="modal-actions"><button class="btn primary block" id="tr-cancel">Angebot zurückziehen</button></div>`, { closable: false });
  $('#tr-cancel', m).addEventListener('click', () => act('cancelTrade'));
}

function openCountered() {
  const st = S.state;
  const t = st.trade;
  const to = st.players[t.to];
  const p = me();
  const canAccept = hasRes(p.resources, t.counter.get);
  const m = openModal(S.autoModal, `
    <h2>Ein Gegenangebot</h2>
    <div class="modal-lede">${avatar(to.name, to.color)}<div><b>${esc(to.name)} hat andere Vorstellungen</b><span class="hint">Nimm das Gegenangebot an oder lehne ab.</span></div></div>
    <div class="trade-summary">
      <div class="side"><small>Du erhältst</small><div class="items">${resList(t.counter.give)}</div></div>
      <div>⇄</div>
      <div class="side"><small>Du gibst</small><div class="items">${resList(t.counter.get)}</div></div>
    </div>
    <div class="modal-actions">
      <button class="btn danger" id="tr-decline">Ablehnen</button>
      <button class="btn primary" id="tr-accept" ${canAccept ? '' : 'disabled'}>Annehmen</button>
    </div>`, { closable: false });
  $('#tr-accept', m).addEventListener('click', () => act('respondTrade', { response: 'accept' }));
  $('#tr-decline', m).addEventListener('click', () => act('respondTrade', { response: 'decline' }));
}

function openCounterWait() {
  const st = S.state;
  openModal(S.autoModal, `
    <h2>Dein Gegenangebot liegt aus</h2>
    <div class="modal-lede"><span class="big-emo">⏳</span><div><b>${esc(st.players[st.trade.from].name)} entscheidet …</b>
    <span class="hint">Du gibst ${resList(st.trade.counter.give)} und erhältst ${resList(st.trade.counter.get)}.</span></div></div>`, { closable: false });
}

// Handelstisch: Bank & Häfen oder Mitspieler; auch für Gegenangebote
function openTrade({ counter = false } = {}) {
  if (!me()) return;
  if (!counter && !isMyMainPhase()) { toast('Handeln ist nur in deinem Zug nach dem Würfeln möglich.'); return; }
  const st0 = S.state;
  const T = {
    partner: counter ? st0.trade.from : 'bank',
    give: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
    get: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
  };
  if (counter) {
    for (const r of RESOURCES) { T.give[r] = st0.trade.get[r] || 0; T.get[r] = st0.trade.give[r] || 0; }
  }
  const draw = () => {
    const st = S.state;
    const p = me();
    const others = st.players.filter((o) => o.idx !== S.you);
    const ratios = harborRatios(st, S.you);
    for (const r of RESOURCES) T.give[r] = Math.min(T.give[r], p.resources[r] - (p.resources[r] % (T.partner === 'bank' ? ratios[r] : 1)));
    const bank = T.partner === 'bank';
    const partner = bank ? null : st.players[T.partner];
    let valid = resCount(T.give) > 0 && resCount(T.get) > 0 && hasRes(p.resources, T.give) && !RESOURCES.some((r) => T.give[r] && T.get[r]);
    let note = '';
    if (bank) {
      let credits = 0;
      let ok = true;
      for (const r of RESOURCES) {
        if (T.give[r] % ratios[r]) ok = false;
        credits += Math.floor(T.give[r] / ratios[r]);
      }
      if (!ok) { valid = false; note = 'Gib jeden Rohstoff in vollen Paketen (z. B. 4:1, 3:1, 2:1).'; }
      else if (credits !== resCount(T.get)) { valid = false; note = `Du kannst ${credits} Karte${credits === 1 ? '' : 'n'} aus der Bank wählen.`; }
      else note = 'Die Bank tauscht sofort.';
      if (!hasRes(st.bank, T.get)) { valid = false; note = 'Die Bank hat nicht genug davon.'; }
    } else {
      note = `${esc(partner.name)} kann annehmen, ein Gegenangebot machen oder ablehnen. Die Hand bleibt geheim.`;
    }
    const partnerTabs = counter ? '' : `<div class="partner-tabs">
      <button class="partner ${bank ? 'active' : ''}" data-partner="bank"><span class="avatar" style="background:#6b4a2d">⚓</span><div><b>Bank & Häfen</b><small>Tausch mit dem Hafen</small></div></button>
      ${others.map((o) => `<button class="partner ${T.partner === o.idx ? 'active' : ''}" data-partner="${o.idx}">${avatar(o.name, o.color)}<div><b>${esc(o.name)}</b><small>${o.resourceCount} Karten</small></div></button>`).join('')}
    </div>`;
    const m = openModal(counter ? 'counter' : 'trade', `
      <h2>${counter ? 'Gegenangebot' : 'Der Handelstisch'}</h2>
      <div class="modal-lede"><span class="big-emo">⚖️</span><div><span class="eyebrow">Ein guter Tausch, eine wachsende Insel</span><b>Schaffe Raum für Möglichkeiten.</b><span class="hint">Wähle deinen Handelspartner und lege deine Karten auf den Tisch.</span></div></div>
      ${partnerTabs}
      <div class="trade-summary">
        <div class="side">${avatar(p.name, p.color, 'margin:0 auto')}<b>Du</b><small>gibst</small><div class="items">${resList(T.give)}</div></div>
        <div>⇄</div>
        <div class="side">${bank ? '<span class="avatar" style="background:#6b4a2d;margin:0 auto">⚓</span><b>Bank</b>' : `${avatar(partner.name, partner.color, 'margin:0 auto')}<b>${esc(partner.name)}</b>`}<small>gibt</small><div class="items">${resList(T.get)}</div></div>
      </div>
      <div class="trade-cols">
        <div><h3>📤 Dein Angebot</h3>${pickGrid('give-grid', { counts: T.give, have: p.resources, disabled: (r) => !p.resources[r], note: (r) => (bank ? ` · ${ratios[r]}:1` : '') })}</div>
        <div><h3>📥 Dein Wunsch</h3>${pickGrid('get-grid', { counts: T.get, showHave: false, disabled: (r) => T.give[r] > 0 || (bank && st.bank[r] <= 0), note: (r) => (bank ? `${st.bank[r]} in der Bank` : 'anfragen') })}</div>
      </div>
      <p class="trade-note">${note}</p>
      <div class="modal-actions">
        <button class="btn ghost" id="tr-reset">Zurücksetzen</button>
        <button class="btn primary" id="tr-submit" ${valid ? '' : 'disabled'}>${counter ? 'Gegenangebot senden' : bank ? 'Mit der Bank tauschen' : `Handel an ${esc(partner.name)} anbieten`}</button>
      </div>`, { wide: true, onClose: () => { if (counter) { S.autoModal = null; renderAutoModal(true); } } });
    $$('[data-partner]', m).forEach((b) => b.addEventListener('click', () => {
      T.partner = b.dataset.partner === 'bank' ? 'bank' : Number(b.dataset.partner);
      draw();
    }));
    bindPickGrid(m, 'give-grid', (r, d) => {
      const step = T.partner === 'bank' ? harborRatios(S.state, S.you)[r] : 1;
      const p = me();
      const next = T.give[r] + d * step;
      if (next < 0 || next > p.resources[r]) return;
      T.give[r] = next;
      if (next) T.get[r] = 0;
      draw();
    });
    bindPickGrid(m, 'get-grid', (r, d) => {
      T.get[r] = Math.max(0, T.get[r] + d);
      draw();
    });
    $('#tr-reset', m).addEventListener('click', () => { for (const r of RESOURCES) { T.give[r] = 0; T.get[r] = 0; } draw(); });
    $('#tr-submit', m).addEventListener('click', () => {
      const give = Object.fromEntries(RESOURCES.filter((r) => T.give[r]).map((r) => [r, T.give[r]]));
      const get = Object.fromEntries(RESOURCES.filter((r) => T.get[r]).map((r) => [r, T.get[r]]));
      if (counter) {
        act('respondTrade', { response: 'counter', give, get });
        closeModal();
      } else if (T.partner === 'bank') {
        act('bankTrade', { give, get });
        // Tisch bleibt offen für weitere Tauschgeschäfte; neu gezeichnet beim nächsten Zustand
        for (const r of RESOURCES) { T.give[r] = 0; T.get[r] = 0; }
      } else {
        act('offerTrade', { to: T.partner, give, get });
        closeModal();
      }
    });
  };
  S.redrawTrade = counter ? null : draw;
  draw();
}

function openStealChooser(hex, cands) {
  const st = S.state;
  const m = openModal('steal', `
    <h2>Von wem stehlen?</h2>
    <p>Mehrere Nachbarn grenzen an dieses Feld. Wähle, wem du eine zufällige Karte abnimmst.</p>
    <div class="partner-tabs">${cands.map((c) => {
      const o = st.players[c];
      return `<button class="partner" data-victim="${c}">${avatar(o.name, o.color)}<div><b>${esc(o.name)}</b><small>${o.resourceCount} Karten · ${o.publicVP} Punkte</small></div></button>`;
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
      <h2>🎁 Erfindung</h2><p>Nimm dir zwei beliebige Rohstoffe aus der Bank.</p>
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
    <h2>💰 Monopol</h2><p>Wähle einen Rohstoff. Alle Mitspieler geben dir sämtliche Karten davon.</p>
    ${pickGrid('mono-grid', { counts: {}, showHave: false })}`);
  bindPickGrid(m, 'mono-grid', (r) => {
    act('playDev', { card: 'monopoly', resource: r });
    closeModal();
  });
}

function openWinner(onDismiss) {
  const st = S.state;
  const ranked = [...st.players].sort((a, b) => (b.vp ?? b.publicVP) - (a.vp ?? a.publicVP));
  const isHost = S.room && S.room.host === S.you;
  const w = st.players[st.winner];
  const m = openModal('winner', `
    <div class="illus">${ILLUS.crown}</div>
    <h2 style="text-align:center">${st.winner === S.you ? 'Du hast gewonnen!' : `${esc(w.name)} gewinnt!`}</h2>
    <p style="text-align:center">Nach ${st.turn.number} Zügen ist die Insel entschieden.</p>
    <ol class="winner-list">${ranked.map((p, i) => `<li class="${i === 0 ? 'first' : ''}">${avatar(p.name, p.color)}<b>${esc(p.idx === S.you ? 'Du' : p.name)}</b>
      <span class="hint">${p.knights} Ritter · ${p.longestRoad} Straßen</span><span class="vp">${p.vp ?? p.publicVP}</span></li>`).join('')}</ol>
    <div class="modal-actions">
      <button class="btn ghost" id="w-menu">Zum Menü</button>
      ${isHost ? '<button class="btn primary" id="w-again">Neue Partie</button>' : '<span class="hint">Der Gastgeber kann eine neue Partie starten.</span>'}
    </div>`, { onClose: onDismiss });
  $('#w-menu', m).addEventListener('click', () => send({ t: 'leave' }));
  $('#w-again', m)?.addEventListener('click', () => { closeModal(); send({ t: 'rematch' }); });
}

const RULES = [
  {
    tab: '1 · Der Anfang', html: `<h3>Ein Platz zum Beginnen</h3>
    <p>Reihum setzt jeder eine <b>Siedlung</b> auf eine Kreuzung und eine angrenzende <b>Straße</b>. Danach geht es in umgekehrter Reihenfolge weiter: Jeder setzt eine zweite Siedlung mit Straße.</p>
    <p>Die zweite Siedlung bringt sofort je einen Rohstoff der angrenzenden Felder.</p>
    <ul><li><b>Abstandsregel:</b> Zwischen zwei Siedlungen muss immer mindestens eine freie Kreuzung liegen.</li><li>Später darfst du nur dort bauen, wo deine Straßen hinführen.</li></ul>`,
  },
  {
    tab: '2 · Die Insel liefert', html: `<h3>Würfeln und Ernten</h3>
    <p>Zu Beginn deines Zuges würfelst du mit zwei Würfeln. Jedes Feld mit dieser Zahl liefert Rohstoffe an alle angrenzenden Siedlungen (1 Karte) und Städte (2 Karten).</p>
    <ul><li>🌲 Wald → 🪵 Holz</li><li>🧱 Hügelland → 🧱 Lehm</li><li>🐑 Weideland → 🐑 Wolle</li><li>🌾 Ackerland → 🌾 Getreide</li><li>⛰️ Gebirge → 🪨 Erz</li><li>🏜️ Wüste bringt nichts.</li></ul>
    <p>Die Punkte unter den Zahlen zeigen die Wahrscheinlichkeit: 6 und 8 fallen am häufigsten.</p>`,
  },
  {
    tab: '3 · Handel & Bau', html: `<h3>Handeln</h3>
    <p>Nach dem Würfeln darfst du mit Mitspielern frei verhandeln oder mit der Bank tauschen: 4:1 immer, 3:1 an einem allgemeinen Hafen, 2:1 an einem Spezialhafen für den jeweiligen Rohstoff.</p>
    <h3>Baukosten</h3>
    <table class="cost-table">
      <tr><td>🛤️ Straße</td><td>${costStr(COSTS.road)}</td></tr>
      <tr><td>🏠 Siedlung (1 Punkt)</td><td>${costStr(COSTS.settlement)}</td></tr>
      <tr><td>🏰 Stadt (2 Punkte, ersetzt Siedlung)</td><td>${costStr(COSTS.city)}</td></tr>
      <tr><td>🃏 Entwicklungskarte</td><td>${costStr(COSTS.dev)}</td></tr>
    </table>
    <p>Vorrat pro Spieler: 15 Straßen, 5 Siedlungen, 4 Städte.</p>`,
  },
  {
    tab: '4 · Der Räuber', html: `<h3>Wenn eine 7 fällt</h3>
    <p>Niemand erhält Rohstoffe. Wer mehr als 7 Karten hat, wirft die Hälfte (abgerundet) ab. Dann versetzt der Würfelnde den Räuber auf ein anderes Feld und zieht eine zufällige Karte von einem Gegner, der dort angrenzt.</p>
    <p>Solange der Räuber auf einem Feld steht, liefert es nichts.</p>`,
  },
  {
    tab: '5 · Karten & Siegpunkte', html: `<h3>Entwicklungskarten</h3>
    <ul>${Object.keys(DEV_LABEL).map((k) => `<li>${DEV_EMOJI[k]} <b>${DEV_LABEL[k]}:</b> ${DEV_TEXT[k]}</li>`).join('')}</ul>
    <p>Pro Zug darfst du eine Karte ausspielen – nicht in dem Zug, in dem du sie gekauft hast. Einen Ritter darfst du auch vor dem Würfeln spielen.</p>
    <h3>Siegpunkte</h3>
    <ul><li>Siedlung 1 · Stadt 2 · Siegpunktkarte 1</li><li>🛤️ Längste Handelsstraße (mind. 5 zusammenhängende Straßen): 2</li><li>⚔️ Größte Rittermacht (mind. 3 Ritter): 2</li></ul>
    <p>Wer in seinem Zug die Zielpunktzahl erreicht, gewinnt sofort.</p>`,
  },
];

function openRules(tab = 0) {
  const m = openModal('rules', `
    <div class="rules-hero"><div class="art">🏘️</div><div><div class="eyebrow">Ein Leitfaden für die Insel</div>
      <h2>Von der ersten Hütte zum Inselerbe.</h2>
      <p>Sammle Rohstoffe, handle mit deinen Nachbarn und baue dich zu ${S.state?.vpToWin || 10} Siegpunkten – in deinem eigenen Zug.</p></div></div>
    <div class="rules-tabs">${RULES.map((r, i) => `<button class="rules-tab ${i === tab ? 'active' : ''}" data-tab="${i}">${r.tab}</button>`).join('')}</div>
    <div class="rules-body">${RULES[tab].html}</div>`, { wide: true });
  $$('[data-tab]', m).forEach((b) => b.addEventListener('click', () => openRules(Number(b.dataset.tab))));
}

const TOUR = [
  { art: '🌲 → 🤝 → 🏠', title: 'Deine Insel, deine Geschichte', text: 'Sammle Rohstoffe, handle mit deinen Nachbarn und baue. Wer zuerst die Zielpunktzahl erreicht, gewinnt.' },
  { art: '🏠', title: 'Ein Zuhause. Benachbarte Felder.', text: 'Siedlungen stehen auf Kreuzungen. Jedes angrenzende Feld liefert Rohstoffe, wenn seine Zahl gewürfelt wird. Fahre mit der Maus über einen leuchtenden Platz, um zu sehen, was er bringt.' },
  { art: '🎲 🌾 🪨', title: 'Würfeln und ernten', text: 'Zu Beginn deines Zuges würfelst du. 6 und 8 fallen am häufigsten – rote Zahlen sind wertvoll. Bei einer 7 erwacht der Räuber.' },
  { art: '🛤️ 🏰 👑', title: 'Wachsen und gewinnen', text: 'Baue Straßen zu neuen Plätzen, erweitere Siedlungen zu Städten und kaufe Entwicklungskarten. Die Kamera steuerst du per Ziehen, Scrollen und WASD.' },
];

function openTour(step = 0) {
  const t = TOUR[step];
  const m = openModal('tour', `
    <div class="eyebrow">Einführung · ${step + 1} von ${TOUR.length}</div>
    <h2 style="text-align:center;margin-top:10px">${t.title}</h2>
    <div class="tour-art">${t.art}</div>
    <p style="text-align:center">${t.text}</p>
    <div class="modal-actions" style="align-items:center">
      <div class="tour-dots" style="margin-right:auto">${TOUR.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn ghost" id="tour-skip">Überspringen</button>
      ${step ? '<button class="btn" id="tour-back">Zurück</button>' : ''}
      <button class="btn primary" id="tour-next">${step === TOUR.length - 1 ? 'Los geht’s' : 'Weiter'}</button>
    </div>`, { onClose: () => store.set('tourDone', '1') });
  const done = () => { store.set('tourDone', '1'); closeModal(); renderAutoModal(true); };
  $('#tour-skip', m).addEventListener('click', done);
  $('#tour-back', m)?.addEventListener('click', () => openTour(step - 1));
  $('#tour-next', m).addEventListener('click', () => (step === TOUR.length - 1 ? done() : openTour(step + 1)));
}

function maybeOnboarding() {
  if (!store.get('tourDone') && S.state.phase === 'setup') openTour(0);
}

function openMenu() {
  const inRoom = !!S.room;
  const m = openModal('menu', `
    <h2>Menü</h2>
    ${inRoom ? `<p>Raumcode: <b style="letter-spacing:.15em">${S.room.code}</b> – teile den Link, damit andere zuschauen oder beitreten können.</p>` : ''}
    <div style="display:grid;gap:8px;margin-top:12px">
      ${inRoom ? '<button class="btn" id="m-copy">🔗 Einladungslink kopieren</button>' : ''}
      <button class="btn" id="m-tour">🧭 Einführung ansehen</button>
      <button class="btn" id="m-rules">📖 Regeln</button>
      <button class="btn" id="m-sound">${isSoundOn() ? '🔊 Ton ausschalten' : '🔈 Ton einschalten'}</button>
      <button class="btn danger" id="m-leave">🚪 Partie verlassen</button>
    </div>
    <h3>Tastenkürzel</h3>
    <p class="hint">R Würfeln · E Zug beenden · T Handeln · Esc Abbrechen · WASD Kamera schwenken · Leertaste + Ziehen schwenken</p>`);
  $('#m-copy', m)?.addEventListener('click', copyInvite);
  $('#m-tour', m).addEventListener('click', () => openTour(0));
  $('#m-rules', m).addEventListener('click', () => openRules(0));
  $('#m-sound', m).addEventListener('click', () => { toggleSound(); updateSoundBtn(); openMenu(); });
  $('#m-leave', m).addEventListener('click', () => {
    if (confirm('Partie wirklich verlassen? Ein Bot übernimmt deinen Platz.')) send({ t: 'leave' });
  });
}

function updateSoundBtn() {
  $('#btn-sound').textContent = isSoundOn() ? '🔊' : '🔈';
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
  $('#btn-menu').addEventListener('click', openMenu);
  $('#btn-sound').addEventListener('click', () => { toggleSound(); updateSoundBtn(); });
  $('#room-chip').addEventListener('click', copyInvite);
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
    send({ t: 'chat', text });
    $('#chat-input').value = '';
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || !S.state || $('#game-screen').hidden) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (S.modalKey && !['discard', 'incoming', 'waiting', 'countered', 'counterwait'].some((x) => (S.modalKey || '').startsWith(x))) {
        const cb = S.modalOnClose;
        closeModal();
        if (cb) cb();
      } else if (S.mode) { S.mode = null; render(); }
      return;
    }
    if (S.modalKey) return;
    const st = S.state;
    if (k === 'r' && st.phase === 'play' && st.current === S.you && !st.turn.rolled && !st.turn.pending) act('roll');
    if (k === 'e' && isMyMainPhase()) { S.mode = null; act('endTurn'); }
    if (k === 't' && isMyMainPhase()) openTrade();
  });
}

// ---------- Start ----------

window.__siedlungen = S; // für Debugging in der Konsole

bindMenu();
bindGame();
showMenu();
resolveToken().then((token) => {
  S.token = token;
  connect();
});
