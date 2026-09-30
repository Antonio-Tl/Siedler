// Persönliche Einstellungen („An deinem Tisch“), im localStorage gespeichert.

const KEY = 'siedlungen.settings';

const DEFAULTS = {
  quality: 'high', // high | medium | low
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
};

let current = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  current = { ...DEFAULTS, ...saved };
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
