// Handgezeichnete SVG-Grafiken: Rohstoffe, Porträts, Bau-Icons, Karten und Illustrationen.
// Jede Grafik bekommt eigene IDs für Verläufe, damit mehrere Exemplare im DOM nicht kollidieren.

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

const SKIN = ['#f1c8a4', '#e0ad84', '#c68a5f', '#f5d3b8', '#a86f48', '#ecc19b'];
const HAIR = [
  { color: '#6b3a1e', style: 'long' },
  { color: '#e3b65a', style: 'bun' },
  { color: '#2b1d14', style: 'beard' },
  { color: '#b8b3aa', style: 'elder' },
  { color: '#b4532b', style: 'curly' },
  { color: '#1d1a17', style: 'short' },
];

function hairBack(style, c) {
  if (style === 'long') return `<path d="M17 30 C15 14 49 14 47 30 L49 52 C42 48 22 48 15 52 Z" fill="${c}"/>`;
  if (style === 'curly') return `<g fill="${c}">${[[18, 24], [22, 17], [30, 13], [38, 14], [45, 19], [47, 27], [17, 33], [47, 35]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g>`;
  return '';
}

function hairFront(style, c) {
  switch (style) {
    case 'long': return `<path d="M20 28 C21 16 43 15 44 28 C40 22 33 20 26 23 C24 25 22 27 20 28 Z" fill="${c}"/>`;
    case 'bun': return `<circle cx="32" cy="11" r="6" fill="${c}"/><path d="M20 29 C19 15 45 15 44 29 C40 21 26 20 20 29 Z" fill="${c}"/>`;
    case 'beard': return `<path d="M20 27 C20 15 44 15 44 27 C39 21 26 21 20 27 Z" fill="${c}"/><path d="M22 34 C22 46 42 46 42 34 C40 40 36 42 32 42 C28 42 24 40 22 34 Z" fill="${c}"/>`;
    case 'elder': return `<path d="M20 27 C19 18 45 18 44 27 C42 23 38 22 36 24 C33 20 27 21 20 27 Z" fill="${c}"/><path d="M21 33 C21 49 43 49 43 33 C41 41 36 44 32 44 C28 44 23 41 21 33 Z" fill="${c}"/>`;
    case 'curly': return `<path d="M20 26 C22 16 42 16 44 26 C38 20 27 20 20 26 Z" fill="${c}"/>`;
    default: return `<path d="M20 27 C20 14 44 14 44 27 C41 22 35 21 30 22 C26 23 22 25 20 27 Z" fill="${c}"/>`;
  }
}

export function portraitArt(seat, colorHex, size = 44) {
  const u = uid();
  const skin = SKIN[seat % SKIN.length];
  const hair = HAIR[seat % HAIR.length];
  const beard = hair.style === 'beard' || hair.style === 'elder';
  return `<svg class="art portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="bg${u}" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#f3e3c0"/><stop offset="1" stop-color="${colorHex}"/></radialGradient>
      <clipPath id="c${u}"><circle cx="32" cy="32" r="28"/></clipPath>
      <linearGradient id="gr${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dc98"/><stop offset=".5" stop-color="#c9a15b"/><stop offset="1" stop-color="#8a6630"/></linearGradient>
    </defs>
    <g clip-path="url(#c${u})">
      <rect width="64" height="64" fill="url(#bg${u})"/>
      ${hairBack(hair.style, hair.color)}
      <path d="M8 64 C10 48 20 44 32 44 C44 44 54 48 56 64 Z" fill="${colorHex}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
      <path d="M24 45 L32 53 L40 45" fill="none" stroke="rgba(255,240,210,.8)" stroke-width="2"/>
      <rect x="28" y="36" width="8" height="9" rx="3" fill="${skin}"/>
      <ellipse cx="32" cy="29" rx="11" ry="13" fill="${skin}"/>
      <circle cx="21" cy="30" r="2.5" fill="${skin}"/><circle cx="43" cy="30" r="2.5" fill="${skin}"/>
      <circle cx="27.5" cy="29" r="1.3" fill="#2b1d14"/><circle cx="36.5" cy="29" r="1.3" fill="#2b1d14"/>
      <path d="M25 25.5 q2.5 -1.5 5 0 M34 25.5 q2.5 -1.5 5 0" stroke="${hair.color}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <circle cx="25" cy="34" r="2.2" fill="#e88a7a" opacity=".35"/><circle cx="39" cy="34" r="2.2" fill="#e88a7a" opacity=".35"/>
      ${beard ? '' : '<path d="M29 36 q3 2 6 0" stroke="#8a4a3a" stroke-width="1.1" fill="none" stroke-linecap="round"/>'}
      ${hairFront(hair.style, hair.color)}
    </g>
    <circle cx="32" cy="32" r="29" fill="none" stroke="url(#gr${u})" stroke-width="3.5"/>
    <circle cx="32" cy="32" r="31" fill="none" stroke="#2a1a0e" stroke-width="1"/>
  </svg>`;
}

// ---------- Bau- und Karten-Icons ----------

const ICONS = {
  road: `<path d="M8 52 L24 20 L40 20 L56 52 Z" fill="#b98c55" stroke="#5a3a22" stroke-width="1.5"/>
    <path d="M14 46 L50 46 M18 38 L46 38 M21 30 L43 30" stroke="#7a5431" stroke-width="2"/>
    <g transform="rotate(-35 42 16)"><rect x="38" y="4" width="5" height="22" rx="1.5" fill="#8a5a2e"/><rect x="31" y="2" width="19" height="7" rx="1.5" fill="#9aa1a8" stroke="#555" stroke-width="1"/></g>`,
  settlement: `<path d="M14 54 L14 32 L32 16 L50 32 L50 54 Z" fill="#efe1bf" stroke="#5a3a22" stroke-width="2"/>
    <path d="M8 34 L32 12 L56 34" fill="none" stroke="#9b3a22" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    <rect x="27" y="38" width="10" height="16" fill="#6b4a2d"/><rect x="18" y="36" width="6" height="6" fill="#8fc0d4" stroke="#5a3a22"/><rect x="40" y="36" width="6" height="6" fill="#8fc0d4" stroke="#5a3a22"/>
    <path d="M14 40 L50 40" stroke="#8a5a2e" stroke-width="1.5"/>`,
  city: `<rect x="8" y="30" width="30" height="24" fill="#e9dab6" stroke="#5a3a22" stroke-width="2"/>
    <path d="M5 32 L23 18 L41 32" fill="#9b3a22" stroke="#6e2414" stroke-width="2" stroke-linejoin="round"/>
    <rect x="36" y="16" width="20" height="38" fill="#ddcca4" stroke="#5a3a22" stroke-width="2"/>
    <path d="M36 16 v-5 h4 v5 M44 16 v-5 h4 v5 M52 16 v-5 h4 v5" fill="#ddcca4" stroke="#5a3a22" stroke-width="1.5"/>
    <line x1="46" y1="11" x2="46" y2="2" stroke="#5a3a22" stroke-width="1.5"/><path d="M46 2 L56 5 L46 8 Z" fill="#b8322a"/>
    <rect x="42" y="40" width="8" height="14" rx="4" fill="#6b4a2d"/><rect x="18" y="40" width="7" height="14" fill="#6b4a2d"/>
    <rect x="42" y="24" width="7" height="7" fill="#8fc0d4" stroke="#5a3a22"/>`,
  card: `<rect x="14" y="8" width="36" height="48" rx="4" fill="#f4ead3" stroke="#8f7040" stroke-width="2"/>
    <rect x="19" y="13" width="26" height="38" rx="2" fill="none" stroke="#c9a15b" stroke-width="1.2"/>
    <path d="M24 26 h16 M24 32 h16 M24 38 h10" stroke="#8f7040" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="46" r="3" fill="#a3261c"/>`,
};

export function iconArt(name, size = 26) {
  return `<svg class="art icon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[name]}</svg>`;
}

const DEV_ART = {
  knight: `<path d="M20 40 C18 22 26 12 36 12 C46 12 50 22 48 30 L44 30 L44 40 Z" fill="#a9b0b8" stroke="#3b3f44" stroke-width="2"/>
    <path d="M26 26 H46" stroke="#3b3f44" stroke-width="3"/><path d="M34 12 C36 6 44 4 48 8 C44 8 40 10 38 14" fill="#b8322a"/>
    <rect x="16" y="40" width="34" height="6" rx="2" fill="#8a6038"/><path d="M50 18 L58 54" stroke="#d6dbe0" stroke-width="3"/><path d="M47 44 L56 42" stroke="#8a6038" stroke-width="3"/>`,
  roadBuilding: `<path d="M6 56 L22 30 L42 30 L58 56 Z" fill="#b98c55" stroke="#5a3a22" stroke-width="1.5"/><path d="M32 34 v6 M32 44 v6 M32 52 v4" stroke="#f4ead3" stroke-width="3"/>
    <rect x="44" y="8" width="4" height="30" fill="#5a3a22"/><path d="M36 12 L54 12 L58 17 L54 22 L36 22 Z" fill="#8a6038"/>`,
  yearOfPlenty: `<path d="M10 20 C24 18 40 26 46 44 C40 50 30 52 22 50 C22 38 18 28 10 20 Z" fill="#c9a15b" stroke="#6b4a2d" stroke-width="2"/>
    <circle cx="44" cy="46" r="6" fill="#b8322a"/><circle cx="52" cy="40" r="5" fill="#e0a92a"/><circle cx="50" cy="52" r="5" fill="#3d8a45"/><path d="M36 50 l6 8 M40 48 l8 6" stroke="#d49f36" stroke-width="3"/>`,
  monopoly: `<ellipse cx="32" cy="50" rx="18" ry="6" fill="#b88a2a"/><ellipse cx="32" cy="46" rx="18" ry="6" fill="#d6a93c" stroke="#8a6320"/>
    <ellipse cx="32" cy="38" rx="18" ry="6" fill="#d6a93c" stroke="#8a6320"/><ellipse cx="32" cy="30" rx="18" ry="6" fill="#e8c05a" stroke="#8a6320"/>
    <text x="32" y="34" font-size="10" text-anchor="middle" fill="#8a6320" font-weight="700">★</text>`,
  vp: `<path d="M12 46 L10 20 L22 30 L32 12 L42 30 L54 20 L52 46 Z" fill="#d6a93c" stroke="#8a6320" stroke-width="2"/>
    <rect x="12" y="46" width="40" height="8" rx="2" fill="#b88a2a"/><circle cx="32" cy="34" r="4" fill="#a3261c"/>`,
};

export function devArt(type, size = 28) {
  return `<svg class="art dev-art" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${DEV_ART[type]}</svg>`;
}

// ---------- Illustrationen für das Zug-Panel ----------

export const ILLUS = {
  house: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="110" rx="62" ry="7" fill="#000" opacity=".16"/>
    <path d="M18 108 q10 -22 22 0 z M120 108 q12 -26 24 0z" fill="#4f7a3a"/><path d="M134 108 q6 -30 12 0z" fill="#3b6e34"/>
    <rect x="40" y="58" width="80" height="50" fill="#efe1bf" stroke="#4a2e18" stroke-width="3"/>
    <path d="M40 72 H120 M40 90 H120 M60 58 V108 M100 58 V108 M40 58 L60 72 M100 72 L120 58" stroke="#5a3a22" stroke-width="3"/>
    <path d="M28 62 L80 22 L132 62" fill="#9b3a22" stroke="#5e2012" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 54 L80 24 L120 54" fill="none" stroke="#b8552e" stroke-width="2" opacity=".6"/>
    <rect x="102" y="26" width="10" height="22" fill="#6b4a2d"/><path d="M107 20 q7 -8 0 -14 q-7 -6 2 -12" stroke="#bbb" stroke-width="3" fill="none" opacity=".6"/>
    <rect x="72" y="78" width="16" height="30" rx="2" fill="#5a3a22"/><circle cx="84" cy="94" r="1.5" fill="#d6a93c"/>
    <rect x="46" y="76" width="10" height="10" fill="#8fc0d4" stroke="#4a2e18" stroke-width="2"/><rect x="104" y="76" width="10" height="10" fill="#8fc0d4" stroke="#4a2e18" stroke-width="2"/>
    <path d="M60 108 h40" stroke="#8a6038" stroke-width="4"/></svg>`,
  road: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="110" rx="62" ry="7" fill="#000" opacity=".16"/>
    <path d="M22 110 L64 44 L96 44 L138 110 Z" fill="#c9a36b"/><path d="M80 48 v12 M80 68 v14 M80 90 v18" stroke="#f4ead3" stroke-width="4"/>
    <rect x="112" y="34" width="6" height="66" fill="#5a3a22"/><path d="M102 40 L136 40 L143 48 L136 56 L102 56 Z" fill="#8a6038"/>
    <path d="M10 110 q16 -34 32 0z M126 110 q10 -20 20 0z" fill="#4f7a3a"/></svg>`,
  robber: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="112" rx="40" ry="6" fill="#000" opacity=".22"/>
    <path d="M80 10 C60 10 52 30 54 46 C44 56 40 78 42 110 L118 110 C120 78 116 56 106 46 C108 30 100 10 80 10 Z" fill="#2a2a30"/>
    <path d="M58 60 C50 80 50 98 52 110 L64 110 C62 90 64 74 70 62 Z" fill="#3a3a42"/>
    <path d="M66 38 C68 26 92 26 94 38 C92 48 68 48 66 38 Z" fill="#0f0f12"/>
    <circle cx="73" cy="38" r="2.6" fill="#e6c36b"/><circle cx="87" cy="38" r="2.6" fill="#e6c36b"/>
    <path d="M56 66 L104 66" stroke="#6b4a2d" stroke-width="5"/><rect x="76" y="62" width="8" height="8" fill="#c9a15b"/>
    <path d="M110 70 L122 96" stroke="#6b4a2d" stroke-width="4"/><circle cx="123" cy="99" r="6" fill="#f0b64a" opacity=".85"/></svg>`,
  dice: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="110" rx="62" ry="7" fill="#000" opacity=".16"/>
    <rect x="18" y="80" width="124" height="24" rx="4" fill="#4a3220" stroke="#c9a15b" stroke-width="2"/>
    <g transform="rotate(-12 56 58)"><rect x="30" y="32" width="52" height="52" rx="10" fill="#f6f1e6" stroke="#8f7040" stroke-width="2"/><circle cx="44" cy="46" r="5" fill="#222"/><circle cx="56" cy="58" r="5" fill="#222"/><circle cx="68" cy="70" r="5" fill="#222"/></g>
    <g transform="rotate(14 104 56)"><rect x="80" y="30" width="50" height="50" rx="10" fill="#f6f1e6" stroke="#8f7040" stroke-width="2"/><circle cx="93" cy="43" r="5" fill="#222"/><circle cx="117" cy="43" r="5" fill="#222"/><circle cx="93" cy="67" r="5" fill="#222"/><circle cx="117" cy="67" r="5" fill="#222"/></g></svg>`,
  trade: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="110" rx="52" ry="7" fill="#000" opacity=".16"/>
    <rect x="77" y="22" width="6" height="80" fill="#6b4a2d"/><rect x="58" y="100" width="44" height="8" rx="3" fill="#5a3a22"/>
    <rect x="26" y="26" width="108" height="5" rx="2" fill="#8a6038"/><circle cx="80" cy="24" r="6" fill="#c9a15b"/>
    <path d="M36 31 L22 64 L54 64 Z M124 31 L108 64 L140 64 Z" fill="none" stroke="#8a6038" stroke-width="2"/>
    <path d="M18 64 q20 14 40 0 z" fill="#c9a15b"/><path d="M104 64 q20 14 40 0 z" fill="#c9a15b"/></svg>`,
  hourglass: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="112" rx="38" ry="6" fill="#000" opacity=".15"/>
    <rect x="50" y="10" width="60" height="9" rx="3" fill="#6b4a2d"/><rect x="50" y="100" width="60" height="9" rx="3" fill="#6b4a2d"/>
    <rect x="52" y="19" width="5" height="81" fill="#8a6038"/><rect x="103" y="19" width="5" height="81" fill="#8a6038"/>
    <path d="M60 19 C60 46 76 52 76 58 C76 64 60 70 60 100 L100 100 C100 70 84 64 84 58 C84 52 100 46 100 19 Z" fill="#f4ead3" stroke="#8f7040" stroke-width="2.5" opacity=".95"/>
    <path d="M66 32 L94 32 C90 46 82 50 80 57 C78 50 70 46 66 32 Z" fill="#d9b566"><animate attributeName="opacity" values="1;.75;1" dur="3s" repeatCount="indefinite"/></path>
    <path d="M66 98 C68 84 76 80 80 78 C84 80 92 84 94 98 Z" fill="#d9b566"/><line x1="80" y1="58" x2="80" y2="80" stroke="#d9b566" stroke-width="1.5" stroke-dasharray="2 3"><animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/></line></svg>`,
  crown: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="110" rx="52" ry="7" fill="#000" opacity=".16"/>
    <path d="M30 90 L22 36 L54 60 L80 20 L106 60 L138 36 L130 90 Z" fill="#d6a93c" stroke="#8a6320" stroke-width="3"/>
    <rect x="30" y="90" width="100" height="13" rx="3" fill="#b88a2a"/><circle cx="80" cy="64" r="8" fill="#a3261c"/>
    <circle cx="52" cy="72" r="5" fill="#2f5fa8"/><circle cx="108" cy="72" r="5" fill="#3d8a45"/><circle cx="22" cy="36" r="4" fill="#f4d27a"/><circle cx="80" cy="20" r="4" fill="#f4d27a"/><circle cx="138" cy="36" r="4" fill="#f4d27a"/></svg>`,
  island: `<svg viewBox="0 0 160 120"><ellipse cx="80" cy="100" rx="70" ry="12" fill="#2a9690" opacity=".5"/>
    <path d="M20 96 L34 70 L126 70 L140 96 Z" fill="#5a4230"/><path d="M34 70 L50 48 L110 48 L126 70 Z" fill="#8fbf5a"/>
    <path d="M60 48 L66 30 L72 48 Z M76 48 L84 22 L92 48 Z" fill="#2f5a2c"/><path d="M50 60 h20 M88 60 h22" stroke="#dcb24a" stroke-width="4"/>
    <rect x="96" y="40" width="12" height="10" fill="#efe1bf" stroke="#4a2e18"/><path d="M94 41 L102 34 L110 41" fill="#9b3a22"/></svg>`,
};

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
  awardRoad: () => `<path d="M6 56 C18 50 16 40 28 36 C40 32 44 22 58 10" fill="none" stroke="#c9a36b" stroke-width="10" stroke-linecap="round"/>
    <path d="M6 56 C18 50 16 40 28 36 C40 32 44 22 58 10" fill="none" stroke="#f4ead3" stroke-width="1.5" stroke-dasharray="4 4"/>
    <rect x="14" y="14" width="4" height="24" fill="#6b4a2d"/><path d="M8 16 L28 16 L32 20 L28 24 L8 24 Z" fill="#c9a15b" stroke="#6b4a2d"/>`,
  awardArmy: () => `<g stroke-linecap="round"><path d="M12 52 L50 14" stroke="#d6dbe0" stroke-width="4"/><path d="M52 52 L14 14" stroke="#d6dbe0" stroke-width="4"/>
    <path d="M10 44 L20 54 M54 44 L44 54" stroke="#c9a15b" stroke-width="4"/><circle cx="12" cy="56" r="3" fill="#8a6038"/><circle cx="52" cy="56" r="3" fill="#8a6038"/></g>
    <path d="M50 14 L56 8 M14 14 L8 8" stroke="#eef2f5" stroke-width="3"/>`,
  devCard: () => `<rect x="8" y="4" width="48" height="56" rx="4" fill="#2f5a3a" stroke="#c9a15b" stroke-width="2.5"/>
    <rect x="12" y="8" width="40" height="48" rx="2" fill="none" stroke="#c9a15b" stroke-width="1" opacity=".6"/>
    <rect x="18" y="20" width="28" height="22" rx="3" fill="#f4ead3" stroke="#b89b64" transform="rotate(-18 32 31)"/>
    <circle cx="20" cy="36" r="5" fill="#e7d9b8" stroke="#b89b64" transform="rotate(-18 32 31)"/>
    <path d="M28 26 L38 38 M34 24 L26 40" stroke="#b8322a" stroke-width="3"/><circle cx="32" cy="32" r="3" fill="#b8322a"/>`,
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

export function uiArt(name, size = 24, cls = '') {
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
