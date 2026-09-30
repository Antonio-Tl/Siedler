// Handgemalte Geländetexturen in hoher Auflösung. Jede Geländeart wird einmal gemalt – Farbe und parallel
// dazu eine Höhenkarte, aus der eine Normal-Map (Relief im Licht) entsteht. Felder derselben Art drehen
// die Textur um Vielfache von 60°, damit sie sich nicht gleichen.
import * as THREE from 'three';
import { mulberry } from './textures.js';

const TAU = Math.PI * 2;
const cache = new Map();

function makeCanvas(w, h = w, opts) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', opts)];
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const grey = (h) => {
  const v = Math.round(clamp01(h) * 255);
  return `rgb(${v},${v},${v})`;
};
function mix(a, b, t) {
  const ca = new THREE.Color(a);
  return `#${ca.lerp(new THREE.Color(b), clamp01(t)).getHexString()}`;
}
function jitter(hex, rnd, dl = 0.08, ds = 0.06, dh = 0.012) {
  const c = new THREE.Color(hex);
  c.offsetHSL((rnd() - 0.5) * dh * 2, (rnd() - 0.5) * ds * 2, (rnd() - 0.5) * dl * 2);
  return `#${c.getHexString()}`;
}

// Wertrauschen mit mehreren Oktaven auf einem kleinen Raster (0..1)
function valueNoise(n, seed, octaves = 5, base = 3) {
  const rnd = mulberry(seed);
  const out = new Float32Array(n * n);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const g = base << o;
    const grid = new Float32Array((g + 1) * (g + 1)).map(() => rnd());
    for (let y = 0; y < n; y++) {
      const gy = (y / n) * g;
      const iy = Math.floor(gy);
      let fy = gy - iy;
      fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < n; x++) {
        const gx = (x / n) * g;
        const ix = Math.floor(gx);
        let fx = gx - ix;
        fx = fx * fx * (3 - 2 * fx);
        const i = iy * (g + 1) + ix;
        const a = grid[i];
        const b = grid[i + 1];
        const c = grid[i + g + 1];
        const d = grid[i + g + 2];
        out[y * n + x] += amp * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
      }
    }
    total += amp;
    amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Rauschen als farbige Überlagerung (Farbverlauf lo→hi) über die ganze Fläche legen
function noiseWash(ctx, s, seed, lo, hi, alpha, { n = 192, octaves = 5, base = 3, contrast = 1.6 } = {}) {
  const data = valueNoise(n, seed, octaves, base);
  const [c, cx] = makeCanvas(n);
  const img = cx.createImageData(n, n);
  const a = new THREE.Color(lo);
  const b = new THREE.Color(hi);
  const t = new THREE.Color();
  for (let i = 0; i < data.length; i++) {
    const v = clamp01((data[i] - 0.5) * contrast + 0.5);
    t.copy(a).lerp(b, v);
    img.data[i * 4] = t.r * 255;
    img.data[i * 4 + 1] = t.g * 255;
    img.data[i * 4 + 2] = t.b * 255;
    img.data[i * 4 + 3] = 255 * alpha;
  }
  cx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, s, s);
  ctx.restore();
  return data;
}

// Sechseck im Texturraum: Ecken bei 0°, 60°, … (so legt CylinderGeometry die Deckel-UVs an)
function hexPath(ctx, c, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
}
function insideHex(x, y, c, r) {
  const dx = Math.abs(x - c);
  const dy = Math.abs(y - c);
  return dy <= r * 0.866 && dx * 0.866 + dy * 0.5 <= r * 0.866;
}

// Zelle eines Voronoi-Diagramms per Halbebenen-Schnitt (für Gesteinsplatten, Lehmschollen, Felder)
function voronoiCells(points, s) {
  return points.map((p, i) => {
    let poly = [[-s, -s], [2 * s, -s], [2 * s, 2 * s], [-s, 2 * s]];
    for (let j = 0; j < points.length && poly.length; j++) {
      if (j === i) continue;
      const q = points[j];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const nx = q[0] - p[0];
      const ny = q[1] - p[1];
      const side = (v) => (v[0] - mx) * nx + (v[1] - my) * ny;
      const next = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % poly.length];
        const sa = side(a);
        const sb = side(b);
        if (sa <= 0) next.push(a);
        if ((sa <= 0) !== (sb <= 0)) {
          const t = sa / (sa - sb);
          next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      poly = next;
    }
    return poly;
  });
}
function insetPoly(poly, cx, cy, f) {
  return poly.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
}
function roundPoly(ctx, poly, r) {
  ctx.beginPath();
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const k1 = Math.min(r, d1 / 2) / d1;
    const k2 = Math.min(r, d2 / 2) / d2;
    const a = [p1[0] + (p0[0] - p1[0]) * k1, p1[1] + (p0[1] - p1[1]) * k1];
    const b = [p1[0] + (p2[0] - p1[0]) * k2, p1[1] + (p2[1] - p1[1]) * k2];
    if (i === 0) ctx.moveTo(a[0], a[1]);
    else ctx.lineTo(a[0], a[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  ctx.closePath();
}

// Normal-Map aus einer Graustufen-Höhenkarte (Sobel). Tangentenraum wie in three.js (OpenGL, +Y = +v).
function heightToNormal(hcanvas, strength) {
  const n = hcanvas.width;
  const src = hcanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, n, n).data;
  const [c, cx] = makeCanvas(n);
  const img = cx.createImageData(n, n);
  const H = (x, y) => src[(Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))) * 4] / 255;
  const k = strength * (n / 512);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const tl = H(x - 1, y - 1);
      const t = H(x, y - 1);
      const tr = H(x + 1, y - 1);
      const l = H(x - 1, y);
      const r = H(x + 1, y);
      const bl = H(x - 1, y + 1);
      const b = H(x, y + 1);
      const br = H(x + 1, y + 1);
      const dx = (tr + 2 * r + br - tl - 2 * l - bl) * k;
      const dy = (bl + 2 * b + br - tl - 2 * t - tr) * k; // Canvas-y zeigt nach unten = -v
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  return c;
}

// ---------- Malwerkzeug: zeichnet Farbe und Höhe mit denselben Pfaden ----------

function painter(size, hsize) {
  const [col, ctx] = makeCanvas(size);
  const [hgt, hctx] = makeCanvas(hsize, hsize, { willReadFrequently: true });
  hctx.setTransform(hsize / size, 0, 0, hsize / size, 0, 0);
  hctx.fillStyle = grey(0.5);
  hctx.fillRect(0, 0, size, size);
  const P = {
    s: size,
    u: size / 1024,
    c: size / 2,
    ctx,
    hctx,
    col,
    hgt,
    // Pfad füllen: Farbe (oder null) und Höhe (oder null)
    fill(path, color, h, alpha = 1, hAlpha = alpha) {
      if (color) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        path(ctx);
        ctx.fill();
      }
      if (h !== null && h !== undefined) {
        hctx.globalAlpha = hAlpha;
        hctx.fillStyle = typeof h === 'number' ? grey(h) : h(hctx);
        path(hctx);
        hctx.fill();
      }
      ctx.globalAlpha = 1;
      hctx.globalAlpha = 1;
    },
    stroke(path, color, width, h, alpha = 1, hAlpha = alpha, cap = 'round') {
      if (color) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = cap;
        ctx.lineJoin = 'round';
        path(ctx);
        ctx.stroke();
      }
      if (h !== null && h !== undefined) {
        hctx.globalAlpha = hAlpha;
        hctx.strokeStyle = grey(h);
        hctx.lineWidth = width;
        hctx.lineCap = cap;
        hctx.lineJoin = 'round';
        path(hctx);
        hctx.stroke();
      }
      ctx.globalAlpha = 1;
      hctx.globalAlpha = 1;
    },
    // Kuppel in der Höhenkarte (radialer Verlauf)
    dome(x, y, r, top, edge = 0.5, alpha = 1) {
      const g = hctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, grey(top));
      g.addColorStop(1, grey(edge));
      hctx.globalAlpha = alpha;
      hctx.fillStyle = g;
      hctx.beginPath();
      hctx.arc(x, y, r, 0, TAU);
      hctx.fill();
      hctx.globalAlpha = 1;
    },
    clipHex(scale = 1) {
      for (const cx of [ctx, hctx]) {
        cx.save();
        hexPath(cx, size / 2, (size / 2) * scale);
        cx.clip();
      }
    },
    unclip() {
      ctx.restore();
      hctx.restore();
    },
  };
  return P;
}

const circle = (x, y, r) => (c) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
const ellipse = (x, y, rx, ry, rot) => (c) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
const line = (pts) => (c) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
};

function randomInHex(P, rnd, lim = 0.97) {
  for (let k = 0; k < 30; k++) {
    const x = rnd() * P.s;
    const y = rnd() * P.s;
    if (insideHex(x, y, P.c, P.c * lim)) return [x, y];
  }
  return [P.c, P.c];
}

// Innerer Schatten am Rand des Sechsecks (Umgebungsverdeckung durch den Rahmen)
function edgeShade(P, strength = 0.32) {
  const { ctx, s, u } = P;
  ctx.save();
  hexPath(ctx, s / 2, s / 2);
  ctx.clip();
  for (const [w, a] of [[64, 0.05], [44, 0.06], [28, 0.08], [16, 0.1], [7, 0.14]]) {
    ctx.globalAlpha = a * strength * 3;
    ctx.strokeStyle = '#1f150a';
    ctx.lineWidth = w * u;
    hexPath(ctx, s / 2, s / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------- Geländearten ----------

const PAINT = {
  fields(P, rnd) {
    const { ctx, s, u, c } = P;
    ctx.fillStyle = '#c99434';
    ctx.fillRect(0, 0, s, s);
    noiseWash(ctx, s, 11 + rnd() * 1000, '#a8741f', '#e2b64c', 0.8);
    // Äcker: drei Parzellen, getrennt durch Feldwege, jede mit eigener Saatrichtung und Reife
    const a0 = rnd() * TAU;
    const cuts = [a0, a0 + 2.0 + rnd() * 0.4, a0 + 4.1 + rnd() * 0.4];
    const center = [c + (rnd() - 0.5) * 120 * u, c + (rnd() - 0.5) * 120 * u];
    const tints = [['#b07a1f', '#e8bd4f'], ['#a8741f', '#dfb246'], ['#b8852a', '#eec766']];
    if (rnd() < 0.5) tints[Math.floor(rnd() * 3)] = ['#9a7f2c', '#cfb456']; // ein Acker noch etwas grünlich
    for (let p = 0; p < 3; p++) {
      const aA = cuts[p];
      const aB = cuts[(p + 1) % 3] + (p === 2 ? TAU : 0);
      const R = s;
      const poly = [center];
      for (let k = 0; k <= 12; k++) {
        const a = aA + ((aB - aA) * k) / 12;
        poly.push([center[0] + Math.cos(a) * R, center[1] + Math.sin(a) * R]);
      }
      for (const cx of [ctx, P.hctx]) {
        cx.save();
        cx.beginPath();
        poly.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
        cx.closePath();
        cx.clip();
      }
      const dir = (aA + aB) / 2 + Math.PI / 2 + (rnd() - 0.5) * 0.6;
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const nx = -dy;
      const ny = dx;
      const [lo, hi] = tints[p];
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = mix(lo, hi, 0.5);
      ctx.fillRect(0, 0, s, s);
      ctx.globalAlpha = 1;
      const rowGap = 11 * u;
      const step = 3.1 * u;
      for (let r = -s; r < s; r += rowGap) {
        // Furche zwischen den Reihen
        const fx = c + nx * r;
        const fy = c + ny * r;
        P.stroke(line([[fx - dx * s, fy - dy * s], [fx + dx * s, fy + dy * s]]), mix(lo, '#6b4a14', 0.55), 3.2 * u, 0.3, 0.55, 0.9);
        for (let t = -s; t < s; t += step * (0.8 + rnd() * 0.4)) {
          const x = c + nx * (r + rowGap / 2 + (rnd() - 0.5) * 3.5 * u) + dx * t;
          const y = c + ny * (r + rowGap / 2 + (rnd() - 0.5) * 3.5 * u) + dy * t;
          if (x < -10 || y < -10 || x > s + 10 || y > s + 10) continue;
          const len = (3.2 + rnd() * 2.4) * u;
          const ang = dir + Math.PI / 2 + (rnd() - 0.5) * 0.9;
          const col = mix(lo, hi, rnd() * 0.85 + 0.15);
          P.fill(ellipse(x, y, len, 1.5 * u + rnd() * 0.8 * u, ang), col, 0.62 + rnd() * 0.25, 0.95);
          if (rnd() < 0.18) P.fill(circle(x + Math.cos(ang) * len * 0.6, y + Math.sin(ang) * len * 0.6, 0.9 * u), '#fff1b8', null, 0.7);
        }
      }
      P.unclip();
    }
    // Feldwege zwischen den Parzellen
    for (const a of cuts) {
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const d = (k / 24) * s * 0.75;
        const wob = Math.sin(k * 0.9 + a * 3) * 6 * u;
        pts.push([center[0] + Math.cos(a) * d - Math.sin(a) * wob, center[1] + Math.sin(a) * d + Math.cos(a) * wob]);
      }
      P.stroke(line(pts), '#8b6a3a', 20 * u, 0.36, 1, 1);
      P.stroke(line(pts), '#a9885a', 12 * u, 0.4, 1, 1);
      P.stroke(line(pts.map(([x, y]) => [x + 2 * u, y + 2 * u])), '#c4a574', 3 * u, null, 0.6);
      for (let k = 0; k < 40; k++) {
        const q = pts[Math.floor(rnd() * pts.length)];
        P.fill(circle(q[0] + (rnd() - 0.5) * 14 * u, q[1] + (rnd() - 0.5) * 14 * u, (1 + rnd() * 1.6) * u), jitter('#7d6a52', rnd), 0.55, 0.9);
      }
    }
    // Mohn- und Kornblumen
    for (let i = 0; i < 160; i++) {
      const [x, y] = randomInHex(P, rnd);
      P.fill(circle(x, y, (1.6 + rnd() * 1.4) * u), rnd() < 0.7 ? '#c7382a' : '#4c78c8', 0.7, 0.95);
    }
  },

  pasture(P, rnd) {
    const { ctx, s, u } = P;
    ctx.fillStyle = '#7cb247';
    ctx.fillRect(0, 0, s, s);
    noiseWash(ctx, s, 21 + rnd() * 1000, '#5f9a35', '#a3d160', 0.85, { contrast: 1.9 });
    noiseWash(ctx, s, 23 + rnd() * 1000, '#4d8a2e', '#9fcf5a', 0.25, { base: 12, octaves: 3, contrast: 2.2 });
    // Trampelpfad der Herde
    const pts = [];
    const a = rnd() * TAU;
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      pts.push([P.c + Math.cos(a) * (t - 0.5) * s * 1.1 + Math.sin(t * 7 + a) * 26 * u, P.c + Math.sin(a) * (t - 0.5) * s * 1.1 + Math.cos(t * 5) * 22 * u]);
    }
    P.stroke(line(pts), '#98a45a', 26 * u, 0.44, 0.55, 1);
    P.stroke(line(pts), '#b0a66c', 12 * u, 0.42, 0.5, 1);
    // Grashalme in Büscheln
    const n = 52000;
    for (let i = 0; i < n; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const len = (3 + rnd() * 6) * u;
      const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
      const light = rnd();
      const col = light > 0.8 ? jitter('#b6de72', rnd, 0.06) : light > 0.3 ? jitter('#7ab545', rnd, 0.1) : jitter('#4f8a2c', rnd, 0.08);
      P.stroke(line([[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]]), col, (1 + rnd() * 1.1) * u, 0.52 + light * 0.2, 0.9, 0.6);
    }
    // dunklere Grasbüschel und Klee
    for (let i = 0; i < 520; i++) {
      const [x, y] = randomInHex(P, rnd, 1.02);
      const r = (5 + rnd() * 9) * u;
      P.fill(circle(x, y, r), '#3f7a27', null, 0.35);
      for (let k = 0; k < 14; k++) {
        const ang = rnd() * TAU;
        const len = r * (0.6 + rnd() * 0.8);
        P.stroke(line([[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]]), jitter('#5d9a36', rnd, 0.1), 1.6 * u, 0.7, 0.9, 0.9);
      }
      P.dome(x, y, r * 1.1, 0.72, 0.5, 0.8);
    }
    // Blümchen
    for (let i = 0; i < 700; i++) {
      const [x, y] = randomInHex(P, rnd, 1.02);
      const col = ['#fffbea', '#fff2a8', '#f7d4e2', '#ffffff'][Math.floor(rnd() * 4)];
      P.fill(circle(x, y, (1.3 + rnd() * 1.3) * u), col, 0.7, 0.95);
    }
    // ein paar Feldsteine
    for (let i = 0; i < 14; i++) {
      const [x, y] = randomInHex(P, rnd, 0.9);
      const r = (4 + rnd() * 7) * u;
      P.fill(ellipse(x + 2 * u, y + 2 * u, r * 1.1, r * 0.8, rnd()), '#2f4a1d', null, 0.4);
      P.fill(ellipse(x, y, r, r * 0.75, rnd() * 3), jitter('#a6a59a', rnd, 0.1), null);
      P.dome(x, y, r, 0.95, 0.55);
      P.fill(circle(x - r * 0.3, y - r * 0.3, r * 0.35), '#d8d6cc', null, 0.6);
    }
  },

  forest(P, rnd) {
    const { ctx, s, u } = P;
    ctx.fillStyle = '#34512a';
    ctx.fillRect(0, 0, s, s);
    noiseWash(ctx, s, 31 + rnd() * 1000, '#2a4220', '#5b7a36', 0.9, { contrast: 1.8 });
    // Waldboden: Nadeln, Laub, Moos
    for (let i = 0; i < 16000; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const ang = rnd() * TAU;
      const len = (2 + rnd() * 4) * u;
      const col = rnd() < 0.3 ? jitter('#6b5a2e', rnd) : jitter('#3d5a28', rnd, 0.1);
      P.stroke(line([[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]]), col, 1.3 * u, 0.45, 0.8, 0.5);
    }
    // Baumkronen von oben: dunkler Schattenhof, dann Krone mit hellem Zentrum
    const trees = [];
    // Poisson-artig verteilen, damit der Wald dicht, aber nicht verklumpt wirkt
    for (let i = 0; i < 5000 && trees.length < 330; i++) {
      const [x, y] = randomInHex(P, rnd, 1.06);
      const r = (22 + rnd() * 22) * u;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.62)) continue;
      trees.push({ x, y, r, pine: rnd() < 0.55 });
    }
    trees.sort((a, b) => a.r - b.r);
    for (const t of trees) {
      P.fill(circle(t.x, t.y, t.r * 1.18), '#10200c', null, 0.45);
    }
    for (const t of trees) {
      const { x, y, r } = t;
      if (t.pine) {
        // Nadelbaum: sternförmige Krone mit Ästen
        const pts = 13 + Math.floor(rnd() * 5);
        const base = jitter('#28491f', rnd, 0.06);
        for (let layer = 0; layer < 4; layer++) {
          const rr = r * (1 - layer * 0.22);
          const col = mix(base, '#6c9a45', layer * 0.17);
          const rot = rnd() * TAU;
          const star = (c) => {
            c.beginPath();
            for (let k = 0; k < pts * 2; k++) {
              const a = rot + (k / (pts * 2)) * TAU;
              const rad = k % 2 ? rr * 0.74 : rr * (0.92 + rnd() * 0.08);
              c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
            }
            c.closePath();
          };
          P.fill(star, col, 0.6 + layer * 0.1, 1);
        }
        P.fill(circle(x, y, r * 0.1), '#93bd6a', 0.98);
      } else {
        // Laubbaum: Wolke aus Blattbüscheln
        const base = jitter('#3a6426', rnd, 0.08, 0.08, 0.02);
        const blobs = 6 + Math.floor(rnd() * 4);
        for (let k = 0; k < blobs; k++) {
          const a = rnd() * TAU;
          const d = r * 0.45 * rnd();
          const br = r * (0.45 + rnd() * 0.25);
          P.fill(circle(x + Math.cos(a) * d, y + Math.sin(a) * d, br), mix(base, '#1f3b16', 0.25), null);
        }
        for (let k = 0; k < blobs; k++) {
          const a = rnd() * TAU;
          const d = r * 0.35 * rnd();
          const br = r * (0.3 + rnd() * 0.2);
          P.fill(circle(x + Math.cos(a) * d, y + Math.sin(a) * d, br), mix(base, '#86b352', 0.15 + rnd() * 0.25), null, 0.9);
        }
        P.dome(x, y, r, 0.95, 0.55);
        for (let k = 0; k < 10; k++) {
          const a = rnd() * TAU;
          const d = r * 0.6 * rnd();
          P.fill(circle(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.08), '#a2c878', null, 0.45);
        }
      }
    }
  },

  hills(P, rnd) {
    const { ctx, s, u, c } = P;
    ctx.fillStyle = '#b95637';
    ctx.fillRect(0, 0, s, s);
    noiseWash(ctx, s, 41 + rnd() * 1000, '#9c4128', '#d77a52', 0.85, { contrast: 1.8 });
    // Lehmschollen: Voronoi-Platten mit feinen Rissen
    const pts = [];
    for (let i = 0; i < 55; i++) pts.push([rnd() * s, rnd() * s]);
    const cells = voronoiCells(pts, s);
    cells.forEach((poly, i) => {
      if (poly.length < 3) return;
      const [px, py] = pts[i];
      const inner = insetPoly(poly, px, py, 0.95);
      P.fill((cx) => roundPoly(cx, inner, 16 * u), jitter('#c4623f', rnd, 0.05, 0.05), 0.55 + rnd() * 0.1, 0.2, 1);
      P.stroke((cx) => roundPoly(cx, poly, 10 * u), '#7a3019', 1.5 * u, 0.3, 0.18, 0.9);
    });
    // Körnung
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      P.fill(circle(x, y, (0.6 + rnd() * 1.4) * u), rnd() < 0.5 ? '#8e3a22' : '#e0906a', null, 0.35 + rnd() * 0.3);
    }
    // Lehmgruben mit Terrassen
    const pits = 2 + Math.floor(rnd() * 2);
    for (let p = 0; p < pits; p++) {
      const ang = rnd() * TAU;
      const d = (170 + rnd() * 150) * u;
      const x = c + Math.cos(ang) * d;
      const y = c + Math.sin(ang) * d;
      const R = (70 + rnd() * 50) * u;
      const rot = rnd() * TAU;
      // Wall aus Aushub, dann Stufen nach unten
      P.fill(ellipse(x, y, R * 1.12, R * 0.9, rot), '#d98660', 0.62, 0.55);
      for (let k = 0; k < 6; k++) {
        const f = 1 - k * 0.15;
        P.fill(ellipse(x + k * 1.5 * u, y + k * 1.5 * u, R * f, R * f * 0.78, rot), mix('#b0502f', '#6a2715', k / 5), 0.46 - k * 0.06, 0.55 + k * 0.05, 1);
      }
      for (let k = 0; k < 18; k++) {
        const a = rnd() * TAU;
        P.fill(circle(x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * 0.85, (3 + rnd() * 5) * u), jitter('#c96a45', rnd), 0.7, 0.9);
      }
    }
    // Steine und Lehmbrocken
    for (let i = 0; i < 90; i++) {
      const [x, y] = randomInHex(P, rnd);
      const r = (2 + rnd() * 5) * u;
      P.fill(circle(x + r * 0.4, y + r * 0.4, r), '#5a2011', null, 0.5);
      P.fill(ellipse(x, y, r, r * 0.8, rnd() * 3), jitter('#d27a55', rnd, 0.1), null);
      P.dome(x, y, r, 0.85, 0.5);
    }
  },

  mountains(P, rnd) {
    const { ctx, s, u } = P;
    ctx.fillStyle = '#9d9f9b';
    ctx.fillRect(0, 0, s, s);
    noiseWash(ctx, s, 51 + rnd() * 1000, '#7f8380', '#bfc0ba', 0.9, { contrast: 1.7 });
    noiseWash(ctx, s, 53 + rnd() * 1000, '#80837f', '#c4c5bf', 0.22, { base: 14, octaves: 3, contrast: 2 });
    // Klüfte im Fels
    for (let i = 0; i < 8; i++) {
      const [x0, y0] = randomInHex(P, rnd, 0.95);
      const pts = [[x0, y0]];
      let ang = rnd() * TAU;
      for (let k = 0; k < 10; k++) {
        ang += (rnd() - 0.5) * 1.1;
        const [lx, ly] = pts[pts.length - 1];
        pts.push([lx + Math.cos(ang) * 24 * u, ly + Math.sin(ang) * 24 * u]);
      }
      P.stroke(line(pts), '#3c3f3e', (6 + rnd() * 5) * u, 0.15, 0.8, 1);
      P.stroke(line(pts.map(([x, y]) => [x - 3 * u, y - 3 * u])), '#c9cac4', 1.6 * u, null, 0.5);
    }
    // Felsbrocken: kantig, facettiert, mit dunklem Fugenhof – von groß nach klein
    const boulder = (x, y, r) => {
      const n = 5 + Math.floor(rnd() * 4);
      const rot = rnd() * TAU;
      const poly = [];
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * TAU + (rnd() - 0.5) * 0.5;
        const rr = r * (0.72 + rnd() * 0.32);
        poly.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86]);
      }
      const base = jitter('#999b97', rnd, 0.11, 0.04);
      P.fill((c) => roundPoly(c, insetPoly(poly, x, y, 1.14), 4 * u), '#4a4d4b', 0.2, 0.4, 0.8);
      P.fill((c) => roundPoly(c, poly, 3 * u), base, null);
      const peak = [x + (rnd() - 0.5) * r * 0.5, y + (rnd() - 0.5) * r * 0.5];
      for (let k = 0; k < n; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % n];
        P.fill((c) => { c.beginPath(); c.moveTo(peak[0], peak[1]); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath(); }, mix(base, rnd() < 0.5 ? '#d8d9d3' : '#5d605e', 0.08 + rnd() * 0.14), null);
        P.stroke(line([peak, a]), '#6a6d6b', 1.1 * u, null, 0.3);
      }
      P.dome(peak[0], peak[1], r * 1.05, 0.62 + Math.min(0.35, r / (200 * u)), 0.42);
      P.stroke((c) => roundPoly(c, poly, 3 * u), '#3e4140', 1.6 * u, null, 0.7);
      // Flechten
      if (rnd() < 0.5) P.fill(circle(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, r * (0.12 + rnd() * 0.15)), rnd() < 0.5 ? '#8f9a62' : '#b7b58a', null, 0.55);
    };
    for (let i = 0; i < 16; i++) boulder(...randomInHex(P, rnd, 0.98), (42 + rnd() * 46) * u);
    for (let i = 0; i < 70; i++) boulder(...randomInHex(P, rnd, 1.02), (14 + rnd() * 20) * u);
    // Moos in Senken
    for (let i = 0; i < 90; i++) {
      const [x, y] = randomInHex(P, rnd, 1.02);
      P.fill(circle(x, y, (4 + rnd() * 9) * u), rnd() < 0.5 ? '#667849' : '#7a8a55', null, 0.3);
    }
    // Geröll
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = (1 + rnd() * 3.4) * u;
      P.fill(circle(x + r * 0.35, y + r * 0.35, r), '#4f5250', null, 0.4);
      P.fill(ellipse(x, y, r, r * 0.8, rnd() * 3), jitter('#b0b1ad', rnd, 0.14), 0.72, 0.9);
    }
    // Erzadern mit Glitzer
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = randomInHex(P, rnd, 0.85);
      const pts2 = [[x0, y0]];
      let ang = rnd() * TAU;
      for (let k = 0; k < 6; k++) {
        ang += (rnd() - 0.5) * 1.2;
        const [lx, ly] = pts2[pts2.length - 1];
        pts2.push([lx + Math.cos(ang) * 16 * u, ly + Math.sin(ang) * 16 * u]);
      }
      P.stroke(line(pts2), '#3a4450', 4.5 * u, 0.32, 0.75);
      P.stroke(line(pts2), '#a9bccd', 1.6 * u, null, 0.9);
      for (const [px, py] of pts2) P.fill(circle(px, py, 2 * u), '#e6eef5', 0.7, 0.9);
    }
  },

  desert(P, rnd) {
    const { ctx, s, u } = P;
    ctx.fillStyle = '#e2cd98';
    ctx.fillRect(0, 0, s, s);
    const dunes = noiseWash(ctx, s, 61 + rnd() * 1000, '#d9c28e', '#f5e9c8', 0.9, { contrast: 1.7, octaves: 4, base: 2 });
    // Rippeln im Sand: nur auf den Dünenrücken deutlich, in Senken verlaufen sie
    const ang = rnd() * Math.PI;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const n = Math.sqrt(dunes.length);
    const duneAt = (x, y) => dunes[Math.min(n - 1, Math.max(0, Math.floor((y / s) * n))) * n + Math.min(n - 1, Math.max(0, Math.floor((x / s) * n)))];
    for (let r = -s; r < s; r += (13 + rnd() * 6) * u) {
      let pts = [];
      const flush = () => {
        if (pts.length > 2) {
          P.stroke(line(pts), '#c4a569', 3.2 * u, 0.42, 0.22, 0.8);
          P.stroke(line(pts.map(([x, y]) => [x - dy * 3.5 * u, y + dx * 3.5 * u])), '#f6ead0', 2.4 * u, 0.58, 0.22, 0.8);
        }
        pts = [];
      };
      for (let t = -s; t <= s; t += 8 * u) {
        const w = Math.sin(t / (70 * u) + r * 0.013) * 12 * u + Math.sin(t / (23 * u) + r) * 2.5 * u;
        const x = P.c - dy * (r + w) + dx * t;
        const y = P.c + dx * (r + w) + dy * t;
        if (duneAt(x, y) > 0.54) pts.push([x, y]);
        else flush();
      }
      flush();
    }
    for (let i = 0; i < 16000; i++) {
      P.fill(circle(rnd() * s, rnd() * s, (0.5 + rnd()) * u), rnd() < 0.5 ? '#b89c63' : '#fff6de', null, 0.5);
    }
    // Kiesel, trockene Sträucher, eine Oase aus Gras
    for (let i = 0; i < 70; i++) {
      const [x, y] = randomInHex(P, rnd);
      const r = (2 + rnd() * 4) * u;
      P.fill(circle(x + r * 0.4, y + r * 0.4, r), '#9c8052', null, 0.5);
      P.fill(ellipse(x, y, r, r * 0.8, rnd() * 3), jitter('#c9b89a', rnd, 0.15), 0.8);
    }
    for (let i = 0; i < 24; i++) {
      const [x, y] = randomInHex(P, rnd, 0.9);
      for (let k = 0; k < 12; k++) {
        const a = rnd() * TAU;
        const l = (5 + rnd() * 9) * u;
        P.stroke(line([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]]), '#8a7a45', 1.3 * u, 0.62, 0.9);
      }
    }
  },
};

// Malt eine Geländeart (Farbe + Normal-Map). size: Kantenlänge der Farbtextur.
export function paintTerrain(terrain, size, { normalSize = size / 2, anisotropy = 8 } = {}) {
  const key = `${terrain}:${size}:${normalSize}`;
  if (cache.has(key)) return cache.get(key);
  const P = painter(size, normalSize);
  const rnd = mulberry(terrain.length * 977 + terrain.charCodeAt(0) * 31);
  (PAINT[terrain] || PAINT.desert)(P, rnd);
  edgeShade(P, terrain === 'desert' ? 0.22 : 0.3);
  const map = new THREE.CanvasTexture(P.col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const strength = { fields: 2.6, pasture: 2.2, forest: 3.2, hills: 2.4, mountains: 3.6, desert: 1.8 }[terrain] || 2;
  const normalMap = new THREE.CanvasTexture(heightToNormal(P.hgt, strength));
  normalMap.anisotropy = anisotropy;
  const set = { map, normalMap };
  cache.set(key, set);
  return set;
}

export const terrainCached = (terrain, size, normalSize = size / 2) => cache.has(`${terrain}:${size}:${normalSize}`);

// Klippen rund um die Insel: geschichteter Fels mit runden Steinen, oben eine Grasnarbe (in x kachelbar)
export function paintCliff(size = 1024, { anisotropy = 8 } = {}) {
  const key = `cliff:${size}`;
  if (cache.has(key)) return cache.get(key);
  const w = size;
  const h = size / 2;
  const [col, ctx] = makeCanvas(w, h);
  const [hgt, hctx] = makeCanvas(w / 2, h / 2, { willReadFrequently: true });
  hctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  const rnd = mulberry(4711);
  const u = size / 1024;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6a5642');
  g.addColorStop(0.3, '#57463a');
  g.addColorStop(0.46, '#3b3029');
  g.addColorStop(1, '#231c17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  hctx.fillStyle = grey(0.35);
  hctx.fillRect(0, 0, w, h);
  // Steine in Lagen, von oben nach unten dunkler und feuchter
  const both = (fn) => { fn(ctx, 0); fn(ctx, -w); fn(ctx, w); fn(hctx, 0); fn(hctx, -w); fn(hctx, w); };
  for (let y = 10 * u; y < h; y += (16 + rnd() * 10) * u) {
    for (let x = rnd() * 30 * u; x < w; x += (26 + rnd() * 30) * u) {
      const rx = (12 + rnd() * 16) * u;
      const ry = (7 + rnd() * 6) * u;
      const t = y / h;
      const base = mix(mix('#8d7a66', '#6f6a64', rnd()), '#2e2823', Math.min(1, t * 1.5));
      const hi = mix(base, '#c9b9a2', 0.35 * (1 - t));
      both((c, off) => {
        const isH = c === hctx;
        c.fillStyle = isH ? grey(0.15) : 'rgba(20,14,10,0.55)';
        c.beginPath();
        c.ellipse(x + off + 2 * u, y + 3 * u, rx * 1.08, ry * 1.1, 0, 0, TAU);
        c.fill();
        if (isH) {
          const gg = c.createRadialGradient(x + off, y - ry * 0.3, 0, x + off, y, rx);
          gg.addColorStop(0, grey(0.9));
          gg.addColorStop(1, grey(0.45));
          c.fillStyle = gg;
        } else {
          const gg = c.createLinearGradient(0, y - ry, 0, y + ry);
          gg.addColorStop(0, hi);
          gg.addColorStop(1, base);
          c.fillStyle = gg;
        }
        c.beginPath();
        c.ellipse(x + off, y, rx, ry, (rnd() - 0.5) * 0.2, 0, TAU);
        c.fill();
      });
    }
  }
  // Grasnarbe mit überhängenden Halmen und Erdkante
  for (let x = 0; x < w; x += 2 * u) {
    const len = (6 + rnd() * 12) * u;
    ctx.strokeStyle = mix('#4f7a31', '#86b04e', rnd());
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 4 * u, len);
    ctx.stroke();
    hctx.strokeStyle = grey(0.8);
    hctx.lineWidth = 2 * u;
    hctx.beginPath();
    hctx.moveTo(x, 0);
    hctx.lineTo(x, len);
    hctx.stroke();
  }
  ctx.fillStyle = 'rgba(60,45,30,0.5)';
  ctx.fillRect(0, 14 * u, w, 5 * u);
  // Nasse Zone an der Wasserlinie
  const wet = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.48);
  wet.addColorStop(0, 'rgba(15,30,30,0)');
  wet.addColorStop(1, 'rgba(15,35,35,0.45)');
  ctx.fillStyle = wet;
  ctx.fillRect(0, h * 0.34, w, h * 0.66);
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.set(3, 1);
  const normalMap = new THREE.CanvasTexture(heightToNormalRect(hgt, 2.5));
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.repeat.set(3, 1);
  const set = { map, normalMap };
  cache.set(key, set);
  return set;
}

function heightToNormalRect(hcanvas, strength) {
  const W = hcanvas.width;
  const Hh = hcanvas.height;
  const src = hcanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, Hh).data;
  const [c, cx] = makeCanvas(W, Hh);
  const img = cx.createImageData(W, Hh);
  const H = (x, y) => src[(Math.min(Hh - 1, Math.max(0, y)) * W + ((x + W) % W)) * 4] / 255;
  const k = strength * (W / 512);
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * k;
      const dy = (H(x, y + 1) - H(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  return c;
}
