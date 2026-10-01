// Handgezeichnete SVG-Grafiken: Rohstoffe, Porträts, Bau-Icons, Karten und Illustrationen.
// Jede Grafik bekommt eigene IDs für Verläufe, damit mehrere Exemplare im DOM nicht kollidieren.

import { emblem } from './art/emblems.js';

let counter = 0;
const uid = () => `a${(counter++).toString(36)}`;

// ---------- Rohstoffe ----------

function logSvg(cx, cy, r, u) {
  const dx = -10;
  const dy = -6;
  return `<path d="M${cx + dx} ${cy + dy - r} L${cx} ${cy - r} A${r * 0.78} ${r} 0 0 1 ${cx} ${cy + r} L${cx + dx} ${cy + dy + r} A${r * 0.78} ${r} 0 0 1 ${cx + dx} ${cy + dy - r} Z" fill="url(#b${u})" stroke="#3b220f" stroke-width=".8"/>
    <path d="M${cx + dx + 2} ${cy + dy - r * 0.35} L${cx - 3} ${cy - r * 0.45} M${cx + dx + 3} ${cy + dy + r * 0.4} L${cx - 2} ${cy + r * 0.3}" stroke="#4a2b14" stroke-width=".8" opacity=".6"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.78}" ry="${r}" fill="url(#e${u})" stroke="#6b421f" stroke-width=".9"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.5}" ry="${r * 0.64}" fill="none" stroke="#b07a42" stroke-width=".7"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.24}" ry="${r * 0.3}" fill="none" stroke="#b07a42" stroke-width=".7"/>`;
}

const RESOURCE_ART = {
  wood(u) {
    const logs = [[20, 47], [34, 47], [48, 47], [27, 35], [41, 35], [34, 23]];
    return `<defs>
      <linearGradient id="b${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a06c3c"/><stop offset=".55" stop-color="#744624"/><stop offset="1" stop-color="#4a2a12"/></linearGradient>
      <radialGradient id="e${u}"><stop offset="0" stop-color="#f3d8a2"/><stop offset=".75" stop-color="#d7a767"/><stop offset="1" stop-color="#9a6632"/></radialGradient></defs>
      <ellipse cx="32" cy="57" rx="25" ry="3.5" fill="#000" opacity=".18"/>
      ${logs.map(([x, y]) => logSvg(x, y, 7, u)).join('')}`;
  },
  brick(u) {
    const brick = (x, y) => `<g transform="translate(${x} ${y})">
      <path d="M0 6 L6 0 L26 0 L20 6 Z" fill="url(#t${u})" stroke="#6e2414" stroke-width=".7"/>
      <path d="M20 6 L26 0 L26 9 L20 15 Z" fill="#7d2815" stroke="#6e2414" stroke-width=".7"/>
      <rect x="0" y="6" width="20" height="9" fill="url(#f${u})" stroke="#6e2414" stroke-width=".7"/>
      <path d="M3 9 h3 M10 12 h4 M15 8 h2" stroke="#8f3219" stroke-width=".8" opacity=".6"/></g>`;
    return `<defs>
      <linearGradient id="f${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9573a"/><stop offset="1" stop-color="#9c3a22"/></linearGradient>
      <linearGradient id="t${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e38a67"/><stop offset="1" stop-color="#d06a48"/></linearGradient></defs>
      <ellipse cx="33" cy="57" rx="25" ry="3.5" fill="#000" opacity=".18"/>
      ${brick(6, 40)}${brick(27, 40)}${brick(16, 27)}${brick(37, 27)}${brick(12, 14)}`;
  },
  sheep(u) {
    return `<defs><radialGradient id="w${u}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fffdf6"/><stop offset=".7" stop-color="#ece2cb"/><stop offset="1" stop-color="#c9b994"/></radialGradient></defs>
      <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#000" opacity=".18"/>
      <path d="M44 48 C52 52 56 50 58 56" fill="none" stroke="#d9cba8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="31" cy="34" r="20" fill="url(#w${u})" stroke="#b8a680" stroke-width="1"/>
      <g fill="none" stroke="#c7b58e" stroke-width="1.6" stroke-linecap="round">
        <path d="M14 30 C22 18 40 16 49 26"/><path d="M13 38 C24 24 42 24 51 36"/><path d="M17 46 C26 34 42 34 48 45"/>
        <path d="M24 16 C18 28 20 44 28 53"/><path d="M36 15 C28 26 29 42 38 53"/></g>
      <path d="M20 22 C26 17 34 16 40 18" fill="none" stroke="#fff" stroke-width="2" opacity=".7" stroke-linecap="round"/>`;
  },
  wheat(u) {
    const stalk = (x2, y2, rot) => `<line x1="32" y1="56" x2="${x2}" y2="${y2}" stroke="#b98a2c" stroke-width="1.3"/>
      <g transform="translate(${x2} ${y2}) rotate(${rot})">${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${i % 2 ? 2 : -2}" cy="${-i * 3.4}" rx="2.1" ry="3.4" fill="url(#g${u})" stroke="#a87922" stroke-width=".5" transform="rotate(${i % 2 ? 25 : -25} ${i % 2 ? 2 : -2} ${-i * 3.4})"/>`).join('')}
      <line x1="0" y1="-15" x2="${rot > 0 ? 4 : -4}" y2="-22" stroke="#c99a3c" stroke-width=".6"/></g>`;
    const spread = [[14, 22, -32], [20, 16, -20], [27, 12, -8], [34, 11, 4], [41, 13, 15], [47, 18, 26], [51, 25, 36], [24, 20, -14], [38, 18, 10]];
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d27a"/><stop offset="1" stop-color="#d49f36"/></linearGradient></defs>
      <ellipse cx="32" cy="58" rx="18" ry="3" fill="#000" opacity=".18"/>
      ${spread.map(([x, y, r]) => stalk(x, y + 8, r)).join('')}
      <path d="M26 40 L38 40 L36 57 L28 57 Z" fill="#d9ab4a" opacity=".55"/>
      <rect x="25" y="39" width="14" height="4" rx="1.5" fill="#8a5a2e" stroke="#5a3519" stroke-width=".6"/>`;
  },
  ore(u) {
    return `<defs>
      <linearGradient id="o${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7adb4"/><stop offset="1" stop-color="#5a6067"/></linearGradient>
      <linearGradient id="p${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b9299"/><stop offset="1" stop-color="#454a50"/></linearGradient></defs>
      <ellipse cx="32" cy="57" rx="26" ry="3.5" fill="#000" opacity=".2"/>
      <path d="M6 54 L10 42 L20 38 L27 45 L25 55 Z" fill="url(#p${u})" stroke="#33373c" stroke-width=".8"/>
      <path d="M40 55 L38 43 L47 36 L57 41 L59 54 Z" fill="url(#p${u})" stroke="#33373c" stroke-width=".8"/>
      <path d="M18 55 L16 36 L27 24 L41 27 L46 42 L42 56 Z" fill="url(#o${u})" stroke="#33373c" stroke-width=".9"/>
      <path d="M27 24 L30 38 L16 36 M30 38 L46 42 M30 38 L32 56" fill="none" stroke="#3f444a" stroke-width=".8" opacity=".7"/>
      <path d="M22 16 L30 10 L38 14 L36 26 L27 24 Z" fill="url(#o${u})" stroke="#33373c" stroke-width=".8"/>
      <path d="M31 30 l3 2 l-2 3 z M20 44 l2 1 l-1 2 z M48 45 l2 2 l-2 1 z" fill="#9fd0ff" opacity=".85"/>
      <path d="M24 28 L28 26" stroke="#e6ebef" stroke-width="1.2" opacity=".8"/>`;
  },
};

export function resourceArt(res, size = 40) {
  const u = uid();
  return `<svg class="art res-art" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${RESOURCE_ART[res](u)}</svg>`;
}

// ---------- Porträts ----------

export { portraitArt } from './art/portraits.js';

// ---------- Bau-, Karten- und Szenen-Grafiken ----------
// Die Motive stammen aus art/emblems.js (klein) und art/scenes.js (groß).

const BUILD_EMBLEM = { road: 'road', settlement: 'house', city: 'city', card: 'card' };
export function iconArt(name, size = 26) {
  return emblem(BUILD_EMBLEM[name] || name, size, 'icon');
}

const DEV_EMBLEM = { knight: 'helmet', roadBuilding: 'road', yearOfPlenty: 'plenty', monopoly: 'monopoly', vp: 'laurel' };
export function devArt(type, size = 28) {
  return emblem(DEV_EMBLEM[type] || 'card', size, 'dev-art');
}

export { ILLUS, MODES, EXPANSIONS, modeArt, expansionArt } from './art/scenes.js';
export { emblem } from './art/emblems.js';
export { icon } from './art/icons.js';

// ---------- Rahmen-Grafiken der Oberfläche ----------

const UI = {
  crest: (u) => `<defs><linearGradient id="s${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b53a26"/><stop offset="1" stop-color="#5e150e"/></linearGradient>
    <linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dc98"/><stop offset=".5" stop-color="#c9a15b"/><stop offset="1" stop-color="#8a6630"/></linearGradient></defs>
    <path d="M32 3 L57 11 V30 C57 46 45 56 32 61 C19 56 7 46 7 30 V11 Z" fill="url(#s${u})" stroke="url(#g${u})" stroke-width="3.5"/>
    <path d="M32 9 L51 15 V30 C51 42 42 50 32 54 C22 50 13 42 13 30 V15 Z" fill="none" stroke="url(#g${u})" stroke-width="1" opacity=".7"/>
    <g fill="url(#g${u})"><rect x="23" y="28" width="18" height="16"/><rect x="21" y="22" width="5" height="7"/><rect x="29.5" y="22" width="5" height="7"/><rect x="38" y="22" width="5" height="7"/>
    <rect x="21" y="26" width="22" height="3"/><path d="M29 44 V37 Q32 33 35 37 V44 Z" fill="#5e150e"/></g>`,
  compass: (u) => `<defs><radialGradient id="c${u}" cx=".4" cy=".35"><stop offset="0" stop-color="#8a6038"/><stop offset="1" stop-color="#3a2414"/></radialGradient>
    <linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dc98"/><stop offset=".5" stop-color="#c9a15b"/><stop offset="1" stop-color="#8a6630"/></linearGradient></defs>
    <circle cx="32" cy="32" r="28" fill="url(#c${u})" stroke="url(#g${u})" stroke-width="4"/>
    <circle cx="32" cy="32" r="21" fill="none" stroke="#c9a15b" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="M32 10 L36 32 L32 54 L28 32 Z" fill="#e2c68e"/><path d="M10 32 L32 28 L54 32 L32 36 Z" fill="#c9a15b"/>
    <path d="M32 10 L36 32 L32 32 Z" fill="#b8322a"/><circle cx="32" cy="32" r="3" fill="#f7dc98"/>`,
  book: () => `<path d="M6 14 C16 10 26 12 32 18 C38 12 48 10 58 14 V52 C48 48 38 50 32 56 C26 50 16 48 6 52 Z" fill="#f4ead3" stroke="#6b4a2d" stroke-width="3"/>
    <path d="M32 18 V56" stroke="#6b4a2d" stroke-width="2"/><path d="M12 24 C18 22 24 23 28 26 M12 32 C18 30 24 31 28 34 M36 26 C40 23 46 22 52 24 M36 34 C40 31 46 30 52 32" stroke="#a88a55" stroke-width="2" fill="none"/>`,
  quill: () => `<path d="M50 6 C30 10 18 28 14 48 L20 46 C26 30 36 20 50 6 Z" fill="#f4ead3" stroke="#8f7040" stroke-width="2"/><path d="M14 48 L10 58" stroke="#3a2618" stroke-width="3" stroke-linecap="round"/>`,
  gear: () => `<g fill="currentColor"><path d="M28 6 h8 l1.5 7 5 2.2 6-4 5.7 5.7-4 6 2.2 5 7 1.5 v8 l-7 1.5-2.2 5 4 6-5.7 5.7-6-4-5 2.2L36 58 h-8 l-1.5-7-5-2.2-6 4-5.7-5.7 4-6-2.2-5L6 36 v-8 l7-1.5 2.2-5-4-6 5.7-5.7 6 4 5-2.2z"/></g><circle cx="32" cy="32" r="9" fill="#2e1d11"/>`,
  soundOn: () => `<path d="M10 24 H22 L36 12 V52 L22 40 H10 Z" fill="currentColor"/><path d="M44 22 C50 28 50 36 44 42 M50 16 C60 26 60 38 50 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  soundOff: () => `<path d="M10 24 H22 L36 12 V52 L22 40 H10 Z" fill="currentColor"/><path d="M44 24 L58 40 M58 24 L44 40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  menu: () => `<path d="M14 18 H50 M14 32 H50 M14 46 H50" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  camera: () => `<rect x="6" y="20" width="36" height="26" rx="4" fill="currentColor"/><path d="M42 28 L58 18 V48 L42 38 Z" fill="currentColor"/><circle cx="16" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="3"/>`,
  trade: () => `<path d="M10 22 H48 L40 14 M54 42 H16 L24 50" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  saved: () => `<path d="M12 34 L26 48 L52 16" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  gem: (u) => `<defs><radialGradient id="m${u}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff1c6"/><stop offset=".5" stop-color="#c9a15b"/><stop offset="1" stop-color="#5e4220"/></radialGradient></defs>
    <circle cx="32" cy="32" r="26" fill="url(#m${u})" stroke="#3a2414" stroke-width="4"/><circle cx="32" cy="32" r="12" fill="#6b4a2d" opacity=".5"/>`,
};

// Einige Rahmen-Grafiken zeigen farbige Motive aus dem Emblem-Satz
const UI_EMBLEM = { awardRoad: 'road', awardArmy: 'sword', devCard: 'card' };

export function uiArt(name, size = 24, cls = '') {
  if (UI_EMBLEM[name]) return emblem(UI_EMBLEM[name], size, `ui-art ${cls}`);
  const u = uid();
  return `<svg class="art ui-art ${cls}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${UI[name](u)}</svg>`;
}

// ---------- Rasterisieren für 3D-Sprites ----------

const imageCache = new Map();

export function svgToImage(svgInner, viewBox = '0 0 64 64', size = 128) {
  const key = `${viewBox}|${size}|${svgInner}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">${svgInner}</svg>`;
  const img = new Image();
  const p = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  imageCache.set(key, p);
  return p;
}

export function resourceImage(res, size = 128) {
  return svgToImage(RESOURCE_ART[res](uid()), '0 0 64 64', size);
}
