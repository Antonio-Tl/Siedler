// Farbige Mini-Illustrationen (64er-Raster) für Chronik, Meldungen, Klänge und Menü – ersetzen die Emojis.
// Licht kommt einheitlich von links oben, Konturen in dunklem Braun, damit alles wie aus einem Guss wirkt.
import { uid } from './color.js';

const INK = '#2e1a0c';
const lg = (id, a, b, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rg = (id, a, b, cx = 0.38, cy = 0.32) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const GOLD = (u) => lg(`au${u}`, '#fbe3a0', '#a8792c', 0.2, 0, 0.8, 1);
const shadow = (rx = 22, cy = 58) => `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="3.6" fill="#000" opacity=".2"/>`;

const EMB = {
  dice: (u) => `<defs>${lg(`d${u}`, '#fffdf6', '#e0d4bb')}${lg(`e${u}`, '#efe5cf', '#c9b994')}</defs>${shadow()}
    <g transform="rotate(-14 22 36)"><rect x="6" y="20" width="30" height="30" rx="6" fill="url(#d${u})" stroke="${INK}" stroke-width="2"/>
      <circle cx="14" cy="28" r="3" fill="#a3261c"/><circle cx="21" cy="35" r="3" fill="#a3261c"/><circle cx="28" cy="42" r="3" fill="#a3261c"/></g>
    <g transform="rotate(12 44 32)"><rect x="29" y="14" width="28" height="28" rx="6" fill="url(#e${u})" stroke="${INK}" stroke-width="2"/>
      <circle cx="36.5" cy="21.5" r="2.8" fill="${INK}"/><circle cx="49.5" cy="21.5" r="2.8" fill="${INK}"/><circle cx="36.5" cy="34.5" r="2.8" fill="${INK}"/><circle cx="49.5" cy="34.5" r="2.8" fill="${INK}"/>
      <path d="M33 17 h12" stroke="#fff" stroke-width="2" opacity=".7" stroke-linecap="round"/></g>`,
  harvest: (u) => `<defs>${lg(`w${u}`, '#f8d97e', '#c98f2c')}</defs>${shadow(16)}
    <g fill="url(#w${u})" stroke="#8a5e1c" stroke-width="1.2">
      ${[[-30, 20, 16], [-16, 26, 11], [0, 32, 9], [16, 38, 11], [30, 44, 16]].map(([r, x, y]) => `<g transform="rotate(${r} 32 46)"><path d="M32 46 L32 18" stroke="#b5862e" stroke-width="2"/>
        ${[0, 1, 2, 3].map((i) => `<ellipse cx="${i % 2 ? 34.5 : 29.5}" cy="${20 - i * 4.5 + 8}" rx="3.2" ry="5" transform="rotate(${i % 2 ? 22 : -22} ${i % 2 ? 34.5 : 29.5} ${20 - i * 4.5 + 8})"/>`).join('')}
        <ellipse cx="32" cy="12" rx="2.8" ry="4.4"/></g>`).join('')}
    </g>
    <path d="M24 44 L40 44 L38 58 L26 58 Z" fill="#d9a948" stroke="#8a5e1c" stroke-width="1.2"/>
    <rect x="22.5" y="42" width="19" height="5.5" rx="2" fill="#8a4a24" stroke="${INK}" stroke-width="1.2"/>`,
  robber: (u) => `<defs>${lg(`r${u}`, '#4a4752', '#16151a')}</defs>${shadow(16, 60)}
    <path d="M32 5 C20 5 15 16 16 26 C10 34 8 46 9 58 L55 58 C56 46 54 34 48 26 C49 16 44 5 32 5 Z" fill="url(#r${u})" stroke="#0a0a0c" stroke-width="2"/>
    <path d="M22 24 C23 15 41 15 42 24 C40 32 24 32 22 24 Z" fill="#050506"/>
    <circle cx="27.5" cy="24" r="2.2" fill="#ffcf6a"/><circle cx="36.5" cy="24" r="2.2" fill="#ffcf6a"/>
    <path d="M14 38 L50 38" stroke="#6b4a2d" stroke-width="3.5"/><rect x="29" y="35" width="6" height="6" rx="1" fill="#d6b06a"/>
    <path d="M20 8 C26 4 36 4 42 9" fill="none" stroke="#7b7884" stroke-width="1.5" opacity=".6"/>`,
  discard: (u) => `<defs>${lg(`c${u}`, '#fbf3df', '#dccaa2')}</defs>${shadow(20)}
    <g transform="rotate(-18 24 30)"><rect x="12" y="10" width="22" height="32" rx="3" fill="url(#c${u})" stroke="${INK}" stroke-width="1.8"/><rect x="16" y="14" width="14" height="24" rx="1.5" fill="none" stroke="#c9a15b" stroke-width="1.2"/></g>
    <g transform="rotate(10 38 28)"><rect x="28" y="8" width="22" height="32" rx="3" fill="url(#c${u})" stroke="${INK}" stroke-width="1.8"/><rect x="32" y="12" width="14" height="24" rx="1.5" fill="none" stroke="#c9a15b" stroke-width="1.2"/></g>
    <circle cx="44" cy="45" r="11" fill="#a3261c" stroke="#5e120c" stroke-width="2"/><path d="M44 39 v10 M39.5 45 l4.5 4.5 4.5-4.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  steal: (u) => `<defs>${lg(`g${u}`, '#5a4a40', '#2a1f19')}${lg(`c${u}`, '#fbf3df', '#dccaa2')}</defs>${shadow(18)}
    <g transform="rotate(16 36 26)"><rect x="26" y="6" width="20" height="28" rx="3" fill="url(#c${u})" stroke="${INK}" stroke-width="1.8"/><circle cx="36" cy="20" r="4" fill="#c9573a"/></g>
    <path d="M6 48 C10 40 16 34 24 32 L36 30 C40 30 41 34 38 36 L30 38 L42 38 C46 38 46 43 42 43 L32 44 L40 45 C43 45.5 43 49.5 39.5 49.5 L26 50 C18 52 12 54 8 56 Z" fill="url(#g${u})" stroke="#110a06" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M14 42 C18 38 22 36 27 35" fill="none" stroke="#8a7a6e" stroke-width="1.4" opacity=".7"/>`,
  house: (u) => `<defs>${lg(`r${u}`, '#c8553a', '#7a2414')}${lg(`w${u}`, '#fbf1da', '#dfcda6')}</defs>${shadow(22)}
    <rect x="13" y="30" width="38" height="27" fill="url(#w${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M13 41 H51 M24 30 V57 M40 30 V57 M13 30 L24 41 M40 41 L51 30" stroke="#5a3a22" stroke-width="2"/>
    <path d="M6 33 L32 10 L58 33 L52 33 L32 16 L12 33 Z" fill="url(#r${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 31 L32 12 L54 31 L32 18 Z" fill="url(#r${u})"/><path d="M14 30 L32 14" stroke="#e98a6a" stroke-width="1.5" opacity=".7"/>
    <rect x="42" y="12" width="6" height="12" fill="#7a3a26" stroke="${INK}" stroke-width="1.5"/>
    <rect x="28" y="44" width="8" height="13" rx="1" fill="#5a3a22" stroke="${INK}" stroke-width="1.5"/>
    <rect x="16.5" y="44" width="5.5" height="5.5" fill="#ffd77a" stroke="${INK}" stroke-width="1.2"/><rect x="42" y="44" width="5.5" height="5.5" fill="#ffd77a" stroke="${INK}" stroke-width="1.2"/>`,
  city: (u) => `<defs>${lg(`s${u}`, '#e9e1d0', '#a99f8c')}${lg(`r${u}`, '#c8553a', '#7a2414')}${lg(`w${u}`, '#fbf1da', '#dfcda6')}</defs>${shadow(26)}
    <rect x="6" y="32" width="28" height="25" fill="url(#w${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M3 34 L20 19 L37 34 Z" fill="url(#r${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="32" y="16" width="22" height="41" fill="url(#s${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M32 16 v-6 h4.5 v6 M40.8 16 v-6 h4.5 v6 M49.5 16 v-6 h4.5 v6" fill="url(#s${u})" stroke="${INK}" stroke-width="1.8"/>
    <path d="M43 10 V2" stroke="${INK}" stroke-width="1.6"/><path d="M43 2 L53 4.5 L43 7 Z" fill="#b8322a" stroke="${INK}" stroke-width="1"/>
    <path d="M38 57 v-9 a5 5 0 0 1 10 0 v9" fill="#5a3a22" stroke="${INK}" stroke-width="1.6"/>
    <rect x="39" y="25" width="7" height="8" rx="3.5" fill="#ffd77a" stroke="${INK}" stroke-width="1.2"/>
    <rect x="13" y="42" width="7" height="15" fill="#5a3a22" stroke="${INK}" stroke-width="1.4"/><path d="M36 22 h14" stroke="#fff" stroke-width="1.4" opacity=".5"/>`,
  road: (u) => `<defs>${lg(`p${u}`, '#d9b37a', '#9c7442')}</defs>
    <path d="M4 60 L24 22 L40 22 L60 60 Z" fill="url(#p${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 26 v6 M32 37 v8 M32 50 v9" stroke="#fbf1da" stroke-width="3" stroke-linecap="round"/>
    <path d="M2 60 C6 46 14 40 22 38 L14 60 Z M62 60 C58 46 50 40 42 38 L50 60 Z" fill="#5f8a3e" opacity=".9"/>
    <rect x="44" y="4" width="4" height="30" fill="#6b4a2d" stroke="${INK}" stroke-width="1.4"/>
    <path d="M36 8 L55 8 L60 13 L55 18 L36 18 Z" fill="#b8874a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M40 13 h12" stroke="#6b4a2d" stroke-width="1.6"/>`,
  card: (u) => `<defs>${lg(`c${u}`, '#3f7a4e', '#1f4a2c')}${GOLD(u)}</defs>${shadow(18)}
    <rect x="14" y="5" width="36" height="50" rx="4" fill="url(#c${u})" stroke="${INK}" stroke-width="2"/>
    <rect x="18.5" y="9.5" width="27" height="41" rx="2" fill="none" stroke="url(#au${u})" stroke-width="1.6"/>
    <path d="M32 18 L36 27 L45 30 L36 33 L32 42 L28 33 L19 30 L28 27 Z" fill="url(#au${u})" stroke="#7a5420" stroke-width="1"/>
    <circle cx="32" cy="30" r="3" fill="#a3261c"/>`,
  sword: (u) => `<defs>${lg(`b${u}`, '#f1f4f6', '#8e979f', 0, 0, 1, 1)}${rg(`s${u}`, '#c8553a', '#6e1a10')}${GOLD(u)}</defs>${shadow(20)}
    <path d="M10 10 L44 44 M54 10 L20 44" stroke="url(#b${u})" stroke-width="5" stroke-linecap="round"/>
    <path d="M10 10 L44 44 M54 10 L20 44" stroke="#5a636b" stroke-width="1" opacity=".6"/>
    <circle cx="32" cy="38" r="14" fill="url(#s${u})" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="38" r="9" fill="none" stroke="url(#au${u})" stroke-width="2"/>
    <circle cx="32" cy="38" r="3.4" fill="url(#au${u})"/>
    <path d="M38 48 l6 -6 M26 48 l-6 -6" stroke="url(#au${u})" stroke-width="4" stroke-linecap="round"/>
    <path d="M47 51 l4 4 M17 51 l-4 4" stroke="#6b4a2d" stroke-width="4" stroke-linecap="round"/>`,
  trade: (u) => `<defs>${lg(`a${u}`, '#c8553a', '#7a2414')}${lg(`b${u}`, '#4a78c0', '#1f3f78')}${lg(`k${u}`, '#f6d2b0', '#d49c74')}</defs>${shadow(24)}
    <path d="M2 30 L16 22 L24 34 L10 44 Z" fill="url(#a${u})" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M62 30 L48 22 L40 34 L54 44 Z" fill="url(#b${u})" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M18 28 C24 22 30 22 36 24 L46 30 C48 32 46 35 43 34 L36 31 L44 37 C47 39 44 43 41 41 L34 37 L40 42 C42 44 40 47 37 45 L31 41 L34 45 C35 47 33 49 31 48 L22 42 Z" fill="url(#k${u})" stroke="#6b3f24" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M44 26 C38 22 32 22 27 26 L22 32 C21 34 23 36 25 35 L30 31" fill="url(#k${u})" stroke="#6b3f24" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M28 27 C32 25 36 25 39 26" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/>`,
  bank: (u) => `<defs>${GOLD(u)}${lg(`i${u}`, '#6b7680', '#2c3238')}</defs>${shadow(24)}
    <circle cx="26" cy="11" r="5" fill="none" stroke="url(#i${u})" stroke-width="3.5"/>
    <path d="M26 16 V50 M16 24 H36 M10 38 C10 50 18 54 26 54 C34 54 42 50 42 38" fill="none" stroke="url(#i${u})" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M6 40 L10 35 L14 40 M38 40 L42 35 L46 40" fill="none" stroke="url(#i${u})" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${[0, 1, 2, 3].map((i) => `<ellipse cx="48" cy="${54 - i * 5}" rx="11" ry="4" fill="url(#au${u})" stroke="#7a5420" stroke-width="1.4"/>`).join('')}
    <ellipse cx="48" cy="38.5" rx="7" ry="2" fill="none" stroke="#7a5420" stroke-width="1"/>`,
  crown: (u) => `<defs>${GOLD(u)}</defs>${shadow(22)}
    <path d="M10 46 L6 18 L20 30 L32 10 L44 30 L58 18 L54 46 Z" fill="url(#au${u})" stroke="#6b4818" stroke-width="2" stroke-linejoin="round"/>
    <rect x="9" y="45" width="46" height="9" rx="2.5" fill="url(#au${u})" stroke="#6b4818" stroke-width="2"/>
    <circle cx="32" cy="34" r="4.5" fill="#a3261c" stroke="#5e120c" stroke-width="1.2"/><circle cx="19" cy="38" r="3" fill="#2f5fa8" stroke="#163066"/><circle cx="45" cy="38" r="3" fill="#3d8a45" stroke="#1f4a24"/>
    <circle cx="6" cy="17" r="3" fill="#fbe3a0" stroke="#6b4818"/><circle cx="32" cy="9" r="3" fill="#fbe3a0" stroke="#6b4818"/><circle cx="58" cy="17" r="3" fill="#fbe3a0" stroke="#6b4818"/>
    <path d="M12 49.5 h40" stroke="#fff3cc" stroke-width="1.4" opacity=".6"/>`,
  scroll: (u) => `<defs>${lg(`p${u}`, '#fbf3df', '#dcc49a')}</defs>${shadow(22)}
    <path d="M14 10 H48 C52 10 54 13 54 16 L54 48 C54 52 51 54 48 54 H16 C12 54 10 51 10 48 L10 16" fill="url(#p${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M10 16 C10 12 12 10 15 10 C18 10 20 12 20 15 C20 18 18 20 15 20 L10 20 Z" fill="#e8d4aa" stroke="${INK}" stroke-width="1.8"/>
    <path d="M24 22 H46 M24 29 H46 M24 36 H40" stroke="#8a6a3e" stroke-width="2" stroke-linecap="round"/>
    <circle cx="42" cy="46" r="6" fill="#a3261c" stroke="#5e120c" stroke-width="1.4"/><path d="M38 50 l-2 7 M46 50 l2 7" stroke="#a3261c" stroke-width="2.4"/>`,
  island: (u) => `<defs>${lg(`s${u}`, '#5fc0b4', '#1f7a74')}${lg(`g${u}`, '#9fd068', '#4f8a32')}</defs>
    <ellipse cx="32" cy="48" rx="29" ry="11" fill="url(#s${u})" stroke="#16524e" stroke-width="1.6"/>
    <path d="M8 48 C12 40 20 34 32 34 C44 34 52 40 56 48 C48 52 16 52 8 48 Z" fill="#e3c98e" stroke="${INK}" stroke-width="1.6"/>
    <path d="M12 46 C16 39 23 36 32 36 C41 36 48 39 52 46 C44 48 20 48 12 46 Z" fill="url(#g${u})"/>
    <path d="M16 38 L20 24 L24 38 Z M23 37 L28 19 L33 37 Z" fill="#2f5a2c" stroke="#1d3a1b" stroke-width="1.2"/>
    <rect x="37" y="30" width="11" height="9" fill="#fbf1da" stroke="${INK}" stroke-width="1.4"/><path d="M35 31 L42.5 24 L50 31 Z" fill="#b8322a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M6 54 c4 -2 8 -2 12 0 M44 55 c4 -2 8 -2 12 0" stroke="#e8fbf6" stroke-width="1.6" fill="none" opacity=".8"/>`,
  compass: (u) => `<defs>${rg(`c${u}`, '#fbf3df', '#e0cba0')}${GOLD(u)}</defs>${shadow(20)}
    <circle cx="32" cy="31" r="25" fill="url(#au${u})" stroke="#6b4818" stroke-width="2"/><circle cx="32" cy="31" r="19.5" fill="url(#c${u})" stroke="#6b4818" stroke-width="1.4"/>
    <path d="M32 13 L36 31 L32 49 L28 31 Z" fill="#2e1a0c"/><path d="M32 13 L36 31 L32 31 Z M32 49 L28 31 L32 31 Z" fill="#6b4a2d"/>
    <path d="M14 31 L32 27 L50 31 L32 35 Z" fill="#8a6a3e"/><path d="M32 13 L36 31 L28 31 Z" fill="#b8322a"/>
    <circle cx="32" cy="31" r="3" fill="url(#au${u})" stroke="#6b4818"/>`,
  trophy: (u) => `<defs>${GOLD(u)}</defs>${shadow(16, 60)}
    <path d="M18 8 H46 V22 C46 32 40 38 32 38 C24 38 18 32 18 22 Z" fill="url(#au${u})" stroke="#6b4818" stroke-width="2"/>
    <path d="M18 12 H9 C9 22 13 27 20 28 M46 12 H55 C55 22 51 27 44 28" fill="none" stroke="#6b4818" stroke-width="3"/>
    <path d="M28 38 H36 L35 46 H29 Z" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.6"/>
    <rect x="20" y="46" width="24" height="10" rx="2" fill="#6b4a2d" stroke="${INK}" stroke-width="1.8"/><rect x="26" y="49" width="12" height="4" rx="1" fill="url(#au${u})"/>
    <path d="M24 12 C24 22 26 28 30 32" fill="none" stroke="#fff6d6" stroke-width="2" opacity=".6" stroke-linecap="round"/>`,
  bell: (u) => `<defs>${GOLD(u)}</defs>${shadow(18)}
    <path d="M32 6 C20 6 15 16 15 28 L15 38 L9 46 L55 46 L49 38 L49 28 C49 16 44 6 32 6 Z" fill="url(#au${u})" stroke="#6b4818" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="32" cy="51" r="5" fill="#8a6a3e" stroke="${INK}" stroke-width="1.6"/><rect x="29" y="2" width="6" height="6" rx="2" fill="#8a6a3e" stroke="${INK}" stroke-width="1.4"/>
    <path d="M22 18 C22 26 21 32 20 38" fill="none" stroke="#fff6d6" stroke-width="2.4" opacity=".6" stroke-linecap="round"/>
    <path d="M58 22 c3 4 3 10 0 14 M6 22 c-3 4 -3 10 0 14" fill="none" stroke="#c9a15b" stroke-width="2" stroke-linecap="round"/>`,
  coin: (u) => `<defs>${GOLD(u)}</defs>${shadow(20)}
    ${[0, 1, 2].map((i) => `<ellipse cx="24" cy="${52 - i * 6}" rx="15" ry="5.5" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.6"/>`).join('')}
    <circle cx="42" cy="28" r="16" fill="url(#au${u})" stroke="#6b4818" stroke-width="2"/><circle cx="42" cy="28" r="11" fill="none" stroke="#8a6320" stroke-width="1.4"/>
    <path d="M42 20 L44.5 25.5 L50 26 L46 30 L47 35.5 L42 33 L37 35.5 L38 30 L34 26 L39.5 25.5 Z" fill="#8a6320"/>`,
  medal: (u) => `<defs>${GOLD(u)}</defs>${shadow(14, 60)}
    <path d="M20 4 L30 26 L24 28 L14 6 Z" fill="#2f5fa8" stroke="${INK}" stroke-width="1.4"/><path d="M44 4 L34 26 L40 28 L50 6 Z" fill="#b8322a" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="32" cy="40" r="16" fill="url(#au${u})" stroke="#6b4818" stroke-width="2"/><circle cx="32" cy="40" r="10.5" fill="none" stroke="#8a6320" stroke-width="1.4"/>
    <path d="M32 32 L34.6 37.6 L40.5 38.2 L36 42.2 L37.3 48 L32 45 L26.7 48 L28 42.2 L23.5 38.2 L29.4 37.6 Z" fill="#fff3cc" stroke="#8a6320" stroke-width=".8"/>`,
  warning: (u) => `<defs>${lg(`w${u}`, '#c9a15b', '#7a5420')}</defs>${shadow(18)}
    <rect x="29" y="34" width="6" height="24" fill="#6b4a2d" stroke="${INK}" stroke-width="1.4"/>
    <path d="M32 4 L58 46 L6 46 Z" fill="url(#w${u})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 16 V32" stroke="#a3261c" stroke-width="5.5" stroke-linecap="round"/><circle cx="32" cy="39" r="3.4" fill="#a3261c"/>`,
  click: (u) => `<defs>${rg(`b${u}`, '#f2d38a', '#8a6320')}</defs>${shadow(18)}
    <circle cx="32" cy="32" r="22" fill="#5a3a22" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="30" r="16" fill="url(#b${u})" stroke="#6b4818" stroke-width="1.8"/>
    <path d="M24 24 C27 20 32 19 36 20" fill="none" stroke="#fff6d6" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>`,
  hand: (u) => `<defs>${lg(`k${u}`, '#f6d2b0', '#c88e66')}</defs>${shadow(16)}
    <path d="M22 56 L20 38 C17 34 13 30 12 27 C11 24 15 22 17 25 L22 31 L22 12 C22 8.5 27 8.5 27 12 L27 28 L27 8 C27 4.5 32 4.5 32 8 L32 28 L32 10 C32 6.5 37 6.5 37 10 L37 29 L37 15 C37 11.5 42 11.5 42 15 L42 38 C42 46 38 52 36 56 Z" fill="url(#k${u})" stroke="#6b3f24" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M27 20 v6 M32 20 v6 M37 22 v5" stroke="#b07a52" stroke-width="1.2" opacity=".7"/>
    <rect x="19" y="54" width="20" height="6" rx="1.5" fill="#7a2414" stroke="${INK}" stroke-width="1.4"/>`,
  helmet: (u) => `<defs>${lg(`h${u}`, '#eef1f4', '#7c858e', 0.1, 0, 0.9, 1)}</defs>${shadow(18)}
    <path d="M30 8 C34 2 46 0 52 6 C46 6 40 9 37 14" fill="#b8322a" stroke="${INK}" stroke-width="1.6"/>
    <path d="M14 50 L14 30 C14 16 22 10 32 10 C42 10 50 16 50 30 L50 50 C44 54 20 54 14 50 Z" fill="url(#h${u})" stroke="#2a2f34" stroke-width="2"/>
    <path d="M18 30 H46" stroke="#2a2f34" stroke-width="4"/><path d="M32 30 V50" stroke="#2a2f34" stroke-width="2.4"/>
    <path d="M22 37 h6 M22 42 h6 M36 37 h6 M36 42 h6" stroke="#2a2f34" stroke-width="2" stroke-linecap="round"/>
    <path d="M20 22 C22 16 26 13 30 12" fill="none" stroke="#fff" stroke-width="2" opacity=".7" stroke-linecap="round"/>`,
  anchor: (u) => `<defs>${lg(`i${u}`, '#7d8892', '#2c3238')}</defs>${shadow(20)}
    <circle cx="32" cy="10" r="5.5" fill="none" stroke="url(#i${u})" stroke-width="4"/>
    <path d="M32 15.5 V54 M20 24 H44 M12 38 C12 50 22 56 32 56 C42 56 52 50 52 38" fill="none" stroke="url(#i${u})" stroke-width="5" stroke-linecap="round"/>
    <path d="M7 41 L12 34 L17 41 M47 41 L52 34 L57 41" fill="none" stroke="url(#i${u})" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M26 8 C18 14 18 26 26 32 C34 38 40 44 36 50" fill="none" stroke="#c9a46a" stroke-width="2.2" stroke-linecap="round"/>`,
  hourglass: (u) => `<defs>${lg(`s${u}`, '#f1cf7a', '#c9952c')}</defs>${shadow(16)}
    <rect x="14" y="5" width="36" height="7" rx="2.5" fill="#6b4a2d" stroke="${INK}" stroke-width="1.6"/><rect x="14" y="50" width="36" height="7" rx="2.5" fill="#6b4a2d" stroke="${INK}" stroke-width="1.6"/>
    <path d="M18 12 V50 M46 12 V50" stroke="#8a6038" stroke-width="3"/>
    <path d="M22 12 C22 26 30 28 30 31 C30 34 22 36 22 50 L42 50 C42 36 34 34 34 31 C34 28 42 26 42 12 Z" fill="#fbf6ea" fill-opacity=".85" stroke="${INK}" stroke-width="1.6"/>
    <path d="M25 18 L39 18 C37 25 33 27 32 30.5 C31 27 27 25 25 18 Z M24 49 C26 41 30 39 32 38 C34 39 38 41 40 49 Z" fill="url(#s${u})"/>`,
  chest: (u) => `<defs>${lg(`w${u}`, '#a8723e', '#5a3418')}${GOLD(u)}</defs>${shadow(26)}
    <path d="M6 28 C6 14 18 10 32 10 C46 10 58 14 58 28 Z" fill="url(#w${u})" stroke="${INK}" stroke-width="2"/>
    <rect x="6" y="28" width="52" height="28" rx="2" fill="url(#w${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M18 12 V56 M46 12 V56" stroke="url(#au${u})" stroke-width="4"/><path d="M6 28 H58" stroke="url(#au${u})" stroke-width="3"/>
    <rect x="27" y="24" width="10" height="13" rx="2" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.4"/><circle cx="32" cy="30" r="1.8" fill="${INK}"/>`,
  sparkle: (u) => `<defs>${GOLD(u)}</defs>
    <path d="M28 4 L32.5 21.5 L50 26 L32.5 30.5 L28 48 L23.5 30.5 L6 26 L23.5 21.5 Z" fill="url(#au${u})" stroke="#8a6320" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M48 38 L50 45 L57 47 L50 49 L48 56 L46 49 L39 47 L46 45 Z" fill="url(#au${u})" stroke="#8a6320" stroke-width="1.2" stroke-linejoin="round"/>`,
  users: (u) => `<defs>${lg(`a${u}`, '#4a78c0', '#1f3f78')}${lg(`b${u}`, '#c8553a', '#7a2414')}${lg(`k${u}`, '#f6d2b0', '#d49c74')}</defs>${shadow(26)}
    <circle cx="42" cy="20" r="8" fill="url(#k${u})" stroke="#6b3f24" stroke-width="1.6"/><path d="M28 54 C28 40 34 32 42 32 C50 32 56 40 56 54 Z" fill="url(#a${u})" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="22" cy="22" r="9" fill="url(#k${u})" stroke="#6b3f24" stroke-width="1.6"/><path d="M6 56 C6 42 13 34 22 34 C31 34 38 42 38 56 Z" fill="url(#b${u})" stroke="${INK}" stroke-width="1.8"/>`,
  quill: (u) => `<defs>${lg(`f${u}`, '#fffaf0', '#d6c6a4')}</defs>${shadow(14)}
    <path d="M54 4 C38 8 26 22 22 42 L28 40 C32 26 42 14 54 4 Z" fill="url(#f${u})" stroke="${INK}" stroke-width="1.8"/>
    <path d="M51 8 C40 16 32 26 26 40" fill="none" stroke="#a89470" stroke-width="1.2"/>
    <path d="M22 42 L19 50" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M10 46 H34 L32 58 H12 Z" fill="#2c3a4a" stroke="${INK}" stroke-width="1.8"/><ellipse cx="22" cy="46" rx="12" ry="3" fill="#465a6e" stroke="${INK}" stroke-width="1.4"/>`,
  book: (u) => `<defs>${lg(`c${u}`, '#9b3a22', '#5e1c10')}${lg(`p${u}`, '#fbf3df', '#e0cca4')}</defs>${shadow(24)}
    <path d="M6 14 C16 10 26 12 32 18 C38 12 48 10 58 14 V52 C48 48 38 50 32 56 C26 50 16 48 6 52 Z" fill="url(#c${u})" stroke="${INK}" stroke-width="2"/>
    <path d="M9 14 C18 11 26 13 32 18 V52 C26 47 18 46 9 48 Z M55 14 C46 11 38 13 32 18 V52 C38 47 46 46 55 48 Z" fill="url(#p${u})" stroke="${INK}" stroke-width="1.4"/>
    <path d="M14 22 C19 20 24 21 28 24 M14 29 C19 27 24 28 28 31 M36 24 C40 21 45 20 50 22 M36 31 C40 28 45 27 50 29" fill="none" stroke="#a88a55" stroke-width="1.6"/>
    <path d="M44 14 V28 L47 25 L50 28 V13" fill="#b8322a" stroke="${INK}" stroke-width="1"/>`,
  gear: (u) => `<defs>${GOLD(u)}</defs>${shadow(22)}
    <path d="M28 4 h8 l1.5 7 5 2.2 6-4 5.7 5.7-4 6 2.2 5 7 1.5 v8 l-7 1.5-2.2 5 4 6-5.7 5.7-6-4-5 2.2L36 60 h-8 l-1.5-7-5-2.2-6 4-5.7-5.7 4-6-2.2-5L4 36 v-8 l7-1.5 2.2-5-4-6 5.7-5.7 6 4 5-2.2z" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="10" fill="#5a3a22" stroke="#6b4818" stroke-width="2"/><circle cx="32" cy="32" r="4" fill="url(#au${u})"/>`,
  ship: (u) => `<defs>${lg(`h${u}`, '#8a5a30', '#4a2c14')}${lg(`s${u}`, '#fffaf0', '#dccaa2', 0, 0, 1, 0)}</defs>
    <path d="M4 54 c6 -3 10 -3 16 0 s10 3 16 0 s10 -3 16 0 s6 2 8 1" fill="none" stroke="#2a8a84" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M8 40 L56 40 L48 52 L16 52 Z" fill="url(#h${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12 44 H52" stroke="#c9a15b" stroke-width="1.4"/>
    <path d="M32 6 V40" stroke="${INK}" stroke-width="2.4"/>
    <path d="M33 8 C46 14 50 26 48 36 L33 36 Z" fill="url(#s${u})" stroke="${INK}" stroke-width="1.8"/><path d="M31 12 C22 18 18 28 20 36 L31 36 Z" fill="url(#s${u})" stroke="${INK}" stroke-width="1.8"/>
    <path d="M32 6 L42 3 L32 0 Z" fill="#b8322a"/>`,
  plenty: (u) => `<defs>${lg(`h${u}`, '#e2b65a', '#8a5a1c', 0, 0, 1, 1)}</defs>${shadow(22)}
    <path d="M6 18 C10 12 16 12 18 18 C24 34 36 46 54 44 C58 52 54 58 44 58 C24 58 8 42 6 18 Z" fill="url(#h${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 24 C18 36 28 46 42 50 M10 20 C14 32 24 44 38 52" fill="none" stroke="#6b4818" stroke-width="1.4" opacity=".7"/>
    <circle cx="50" cy="34" r="7" fill="#c8423a" stroke="${INK}" stroke-width="1.6"/><circle cx="40" cy="30" r="6" fill="#e0a92a" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="56" cy="44" r="5.5" fill="#3d8a45" stroke="${INK}" stroke-width="1.6"/><path d="M44 22 C46 16 50 14 54 15 C52 19 48 22 44 22 Z" fill="#5d8f3a" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="47" cy="32" r="1.6" fill="#fff" opacity=".6"/>`,
  monopoly: (u) => `<defs>${lg(`b${u}`, '#c9a46a', '#7a5428', 0, 0, 1, 1)}${GOLD(u)}</defs>${shadow(22)}
    <path d="M22 16 C18 10 22 6 26 8 L32 11 L38 8 C42 6 46 10 42 16 Z" fill="url(#b${u})" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M22 16 C8 26 6 44 12 52 C18 58 46 58 52 52 C58 44 56 26 42 16 Z" fill="url(#b${u})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M20 16 H44" stroke="#5a3a20" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="38" r="10" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.8"/>
    <path d="M32 31 L34 36 L39 36.5 L35 40 L36.3 45 L32 42.4 L27.7 45 L29 40 L25 36.5 L30 36 Z" fill="#8a6320"/>
    <path d="M16 30 C15 36 15 42 17 48" fill="none" stroke="#e9cf9a" stroke-width="2" opacity=".6" stroke-linecap="round"/>`,
  laurel: (u) => `<defs>${lg(`l${u}`, '#8fbf5a', '#3f6b2a')}${GOLD(u)}</defs>${shadow(18)}
    ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${16 + i * 2.2}" cy="${46 - i * 8}" rx="4" ry="8" transform="rotate(${-40 + i * 12} ${16 + i * 2.2} ${46 - i * 8})" fill="url(#l${u})" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${48 - i * 2.2}" cy="${46 - i * 8}" rx="4" ry="8" transform="rotate(${40 - i * 12} ${48 - i * 2.2} ${46 - i * 8})" fill="url(#l${u})" stroke="${INK}" stroke-width="1.2"/>`).join('')}
    <path d="M32 18 L36 28 L46 29 L38 35.5 L40.5 46 L32 40.5 L23.5 46 L26 35.5 L18 29 L28 28 Z" fill="url(#au${u})" stroke="#6b4818" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M24 54 C28 50 36 50 40 54" fill="none" stroke="#a3261c" stroke-width="3" stroke-linecap="round"/>`,
  desert: (u) => `<defs>${lg(`d${u}`, '#f3dfa6', '#c9a35e')}</defs>
    <circle cx="44" cy="16" r="8" fill="#f6c453" stroke="#b07a1c" stroke-width="1.4"/>
    <path d="M2 52 C12 36 22 32 32 40 C40 32 52 34 62 48 L62 58 L2 58 Z" fill="url(#d${u})" stroke="${INK}" stroke-width="1.8"/>
    <path d="M18 44 V30 M18 34 C14 34 13 31 13 28 M18 38 C22 38 23 35 23 32" fill="none" stroke="#4f7a32" stroke-width="3.5" stroke-linecap="round"/>`,
};

export function emblem(name, size = 24, cls = '') {
  const u = uid();
  const body = (EMB[name] || EMB.scroll)(u);
  return `<svg class="art emblem ${cls}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

export const EMBLEM_NAMES = Object.keys(EMB);
