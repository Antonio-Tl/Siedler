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

function speckle(ctx, s, rnd, base, n, rMax, spread = 0.35, alpha = [0.3, 0.7]) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade(base, (rnd() - 0.5) * spread);
    ctx.globalAlpha = alpha[0] + rnd() * (alpha[1] - alpha[0]);
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, 0.6 + rnd() * rMax, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function terrainTexture(terrain, seed) {
  const base = TERRAIN_COLORS[terrain];
  const rnd = mulberry(seed);
  return canvasTex(512, (ctx, s) => {
    const grad = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.7);
    grad.addColorStop(0, shade(base, 0.08));
    grad.addColorStop(1, shade(base, -0.12));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    // große, weiche Farbflecken
    for (let i = 0; i < 26; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 30 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = new THREE.Color(shade(base, (rnd() - 0.5) * 0.3));
      g.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0.45)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    switch (terrain) {
      case 'fields': {
        // Ährenreihen
        ctx.lineCap = 'round';
        for (let row = -s; row < s * 2; row += 13) {
          for (let x = -20; x < s + 20; x += 4) {
            const y = row + x * 0.35 + (rnd() - 0.5) * 3;
            ctx.strokeStyle = shade(base, (rnd() - 0.3) * 0.35);
            ctx.globalAlpha = 0.55 + rnd() * 0.4;
            ctx.lineWidth = 1.5 + rnd();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rnd() - 0.5) * 3, y - 5 - rnd() * 4);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = shade(base, -0.35);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-20, row + 5 - 7);
          ctx.lineTo(s + 20, row + 5 + (s + 40) * 0.35 - 7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'pasture': {
        for (let i = 0; i < 2600; i++) {
          const x = rnd() * s;
          const y = rnd() * s;
          ctx.strokeStyle = shade(base, (rnd() - 0.45) * 0.45);
          ctx.globalAlpha = 0.5 + rnd() * 0.5;
          ctx.lineWidth = 1 + rnd();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 70; i++) {
          ctx.fillStyle = ['#fff7e0', '#f6e27a', '#f2c9d8'][Math.floor(rnd() * 3)];
          ctx.beginPath();
          ctx.arc(rnd() * s, rnd() * s, 1.5 + rnd() * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'forest': {
        speckle(ctx, s, rnd, base, 2200, 4, 0.5);
        // Moos und Waldboden
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = rnd() > 0.5 ? '#2f4f25' : '#5d7a3a';
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.ellipse(rnd() * s, rnd() * s, 10 + rnd() * 26, 6 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'hills': {
        speckle(ctx, s, rnd, base, 1400, 3, 0.4);
        // Risse im Lehm
        ctx.strokeStyle = shade(base, -0.4);
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 40; i++) {
          let x = rnd() * s;
          let y = rnd() * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (rnd() - 0.5) * 34;
            y += (rnd() - 0.5) * 34;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 22; i++) {
          ctx.fillStyle = shade(base, -0.25);
          ctx.beginPath();
          ctx.ellipse(rnd() * s, rnd() * s, 8 + rnd() * 16, 5 + rnd() * 9, rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'mountains': {
        for (let i = 0; i < 140; i++) {
          const x = rnd() * s;
          const y = rnd() * s;
          const r = 6 + rnd() * 22;
          ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.4);
          ctx.strokeStyle = shade(base, -0.4);
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          const n = 5 + Math.floor(rnd() * 3);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const rr = r * (0.7 + rnd() * 0.4);
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        speckle(ctx, s, rnd, base, 1400, 2, 0.6);
        break;
      }
      case 'desert': {
        speckle(ctx, s, rnd, base, 900, 2, 0.25);
        ctx.strokeStyle = shade(base, -0.14);
        ctx.lineWidth = 2;
        for (let y = 6; y < s; y += 18) {
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          for (let x = 0; x <= s; x += 6) ctx.lineTo(x, y + Math.sin(x / 26 + y * 0.7) * 6 + Math.sin(x / 9) * 1.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      default:
    }
  });
}

export function rockTexture() {
  const rnd = mulberry(77);
  const tex = canvasTex(512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6b5540');
    g.addColorStop(0.25, '#54412f');
    g.addColorStop(1, '#2a2019');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Gesteinsschichten
    for (let y = 10; y < h; y += 10 + rnd() * 16) {
      ctx.strokeStyle = `rgba(20,14,8,${0.3 + rnd() * 0.3})`;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + (rnd() - 0.5) * 5);
      ctx.stroke();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${140 + rnd() * 60},${120 + rnd() * 50},${95 + rnd() * 40},${0.12 + rnd() * 0.2})`;
      ctx.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 18, 2 + rnd() * 6);
    }
    // Grasnarbe oben
    ctx.fillStyle = 'rgba(70,95,45,0.8)';
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 3, 4 + rnd() * 7);
  }, { h: 256 });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

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

export function tokenTexture(n) {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    const grad = ctx.createRadialGradient(c * 0.85, c * 0.75, 10, c, c, c);
    grad.addColorStop(0, '#fdf6e2');
    grad.addColorStop(0.8, '#efdfb9');
    grad.addColorStop(1, '#d9c190');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#b8995e';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(110,86,52,.6)';
    ctx.beginPath();
    ctx.arc(c, c, c - 16, 0, Math.PI * 2);
    ctx.stroke();
    const red = n === 6 || n === 8;
    ctx.fillStyle = red ? '#a3261c' : '#2e2519';
    ctx.font = `700 ${red ? 140 : 128}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), c, c - 10);
    const pips = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[n];
    for (let i = 0; i < pips; i++) {
      ctx.beginPath();
      ctx.arc(c + (i - (pips - 1) / 2) * 17, c + 66, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

const HARBOR_LABEL = { any: 'ALLES', wood: 'HOLZ', brick: 'LEHM', sheep: 'WOLLE', wheat: 'GETREIDE', ore: 'ERZ' };

export function harborTexture(type, image) {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    const grad = ctx.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
    grad.addColorStop(0, '#fbf2dc');
    grad.addColorStop(1, '#e2cc9c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#7a5530';
    ctx.stroke();
    ctx.fillStyle = '#3b2a18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 70px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(type === 'any' ? '3:1' : '2:1', c, c - 42);
    if (image) ctx.drawImage(image, c - 38, c - 14, 76, 76);
    else {
      ctx.font = '60px sans-serif';
      ctx.fillText('⚓', c, c + 24);
    }
    ctx.font = '600 24px Inter, sans-serif';
    ctx.fillText(HARBOR_LABEL[type], c, c + 82);
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
