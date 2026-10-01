// Große Illustrationen: Zug-Panel, Spielmodi und Erweiterungen. Gemalter Stil mit Verläufen,
// einheitlichem Licht von links oben und dunkler Tuschkontur. Jede Ausgabe bekommt eigene IDs.
import { uid } from './color.js';

const INK = '#2e1a0c';
const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const ground = (u, cx = 80, cy = 106, rx = 66, ry = 11) => `<ellipse cx="${cx}" cy="${cy + 3}" rx="${rx}" ry="${ry}" fill="#000" opacity=".16"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx - 4}" ry="${ry - 2}" fill="url(#gr${u})"/>
  <path d="M${cx - rx + 10} ${cy - 2} q6 -9 12 0 M${cx + rx - 26} ${cy - 3} q5 -8 10 0 M${cx - 20} ${cy + 4} q4 -6 8 0" fill="#3d6b2c" opacity=".7"/>`;
const grassDefs = (u) => lg(`gr${u}`, ['#9cc860', '#5d8f3a', '#3f6b2a']);
const tuft = (x, y, s = 1, c = '#4f7f33') => `<path d="M${x} ${y} q${-2 * s} ${-7 * s} ${-5 * s} ${-9 * s} q${4 * s} ${2 * s} ${5 * s} ${6 * s} q${1 * s} ${-6 * s} ${4 * s} ${-9 * s} q${-1 * s} ${5 * s} ${-1 * s} ${9 * s} q${3 * s} ${-4 * s} ${6 * s} ${-5 * s} q${-3 * s} ${3 * s} ${-4 * s} ${8 * s} z" fill="${c}"/>`;

// ---------- Zug-Panel (160 × 120) ----------

const SCENE = {
  house: (u) => `<defs>${grassDefs(u)}
      ${lg(`wl${u}`, ['#fff7e4', '#ead8b1', '#cdb486'], 0, 0, 1, 1)}
      ${lg(`rf${u}`, ['#d2603e', '#a83a22', '#6e1f10'], 0, 0, 0.3, 1)}
      ${lg(`sd${u}`, ['#e2cfa8', '#b49a6c'])}
      ${lg(`gl${u}`, ['#fff1b8', '#f2b544'])}
      ${rg(`sm${u}`, ['#ffffff', '#ffffff00'], 0.5, 0.5, 0.5)}</defs>
    ${ground(u)}
    <path d="M58 116 C64 106 72 102 78 100 L86 100 C90 104 92 110 92 116 Z" fill="#d9bf8c" opacity=".9"/>
    <g fill="#2f5a2c" stroke="${INK}" stroke-width="1.6">
      <ellipse cx="22" cy="92" rx="14" ry="16"/><ellipse cx="30" cy="82" rx="10" ry="12" fill="#3f7334"/>
      <rect x="20" y="100" width="4" height="8" fill="#5a3a20" stroke="none"/></g>
    <path d="M14 86 C18 78 26 74 32 76" fill="none" stroke="#8fbf5a" stroke-width="2" opacity=".6" stroke-linecap="round"/>
    <rect x="42" y="56" width="76" height="46" fill="url(#wl${u})" stroke="${INK}" stroke-width="2.5"/>
    <path d="M118 56 L134 66 L134 100 L118 102 Z" fill="url(#sd${u})" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <g stroke="#5a3a20" stroke-width="3.2" stroke-linecap="square">
      <path d="M42 72 H118 M42 88 H118 M62 56 V102 M98 56 V102 M42 56 L62 72 M98 72 L118 56 M42 88 L62 72 M98 72 L118 88"/>
      <path d="M118 72 L134 79 M126 61 V101"/></g>
    <path d="M30 60 L80 20 L130 60 L124 62 L80 28 L36 62 Z" fill="#5e1a0c"/>
    <path d="M32 58 L80 20 L128 58 L80 30 Z" fill="url(#rf${u})" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M128 58 L80 20 L94 13 L146 66 Z" fill="#7e2a16" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <g stroke="#5e1a0c" stroke-width="1.3" opacity=".75"><path d="M44 48 L80 25 M52 50 L80 31 M60 52 L80 37 M68 54 L80 43"/><path d="M116 48 L80 25 M108 50 L80 31 M100 52 L80 37 M92 54 L80 43"/>
      <path d="M104 38 L134 64 M112 30 L140 58 M100 24 L132 52"/></g>
    <path d="M40 54 L80 24" stroke="#f19a72" stroke-width="2" opacity=".55" stroke-linecap="round"/>
    <rect x="104" y="14" width="10" height="20" fill="#8a4430" stroke="${INK}" stroke-width="2"/><rect x="102" y="11" width="14" height="5" rx="1" fill="#5a2a1a" stroke="${INK}" stroke-width="1.6"/>
    <path d="M106 18 h6 M106 24 h6 M106 29 h6" stroke="#5e2a1a" stroke-width="1"/>
    <g opacity=".8"><circle cx="111" cy="7" r="4.5" fill="url(#sm${u})"/><circle cx="118" cy="4" r="5.5" fill="url(#sm${u})"/><circle cx="127" cy="3" r="6" fill="url(#sm${u})"/></g>
    <path d="M72 102 V82 a8 8 0 0 1 16 0 V102 Z" fill="#6b4224" stroke="${INK}" stroke-width="2.4"/>
    <path d="M80 76 V102 M74 88 H86" stroke="#4a2c14" stroke-width="1.4"/><circle cx="84" cy="91" r="1.4" fill="#e6c36b"/>
    ${[[47, 76], [103, 76]].map(([x, y]) => `<rect x="${x}" y="${y}" width="11" height="10" fill="url(#gl${u})" stroke="${INK}" stroke-width="2"/><path d="M${x + 5.5} ${y} v10 M${x} ${y + 5} h11" stroke="#5a3a20" stroke-width="1.4"/>
      <rect x="${x - 2}" y="${y + 10}" width="15" height="4" fill="#6b4224" stroke="${INK}" stroke-width="1.2"/>
      <circle cx="${x + 1.5}" cy="${y + 9}" r="2" fill="#d6455a"/><circle cx="${x + 6}" cy="${y + 8.5}" r="2" fill="#f2c94c"/><circle cx="${x + 10}" cy="${y + 9}" r="2" fill="#d6455a"/>`).join('')}
    <rect x="47" y="60" width="11" height="8" fill="url(#gl${u})" stroke="${INK}" stroke-width="1.8"/><rect x="103" y="60" width="11" height="8" fill="url(#gl${u})" stroke="${INK}" stroke-width="1.8"/>
    <g stroke="${INK}" stroke-width="1.6" fill="#a87a48"><path d="M120 106 V94 M128 106 V95 M136 106 V96 M144 106 V97"/><path d="M118 98 L148 100 M118 103 L148 104" fill="none" stroke="#8a5a30" stroke-width="2.4"/></g>
    ${tuft(40, 106)}${tuft(96, 108, 0.8)}${tuft(140, 108, 0.9, '#5d8f3a')}`,

  road: (u) => `<defs>${grassDefs(u)}
      ${lg(`rd${u}`, ['#d9b37a', '#b98c55', '#8a6038'])}
      ${lg(`sk${u}`, ['#cfe7e2', '#f4ead3'])}
      ${lg(`hl${u}`, ['#a8d06a', '#5d8f3a'])}
      ${lg(`sg${u}`, ['#c99a5e', '#8a6038'], 0, 0, 1, 0)}</defs>
    <ellipse cx="80" cy="110" rx="74" ry="7" fill="#000" opacity=".14"/>
    <path d="M6 108 C4 90 6 78 10 70 C30 50 60 44 80 46 C104 44 132 50 150 66 C156 80 156 96 154 108 C110 116 50 116 6 108 Z" fill="url(#hl${u})"/>
    <path d="M10 70 C30 50 60 44 80 46 C104 44 132 50 150 66" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M10 66 C32 54 50 52 64 54" fill="none" stroke="#c4e48e" stroke-width="2" opacity=".6"/>
    <g fill="#2f5a2c" stroke="${INK}" stroke-width="1.4"><path d="M118 52 L124 34 L130 52 Z"/><path d="M128 54 L134 30 L140 54 Z" fill="#3a6b33"/><path d="M28 56 L33 40 L38 56 Z"/></g>
    <path d="M58 112 C70 92 78 70 80 50 C82 50 84 50 86 50 C88 70 104 92 128 112 Z" fill="url(#rd${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M83 54 V60 M84 67 V75 M86 83 V93 M90 101 V110" stroke="#f6ead0" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
    <path d="M66 108 C74 92 79 74 81 56" fill="none" stroke="#7a5430" stroke-width="1.4" opacity=".6"/>
    ${[[64, 100, 3], [112, 104, 2.6], [72, 86, 2], [100, 92, 2.2]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r * 1.4}" ry="${r}" fill="#9a9488" stroke="${INK}" stroke-width="1"/>`).join('')}
    <rect x="34" y="40" width="5" height="62" fill="url(#sg${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M22 46 L56 46 L64 54 L56 62 L22 62 Z" fill="#c99a5e" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M26 54 H54" stroke="#7a5430" stroke-width="2"/><path d="M58 54 l-4 -3 v6 z" fill="#7a5430"/>
    <path d="M14 70 L40 70 L34 78 L8 78 Z" fill="#b8874a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 46 C32 44 46 44 52 46" fill="none" stroke="#f1d29a" stroke-width="1.6" opacity=".8"/>
    <g transform="translate(112 74)"><path d="M0 18 L22 18 L26 6 L-4 6 Z" fill="#8a5a30" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="4" cy="20" r="5" fill="#5a3a20" stroke="${INK}" stroke-width="1.6"/><path d="M22 12 L38 0" stroke="${INK}" stroke-width="2.4"/>
      ${[0, 1, 2].map((i) => `<rect x="${-2 + i * 8}" y="0" width="7" height="6" rx="1" fill="#c9573a" stroke="${INK}" stroke-width="1.2"/>`).join('')}</g>
    ${tuft(20, 108)}${tuft(146, 106, 0.9)}${tuft(52, 110, 0.7, '#5d8f3a')}`,

  robber: (u) => `<defs>
      ${lg(`cl${u}`, ['#4e4b57', '#2a2830', '#141317'], 0, 0, 0.6, 1)}
      ${lg(`rk${u}`, ['#8a8478', '#4f4a42'])}
      ${rg(`gw${u}`, ['#ffd27a', '#ff9d2e00'], 0.5, 0.5, 0.5)}
      ${lg(`sk${u}`, ['#8a5a30', '#4a2c14'])}</defs>
    <ellipse cx="80" cy="110" rx="56" ry="8" fill="#000" opacity=".25"/>
    <path d="M30 112 C34 100 44 96 56 98 L104 98 C118 96 128 102 132 112 Z" fill="url(#rk${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M40 104 l10 -3 M110 104 l-12 -3" stroke="#bdb6a8" stroke-width="1.6" opacity=".6"/>
    <path d="M80 8 C62 8 54 24 55 40 C46 50 42 70 44 104 L116 104 C118 70 114 50 105 40 C106 24 98 8 80 8 Z" fill="url(#cl${u})" stroke="#0a0a0c" stroke-width="2.4"/>
    <path d="M80 8 C66 12 60 26 61 40 C66 34 72 32 80 32 C88 32 94 34 99 40 C100 26 94 12 80 8 Z" fill="#5c5866" opacity=".55"/>
    <path d="M64 40 C66 28 94 28 96 40 C94 51 66 51 64 40 Z" fill="#050506"/>
    <circle cx="72.5" cy="40" r="3.1" fill="#ffd27a"/><circle cx="87.5" cy="40" r="3.1" fill="#ffd27a"/>
    <circle cx="72.5" cy="40" r="6" fill="url(#gw${u})" opacity=".6"/><circle cx="87.5" cy="40" r="6" fill="url(#gw${u})" opacity=".6"/>
    <path d="M56 62 C52 80 52 96 54 104 L66 104 C64 88 64 74 70 62 Z M104 62 C108 80 108 96 106 104 L94 104 C96 88 96 74 90 62 Z" fill="#3a3842" opacity=".85"/>
    <path d="M52 66 L108 66" stroke="#6b4a2d" stroke-width="6"/><rect x="75" y="61" width="10" height="10" rx="1.5" fill="#d6b06a" stroke="${INK}" stroke-width="1.4"/>
    <path d="M100 40 C112 34 120 40 122 50 C124 60 118 70 108 70" fill="none" stroke="url(#sk${u})" stroke-width="4"/>
    <path d="M108 70 C120 70 126 82 122 92 C118 100 104 100 102 92 C100 84 100 74 108 70 Z" fill="#8a6a3e" stroke="${INK}" stroke-width="2"/>
    <path d="M104 80 C108 78 114 78 118 80" stroke="#5a3a20" stroke-width="1.6" fill="none"/>
    <path d="M44 74 L30 96" stroke="#5a3a20" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="28" cy="100" r="16" fill="url(#gw${u})"/>
    <rect x="22" y="92" width="12" height="14" rx="2" fill="#ffcf70" stroke="${INK}" stroke-width="2"/><path d="M22 92 L28 86 L34 92" fill="#3b3a38" stroke="${INK}" stroke-width="1.6"/>
    <path d="M28 106 v4" stroke="${INK}" stroke-width="2"/>`,

  dice: (u) => `<defs>
      ${lg(`tr${u}`, ['#6b4a2d', '#3a2414'])}
      ${lg(`fl${u}`, ['#8a6a4e', '#5a4030'])}
      ${lg(`au${u}`, ['#fbe3a0', '#c9a15b', '#8a6320'], 0, 0, 1, 1)}
      ${lg(`d1${u}`, ['#fffdf7', '#ece3d2', '#cdbf9f'], 0, 0, 1, 1)}
      ${lg(`d2${u}`, ['#e9dfcb', '#c7b892'], 0, 0, 1, 1)}</defs>
    <ellipse cx="80" cy="112" rx="66" ry="7" fill="#000" opacity=".22"/>
    <path d="M14 80 L146 80 L136 108 L24 108 Z" fill="url(#tr${u})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M22 82 L138 82 L131 100 L29 100 Z" fill="url(#fl${u})"/>
    <path d="M14 80 L146 80" stroke="url(#au${u})" stroke-width="3.5"/><circle cx="14" cy="80" r="3.2" fill="url(#au${u})" stroke="${INK}"/><circle cx="146" cy="80" r="3.2" fill="url(#au${u})" stroke="${INK}"/>
    <path d="M24 108 L136 108" stroke="url(#au${u})" stroke-width="2"/>
    <ellipse cx="58" cy="92" rx="22" ry="4" fill="#000" opacity=".3"/><ellipse cx="106" cy="88" rx="20" ry="4" fill="#000" opacity=".25"/>
    <g transform="rotate(-14 58 62)">
      <path d="M34 40 L74 40 L80 46 L80 84 L40 84 L34 78 Z" fill="url(#d2${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="34" y="40" width="40" height="38" rx="7" fill="url(#d1${u})" stroke="${INK}" stroke-width="2.2"/>
      <circle cx="44" cy="50" r="4.2" fill="#a3261c"/><circle cx="54" cy="59" r="4.2" fill="#a3261c"/><circle cx="64" cy="68" r="4.2" fill="#a3261c"/>
      <path d="M39 44 h18" stroke="#fff" stroke-width="2.4" opacity=".8" stroke-linecap="round"/></g>
    <g transform="rotate(16 106 50)">
      <path d="M86 28 L122 28 L128 34 L128 70 L92 70 L86 64 Z" fill="url(#d2${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="86" y="28" width="36" height="36" rx="7" fill="url(#d1${u})" stroke="${INK}" stroke-width="2.2"/>
      ${[[95, 37], [113, 37], [95, 55], [113, 55], [104, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.8" fill="${INK}"/>`).join('')}
      <path d="M91 32 h16" stroke="#fff" stroke-width="2.4" opacity=".8" stroke-linecap="round"/></g>
    <g stroke="#c9a15b" stroke-width="2.4" stroke-linecap="round" opacity=".7"><path d="M20 30 q8 -6 16 -2 M16 44 q6 -4 12 -1 M140 18 q-8 -5 -14 0"/></g>`,

  trade: (u) => `<defs>${grassDefs(u)}
      ${lg(`wd${u}`, ['#a8723e', '#6b4224'], 0, 0, 1, 0)}
      ${lg(`au${u}`, ['#fbe3a0', '#c9a15b', '#8a6320'], 0, 0, 1, 1)}
      ${lg(`br${u}`, ['#e38a67', '#a8432a'])}
      ${lg(`sa${u}`, ['#efdcb2', '#c9ad78'])}</defs>
    <ellipse cx="80" cy="110" rx="56" ry="7" fill="#000" opacity=".2"/>
    <path d="M64 106 L96 106 L90 98 L70 98 Z" fill="url(#wd${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="76.5" y="22" width="7" height="78" fill="url(#wd${u})" stroke="${INK}" stroke-width="2"/>
    <g transform="rotate(-6 80 24)">
      <rect x="20" y="20" width="120" height="7" rx="3" fill="url(#au${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M30 27 L16 62 M30 27 L44 62 M130 27 L116 62 M130 27 L144 62" stroke="#6b4818" stroke-width="1.6"/>
      <path d="M10 62 Q30 76 50 62 Z" fill="url(#au${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M110 62 Q130 76 150 62 Z" fill="url(#au${u})" stroke="${INK}" stroke-width="2"/>
      ${[[18, 52], [30, 52], [24, 44], [36, 44]].map(([x, y]) => `<rect x="${x - 1}" y="${y}" width="12" height="7" rx="1" fill="url(#br${u})" stroke="${INK}" stroke-width="1.4"/>`).join('')}
      <path d="M118 62 C116 50 120 40 130 38 C140 40 144 50 142 62 Z" fill="url(#sa${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M124 40 C126 34 134 34 136 40" fill="none" stroke="#8a6a3e" stroke-width="2.4"/>
      ${[-8, -3, 2, 7].map((d) => `<path d="M${130 + d} 38 q${d * 0.4} -10 ${d * 0.8} -14" fill="none" stroke="#d4a23c" stroke-width="2.2"/><ellipse cx="${130 + d * 1.8}" cy="${24}" rx="2.2" ry="3.6" fill="#e6bb52" stroke="#8a5e1c" stroke-width=".8"/>`).join('')}
    </g>
    <circle cx="80" cy="20" r="7" fill="url(#au${u})" stroke="${INK}" stroke-width="2"/><circle cx="78" cy="18" r="2" fill="#fff6d6" opacity=".7"/>`,

  hourglass: (u) => `<defs>
      ${lg(`wd${u}`, ['#a8723e', '#5a3418'], 0, 0, 1, 0)}
      ${lg(`sd${u}`, ['#f6d68a', '#c9952c'])}
      ${lg(`gl${u}`, ['#ffffff', '#e8f0f0'], 0, 0, 1, 0)}
      ${rg(`fl${u}`, ['#fff3c0', '#ffb34700'], 0.5, 0.5, 0.5)}</defs>
    <ellipse cx="80" cy="112" rx="44" ry="6" fill="#000" opacity=".2"/>
    <rect x="46" y="8" width="68" height="11" rx="3" fill="url(#wd${u})" stroke="${INK}" stroke-width="2.4"/>
    <rect x="46" y="100" width="68" height="11" rx="3" fill="url(#wd${u})" stroke="${INK}" stroke-width="2.4"/>
    ${[52, 103].map((x) => `<rect x="${x}" y="19" width="5" height="81" fill="url(#wd${u})" stroke="${INK}" stroke-width="1.6"/><circle cx="${x + 2.5}" cy="59" r="3.5" fill="#c9a15b" stroke="${INK}" stroke-width="1.2"/>`).join('')}
    <path d="M62 19 C62 46 77 52 77 59 C77 66 62 72 62 100 L98 100 C98 72 83 66 83 59 C83 52 98 46 98 19 Z" fill="url(#gl${u})" fill-opacity=".55" stroke="${INK}" stroke-width="2.2"/>
    <path d="M66 30 L94 30 C91 44 83 49 80 57 C77 49 69 44 66 30 Z" fill="url(#sd${u})"><animate attributeName="d" dur="6s" repeatCount="indefinite" values="M66 30 L94 30 C91 44 83 49 80 57 C77 49 69 44 66 30 Z;M71 40 L89 40 C88 47 82 51 80 57 C78 51 72 47 71 40 Z;M66 30 L94 30 C91 44 83 49 80 57 C77 49 69 44 66 30 Z"/></path>
    <path d="M64 98 C66 84 75 80 80 77 C85 80 94 84 96 98 Z" fill="url(#sd${u})"/>
    <line x1="80" y1="58" x2="80" y2="78" stroke="#d9a948" stroke-width="1.6" stroke-dasharray="2 3"><animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/></line>
    <path d="M67 24 C67 40 72 46 76 52" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>
    <g transform="translate(126 70)"><rect x="-6" y="0" width="12" height="34" fill="#f4ead3" stroke="${INK}" stroke-width="2"/><ellipse cx="0" cy="34" rx="12" ry="3" fill="#8a6038" stroke="${INK}" stroke-width="1.6"/>
      <path d="M0 0 v-5" stroke="${INK}" stroke-width="1.4"/><circle cx="0" cy="-12" r="12" fill="url(#fl${u})"/><path d="M0 -4 C-4 -8 -3 -13 0 -18 C3 -13 4 -8 0 -4 Z" fill="#ffb347" stroke="#c9601c" stroke-width="1"/></g>`,

  crown: (u) => `<defs>
      ${lg(`au${u}`, ['#fff1c0', '#e2bd6a', '#a8792c', '#e6c57c'], 0, 0, 1, 1)}
      ${lg(`cu${u}`, ['#c8423a', '#7a1a14'])}
      ${lg(`lf${u}`, ['#8fbf5a', '#3f6b2a'])}</defs>
    <ellipse cx="80" cy="112" rx="60" ry="7" fill="#000" opacity=".2"/>
    <path d="M22 96 C22 84 40 78 80 78 C120 78 138 84 138 96 C138 108 120 112 80 112 C40 112 22 108 22 96 Z" fill="url(#cu${u})" stroke="${INK}" stroke-width="2.4"/>
    <path d="M30 92 C40 86 60 84 80 84" fill="none" stroke="#e8766a" stroke-width="2" opacity=".6"/>
    ${[[24, 98], [136, 98]].map(([x, y]) => `<path d="M${x} ${y} l${x < 80 ? -8 : 8} 10 M${x} ${y} l${x < 80 ? -4 : 4} 12" stroke="#e2bd6a" stroke-width="2.4"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${30 + i * 7}" cy="${70 - i * 6}" rx="3.2" ry="7" transform="rotate(${-50 + i * 8} ${30 + i * 7} ${70 - i * 6})" fill="url(#lf${u})" stroke="${INK}" stroke-width="1"/><ellipse cx="${130 - i * 7}" cy="${70 - i * 6}" rx="3.2" ry="7" transform="rotate(${50 - i * 8} ${130 - i * 7} ${70 - i * 6})" fill="url(#lf${u})" stroke="${INK}" stroke-width="1"/>`).join('')}
    <path d="M44 80 L36 32 L60 52 L80 18 L100 52 L124 32 L116 80 Z" fill="url(#au${u})" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="42" y="72" width="76" height="13" rx="3" fill="url(#au${u})" stroke="${INK}" stroke-width="2.4"/>
    <circle cx="80" cy="56" r="7" fill="#a3261c" stroke="#5e120c" stroke-width="1.6"/><circle cx="78" cy="54" r="2" fill="#fff" opacity=".6"/>
    <circle cx="58" cy="64" r="4.5" fill="#2f5fa8" stroke="#163066" stroke-width="1.2"/><circle cx="102" cy="64" r="4.5" fill="#3d8a45" stroke="#1f4a24" stroke-width="1.2"/>
    ${[[60, 78.5], [80, 78.5], [100, 78.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#a3261c"/>`).join('')}
    ${[[36, 31], [80, 17], [124, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#fff1c0" stroke="${INK}" stroke-width="1.6"/>`).join('')}
    <path d="M52 76 C56 60 60 50 64 46" fill="none" stroke="#fff6d6" stroke-width="2" opacity=".55" stroke-linecap="round"/>`,

  island: (u) => `<defs>
      ${rg(`sea${u}`, ['#6fd0c4', '#2a9690', '#18625e'], 0.5, 0.4, 0.6)}
      ${lg(`sand${u}`, ['#f1dca4', '#cfae6c'])}
      ${lg(`grs${u}`, ['#aad46c', '#5d8f3a'])}
      ${lg(`mt${u}`, ['#c9c9c4', '#7c7d79'], 0, 0, 1, 1)}
      ${lg(`fl${u}`, ['#f2cf6a', '#c99a34'])}</defs>
    <ellipse cx="80" cy="96" rx="74" ry="20" fill="url(#sea${u})" stroke="#16524e" stroke-width="2"/>
    <path d="M14 98 c8 -3 14 -3 22 0 M120 104 c8 -3 14 -3 22 0 M60 110 c6 -2 12 -2 18 0" stroke="#e8fbf6" stroke-width="2" fill="none" opacity=".8" stroke-linecap="round"/>
    <path d="M26 92 C34 74 52 64 80 62 C110 64 128 74 136 92 C120 100 42 100 26 92 Z" fill="url(#sand${u})" stroke="${INK}" stroke-width="2.2"/>
    <path d="M34 88 C42 74 58 68 80 67 C104 68 120 74 128 88 C110 93 52 93 34 88 Z" fill="url(#grs${u})"/>
    <path d="M86 70 L102 40 L114 58 L120 52 L132 80 C120 84 98 82 86 70 Z" fill="url(#mt${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M102 40 L96 52 L104 50 L108 48 Z" fill="#fff" opacity=".9"/>
    <path d="M44 84 C52 80 64 79 72 82 L68 90 C60 90 50 89 44 84 Z" fill="url(#fl${u})" stroke="${INK}" stroke-width="1.4"/>
    <path d="M48 85 L68 87 M52 82 L70 84" stroke="#b5862e" stroke-width="1"/>
    <g stroke="${INK}" stroke-width="1.4"><path d="M38 80 L44 58 L50 80 Z" fill="#2f5a2c"/><path d="M48 76 L55 50 L62 76 Z" fill="#3a6b33"/><path d="M58 74 L64 56 L70 74 Z" fill="#2f5a2c"/></g>
    <rect x="72" y="66" width="14" height="11" fill="#fbf1da" stroke="${INK}" stroke-width="1.6"/><path d="M70 67 L79 59 L88 67 Z" fill="#b8322a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="77" y="71" width="4" height="6" fill="#5a3a22"/>
    <g transform="translate(18 74)"><path d="M0 8 L20 8 L16 14 L4 14 Z" fill="#6b4224" stroke="${INK}" stroke-width="1.4"/><path d="M10 8 V-10" stroke="${INK}" stroke-width="1.6"/><path d="M11 -8 C18 -4 19 2 18 6 L11 6 Z" fill="#fbf6ea" stroke="${INK}" stroke-width="1.2"/></g>`,
};

// ---------- Spielmodi im Hauptmenü (120 × 90) ----------

const meeple = (x, y, color, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 -26 C-6 -26 -8 -21 -7 -17 C-14 -15 -20 -12 -20 -7 C-20 -3 -14 -2 -10 -3 L-14 12 L-3 12 L0 4 L3 12 L14 12 L10 -3 C14 -2 20 -3 20 -7 C20 -12 14 -15 7 -17 C8 -21 6 -26 0 -26 Z" fill="${color}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M-4 -23 C-2 -25 2 -25 3 -23" fill="none" stroke="#fff" stroke-width="1.6" opacity=".5" stroke-linecap="round"/></g>`;

const MODE = {
  ai: (u) => `<defs>${lg(`au${u}`, ['#fff1c0', '#d9b265', '#8a6320'], 0, 0, 1, 1)}${rg(`gl${u}`, ['#fff3c0', '#fff3c000'], 0.5, 0.5, 0.5)}</defs>
    <ellipse cx="60" cy="82" rx="46" ry="5" fill="#000" opacity=".18"/>
    <circle cx="60" cy="28" r="26" fill="url(#gl${u})"/>
    <path d="M42 34 L38 12 L50 22 L60 6 L70 22 L82 12 L78 34 Z" fill="url(#au${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="41" y="32" width="38" height="7" rx="2" fill="url(#au${u})" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="60" cy="25" r="3.4" fill="#a3261c"/>
    ${meeple(32, 70, '#2f5fa8', 0.85)}${meeple(88, 70, '#ece6d6', 0.85)}${meeple(60, 74, '#e0a92a', 1)}`,
  friends: (u) => `<defs>${lg(`mg${u}`, ['#c9905a', '#7a4a24'], 0, 0, 1, 0)}${lg(`ft${u}`, ['#fffdf4', '#efe2c0'])}${lg(`br${u}`, ['#f2b84a', '#c97f1c'])}${lg(`tb${u}`, ['#8a5a30', '#4a2c14'])}</defs>
    <ellipse cx="60" cy="84" rx="50" ry="5" fill="#000" opacity=".2"/>
    <path d="M6 74 L114 74 L108 84 L12 84 Z" fill="url(#tb${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    ${[[38, -12], [82, 12]].map(([x, r]) => `<g transform="rotate(${r} ${x} 52)">
      <path d="M${x - 15} 30 L${x + 15} 30 L${x + 13} 74 L${x - 13} 74 Z" fill="url(#br${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${x - 15} 30 L${x + 15} 30 L${x + 13} 74 L${x - 13} 74 Z" fill="url(#mg${u})" opacity=".55"/>
      <path d="M${x - 15} 40 H${x + 15} M${x - 14} 62 H${x + 13}" stroke="#4a2c14" stroke-width="2.4"/>
      <path d="M${x + (r < 0 ? 15 : -15)} 40 C${x + (r < 0 ? 28 : -28)} 40 ${x + (r < 0 ? 28 : -28)} 62 ${x + (r < 0 ? 14 : -14)} 62" fill="none" stroke="#7a4a24" stroke-width="5"/>
      <path d="M${x - 17} 32 C${x - 18} 22 ${x - 8} 18 ${x - 2} 22 C${x + 4} 16 ${x + 16} 20 ${x + 17} 30 Z" fill="url(#ft${u})" stroke="${INK}" stroke-width="1.8"/>
      <path d="M${x - 9} 44 v12" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/></g>`).join('')}
    <g fill="#fffdf4" stroke="${INK}" stroke-width="1"><circle cx="60" cy="18" r="3"/><circle cx="54" cy="12" r="2"/><circle cx="66" cy="10" r="2.4"/></g>`,
  hotseat: (u) => `<defs>${lg(`bd${u}`, ['#f6ecd2', '#d9c497'])}${lg(`hx${u}`, ['#9cc860', '#5d8f3a'])}${lg(`hy${u}`, ['#f2cf6a', '#c99a34'])}${lg(`hz${u}`, ['#d77a52', '#a8432a'])}</defs>
    <ellipse cx="60" cy="84" rx="50" ry="5" fill="#000" opacity=".18"/>
    <path d="M14 60 L60 38 L106 60 L60 82 Z" fill="url(#bd${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    ${[[48, 58, 'hx'], [60, 52, 'hy'], [72, 58, 'hz'], [60, 64, 'hx']].map(([x, y, g]) => `<path d="M${x - 9} ${y} L${x - 4.5} ${y - 4.5} L${x + 4.5} ${y - 4.5} L${x + 9} ${y} L${x + 4.5} ${y + 4.5} L${x - 4.5} ${y + 4.5} Z" fill="url(#${g}${u})" stroke="${INK}" stroke-width="1.2"/>`).join('')}
    ${meeple(18, 48, '#b8322a', 0.7)}${meeple(102, 48, '#2f5fa8', 0.7)}${meeple(36, 30, '#e0a92a', 0.6)}${meeple(84, 30, '#3d8a45', 0.6)}
    <g transform="rotate(-10 60 20)"><rect x="50" y="8" width="20" height="20" rx="4" fill="#fffdf6" stroke="${INK}" stroke-width="1.8"/><circle cx="55.5" cy="13.5" r="2" fill="${INK}"/><circle cx="60" cy="18" r="2" fill="${INK}"/><circle cx="64.5" cy="22.5" r="2" fill="${INK}"/></g>`,
};

// ---------- Erweiterungen (240 × 140) ----------

const hex = (x, y, r, fill, stroke = INK) => `<path d="M${x} ${y - r} L${x + r * 0.866} ${y - r / 2} L${x + r * 0.866} ${y + r / 2} L${x} ${y + r} L${x - r * 0.866} ${y + r / 2} L${x - r * 0.866} ${y - r / 2} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
const tinyHouse = (x, y, c) => `<g transform="translate(${x} ${y})"><rect x="-5" y="-4" width="10" height="8" fill="#fbf1da" stroke="${INK}" stroke-width="1.2"/><path d="M-7 -3 L0 -10 L7 -3 Z" fill="${c}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
const sky = (u, a = '#bfe3e0', b = '#f6ecd2') => lg(`sk${u}`, [a, b]);
const waves = (y, c = '#e8fbf6') => `<path d="M0 ${y} c10 -4 20 -4 30 0 s20 4 30 0 s20 -4 30 0 s20 4 30 0 s20 -4 30 0 s20 4 30 0 s20 -4 30 0 s20 4 30 0" fill="none" stroke="${c}" stroke-width="2" opacity=".7"/>`;

const EXPANSION = {
  players: (u) => {
    const T = ['#5d8f3a', '#c99a34', '#a8432a', '#8a8c88', '#2f5a2c', '#9cc860', '#d9c08a'];
    const pos = [];
    for (let r = -2; r <= 2; r++) for (let q = -3; q <= 3; q++) if (Math.abs(q + r) <= 3 && Math.abs(q) <= 3 && Math.abs(r) <= 2) pos.push([q, r]);
    const cells = pos.map(([q, r], i) => hex(120 + 19 * (q + r / 2), 72 + 16.5 * r, 11, T[(i * 3) % T.length]));
    const colors = ['#b8322a', '#e0a92a', '#2f5fa8', '#ece6d6', '#3d8a45', '#7a4a9c'];
    const spots = [[66, 50], [174, 50], [62, 96], [178, 96], [120, 26], [120, 118]];
    return `<defs>${rg(`sea${u}`, ['#5fc0b4', '#1f7a74'], 0.5, 0.5, 0.7)}</defs>
      <rect width="240" height="140" fill="url(#sea${u})"/>${waves(18)}${waves(130)}
      <ellipse cx="120" cy="72" rx="96" ry="58" fill="#3a2a1c" opacity=".35"/>
      ${cells.join('')}
      ${spots.map(([x, y], i) => tinyHouse(x, y, colors[i])).join('')}`;
  },
  seafarers: (u) => `<defs>${sky(u, '#9fd6dc', '#fbeed0')}${lg(`sea${u}`, ['#3fa8a0', '#17605c'])}${lg(`hl${u}`, ['#8a5a30', '#4a2c14'])}${lg(`sl${u}`, ['#fffdf4', '#e6d6b0'], 0, 0, 1, 0)}</defs>
    <rect width="240" height="140" fill="url(#sk${u})"/><circle cx="196" cy="34" r="16" fill="#ffe08a" opacity=".9"/>
    <path d="M150 86 C160 70 174 66 186 70 C196 62 214 64 224 86 Z" fill="#6f9a52" stroke="${INK}" stroke-width="1.6"/><path d="M180 70 l6 -12 l6 12 z" fill="#2f5a2c"/>
    <rect y="84" width="240" height="56" fill="url(#sea${u})"/>${waves(96)}${waves(112)}${waves(128)}
    <g transform="translate(70 18)">
      <path d="M-40 82 L60 82 L48 104 L-28 104 Z" fill="url(#hl${u})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-34 88 H54" stroke="#c9a15b" stroke-width="2"/>${[-18, -2, 14, 30].map((x) => `<circle cx="${x}" cy="95" r="2.4" fill="#2a1a0c"/>`).join('')}
      <path d="M10 82 V0 M-20 82 V22" stroke="${INK}" stroke-width="3"/>
      <path d="M12 4 C34 14 40 40 36 62 L12 62 Z" fill="url(#sl${u})" stroke="${INK}" stroke-width="2"/><path d="M8 8 C-6 22 -10 42 -6 62 L8 62 Z" fill="url(#sl${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M-18 26 C-30 36 -34 50 -32 70 L-18 70 Z" fill="url(#sl${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M10 0 L24 -5 L10 -10 Z" fill="#b8322a" stroke="${INK}" stroke-width="1"/>
      <path d="M36 62 L58 76 M-40 82 L-50 70" stroke="${INK}" stroke-width="1.6"/></g>`,
  knights: (u) => `<defs>${sky(u, '#c9d6dc', '#f6ecd2')}${lg(`st${u}`, ['#d8d2c4', '#8f877a'])}${lg(`hm${u}`, ['#f1f4f6', '#7c858e'], 0.1, 0, 0.9, 1)}${lg(`sh${u}`, ['#3a6bb8', '#1c3a72'])}${lg(`au${u}`, ['#fbe3a0', '#a8792c'], 0, 0, 1, 1)}</defs>
    <rect width="240" height="140" fill="url(#sk${u})"/>
    <path d="M0 110 C40 100 80 104 120 100 C160 96 200 102 240 98 L240 140 L0 140 Z" fill="#6f9a52"/>
    <rect x="96" y="40" width="128" height="72" fill="url(#st${u})" stroke="${INK}" stroke-width="2.2"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${96 + i * 16}" y="32" width="10" height="9" fill="url(#st${u})" stroke="${INK}" stroke-width="1.8"/>`).join('')}
    <rect x="140" y="16" width="40" height="96" fill="url(#st${u})" stroke="${INK}" stroke-width="2.2"/>
    ${[0, 1, 2].map((i) => `<rect x="${140 + i * 14}" y="8" width="10" height="9" fill="url(#st${u})" stroke="${INK}" stroke-width="1.8"/>`).join('')}
    <path d="M150 112 V82 a10 10 0 0 1 20 0 V112 Z" fill="#4a2c14" stroke="${INK}" stroke-width="2"/><path d="M152 90 H168 M152 98 H168 M152 106 H168" stroke="#2a1a0c" stroke-width="1.4"/>
    <path d="M160 8 V-6" stroke="${INK}" stroke-width="2"/><path d="M160 -6 L178 0 L160 6 Z" transform="translate(0 4)" fill="#b8322a" stroke="${INK}" stroke-width="1.2"/>
    <g transform="translate(58 76)">
      <path d="M-30 -42 C-22 -54 -6 -56 4 -48 C-6 -48 -14 -44 -18 -38" fill="#b8322a" stroke="${INK}" stroke-width="1.6"/>
      <path d="M-34 30 L-34 -6 C-34 -28 -22 -40 -4 -40 C14 -40 26 -28 26 -6 L26 30 C16 36 -24 36 -34 30 Z" fill="url(#hm${u})" stroke="#2a2f34" stroke-width="2.4"/>
      <path d="M-28 -6 H20" stroke="#2a2f34" stroke-width="6"/><path d="M-4 -6 V30" stroke="#2a2f34" stroke-width="3"/>
      ${[2, 10, 18].map((y) => `<path d="M-22 ${y} h10 M4 ${y} h10" stroke="#2a2f34" stroke-width="2.4" stroke-linecap="round"/>`).join('')}
      <path d="M-24 -20 C-20 -30 -14 -34 -6 -36" fill="none" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/></g>
    <g transform="translate(96 92)"><path d="M-16 -18 L16 -18 L16 2 C16 14 6 20 0 24 C-6 20 -16 14 -16 2 Z" fill="url(#sh${u})" stroke="${INK}" stroke-width="2.2"/>
      <path d="M0 -18 V24 M-16 -4 H16" stroke="url(#au${u})" stroke-width="3"/></g>`,
  merchants: (u) => `<defs>${sky(u, '#f6d9a0', '#fbeed0')}${lg(`dn${u}`, ['#f1d8a0', '#c9a35e'])}${lg(`cm${u}`, ['#c9905a', '#8a5a30'])}${lg(`wd${u}`, ['#a8723e', '#5a3418'])}</defs>
    <rect width="240" height="140" fill="url(#sk${u})"/><circle cx="50" cy="34" r="18" fill="#ffd27a" opacity=".85"/>
    <path d="M0 96 C40 80 80 86 120 92 C160 84 200 80 240 90 L240 140 L0 140 Z" fill="url(#dn${u})" stroke="${INK}" stroke-width="1.6"/>
    <path d="M20 112 C50 104 70 106 96 110" fill="none" stroke="#b8935a" stroke-width="2" opacity=".7"/>
    <g transform="translate(150 54)">
      <path d="M-34 40 L-30 64 M-20 42 L-18 64 M18 40 L16 64 M28 38 L30 64" stroke="url(#cm${u})" stroke-width="6" stroke-linecap="round"/>
      <path d="M-40 20 C-40 4 -24 -2 -12 6 C-6 -6 10 -6 16 6 C26 0 36 6 36 18 C36 34 26 42 0 42 C-26 42 -40 36 -40 20 Z" fill="url(#cm${u})" stroke="${INK}" stroke-width="2.2"/>
      <path d="M36 16 C44 12 50 4 50 -8 C50 -16 56 -20 62 -16 L64 -12 L58 -10 C58 2 52 18 40 26 Z" fill="url(#cm${u})" stroke="${INK}" stroke-width="2.2"/>
      <circle cx="58" cy="-12" r="1.6" fill="${INK}"/>
      <rect x="-30" y="-8" width="22" height="16" rx="2" fill="#b8322a" stroke="${INK}" stroke-width="1.8"/><rect x="-6" y="-6" width="18" height="14" rx="2" fill="#2f5fa8" stroke="${INK}" stroke-width="1.8"/>
      <path d="M-30 0 H-8 M-6 1 H12" stroke="#f6dfa4" stroke-width="1.6"/></g>
    <g transform="translate(54 84)">
      <path d="M-30 -14 L26 -14 L22 10 L-26 10 Z" fill="url(#wd${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M-28 -14 C-24 -34 20 -34 24 -14" fill="#efe2c0" stroke="${INK}" stroke-width="2"/><path d="M-18 -14 C-16 -26 12 -26 14 -14" fill="none" stroke="#c9b48a" stroke-width="1.6"/>
      ${[-16, 12].map((x) => `<circle cx="${x}" cy="12" r="9" fill="#6b4224" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="12" r="2.4" fill="${INK}"/><path d="M${x - 9} 12 H${x + 9} M${x} 3 V21" stroke="${INK}" stroke-width="1.2"/>`).join('')}</g>`,
  pirates: (u) => `<defs>${sky(u, '#7fb8c4', '#e9dcc0')}${lg(`sea${u}`, ['#2f8a84', '#124846'])}${lg(`hl${u}`, ['#5a3a20', '#2a1a0c'])}${lg(`au${u}`, ['#fbe3a0', '#c9952c'], 0, 0, 1, 1)}${lg(`ch${u}`, ['#a8723e', '#5a3418'])}</defs>
    <rect width="240" height="140" fill="url(#sk${u})"/>
    <rect y="80" width="240" height="60" fill="url(#sea${u})"/>${waves(92)}${waves(110)}${waves(128)}
    <g transform="translate(78 18)">
      <path d="M-46 66 L58 66 L46 90 L-34 90 Z" fill="url(#hl${u})" stroke="#0a0604" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-40 72 H52" stroke="#a3261c" stroke-width="2.4"/>
      <path d="M6 66 V-4 M-24 66 V14" stroke="#0a0604" stroke-width="3"/>
      <path d="M8 0 C30 10 34 34 30 54 L8 54 Z" fill="#26201e" stroke="#0a0604" stroke-width="2"/><path d="M4 4 C-10 18 -12 36 -8 54 L4 54 Z" fill="#26201e" stroke="#0a0604" stroke-width="2"/>
      <path d="M-22 18 C-34 28 -38 42 -36 58 L-22 58 Z" fill="#332a27" stroke="#0a0604" stroke-width="2"/>
      <g transform="translate(19 26)" fill="#efe6d4"><circle cx="0" cy="-2" r="6"/><rect x="-4" y="2" width="8" height="5" rx="1.5"/><circle cx="-2.3" cy="-2.5" r="1.6" fill="#26201e"/><circle cx="2.3" cy="-2.5" r="1.6" fill="#26201e"/>
        <path d="M-9 8 L9 14 M9 8 L-9 14" stroke="#efe6d4" stroke-width="2.4" stroke-linecap="round"/></g>
      <path d="M6 -4 L22 -9 L6 -14 Z" fill="#a3261c" stroke="#0a0604" stroke-width="1"/></g>
    <path d="M150 88 C160 74 190 70 214 76 C226 80 232 86 236 92 Z" fill="#e3c98e" stroke="${INK}" stroke-width="1.6"/>
    <g transform="translate(190 80)">
      <path d="M-18 -6 C-18 -18 18 -18 18 -6 Z" fill="url(#ch${u})" stroke="${INK}" stroke-width="2"/><rect x="-18" y="-6" width="36" height="18" rx="2" fill="url(#ch${u})" stroke="${INK}" stroke-width="2"/>
      <path d="M-10 -15 V12 M10 -15 V12" stroke="url(#au${u})" stroke-width="3"/><rect x="-4" y="-8" width="8" height="8" rx="1.5" fill="url(#au${u})" stroke="${INK}" stroke-width="1.2"/>
      <g fill="url(#au${u})" stroke="#8a6320" stroke-width=".8"><circle cx="-24" cy="10" r="4"/><circle cx="24" cy="11" r="4"/><circle cx="-14" cy="-16" r="3.4"/></g></g>`,
};

// ---------- Ausgabe ----------

function svg(viewBox, inner, cls = '', fit = '') {
  return `<svg class="scene ${cls}" viewBox="${viewBox}" ${fit ? `preserveAspectRatio="${fit}"` : ''} aria-hidden="true">${inner}</svg>`;
}

export const SCENE_NAMES = Object.keys(SCENE);
export const sceneArt = (name) => svg('0 0 160 120', (SCENE[name] || SCENE.island)(uid()));
export const modeArt = (name) => svg('0 0 120 90', (MODE[name] || MODE.ai)(uid()), 'mode-art');
export const expansionArt = (name) => {
  const u = uid();
  return svg('0 0 240 140', `<clipPath id="xc${u}"><rect width="240" height="140"/></clipPath><g clip-path="url(#xc${u})">${(EXPANSION[name] || EXPANSION.players)(u)}</g>`, 'exp-art', 'xMidYMid slice');
};

// Für bestehenden Code: ILLUS.house usw. liefert bei jedem Zugriff eine frische Grafik
export const ILLUS = new Proxy({}, {
  get: (_, name) => (typeof name === 'string' ? sceneArt(name) : undefined),
  ownKeys: () => SCENE_NAMES,
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
export const MODES = new Proxy({}, { get: (_, n) => modeArt(n), ownKeys: () => Object.keys(MODE), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
export const EXPANSIONS = new Proxy({}, { get: (_, n) => expansionArt(n), ownKeys: () => Object.keys(EXPANSION), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
