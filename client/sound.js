// Synthetisierte Klangeffekte und Meeresrauschen (keine Audiodateien nötig).
import { settings, onSettingsChange } from './settings.js';

let ctx = null;
let master = null;
let ambience = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = settings.volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0, attack = 0.01 } = {}) {
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBuffer(a, dur) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(dur, { vol = 0.15, delay = 0, freq = 1800, q = 1, type = 'bandpass' } = {}) {
  const a = ac();
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// Warme Glocke: Grundton plus leise Obertöne
function bell(freq, delay = 0, vol = 0.1) {
  tone(freq, 1.2, { vol, delay, attack: 0.005 });
  tone(freq * 2.01, 0.8, { vol: vol * 0.35, delay, attack: 0.005 });
  tone(freq * 3.02, 0.5, { vol: vol * 0.15, delay, attack: 0.005 });
}

export const SOUNDS = {
  dice: { label: 'Würfel', icon: '🎲', play() { for (let i = 0; i < 9; i++) noise(0.05, { delay: i * 0.08 + Math.random() * 0.05, vol: 0.4 * (1 - i / 11), freq: 1800 + Math.random() * 1800, q: 2 }); } },
  harvest: { label: 'Ernte', icon: '🌾', play() { [660, 880, 1100].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.06, delay: i * 0.07 })); } },
  road: { label: 'Straße', icon: '🛤️', play() { noise(0.12, { vol: 0.35, freq: 500, q: 1.5 }); tone(140, 0.15, { type: 'triangle', vol: 0.15, slide: 0.7 }); } },
  build: { label: 'Siedlung', icon: '🏠', play() { tone(180, 0.2, { type: 'triangle', vol: 0.2, slide: 0.6 }); noise(0.1, { vol: 0.25, freq: 900 }); tone(240, 0.18, { type: 'triangle', vol: 0.12, delay: 0.12, slide: 0.7 }); } },
  city: { label: 'Stadt', icon: '🏰', play() { noise(0.12, { vol: 0.3, freq: 300 }); bell(392, 0.1, 0.09); bell(523, 0.25, 0.08); } },
  card: { label: 'Karte', icon: '🃏', play() { noise(0.14, { vol: 0.2, freq: 4200, q: 0.8 }); } },
  page: { label: 'Pergament', icon: '📜', play() { noise(0.25, { vol: 0.12, freq: 3000, q: 0.5 }); } },
  coin: { label: 'Handel', icon: '🪙', play() { tone(1320, 0.12, { type: 'square', vol: 0.04 }); tone(1760, 0.25, { type: 'square', vol: 0.04, delay: 0.07 }); } },
  offer: { label: 'Angebot', icon: '🤝', play() { bell(587, 0, 0.07); bell(784, 0.12, 0.06); } },
  robber: { label: 'Räuber', icon: '🥷', play() { tone(110, 0.6, { type: 'sawtooth', vol: 0.06, slide: 0.7 }); tone(82, 0.8, { vol: 0.14, delay: 0.1 }); noise(0.5, { vol: 0.08, freq: 200, type: 'lowpass' }); } },
  steal: { label: 'Diebstahl', icon: '🫳', play() { noise(0.18, { vol: 0.2, freq: 2500 }); tone(300, 0.2, { type: 'triangle', vol: 0.08, slide: 0.5, delay: 0.05 }); } },
  turn: { label: 'Dein Zug', icon: '🔔', play() { bell(523, 0, 0.09); bell(784, 0.14, 0.08); } },
  award: { label: 'Auszeichnung', icon: '🏅', play() { [523, 659, 784].forEach((f, i) => bell(f, i * 0.1, 0.07)); } },
  win: { label: 'Sieg', icon: '👑', play() { [523, 659, 784, 1047].forEach((f, i) => bell(f, i * 0.14, 0.09)); tone(1047, 1.5, { type: 'triangle', vol: 0.05, delay: 0.6 }); } },
  error: { label: 'Fehler', icon: '⚠️', play() { tone(200, 0.15, { type: 'square', vol: 0.05 }); } },
  click: { label: 'Knopf', icon: '🔘', play() { tone(900, 0.04, { type: 'square', vol: 0.025 }); } },
};

export function play(name, force = false) {
  if (!settings.sound && !force) return;
  try { SOUNDS[name]?.play(); } catch { /* Audio nicht verfügbar */ }
}

export function isSoundOn() { return settings.sound; }

export function toggleSound() {
  settings.sound = !settings.sound;
  return settings.sound;
}

// ---------- Meeresrauschen ----------

function startAmbience() {
  if (ambience || !settings.sound || !settings.ambience) return;
  const a = ac();
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 4);
  src.loop = true;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const g = a.createGain();
  g.gain.value = 0.0;
  // Langsames An- und Abschwellen wie Wellen
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = a.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(lp).connect(g).connect(master);
  g.gain.setTargetAtTime(0.05, a.currentTime, 2);
  src.start();
  lfo.start();
  ambience = { src, lfo, g };
}

function stopAmbience() {
  if (!ambience) return;
  const { src, lfo, g } = ambience;
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  setTimeout(() => { try { src.stop(); lfo.stop(); } catch { /* ignorieren */ } }, 1500);
  ambience = null;
}

export function updateAmbience() {
  if (settings.sound && settings.ambience) startAmbience();
  else stopAmbience();
}

onSettingsChange((key, value) => {
  if (key === 'volume' && master) master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
  if (key === 'sound' || key === 'ambience') updateAmbience();
});

// Audio darf erst nach einer Nutzeraktion starten
window.addEventListener('pointerdown', () => updateAmbience(), { once: true });
