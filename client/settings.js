// Persönliche Einstellungen („An deinem Tisch“), im localStorage gespeichert.

const KEY = 'siedlungen.settings';

// Touch-Geräte (Handy, Tablet) starten mit „Hoch“, Rechner mit „Ultra“
const TOUCH = !!window.matchMedia?.('(pointer: coarse)').matches;

const DEFAULTS = {
  quality: TOUCH ? 'high' : 'ultra', // ultra | high | medium | low
  qualityRev: 2, // Stand der Grafikstufen (2 = mit „Ultra“)
  sound: true,
  volume: 0.7,
  ambience: true, // Meeresrauschen
  cinematic: true, // Kamerafahrten insgesamt
  camDice: true, // zur Würfelschale
  camHarvest: true, // zu den Feldern mit Ertrag
  camRobber: true, // zum Räuber
  camBuild: true, // zu neuen Bauten der Mitspieler
  scenery: true, // bewegtes Wasser, Boote, Wolken
  holograms: true, // Bauvorschau auf dem Brett
  boardToasts: true, // Hinweise unten auf dem Brett (Würfel, Erträge, Handel)
  autoFullscreen: true, // Handy: beim Start einer Partie ins Vollbild wechseln (wo der Browser es erlaubt)
};

let current = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  current = { ...DEFAULTS, ...saved };
  // Früherer Standard „Hoch“ wird einmalig auf die neue Stufe „Ultra“ gehoben
  if ((saved.qualityRev || 1) < 2) {
    if (!saved.quality || saved.quality === 'high') current.quality = DEFAULTS.quality;
    current.qualityRev = 2;
  }
  // Übernahme der alten Ton-Einstellung
  if (localStorage.getItem('siedlungen.sound') === 'off' && saved.sound === undefined) current.sound = false;
} catch { /* ignorieren */ }

const listeners = new Set();

export const settings = new Proxy(current, {
  set(target, prop, value) {
    target[prop] = value;
    try { localStorage.setItem(KEY, JSON.stringify(target)); } catch { /* ignorieren */ }
    for (const fn of listeners) fn(prop, value);
    return true;
  },
});

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Bei „weniger Bewegung“ im Betriebssystem ruhiger starten
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem(KEY)) {
  current.cinematic = false;
  current.scenery = false;
}
