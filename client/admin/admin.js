// Admin-Seite (/admin): wie viele Partien wann gespielt wurden.
// Daten kommen von GET /api/admin/games, „Statistik löschen“ schickt DELETE (siehe server/admin.js).
// Ist auf dem Server ein ADMIN_KEY gesetzt, fragt die Seite einmal pro Sitzung danach.
import { uiArt, emblem, icon, portraitArt } from '/art.js';
import { PLAYER_COLORS } from '/shared/engine.js';

const COLOR_HEX = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.hex]));

// Feste Reihenfolge = feste Farbe je Modus (geprüft auf Farbfehlsichtigkeit vor dem Pergament #f4ead3)
const MODES = [
  { id: 'solo', label: 'Gegen die KI', color: '#2f5fa8' },
  { id: 'online', label: 'Mit Freunden', color: '#b88a1c' },
  { id: 'hotseat', label: 'An einem Gerät', color: '#a3302a' },
];
const MODE = Object.fromEntries(MODES.map((m) => [m.id, m]));
const HEAT = ['#c4a060', '#a98042', '#8c6230', '#6b4723', '#4a2f18']; // eine Farbe, hell → dunkel
const NEUTRAL_BAR = '#8c6230';
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const REFRESH_MS = 30_000;
const PAGE = 25;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Browser-Speicher kann fehlen (privates Fenster) – dann gilt eben der Standard
const store = {
  get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
  set(area, k, v) { try { if (v === null) window[area].removeItem(k); else window[area].setItem(k, v); } catch { /* egal */ } },
};

const num = new Intl.NumberFormat('de-DE');
const dec = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });
const fDay = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const fDayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fRowDate = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fMonth = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
const fMonthLong = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const fTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

let data = null; // { now, games }
let range = Number(store.get('localStorage', 'admin-range') ?? 30);
if (![7, 30, 90, 365, 0].includes(range)) range = 30;
let shown = PAGE;
let key = store.get('sessionStorage', 'admin-key') || '';
let loadSeq = 0; // nur die jüngste Anfrage zählt (z. B. Löschen während einer Aktualisierung)

// ---------- Zeit ----------

const dayStart = (ts, addDays = 0) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays).getTime(); };
const weekStart = (ts) => { const d = new Date(ts); return dayStart(ts, -((d.getDay() + 6) % 7)); };
const monthStart = (ts, add = 0) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() + add, 1).getTime(); };

function isoWeek(ts) {
  const d = new Date(ts);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function duration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return '< 1 Min.';
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} Std. ${min % 60} Min.` : `${h} Std.`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} ${d === 1 ? 'Tag' : 'Tage'} ${h % 24} Std.` : `${d} ${d === 1 ? 'Tag' : 'Tage'}`;
}

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

const plural = (n, one, many) => `${num.format(n)} ${n === 1 ? one : many}`;

// ---------- Daten ----------

async function api(method = 'GET') {
  const res = await fetch('/api/admin/games', { method, cache: 'no-store', headers: key ? { 'X-Admin-Key': key } : {} });
  if (res.status === 401) {
    const err = new Error('locked');
    err.locked = true;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function load() {
  const seq = ++loadSeq;
  document.body.classList.add('is-loading');
  try {
    const result = await api();
    if (seq !== loadSeq) return;
    data = result;
    showLock(false);
    render();
    setTimeout(() => document.body.classList.remove('intro'), 800);
  } catch (e) {
    if (seq !== loadSeq) return;
    if (e.locked) showLock(true, !!key);
    else toast('Die Statistik konnte nicht geladen werden.');
  } finally {
    if (seq === loadSeq) document.body.classList.remove('is-loading');
  }
}

function showLock(on, wrongKey = false) {
  $('#lock').hidden = !on;
  $('#main').hidden = on;
  $('#live').hidden = on || !data;
  $('.admin-actions').hidden = on;
  $('#lock-error').hidden = !wrongKey;
  if (on) {
    if (wrongKey) store.set('sessionStorage', 'admin-key', null);
    setTimeout(() => $('#lock-input').focus(), 50);
  }
}

// Zeitraum der Auswertung: bis jetzt, ab Mitternacht vor (range - 1) Tagen
function period() {
  const now = Date.now();
  const today = dayStart(now);
  if (range) return { from: dayStart(now, -(range - 1)), to: now, days: range };
  const first = data.games.reduce((m, g) => Math.min(m, g.startedAt), today);
  const from = Math.min(dayStart(first), dayStart(now, -13));
  return { from, to: now, days: Math.round((today - from) / 86400000) + 1 };
}

// Säulen: Tage bis 3 Monate, danach Wochen, ab 2 Jahren Monate
function bucketize(games, { from, to, days }) {
  const unit = days <= 92 ? 'day' : days <= 731 ? 'week' : 'month';
  const next = (t) => (unit === 'day' ? dayStart(t, 1) : unit === 'week' ? dayStart(t, 7) : monthStart(t, 1));
  let t = unit === 'day' ? from : unit === 'week' ? weekStart(from) : monthStart(from);
  const list = [];
  while (t <= to) {
    const end = next(t);
    list.push({ start: t, end, total: 0, modes: Object.fromEntries(MODES.map((m) => [m.id, 0])) });
    t = end;
  }
  for (const g of games) {
    const b = list.findLast((x) => x.start <= g.startedAt);
    if (!b || g.startedAt >= b.end) continue;
    b.total++;
    b.modes[g.mode] = (b.modes[g.mode] || 0) + 1;
  }
  return { unit, list };
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------- Darstellung ----------

function render() {
  const games = data.games;
  hideTip();
  renderLive(games);
  $('#stamp').textContent = `Stand ${fTime.format(Date.now())} Uhr · aktualisiert sich alle 30 s`;
  $$('#range button').forEach((b) => b.classList.toggle('on', Number(b.dataset.days) === range));
  $('#btn-clear').disabled = !games.length;

  const empty = !games.length;
  $('#empty').hidden = !empty;
  $('#range').hidden = empty;
  $('#board').hidden = empty;
  if (empty) return;

  const p = period();
  const inRange = games.filter((g) => g.startedAt >= p.from && g.startedAt <= p.to);
  const prev = range ? games.filter((g) => g.startedAt >= p.from - (p.to - p.from) && g.startedAt < p.from) : null;
  renderKpis(inRange, prev, p);
  renderChart(bucketize(inRange, p), p);
  renderHeat(inRange);
  renderBars(inRange);
  renderTable(inRange, p);
}

function renderLive(games) {
  const live = games.filter((g) => g.status === 'live').length;
  const paused = games.filter((g) => g.status === 'paused').length;
  const today = games.filter((g) => g.startedAt >= dayStart(Date.now())).length;
  const el = $('#live');
  el.hidden = false;
  el.innerHTML = `<span class="pulse ${live ? 'on' : ''}"></span>
    <span><b>${plural(live, 'Partie läuft', 'Partien laufen')}</b> gerade</span>
    <span class="live-sep"></span><span>${num.format(paused)} pausiert</span>
    <span class="live-sep"></span><span>${plural(today, 'Partie', 'Partien')} heute</span>`;
}

function rangeLabel(p) {
  const from = fDay.format(p.from);
  const to = fDay.format(p.to);
  const head = range === 365 ? 'Letztes Jahr' : range ? `Letzte ${range} Tage` : 'Seit Beginn der Aufzeichnung';
  return `${head} · ${from} – ${to}`;
}

function renderKpis(games, prev, p) {
  const ended = games.filter((g) => g.status === 'ended');
  const abandoned = games.filter((g) => g.status === 'abandoned').length;
  const dur = median(ended.map((g) => g.endedAt - g.startedAt));
  const humans = games.reduce((n, g) => n + g.players.filter((x) => !x.isBot).length, 0);
  const bots = games.reduce((n, g) => n + g.players.filter((x) => x.isBot).length, 0);

  let delta = '';
  if (prev) {
    const d = games.length - prev.length;
    const rel = prev.length ? d / prev.length : null;
    const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const txt = d === 0 ? 'gleich viele' : `${d > 0 ? '+' : '−'}${num.format(Math.abs(d))}${rel !== null ? ` (${d > 0 ? '+' : '−'}${pct.format(Math.abs(rel))})` : ''}`;
    delta = `<span class="delta ${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='} ${txt}</span> <span class="kpi-sub">ggü. den ${range === 365 ? '365' : range} Tagen davor</span>`;
  }

  const tile = (art, label, value, sub, cls = '') => `<article class="kpi parchment ${cls}">
      <span class="kpi-art">${emblem(art, cls ? 64 : 44)}</span>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-foot">${sub}</div></article>`;

  $('#kpis').innerHTML = [
    tile('dice', 'Partien begonnen', num.format(games.length), delta || `<span class="kpi-sub">${esc(rangeLabel(p))}</span>`, 'hero ornate'),
    tile('hourglass', 'Pro Tag', dec.format(games.length / p.days), `<span class="kpi-sub">im Schnitt über ${plural(p.days, 'Tag', 'Tage')}</span>`),
    tile('crown', 'Zu Ende gespielt', num.format(ended.length),
      `<span class="kpi-sub">${games.length ? pct.format(ended.length / games.length) : '–'} aller Partien · ${num.format(abandoned)} abgebrochen</span>`),
    tile('scroll', 'Typische Spieldauer', dur === null ? '–' : duration(dur),
      `<span class="kpi-sub">${ended.length ? `Median aus ${plural(ended.length, 'beendeten Partie', 'beendeten Partien')}` : 'noch keine Partie beendet'}</span>`),
    tile('users', 'Siedler am Tisch', num.format(humans), `<span class="kpi-sub">Menschen · dazu ${plural(bots, 'KI-Siedler', 'KI-Siedler')}</span>`),
  ].join('');
}

// ----- Säulendiagramm: Partien pro Tag/Woche/Monat, gestapelt nach Modus -----

let chartState = null;

function bucketLabel(b, unit, long = false) {
  if (unit === 'day') return long ? fDayLong.format(b.start) : fDay.format(b.start);
  if (unit === 'week') {
    const range = `${fDay.format(b.start)} – ${fDay.format(dayStart(b.end, -1))}`;
    return long ? `KW ${isoWeek(b.start)} · ${range}` : `KW ${isoWeek(b.start)}`;
  }
  return long ? fMonthLong.format(b.start) : fMonth.format(b.start);
}

function niceStep(max) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw));
}

// Rechteck mit abgerundetem oberen Ende, unten eckig (sitzt auf der Grundlinie bzw. dem Segment darunter)
function topRounded(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

function renderChart(bk, p) {
  const word = { day: 'Tag', week: 'Woche', month: 'Monat' }[bk.unit];
  $('#chart-title').textContent = `Partien pro ${word}`;
  $('#chart-sub').textContent = rangeLabel(p);
  $('#legend').innerHTML = MODES.map((m) => `<li><span class="key" style="background:${m.color}"></span>${m.label}</li>`).join('');
  chartState = { bk, active: null };
  drawChart();
}

function drawChart() {
  const el = $('#chart');
  const { bk } = chartState;
  const W = Math.max(280, el.clientWidth);
  const H = W < 560 ? 210 : 260;
  const m = { l: 34, r: 6, t: 22, b: 30 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const n = bk.list.length;
  const max = Math.max(1, ...bk.list.map((b) => b.total));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const y = (v) => m.t + ph - (v / top) * ph;
  const slot = pw / n;
  const bw = Math.max(2, Math.min(24, slot - Math.max(2, slot * 0.3)));
  const GAP = 2;

  let grid = '';
  for (let v = 0; v <= top; v += step) {
    const gy = Math.round(y(v)) + 0.5; // Haarlinie auf ganzen Pixeln
    grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${gy}" y2="${gy}" class="${v === 0 ? 'base' : 'grid'}"/>
      <text x="${m.l - 8}" y="${y(v) + 4}" class="tick" text-anchor="end">${num.format(v)}</text>`;
  }

  // Beschriftung der x-Achse: vom jüngsten Eintrag rückwärts, mit genug Abstand
  const every = Math.max(1, Math.ceil(64 / slot));
  let xlabels = '';
  bk.list.forEach((b, i) => {
    if ((n - 1 - i) % every) return;
    const cx = m.l + slot * (i + 0.5);
    const anchor = cx + 30 > W ? 'end' : cx - 30 < 0 ? 'start' : 'middle';
    const lx = anchor === 'end' ? Math.min(cx + slot / 2, W - 2) : anchor === 'start' ? Math.max(cx - slot / 2, 2) : cx;
    xlabels += `<text x="${lx}" y="${H - 8}" class="tick" text-anchor="${anchor}">${esc(bucketLabel(b, bk.unit))}</text>`;
  });

  let bars = '';
  let hits = '';
  let peak = -1;
  bk.list.forEach((b, i) => { if (b.total && (peak < 0 || b.total >= bk.list[peak].total)) peak = i; });
  bk.list.forEach((b, i) => {
    const x = m.l + slot * i + (slot - bw) / 2;
    let base = y(0);
    const segs = MODES.filter((md) => b.modes[md.id] > 0);
    segs.forEach((md, k) => {
      const h = (b.modes[md.id] / top) * ph;
      const isTop = k === segs.length - 1;
      const gap = k > 0 ? GAP : 0;
      const hh = Math.max(1, h - gap);
      bars += `<path d="${topRounded(x, base - h, bw, hh, isTop ? 4 : 0)}" fill="${md.color}"/>`;
      base -= h;
    });
    hits += `<rect class="hit" data-i="${i}" x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${ph}"/>`;
  });
  const peakLabel = peak >= 0
    ? `<text x="${m.l + slot * (peak + 0.5)}" y="${y(bk.list[peak].total) - 7}" class="peak" text-anchor="middle">${num.format(bk.list[peak].total)}</text>`
    : '';

  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" tabindex="0"
      aria-label="${esc($('#chart-title').textContent)}. Mit den Pfeiltasten einzelne Säulen ansehen.">
    <rect class="band" id="chart-band" x="0" y="${m.t}" width="${slot}" height="${ph}" visibility="hidden"/>
    ${grid}${bars}${peakLabel}${xlabels}<g class="hits">${hits}</g></svg>`;
  chartState.geom = { m, slot, ph };

  const svg = $('svg', el);
  svg.addEventListener('pointermove', (e) => {
    const r = e.target.closest?.('.hit');
    if (r) setChartActive(Number(r.dataset.i), e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => setChartActive(null));
  svg.addEventListener('blur', () => setChartActive(null));
  svg.addEventListener('focus', () => setChartActive(chartState.active ?? (peak >= 0 ? peak : n - 1)));
  svg.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }[e.key];
    if (e.key === 'Escape') { setChartActive(null); return; }
    if (d === undefined) return;
    e.preventDefault();
    setChartActive(Math.max(0, Math.min(n - 1, (chartState.active ?? n - 1) + d)));
  });
}

function setChartActive(i, px, py) {
  chartState.active = i;
  const band = $('#chart-band');
  if (!band) return;
  if (i === null) { band.setAttribute('visibility', 'hidden'); hideTip(); return; }
  const { m, slot } = chartState.geom;
  band.setAttribute('x', m.l + slot * i);
  band.setAttribute('visibility', 'visible');
  const b = chartState.bk.list[i];
  const rows = MODES.map((md) => `<div class="tip-row"><span class="tip-key" style="background:${md.color}"></span><b>${num.format(b.modes[md.id])}</b><span>${md.label}</span></div>`).join('');
  const html = `<div class="tip-head">${esc(bucketLabel(b, chartState.bk.unit, true))}</div>
    <div class="tip-value">${plural(b.total, 'Partie', 'Partien')}</div>${rows}`;
  if (px === undefined) {
    const r = band.getBoundingClientRect();
    showTip(html, r.left + r.width / 2, r.top + 30);
  } else showTip(html, px, py);
}

// ----- Heatmap: Beginn nach Wochentag × Stunde -----

let heatState = null;

function renderHeat(games) {
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const g of games) {
    const d = new Date(g.startedAt);
    cells[(d.getDay() + 6) % 7][d.getHours()]++;
  }
  const max = Math.max(0, ...cells.flat());
  const level = (v) => (v ? Math.min(HEAT.length, Math.ceil((v / max) * HEAT.length)) : 0);
  let best = null;
  cells.forEach((row, w) => row.forEach((v, h) => { if (v && (!best || v > best.v)) best = { v, w, h }; }));
  $('#heat-sub').textContent = best
    ? `Beginn der Partien · am häufigsten ${WEEKDAYS_LONG[best.w]}s um ${best.h} Uhr`
    : 'Beginn der Partien · noch keine Partie in diesem Zeitraum';

  let html = '<span class="heat-corner"></span>';
  for (let h = 0; h < 24; h++) html += `<span class="heat-hour ${h % 6 ? 'minor' : ''}">${h % 3 ? '' : h}</span>`;
  cells.forEach((row, w) => {
    html += `<span class="heat-day">${WEEKDAYS[w]}</span>`;
    row.forEach((v, h) => {
      const lv = level(v);
      html += `<span class="cell" data-w="${w}" data-h="${h}" style="${lv ? `background:${HEAT[lv - 1]}` : ''}"></span>`;
    });
  });
  const el = $('#heat');
  el.innerHTML = html;
  el.tabIndex = 0;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Beginn der Partien nach Wochentag und Uhrzeit. ${$('#heat-sub').textContent}. Mit den Pfeiltasten Felder ansehen.`);
  heatState = { cells, active: null };

  $('#heat-legend').innerHTML = `<span>weniger</span><span class="cell" title="keine"></span>${HEAT.map((c) => `<span class="cell" style="background:${c}"></span>`).join('')}<span>mehr</span>`;
}

function setHeatActive(w, h, px, py) {
  $$('#heat .cell.active').forEach((c) => c.classList.remove('active'));
  if (w === null) { heatState.active = null; hideTip(); return; }
  heatState.active = { w, h };
  const cell = $(`#heat .cell[data-w="${w}"][data-h="${h}"]`);
  cell.classList.add('active');
  const v = heatState.cells[w][h];
  const html = `<div class="tip-head">${WEEKDAYS_LONG[w]} · ${h}–${h + 1} Uhr</div><div class="tip-value">${plural(v, 'Partie', 'Partien')}</div>`;
  if (px === undefined) {
    const r = cell.getBoundingClientRect();
    showTip(html, r.left + r.width / 2, r.top);
  } else showTip(html, px, py);
}

function bindHeat() {
  const el = $('#heat');
  el.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.cell');
    if (c) setHeatActive(Number(c.dataset.w), Number(c.dataset.h), e.clientX, e.clientY);
    else setHeatActive(null);
  });
  el.addEventListener('pointerleave', () => setHeatActive(null));
  el.addEventListener('blur', () => setHeatActive(null));
  el.addEventListener('focus', () => {
    const a = heatState.active || { w: 0, h: 20 };
    setHeatActive(a.w, a.h);
  });
  el.addEventListener('keydown', (e) => {
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (e.key === 'Escape') { setHeatActive(null); return; }
    if (!mv) return;
    e.preventDefault();
    const a = heatState.active || { w: 0, h: 20 };
    setHeatActive(Math.max(0, Math.min(6, a.w + mv[0])), Math.max(0, Math.min(23, a.h + mv[1])));
  });
}

// ----- Balken: Spielmodi, Spieler pro Partie, Sieger -----

function renderBars(games) {
  // Balkenlänge relativ zum größten Wert der Gruppe, Anteil in Prozent daneben
  const group = (title, items) => {
    const sum = items.reduce((n, it) => n + it.value, 0);
    const max = Math.max(1, ...items.map((it) => it.value));
    return `<div class="bar-group"><div class="bar-title">${title}</div>
      ${items.map((it) => `<div class="bar-row">
        <span class="bar-label">${it.color !== NEUTRAL_BAR ? `<span class="key" style="background:${it.color}"></span>` : ''}${it.label}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(it.value / max) * 100}%;background:${it.color}"></span></span>
        <span class="bar-value"><b>${num.format(it.value)}</b><small>${sum ? pct.format(it.value / sum) : '–'}</small></span></div>`).join('')}</div>`;
  };

  const modes = MODES.map((m) => ({ label: m.label, color: m.color, value: games.filter((g) => g.mode === m.id).length }));
  const seats = [2, 3, 4].map((k) => ({ label: `${k} Siedler`, color: NEUTRAL_BAR, value: games.filter((g) => g.players.length === k).length }));
  const won = games.filter((g) => g.status === 'ended' && g.winner !== null && g.players[g.winner]);
  const winners = [
    { label: 'Menschen', color: NEUTRAL_BAR, value: won.filter((g) => !g.players[g.winner].isBot).length },
    { label: 'KI-Siedler', color: NEUTRAL_BAR, value: won.filter((g) => g.players[g.winner].isBot).length },
  ];
  $('#bars').innerHTML = group('Spielmodus', modes) + group('Siedler pro Partie', seats) + group('Wer gewinnt', winners);
}

// ----- Tabelle aller Partien -----

const STATUS = {
  live: { label: 'Läuft', icon: null },
  paused: { label: 'Pausiert', icon: 'hourglass' },
  ended: { label: 'Beendet', icon: 'crown' },
  abandoned: { label: 'Abgebrochen', icon: 'leave' },
};

function statusCell(g) {
  const s = STATUS[g.status] || STATUS.abandoned;
  const mark = g.status === 'live' ? '<span class="pulse on"></span>' : icon(s.icon, 14);
  let sub = '';
  if (g.status === 'ended') sub = `Sieg: ${esc(g.players[g.winner]?.name || '–')}${g.players[g.winner]?.isBot ? ' (KI)' : ''}`;
  else if (g.status === 'paused' || g.status === 'live') sub = `zuletzt ${ago(g.lastActive)}`;
  else if (g.abandonedAt) sub = ago(g.abandonedAt);
  return `<span class="status ${g.status}">${mark}${s.label}</span>${sub ? `<small>${sub}</small>` : ''}`;
}

function durationCell(g) {
  if (g.status === 'ended') return duration(g.endedAt - g.startedAt);
  // Abgebrochen: bis zum letzten Geschehen am Tisch (der Raum selbst verschwindet evtl. erst nach Tagen)
  const last = g.lastActive || g.abandonedAt;
  if (g.status === 'abandoned') return last ? duration(Math.max(0, last - g.startedAt)) : '–';
  return `seit ${duration(Date.now() - g.startedAt)}`;
}

function playersCell(g) {
  const humans = g.players.filter((p) => !p.isBot);
  const bots = g.players.length - humans.length;
  const faces = g.players.map((p, i) => `<span class="face ${p.isBot ? 'bot' : ''}" title="${esc(p.name)}${p.isBot ? ' (KI)' : ''}">${portraitArt(i, COLOR_HEX[p.color], 26)}</span>`).join('');
  const names = humans.map((p) => esc(p.name)).join(', ') || '–';
  return `<div class="faces">${faces}</div><small>${names}${bots ? ` · ${bots} KI` : ''}</small>`;
}

function renderTable(games, p) {
  $('#table-sub').textContent = `${plural(games.length, 'Partie', 'Partien')} · ${rangeLabel(p)}`;
  const el = $('#table');
  if (!games.length) {
    el.innerHTML = `<div class="table-empty">${emblem('island', 56)}<span>In diesem Zeitraum wurde keine Partie begonnen.</span></div>`;
    return;
  }
  const list = games.slice(0, shown);
  el.innerHTML = `<table class="games-table">
    <thead><tr><th>Beginn</th><th>Insel</th><th>Modus</th><th>Siedler</th><th>Verlauf</th><th>Dauer</th><th>Stand</th></tr></thead>
    <tbody>${list.map((g) => {
      const md = MODE[g.mode] || MODES[0];
      const progress = g.rounds ? `${g.status === 'ended' ? '' : 'Runde '}${num.format(g.rounds)}${g.status === 'ended' ? ' Runden' : ''}` : 'Gründung';
      return `<tr>
        <td data-label="Beginn"><b>${fRowDate.format(g.startedAt)}</b><small>${fTime.format(g.startedAt)} Uhr</small></td>
        <td data-label="Insel"><span class="island">${esc(g.island)}</span><small>Raum ${esc(g.code)}</small></td>
        <td data-label="Modus"><span class="mode-tag"><span class="key" style="background:${md.color}"></span>${md.label}</span></td>
        <td data-label="Siedler">${playersCell(g)}</td>
        <td data-label="Verlauf" class="num">${progress}<small>Ziel ${g.vpToWin} Punkte</small></td>
        <td data-label="Dauer" class="num">${durationCell(g)}</td>
        <td data-label="Stand">${statusCell(g)}</td></tr>`;
    }).join('')}</tbody></table>
    ${games.length > shown ? `<div class="more"><button class="btn small" id="btn-more">Weitere ${Math.min(PAGE, games.length - shown)} anzeigen <span class="more-count">· noch ${num.format(games.length - shown)}</span></button></div>` : ''}`;
  $('#btn-more')?.addEventListener('click', () => { shown += PAGE; render(); });
}

// ---------- Tooltip, Meldung, Dialog ----------

function showTip(html, x, y) {
  const tip = $('#tip');
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
  const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTip() {
  $('#tip').hidden = true;
}

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function confirmClear() {
  const count = data?.games.length || 0;
  const root = $('#modal-root');
  const before = document.activeElement;
  root.innerHTML = `<div class="modal-backdrop"><div class="modal parchment admin-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title">
    <div class="modal-body">
      <div class="modal-art">${emblem('scroll', 72)}</div>
      <h2 class="center" id="clear-title">Partienbuch leeren?</h2>
      <p>Alle <b>${plural(count, 'Eintrag', 'Einträge')}</b> werden endgültig gelöscht. Gespeicherte Partien der Spieler bleiben erhalten – nur die Statistik beginnt von vorn.</p>
      <div class="modal-actions">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn danger" data-ok>${icon('trash', 15)} Endgültig löschen</button>
      </div>
    </div></div></div>`;
  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    before?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('.modal-backdrop', root).addEventListener('click', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
  $('[data-close]', root).addEventListener('click', close);
  $('[data-ok]', root).addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await api('DELETE');
      close();
      shown = PAGE;
      toast('Das Partienbuch ist jetzt leer.');
      await load();
    } catch (err) {
      close();
      if (err.locked) showLock(true, !!key);
      else toast('Löschen hat nicht geklappt – bitte noch einmal versuchen.');
    }
  });
  $('[data-close]', root).focus();
}

// ---------- Start ----------

function fillArt() {
  $$('[data-art]').forEach((el) => { const [n, s] = el.dataset.art.split(':'); el.innerHTML = uiArt(n, Number(s) || 24); });
  $$('[data-icon]').forEach((el) => { const [n, s] = el.dataset.icon.split(':'); el.outerHTML = icon(n, Number(s) || 16); });
  $$('[data-emblem]').forEach((el) => { const [n, s] = el.dataset.emblem.split(':'); el.innerHTML = emblem(n, Number(s) || 24); });
}

fillArt();
bindHeat();

$('#range').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !data) return;
  range = Number(b.dataset.days);
  shown = PAGE;
  store.set('localStorage', 'admin-range', String(range));
  render();
});
$('#btn-refresh').addEventListener('click', load);
$('#btn-clear').addEventListener('click', confirmClear);
$('#lock-form').addEventListener('submit', (e) => {
  e.preventDefault();
  key = $('#lock-input').value.trim();
  store.set('sessionStorage', 'admin-key', key);
  $('#lock-input').value = '';
  load();
});

let lastWidth = 0;
new ResizeObserver(([entry]) => {
  const w = Math.round(entry.contentRect.width);
  if (chartState && w !== lastWidth) { lastWidth = w; drawChart(); }
}).observe($('#chart'));

setInterval(() => {
  if (document.visibilityState === 'visible' && data && !$('#modal-root').children.length && $('#lock').hidden) load();
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(); });

load();
