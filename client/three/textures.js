// Prozedurale Canvas-Texturen für Gelände, Klippen, Zahlenchips, Häfen, Würfel, Wolken und Effekte.
import * as THREE from 'three';

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 0) c.lerp(new THREE.Color('#000'), -f);
  else c.lerp(new THREE.Color('#fff'), f);
  return `#${c.getHexString()}`;
}

export function canvasTex(size, draw, { srgb = true, h = size } = {}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, size, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const TERRAIN_COLORS = {
  forest: '#4a7536', pasture: '#8cc157', fields: '#dcb04a', hills: '#c0603f', mountains: '#9b9d9b', desert: '#e7d4a2',
};

export function woodTexture(base = '#6b4527') {
  const rnd = mulberry(5);
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      ctx.strokeStyle = shade(base, (rnd() - 0.5) * 0.35);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 1.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = shade(base, -0.35);
      ctx.beginPath();
      ctx.ellipse(rnd() * s, rnd() * s, 6, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Schriften für Chips und Hafenschilder: Texturen werden neu gezeichnet, sobald die Webfonts geladen sind.
const lateTextures = [];
export const fontsReady = (document.fonts
  ? Promise.all(['800 100px Spectral', '700 60px Spectral', '700 60px "Cormorant Garamond"', '600 30px Inter'].map((f) => document.fonts.load(f)))
  : Promise.resolve()
).catch(() => {}).then(() => {
  for (const [tex, draw] of lateTextures) {
    const ctx = tex.image.getContext('2d');
    ctx.clearRect(0, 0, tex.image.width, tex.image.height);
    draw(ctx, tex.image.width, tex.image.height);
    tex.needsUpdate = true;
  }
  lateTextures.length = 0;
});
let fontsLoaded = false;
fontsReady.then(() => { fontsLoaded = true; });

function fontTex(size, draw) {
  const tex = canvasTex(size, draw);
  tex.anisotropy = 16;
  if (!fontsLoaded) lateTextures.push([tex, draw]);
  return tex;
}

const NUM_FONT = 'Spectral, "Cormorant Garamond", Georgia, serif';

// Elfenbein-Scheibe mit Papierkorn und doppeltem Ring (Zahlenchips und Hafenschilder)
function ivoryDisc(ctx, s, seed, { ring = '#7d5a2e', inner = 'rgba(110,80,40,.5)' } = {}) {
  const c = s / 2;
  const u = s / 512;
  const g = ctx.createRadialGradient(c * 0.82, c * 0.72, s * 0.04, c, c, c);
  g.addColorStop(0, '#fbf2da');
  g.addColorStop(0.6, '#f2e3c0');
  g.addColorStop(0.9, '#e3cc9a');
  g.addColorStop(1, '#cfb07a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c - 2 * u, 0, Math.PI * 2);
  ctx.fill();
  const rnd = mulberry(seed);
  for (let i = 0; i < 1400; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (c - 14 * u);
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(150,115,60,0.10)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.6 * u, 1.6 * u);
  }
  ctx.lineWidth = 11 * u;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(c, c, c - 8 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3 * u;
  ctx.strokeStyle = 'rgba(255,240,205,.8)';
  ctx.beginPath();
  ctx.arc(c, c, c - 15 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5 * u;
  ctx.strokeStyle = inner;
  ctx.beginPath();
  ctx.arc(c, c, c - 30 * u, 0, Math.PI * 2);
  ctx.stroke();
}

// Geprägter Text: heller Versatz unten, dunkler Kern
function embossText(ctx, text, x, y, color, u) {
  ctx.fillStyle = 'rgba(255,250,235,0.9)';
  ctx.fillText(text, x, y + 3 * u);
  ctx.fillStyle = 'rgba(60,35,10,0.35)';
  ctx.fillText(text, x, y - 1.5 * u);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function tokenTexture(n, size = 512) {
  const draw = (ctx, s) => {
    const c = s / 2;
    const u = s / 512;
    ivoryDisc(ctx, s, n * 131);
    const red = n === 6 || n === 8;
    const col = red ? '#a8231a' : '#2a1d10';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${(n >= 10 ? 238 : 276) * u}px ${NUM_FONT}`;
    const m = ctx.measureText(String(n));
    const capH = (m.actualBoundingBoxAscent || 170 * u);
    const base = c + capH / 2 - 24 * u;
    embossText(ctx, String(n), c, base, col, u);
    const pips = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[n];
    ctx.fillStyle = col;
    for (let i = 0; i < pips; i++) {
      const x = c + (i - (pips - 1) / 2) * 34 * u;
      const y = base + 50 * u;
      ctx.fillStyle = 'rgba(255,250,235,0.9)';
      ctx.beginPath();
      ctx.arc(x, y + 2.5 * u, 11.5 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 11.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  return fontTex(size, draw);
}

const HARBOR_LABEL = { any: 'ALLES', wood: 'HOLZ', brick: 'LEHM', sheep: 'WOLLE', wheat: 'GETREIDE', ore: 'ERZ' };

export function harborTexture(type, image, size = 512) {
  const draw = (ctx, s) => {
    const c = s / 2;
    const u = s / 512;
    ctx.fillStyle = '#d9bf8a';
    ctx.fillRect(0, 0, s, s);
    ivoryDisc(ctx, s, type.length * 17, { ring: '#5e3d1d' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${150 * u}px ${NUM_FONT}`;
    embossText(ctx, type === 'any' ? '3:1' : '2:1', c, c - 30 * u, '#2a1d10', u);
    if (image) ctx.drawImage(image, c - 68 * u, c - 22 * u, 136 * u, 136 * u);
    else {
      // Anker
      ctx.strokeStyle = '#3b2a18';
      ctx.lineWidth = 11 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c, c - 14 * u);
      ctx.lineTo(c, c + 78 * u);
      ctx.moveTo(c - 34 * u, c + 8 * u);
      ctx.lineTo(c + 34 * u, c + 8 * u);
      ctx.moveTo(c - 50 * u, c + 46 * u);
      ctx.quadraticCurveTo(c - 44 * u, c + 86 * u, c, c + 80 * u);
      ctx.quadraticCurveTo(c + 44 * u, c + 86 * u, c + 50 * u, c + 46 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c - 26 * u, 12 * u, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `700 ${34 * u}px Inter, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${3 * u}px`;
    ctx.fillStyle = '#4a3218';
    ctx.fillText(HARBOR_LABEL[type], c, c + 150 * u);
  };
  return fontTex(size, draw);
}

// Dachziegel (hell, wird mit der Spielerfarbe eingefärbt)
export function shingleTexture() {
  const rnd = mulberry(8);
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#d9d4cc';
    ctx.fillRect(0, 0, s, s);
    const rows = 8;
    const h = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / 12);
      for (let x = -s / 6; x < s + s / 6; x += s / 6) {
        const l = 0.8 + rnd() * 0.2;
        const v = Math.round(255 * l);
        const g = ctx.createLinearGradient(0, r * h, 0, (r + 1) * h);
        g.addColorStop(0, `rgb(${v - 40},${v - 42},${v - 46})`);
        g.addColorStop(1, `rgb(${v},${v - 2},${v - 6})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + off + 2, r * h + 1, s / 6 - 4, h + 4, [0, 0, 10, 10]);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,30,25,0.45)';
      ctx.fillRect(0, (r + 1) * h - 3, s, 3);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Helle Holzmaserung zum Einfärben (Straßen, Stege)
export function grainTexture(base = '#e6e0d6', seed = 5) {
  const rnd = mulberry(seed);
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 1.5) {
      ctx.strokeStyle = shade(base, (rnd() - 0.55) * 0.3);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) ctx.lineTo(x, y + Math.sin(x / 37 + y * 0.3) * 1.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = shade(base, -0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(rnd() * s, rnd() * s, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Weicher Kontaktschatten unter Figuren und Chips
export function contactShadowTexture() {
  return canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function diceFaceTexture(v) {
  return canvasTex(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.4, s * 0.35, 10, s / 2, s / 2, s * 0.75);
    g.addColorStop(0, '#fffdf7');
    g.addColorStop(1, '#ebe3d2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const p = {
      1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
      4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
      5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
      6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
    }[v];
    for (const [x, y] of p) {
      const r = v === 1 ? 26 : 20;
      // eingelassene Augen mit hellem Rand
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(x * s + 1.5, y * s + 2, r + 2, 0, Math.PI * 2);
      ctx.fill();
      const pg = ctx.createRadialGradient(x * s - r * 0.3, y * s - r * 0.3, 1, x * s, y * s, r);
      pg.addColorStop(0, v === 1 ? '#6a120c' : '#050505');
      pg.addColorStop(1, v === 1 ? '#b0281c' : '#3a352f');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function cloudTexture(seed) {
  const rnd = mulberry(seed);
  return canvasTex(256, (ctx, s) => {
    for (let i = 0; i < 22; i++) {
      const x = s * (0.2 + rnd() * 0.6);
      const y = s * (0.3 + rnd() * 0.4);
      const r = s * (0.08 + rnd() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
}

export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,220,150,0)') {
  return canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function ringTexture() {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, c * 0.6, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.85, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// Entfernungsmaske zur Küste: 1 = Insel, fällt nach außen ab. Grundlage für Flachwasser und Brandung.
export function shoreMask(board, size = 256, extent = 20) {
  const data = new Uint8Array(size * size * 4);
  const SQ3 = Math.sqrt(3);
  const hexDist = (px, py, h) => {
    const x = Math.abs(px - h.x);
    const y = Math.abs(py - h.y);
    // Abstand zum Rand eines spitzen Sechsecks mit Radius 1 (negativ = innen); Kantennormalen bei 0°/60°
    return Math.max(x, x * 0.5 + y * SQ3 / 2) - SQ3 / 2;
  };
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const wx = (i / (size - 1) - 0.5) * extent;
      const wz = (j / (size - 1) - 0.5) * extent;
      let d = Infinity;
      for (const h of board.hexes) d = Math.min(d, hexDist(wx, wz, h));
      const v = Math.max(0, Math.min(1, 1 - d / 2.6));
      const k = (j * size + i) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
