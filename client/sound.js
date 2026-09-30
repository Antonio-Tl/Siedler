// Kleine, synthetisierte Klangeffekte (keine Audiodateien nötig).
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('siedlungen.sound') !== 'off'; } catch { /* ignorieren */ }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0 } = {}) {
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.15, delay = 0, freq = 1800 } = {}) {
  const a = ac();
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  dice() { for (let i = 0; i < 7; i++) noise(0.05, { delay: i * 0.09 + Math.random() * 0.04, vol: 0.35, freq: 2200 + Math.random() * 1500 }); },
  build() { tone(180, 0.18, { type: 'triangle', vol: 0.2, slide: 0.6 }); noise(0.08, { vol: 0.2, freq: 900 }); },
  city() { tone(220, 0.2, { type: 'triangle', vol: 0.18 }); tone(330, 0.3, { type: 'triangle', vol: 0.14, delay: 0.1 }); },
  coin() { tone(1320, 0.12, { type: 'square', vol: 0.05 }); tone(1760, 0.2, { type: 'square', vol: 0.05, delay: 0.07 }); },
  turn() { tone(523, 0.25, { vol: 0.1 }); tone(784, 0.4, { vol: 0.1, delay: 0.12 }); },
  robber() { tone(110, 0.5, { type: 'sawtooth', vol: 0.07, slide: 0.7 }); tone(98, 0.6, { type: 'sine', vol: 0.12, delay: 0.1 }); },
  card() { noise(0.12, { vol: 0.18, freq: 4000 }); },
  error() { tone(200, 0.15, { type: 'square', vol: 0.05 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.13 })); },
  click() { tone(900, 0.04, { type: 'square', vol: 0.03 }); },
};

export function play(name) {
  if (!enabled) return;
  try { SOUNDS[name]?.(); } catch { /* Audio nicht verfügbar */ }
}

export function isSoundOn() { return enabled; }

export function toggleSound() {
  enabled = !enabled;
  try { localStorage.setItem('siedlungen.sound', enabled ? 'on' : 'off'); } catch { /* ignorieren */ }
  return enabled;
}
