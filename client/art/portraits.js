// Gemalte Porträts der Siedler: sechs Charaktere mit Licht und Schatten, Kleidung in der Hausfarbe
// und einem goldenen Medaillon-Rahmen. Der Platz am Tisch bestimmt den Charakter, die Farbe das Gewand.
import { uid, mix, darken, lighten, luminance } from './color.js';

const CAST = [
  { skin: '#f0c6a0', hair: '#8c3a1a', eyes: '#3f7a4a', lips: '#c4645a', style: 'long', dress: 'laced' },
  { skin: '#f6d5bb', hair: '#e0b45a', eyes: '#3d6fa8', lips: '#d0706a', style: 'crown', dress: 'square' },
  { skin: '#d8a078', hair: '#3a2416', eyes: '#5a3a1f', lips: '#a85a48', style: 'bearded', dress: 'strap' },
  { skin: '#e8bd99', hair: '#ddd6ca', eyes: '#5f7686', lips: '#b0685a', style: 'elder', dress: 'hood' },
  { skin: '#f4cfaf', hair: '#c4562a', eyes: '#6f6a2a', lips: '#c86b5d', style: 'curly', dress: 'collar' },
  { skin: '#a46d48', hair: '#1c1612', eyes: '#3a2414', lips: '#8a4a3c', style: 'bob', dress: 'brooch' },
];

// ---------- Teile ----------

function defs(u, c, color) {
  const bgLight = mix(lighten(color, 0.55), '#f6e7c8', 0.45);
  const bgDark = darken(color, luminance(color) > 0.75 ? 0.55 : 0.35);
  return `<defs>
    <radialGradient id="bg${u}" cx=".42" cy=".34" r=".8"><stop offset="0" stop-color="${bgLight}"/><stop offset=".55" stop-color="${mix(bgLight, bgDark, 0.55)}"/><stop offset="1" stop-color="${bgDark}"/></radialGradient>
    <linearGradient id="sk${u}" x1=".15" y1=".05" x2=".85" y2=".95"><stop offset="0" stop-color="${lighten(c.skin, 0.22)}"/><stop offset=".55" stop-color="${c.skin}"/><stop offset="1" stop-color="${darken(c.skin, 0.22)}"/></linearGradient>
    <linearGradient id="nk${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${darken(c.skin, 0.32)}"/><stop offset=".55" stop-color="${darken(c.skin, 0.08)}"/><stop offset="1" stop-color="${c.skin}"/></linearGradient>
    <linearGradient id="hr${u}" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${lighten(c.hair, 0.28)}"/><stop offset=".45" stop-color="${c.hair}"/><stop offset="1" stop-color="${darken(c.hair, 0.35)}"/></linearGradient>
    <linearGradient id="cl${u}" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${lighten(color, 0.18)}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.45)}"/></linearGradient>
    <linearGradient id="gd${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7ad"/><stop offset=".35" stop-color="#d9b265"/><stop offset=".7" stop-color="#9a7434"/><stop offset="1" stop-color="#e6c57c"/></linearGradient>
    <radialGradient id="lt${u}" cx=".3" cy=".22" r=".85"><stop offset="0" stop-color="#fff6dc" stop-opacity=".28"/><stop offset=".5" stop-color="#fff6dc" stop-opacity="0"/><stop offset="1" stop-color="#1a0e05" stop-opacity=".38"/></radialGradient>
    <clipPath id="cp${u}"><circle cx="64" cy="64" r="58"/></clipPath>
  </defs>`;
}

const FACE = 'M44 58 C44 40 53 33 64 33 C75 33 84 40 84 58 C84 70 80 80 72 86 C69 88 66.5 89 64 89 C61.5 89 59 88 56 86 C48 80 44 70 44 58 Z';

function head(u, c, { wrinkles = false, freckles = false, beard = false } = {}) {
  const shade = darken(c.skin, 0.3);
  const eye = (x, flip) => {
    const s = flip ? -1 : 1;
    return `<path d="M${x - 4.8} 62.2 C${x - 3} 59.6 ${x + 3} 59.6 ${x + 4.8} 62 C${x + 3} 64.2 ${x - 3} 64.2 ${x - 4.8} 62.2 Z" fill="#f7f1e6"/>
      <circle cx="${x + 0.3 * s}" cy="62" r="2.35" fill="${c.eyes}"/>
      <circle cx="${x + 0.3 * s}" cy="62" r="1.1" fill="#120a05"/><circle cx="${x + 1 * s}" cy="61.2" r=".7" fill="#fff"/>
      <path d="M${x - 5} 62.3 C${x - 3.2} 59.2 ${x + 3.2} 59.1 ${x + 5} 61.7" fill="none" stroke="#2a170b" stroke-width="1.15" stroke-linecap="round"/>
      <path d="M${x + 4.6 * s} 61.6 l${1.3 * s} -.7" stroke="#2a170b" stroke-width=".8" stroke-linecap="round"/>`;
  };
  const brow = (x, flip) => {
    const s = flip ? -1 : 1;
    const w = c.style === 'elder' ? 2.8 : c.style === 'bearded' || c.style === 'curly' ? 2.2 : 1.6;
    const col = c.style === 'elder' ? '#e8e3da' : darken(c.hair, 0.15);
    return `<path d="M${x - 5.5 * s} 56.5 C${x - 2.5 * s} 54 ${x + 2.5 * s} 53.8 ${x + 5.8 * s} 55.4" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  return `
    <path d="M44 60 C40 57 37.5 62 39.5 67 C40.5 70 43 71 45 70 Z" fill="${darken(c.skin, 0.12)}"/>
    <path d="M84 60 C88 57 90.5 62 88.5 67 C87.5 70 85 71 83 70 Z" fill="${darken(c.skin, 0.2)}"/>
    <path d="M41.5 62 C41 64 42 66 43.5 66.5" fill="none" stroke="${shade}" stroke-width=".9" opacity=".6"/>
    <path d="${FACE}" fill="url(#sk${u})"/>
    <path d="M78 52 C83 60 82 74 72 86 C69 88 66.5 89 64 89 C70 84 78 74 78 52 Z" fill="${shade}" opacity=".25"/>
    <ellipse cx="57" cy="44" rx="9" ry="5" fill="#fff" opacity=".12"/>
    <ellipse cx="52.5" cy="70.5" rx="4.6" ry="3" fill="#e2735e" opacity="${freckles ? 0.28 : 0.2}"/>
    <ellipse cx="75.5" cy="70.5" rx="4.6" ry="3" fill="#e2735e" opacity="${freckles ? 0.28 : 0.2}"/>
    ${eye(56.5, false)}${eye(71.5, true)}${brow(56.5, false)}${brow(71.5, true)}
    <path d="M64.5 61 C64.2 65.5 62.6 69.4 61.7 71.2 C62.8 73 65.8 73.2 67.2 71.8" fill="none" stroke="${shade}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M65.6 63 C65.8 66 66 68 66.6 69.4" fill="none" stroke="#fff" stroke-width=".8" opacity=".35" stroke-linecap="round"/>
    ${beard ? '' : `<path d="M58.5 77.2 C61 76 63 76.6 64 77.1 C65 76.6 67 76 69.5 77.2 C67 78.6 61 78.6 58.5 77.2 Z" fill="${c.lips}"/>
    <path d="M59.6 77.8 C62 80.8 66 80.8 68.4 77.8 C66 78.8 62 78.8 59.6 77.8 Z" fill="${lighten(c.lips, 0.18)}"/>
    <path d="M58.4 77.1 C62 78.6 66 78.6 69.6 77.1" fill="none" stroke="${darken(c.lips, 0.45)}" stroke-width=".9" stroke-linecap="round"/>
    <path d="M61.5 80.6 C63 81.3 65 81.3 66.5 80.6" fill="none" stroke="#fff" stroke-width=".6" opacity=".35"/>`}
    ${wrinkles ? `<g fill="none" stroke="${shade}" stroke-width=".8" opacity=".55" stroke-linecap="round">
      <path d="M54 46 C59 44.5 69 44.5 74 46"/><path d="M56 49.5 C60 48.5 68 48.5 72 49.5"/>
      <path d="M48.5 61 l-2.5 -1.5 M48.5 63 l-2.8 .4 M79.5 61 l2.5 -1.5 M79.5 63 l2.8 .4"/>
      <path d="M57 72 C55.5 74 55.5 76 56.5 78 M71 72 C72.5 74 72.5 76 71.5 78"/></g>` : ''}
    ${freckles ? `<g fill="${darken(c.skin, 0.35)}" opacity=".55">${[[51, 67], [54, 69], [49, 70], [53, 72], [77, 67], [74, 69], [79, 70], [75, 72], [62, 66], [66, 66.5], [64, 68]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".75"/>`).join('')}</g>` : ''}`;
}

function neck(u) {
  return `<path d="M55.5 78 L55.5 97 C59 101 69 101 72.5 97 L72.5 78 Z" fill="url(#nk${u})"/>`;
}

// Gewand in Hausfarbe – je Charakter ein anderer Schnitt
function clothes(u, c, color) {
  const dark = darken(color, 0.5);
  const linen = '#efe4cc';
  const gold = `url(#gd${u})`;
  const base = `<path d="M10 128 C12 108 25 99 45 96 C51 95 55 94 57 93 L71 93 C73 94 77 95 83 96 C103 99 116 108 118 128 Z" fill="url(#cl${u})"/>`;
  const folds = `<g fill="none" stroke="${dark}" stroke-width="1.6" opacity=".35" stroke-linecap="round">
    <path d="M30 104 C33 112 34 120 33 128"/><path d="M98 104 C95 112 94 120 95 128"/><path d="M42 112 C43 118 43 124 42 128"/></g>`;
  switch (c.dress) {
    case 'laced':
      return `${base}${folds}
        <path d="M52 95 L64 116 L76 95 C72 97 56 97 52 95 Z" fill="${linen}"/>
        <path d="M52 95 L64 116 L76 95" fill="none" stroke="${dark}" stroke-width="1.6"/>
        <g stroke="${gold}" stroke-width="1.3"><path d="M58 102 L70 102 M59.5 106 L68.5 106 M61 110 L67 110"/></g>
        <path d="M40 98 C46 104 50 112 52 128 M88 98 C82 104 78 112 76 128" fill="none" stroke="${lighten(color, 0.3)}" stroke-width="1.5" opacity=".6"/>`;
    case 'square':
      return `${base}${folds}
        <path d="M50 96 L50 108 L78 108 L78 96 C70 98 58 98 50 96 Z" fill="${linen}"/>
        <path d="M50 96 L50 108 L78 108 L78 96" fill="none" stroke="${gold}" stroke-width="2"/>
        <path d="M18 120 C30 104 44 100 52 108 C44 112 38 120 36 128 L16 128 Z" fill="${mix(color, '#e9dcc0', 0.45)}" opacity=".9"/>
        <path d="M110 120 C98 104 84 100 76 108 C84 112 90 120 92 128 L112 128 Z" fill="${mix(color, '#e9dcc0', 0.45)}" opacity=".9"/>
        <circle cx="64" cy="104" r="2.2" fill="${gold}"/>`;
    case 'strap':
      return `${base}${folds}
        <path d="M54 94 C58 99 70 99 74 94 L72 100 C68 102 60 102 56 100 Z" fill="${dark}"/>
        <path d="M36 100 L92 128 L80 128 L32 106 Z" fill="#5a3a22"/>
        <path d="M36 100 L92 128" stroke="#3a2414" stroke-width="1" fill="none"/>
        <rect x="58" y="110" width="9" height="7" rx="1.5" fill="none" stroke="${gold}" stroke-width="1.8" transform="rotate(27 62 113)"/>`;
    case 'hood':
      return `<path d="M8 128 C10 106 26 96 46 94 L82 94 C102 96 118 106 120 128 Z" fill="url(#cl${u})"/>${folds}
        <path d="M50 96 C56 104 72 104 78 96" fill="none" stroke="#c9b48a" stroke-width="2.4"/>
        <circle cx="50" cy="97" r="3" fill="${gold}"/><circle cx="78" cy="97" r="3" fill="${gold}"/>`;
    case 'collar':
      return `${base}${folds}
        <path d="M50 94 L58 106 L64 97 L70 106 L78 94 C72 96 56 96 50 94 Z" fill="${linen}"/>
        <path d="M50 94 L58 106 L64 97 L70 106 L78 94" fill="none" stroke="${darken(linen, 0.35)}" stroke-width="1"/>
        <path d="M44 98 L46 128 M84 98 L82 128" stroke="#4a2e18" stroke-width="4"/>
        <circle cx="45.5" cy="112" r="1.6" fill="${gold}"/><circle cx="82.5" cy="112" r="1.6" fill="${gold}"/>`;
    default:
      return `${base}${folds}
        <path d="M53 93 C56 99 72 99 75 93 L74 97 C70 101 58 101 54 97 Z" fill="${dark}"/>
        <circle cx="64" cy="108" r="5" fill="${gold}"/><circle cx="64" cy="108" r="2.3" fill="#a3261c"/>
        <path d="M30 108 C40 104 52 106 60 108 M98 108 C88 104 76 106 68 108" fill="none" stroke="${gold}" stroke-width="1.2" opacity=".8"/>`;
  }
}

// ---------- Frisuren ----------

function strands(paths, col, w = 1, op = 0.45) {
  return `<g fill="none" stroke="${col}" stroke-width="${w}" opacity="${op}" stroke-linecap="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`;
}

const HAIR = {
  long: {
    back: (u) => `<path d="M40 54 C37 32 51 23 64 23 C79 23 91 32 88 54 C89 72 92 90 98 108 C90 113 80 110 76 102 L52 102 C48 110 38 113 30 108 C36 90 39 72 40 54 Z" fill="url(#hr${u})"/>`,
    front: (u, c) => `<path d="M43.5 62 C41 40 51 27 66 27 C81 27 89 40 85.5 62 C84 52 80 45 75 42 C70 39 63 38 57 40 C51 42 46 50 43.5 62 Z" fill="url(#hr${u})"/>
      <path d="M44 60 C41 74 39 90 43 106 C48 102 51 92 51 80 C50 72 47 66 44 60 Z" fill="url(#hr${u})"/>
      <path d="M84.5 60 C87 74 89 90 85 106 C80 102 77 92 77 80 C78 72 81 66 84.5 60 Z" fill="url(#hr${u})"/>
      ${strands(['M58 31 C52 36 47 44 45 56', 'M66 29 C60 33 55 38 52 44', 'M70 30 C77 33 82 40 84 52', 'M46 70 C44 82 44 94 46 102', 'M83 70 C85 82 85 94 83 102'], lighten(c.hair, 0.35))}
      <path d="M45 47 C52 42.5 76 42.5 83 47" fill="none" stroke="url(#gd${u})" stroke-width="2"/>
      <circle cx="64" cy="43.4" r="2.3" fill="#2f8a5a" stroke="#f6dfa4" stroke-width=".8"/>`,
  },
  crown: {
    back: (u) => `<path d="M42 56 C40 34 52 25 64 25 C76 25 88 34 86 56 L86 68 C80 62 48 62 42 68 Z" fill="url(#hr${u})"/>`,
    front: (u, c) => {
      const braid = Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * (1.08 - (i / 10) * 1.16);
        const x = 64 + Math.cos(a) * 22.5;
        const y = 50 - Math.sin(a) * 20;
        return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.6" ry="3.2" transform="rotate(${(-a * 180) / Math.PI + 90} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#hr${u})" stroke="${darken(c.hair, 0.4)}" stroke-width=".6"/>`;
      }).join('');
      return `<path d="M44.5 58 C43 42 52 32 64 32 C76 32 85 42 83.5 58 C81 49 75 42 64 41.5 C53 42 47 49 44.5 58 Z" fill="url(#hr${u})"/>
        ${strands(['M64 33 C58 36 52 42 47 52', 'M64 33 C70 36 76 42 81 52', 'M60 34 C55 39 50 46 46 56'], lighten(c.hair, 0.35))}
        ${braid}
        <path d="M43 69 l0 5" stroke="url(#gd${u})" stroke-width="1.4"/><circle cx="43" cy="76.5" r="2.4" fill="url(#gd${u})"/>
        <path d="M85 69 l0 5" stroke="url(#gd${u})" stroke-width="1.4"/><circle cx="85" cy="76.5" r="2.4" fill="url(#gd${u})"/>`;
    },
  },
  bearded: {
    back: () => '',
    front: (u, c) => `<path d="M43 60 C41 38 52 28 64 28 C78 28 88 38 85 60 C84 52 82 47 80 45 C75 47 66 46 58 43 C52 45 46 51 43 60 Z" fill="url(#hr${u})"/>
      <path d="M50 33 l-3 -4 l6 2 M60 29 l0 -5 l4 4 M70 29 l3 -4 l1 5 M79 34 l4 -2 l-2 5" fill="${c.hair}"/>
      ${strands(['M52 37 C56 40 62 42 70 42', 'M74 34 C79 37 82 42 83 50', 'M48 44 C46 48 45 52 44 58'], lighten(c.hair, 0.3))}
      <path d="M45 64 C45 79 52 91 64 93.5 C76 91 83 79 83 64 C81 72 77 77.5 72 79 C69 76.5 59 76.5 56 79 C51 77.5 47 72 45 64 Z" fill="url(#hr${u})"/>
      ${strands(['M50 76 C53 82 57 87 62 90', 'M78 76 C75 82 71 87 66 90', 'M64 82 L64 92'], lighten(c.hair, 0.25), 0.9)}
      <path d="M56 74.6 C59 72.4 62 73 64 74.2 C66 73 69 72.4 72 74.6 C69 77 66 76.4 64 75.8 C62 76.4 59 77 56 74.6 Z" fill="${darken(c.hair, 0.1)}"/>
      <path d="M60.5 79.2 C62.5 80.6 65.5 80.6 67.5 79.2" fill="none" stroke="${c.lips}" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  elder: {
    back: (u, c, color) => `<path d="M33 70 C28 38 45 17 64 17 C83 17 100 38 95 70 C97 84 101 96 106 110 L22 110 C27 96 31 84 33 70 Z" fill="url(#cl${u})"/>
      <path d="M38 70 C35 44 48 26 64 26 C80 26 93 44 90 70 C88 82 86 92 84 100 L44 100 C42 92 40 82 38 70 Z" fill="${darken(color, 0.62)}"/>`,
    front: (u, c, color) => `<path d="M44 56 C44 46 49 41 54 40 C50 46 48 52 47 60 Z M84 56 C84 46 79 41 74 40 C78 46 80 52 81 60 Z" fill="${c.hair}"/>
      <path d="M45.5 66 C45 84 52 102 64 110 C76 102 83 84 82.5 66 C79 75 72 80 64 80 C56 80 49 75 45.5 66 Z" fill="${c.hair}"/>
      ${strands(['M52 80 C54 90 58 100 62 106', 'M76 80 C74 90 70 100 66 106', 'M64 84 L64 106', 'M57 84 C58 92 60 98 62 102', 'M71 84 C70 92 68 98 66 102'], darken(c.hair, 0.25), 0.9, 0.6)}
      <path d="M55 74.6 C58.5 72 62 72.6 64 74 C66 72.6 69.5 72 73 74.6 C70 78.5 66 77.5 64 76.6 C62 77.5 58 78.5 55 74.6 Z" fill="${lighten(c.hair, 0.2)}" stroke="${darken(c.hair, 0.2)}" stroke-width=".5"/>
      <path d="M34 72 C30 46 44 22 64 21 C84 22 98 46 94 72" fill="none" stroke="${lighten(color, 0.25)}" stroke-width="1.6" opacity=".55"/>`,
  },
  curly: {
    back: (u, c) => `<g fill="url(#hr${u})" stroke="${darken(c.hair, 0.35)}" stroke-width=".7">${[[42, 46, 8], [86, 46, 8], [40, 58, 7], [88, 58, 7], [48, 34, 9], [80, 34, 9], [64, 27, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
    front: (u, c) => `<g fill="url(#hr${u})" stroke="${darken(c.hair, 0.35)}" stroke-width=".7">${[[47, 44, 6.5], [55, 37, 7.5], [64, 34, 8], [73, 37, 7.5], [81, 44, 6.5], [52, 46, 5], [76, 46, 5], [60, 42, 5], [68, 42, 5], [44, 53, 4.5], [84, 53, 4.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
      <g fill="none" stroke="${lighten(c.hair, 0.4)}" stroke-width="1" opacity=".6" stroke-linecap="round">${[[55, 36], [64, 33], [73, 36], [47, 43], [81, 43], [60, 41], [68, 41]].map(([x, y]) => `<path d="M${x - 3} ${y + 1} a3 3 0 0 1 5 -2"/>`).join('')}</g>`,
  },
  bob: {
    back: (u) => `<path d="M39 58 C37 34 51 25 64 25 C77 25 91 34 89 58 L90 84 C86 89 79 89 76 84 L52 84 C49 89 42 89 38 84 Z" fill="url(#hr${u})"/>`,
    front: (u, c) => `<path d="M42.5 60 C41.5 38 52 29.5 64 29.5 C76 29.5 86.5 38 85.5 60 C84 54 82.5 50 81.5 48 C74 46 54 46 46.5 48 C45.5 50 44 54 42.5 60 Z" fill="url(#hr${u})"/>
      ${strands(['M50 33 C48 38 47 43 47 47', 'M58 30 C56 36 55 41 55 46', 'M66 30 C66 36 66 41 66 46', 'M74 31 C76 36 77 41 77 46', 'M82 37 C83 41 83 44 82 47', 'M42 64 C41 72 41 78 42 84', 'M86 64 C87 72 87 78 86 84'], lighten(c.hair, 0.45), 1, 0.35)}
      <circle cx="42.5" cy="73" r="3.4" fill="none" stroke="url(#gd${u})" stroke-width="1.4"/>
      <circle cx="85.5" cy="73" r="3.4" fill="none" stroke="url(#gd${u})" stroke-width="1.4"/>`,
  },
};

export function portraitArt(seat, colorHex, size = 44) {
  const u = uid();
  const c = CAST[((seat % CAST.length) + CAST.length) % CAST.length];
  const color = colorHex || '#b8322a';
  const hair = HAIR[c.style];
  const fine = size >= 34;
  return `<svg class="art portrait" viewBox="0 0 128 128" width="${size}" height="${size}" aria-hidden="true">
    ${defs(u, c, color)}
    <g clip-path="url(#cp${u})">
      <rect width="128" height="128" fill="url(#bg${u})"/>
      ${fine ? `<g opacity=".18" fill="none" stroke="#fff6dc" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M64 60 L${64 + Math.cos(-Math.PI * (0.1 + i * 0.1)) * 80} ${60 + Math.sin(-Math.PI * (0.1 + i * 0.1)) * 80}"/>`).join('')}</g>` : ''}
      <g transform="translate(64 70) scale(1.13) translate(-64 -66)">
      ${hair.back(u, c, color)}
      ${clothes(u, c, color)}
      ${neck(u)}
      <path d="M55.5 92 C59 97 69 97 72.5 92 L72.5 96 C69 100 59 100 55.5 96 Z" fill="${darken(c.skin, 0.3)}" opacity=".5"/>
      ${head(u, c, { wrinkles: c.style === 'elder', freckles: c.style === 'curly', beard: c.style === 'bearded' || c.style === 'elder' })}
      ${hair.front(u, c, color)}
      </g>
      <rect width="128" height="128" fill="url(#lt${u})"/>
    </g>
    <circle cx="64" cy="64" r="60.5" fill="none" stroke="#24150a" stroke-width="${fine ? 2 : 3}"/>
    <circle cx="64" cy="64" r="58.5" fill="none" stroke="url(#gd${u})" stroke-width="${fine ? 4.5 : 7}"/>
    ${fine ? `<circle cx="64" cy="64" r="56" fill="none" stroke="#24150a" stroke-width="1" opacity=".75"/>
    <circle cx="64" cy="64" r="61.5" fill="none" stroke="#f6dfa4" stroke-width=".8" opacity=".6"/>` : ''}
  </svg>`;
}
