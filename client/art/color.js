// Kleine Farbhelfer für die SVG-Grafiken (ohne three.js, damit die Oberfläche leicht bleibt).

let counter = 0;
export const uid = () => `g${(counter++).toString(36)}`;

function rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

// Mischung zweier Farben: t = 0 → a, t = 1 → b
export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}

export const darken = (c, t) => mix(c, '#140c06', t);
export const lighten = (c, t) => mix(c, '#fffaf0', t);

export function luminance(c) {
  const [r, g, b] = rgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
