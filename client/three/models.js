// 3D-Modelle: Spielfiguren, Räuber, Hologramme, Geländedeko, Häfen, Boote und Würfel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  mulberry, shade, woodTexture, glowTexture, diceFaceTexture, shingleTexture, grainTexture, contactShadowTexture,
} from './textures.js';

export const TOP = 0;
export const SLAB = 0.07;
export const SURF = TOP + SLAB;
export const WATER_Y = -0.3;

const SQ3 = Math.sqrt(3);

// ---------- Figuren ----------

const shingles = shingleTexture();
const roadGrain = grainTexture('#ebe6de', 21);
const contactTex = contactShadowTexture();

const matCache = new Map();
function pieceMats(color) {
  if (!matCache.has(color)) {
    const c = new THREE.Color(color);
    const light = c.getHSL({ h: 0, s: 0, l: 0 }).l > 0.75;
    const roofTex = shingles.clone();
    roofTex.repeat.set(1.4, 1);
    matCache.set(color, {
      roof: new THREE.MeshStandardMaterial({ color: light ? '#f4f0e6' : color, map: roofTex, roughness: 0.62 }),
      roofDark: new THREE.MeshStandardMaterial({ color: shade(color, -0.35), roughness: 0.6 }),
      wall: new THREE.MeshStandardMaterial({ color: light ? '#d9cfba' : new THREE.Color('#f1e8d4').lerp(c, 0.1), roughness: 0.85 }),
      road: new THREE.MeshStandardMaterial({ color: light ? '#f2eee4' : shade(color, 0.04), map: roadGrain, roughness: 0.5 }),
      trim: new THREE.MeshStandardMaterial({ color: light ? '#9d917b' : shade(color, -0.45), roughness: 0.6 }),
      flag: new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }),
    });
  }
  return matCache.get(color);
}

const SHARED = {
  dark: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 }),
  timber: new THREE.MeshStandardMaterial({ color: '#4d3322', roughness: 0.85 }),
  window: new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#f2b544', emissiveIntensity: 0.55, roughness: 0.35 }),
  brick: new THREE.MeshStandardMaterial({ color: '#8a4430', roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: '#b3ab9c', roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.8 }),
  outline: new THREE.MeshBasicMaterial({ color: '#1e140b', side: THREE.BackSide }),
  contact: new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.55 }),
};

export function roofGeo(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

const GEO = {
  post: new THREE.BoxGeometry(0.016, 1, 0.016),
  beam: new THREE.BoxGeometry(1, 0.013, 0.008),
  chimney: new THREE.BoxGeometry(0.034, 0.1, 0.034),
  chimneyCap: new THREE.BoxGeometry(0.044, 0.012, 0.044),
  door: new THREE.BoxGeometry(0.046, 0.078, 0.008),
  window: new THREE.BoxGeometry(0.034, 0.034, 0.008),
  windowFrame: new THREE.BoxGeometry(0.046, 0.046, 0.005),
  merlon: new THREE.BoxGeometry(0.036, 0.036, 0.036),
  spire: new THREE.ConeGeometry(0.105, 0.16, 4),
  pole: new THREE.CylinderGeometry(0.005, 0.005, 0.18),
  flag: new THREE.PlaneGeometry(0.09, 0.056, 6, 1),
  road: new RoundedBoxGeometry(0.56, 0.066, 0.118, 3, 0.024),
  contact: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
GEO.flag.translate(0.045, 0, 0);

function shadowAll(g) {
  g.traverse((o) => {
    if (o.isMesh && !o.userData.outline && !o.userData.contact) { o.castShadow = true; o.receiveShadow = true; }
  });
  return g;
}

// Dunkle Kontur als „invertierte Hülle“: leicht vergrößerte Rückseiten hinter dem Objekt
function outline(mesh, t = 0.007) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  const o = new THREE.Mesh(geo, SHARED.outline);
  const sx = mesh.scale.x || 1;
  const sy = mesh.scale.y || 1;
  const sz = mesh.scale.z || 1;
  o.scale.set((size.x * sx + 2 * t) / (size.x * sx), (size.y * sy + 2 * t) / (size.y * sy), (size.z * sz + 2 * t) / (size.z * sz));
  o.position.set(c.x * (1 - o.scale.x), c.y * (1 - o.scale.y), c.z * (1 - o.scale.z));
  o.userData.outline = true;
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

function contactShadow(g, r) {
  const m = new THREE.Mesh(GEO.contact, SHARED.contact);
  m.scale.set(r * 2, 1, r * 2);
  m.position.y = 0.002;
  m.renderOrder = 1;
  m.userData.contact = true;
  m.raycast = () => {};
  g.add(m);
}

// Verschmilzt alle Teile einer Figur nach Material: einfache Standard-Materialien werden zu einem Mesh mit
// Vertex-Farben zusammengefasst (je Textur eins), besondere Materialien (Glas, Konturen …) je Material.
// Aus ~40 Draw-Calls pro Haus oder Steg werden so eine Handvoll.
const bakedMats = new Map();
function bakedMaterial(key, map) {
  if (!bakedMats.has(key)) bakedMats.set(key, new THREE.MeshStandardMaterial({ vertexColors: true, map: map || null, roughness: 0.78 }));
  return bakedMats.get(key);
}
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh || o === root) return;
    if (o.userData.flag || o.userData.contact) { keep.push(o); return; }
    const m = o.material;
    const plain = m.isMeshStandardMaterial && !m.transparent && m.side === THREE.FrontSide && m.emissiveIntensity * (m.emissive.r + m.emissive.g + m.emissive.b) === 0;
    const key = plain ? `v:${m.map ? m.map.uuid : '-'}` : `m:${m.uuid}`;
    if (!buckets.has(key)) buckets.set(key, { plain, mat: m, parts: [], outline: !!o.userData.outline });
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (plain) {
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([m.color.r, m.color.g, m.color.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    g.clearGroups();
    buckets.get(key).parts.push(g);
  });
  const out = new THREE.Group();
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  for (const [key, b] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(b.parts), b.plain ? bakedMaterial(key, b.mat.map) : b.mat);
    if (b.outline) {
      mesh.userData.outline = true;
      mesh.raycast = () => {};
    } else {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    out.add(mesh);
  }
  for (const o of keep) {
    const c = o.clone();
    c.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.parent.matrixWorld));
    out.add(c);
  }
  return out;
}

// Gebackene Vorlagen je Figur und Farbe; jede Figur auf dem Brett ist ein leichter Klon davon
const templates = new Map();
function fromTemplate(key, build) {
  if (!templates.has(key)) templates.set(key, bake(build()));
  return templates.get(key).clone();
}

function box(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// Satteldach aus zwei Ziegelflächen mit Überstand und First; Giebel in Wandfarbe
function gableRoof(g, m, { x = 0, y, lenX, spanZ, h, over = 0.024, thick = 0.018 }) {
  const half = spanZ / 2 + over;
  const ang = Math.atan2(h, half);
  const slant = Math.hypot(half, h) + 0.006;
  const panel = new THREE.BoxGeometry(lenX + over * 2, thick, slant);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(panel, m.roof);
    p.rotation.x = side * ang;
    p.position.set(x, y + h / 2 + thick * 0.4, (side * half) / 2);
    outline(p, 0.004);
    g.add(p);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(lenX + over * 2 + 0.01, 0.018, 0.022), m.roofDark);
  ridge.position.set(x, y + h + thick * 0.5, 0);
  g.add(ridge);
  const gable = new THREE.Mesh(roofGeo(spanZ, h * (spanZ / 2 / half) * 0.98, lenX - 0.004), m.wall);
  gable.rotation.y = Math.PI / 2;
  gable.position.set(x, y, 0);
  g.add(gable);
}

// Fachwerkhaus: Putzwände, dunkle Balken, Ziegeldach in Spielerfarbe
function framedHouse(g, m, { x = 0, z = 0, w, d, wallH, y0 }) {
  const walls = box(new THREE.BoxGeometry(w, wallH, d), m.wall, x, y0 + wallH / 2, z);
  outline(walls, 0.0045);
  g.add(walls);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(GEO.post, SHARED.timber, x + sx * (w / 2 - 0.004), y0 + wallH / 2, z + sz * (d / 2 - 0.004), 1, wallH, 1));
  }
  for (const sz of [-1, 1]) {
    g.add(box(GEO.beam, SHARED.timber, x, y0 + wallH * 0.55, z + sz * (d / 2 + 0.002), w, 1, 1));
    g.add(box(GEO.beam, SHARED.timber, x, y0 + wallH - 0.006, z + sz * (d / 2 + 0.002), w, 1, 1));
  }
  for (const sx of [-1, 1]) {
    const side = box(GEO.beam, SHARED.timber, x + sx * (w / 2 + 0.002), y0 + wallH * 0.55, z, d, 1, 1);
    side.rotation.y = Math.PI / 2;
    g.add(side);
  }
  return walls;
}

function windowAt(g, x, y, z, rotY = 0) {
  const frame = box(GEO.windowFrame, SHARED.timber, x, y, z);
  frame.rotation.y = rotY;
  const glass = box(GEO.window, SHARED.window, x, y, z);
  glass.rotation.y = rotY;
  g.add(frame, glass);
}

// Häuser und Städte stehen deutlich größer auf dem Brett (wie im Vorbild); innere Gruppe trägt die Skalierung
export const PIECE_SCALE = 1.45;
function scaled(inner) {
  inner.scale.setScalar(PIECE_SCALE);
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

export function makeSettlement(color) {
  return scaled(fromTemplate(`settlement:${color}`, () => buildSettlement(color)));
}

function buildSettlement(color) {
  const m = pieceMats(color);
  const g = new THREE.Group();
  contactShadow(g, 0.2);
  const y0 = 0.02;
  const w = 0.2;
  const d = 0.17;
  const plinth = box(new THREE.BoxGeometry(w + 0.022, y0, d + 0.022), SHARED.stone, 0, y0 / 2, 0);
  outline(plinth, 0.004);
  g.add(plinth);
  const wallH = 0.13;
  framedHouse(g, m, { w, d, wallH, y0 });
  gableRoof(g, m, { y: y0 + wallH, lenX: w, spanZ: d, h: 0.12 });
  const chimney = box(GEO.chimney, SHARED.brick, 0.055, y0 + wallH + 0.1, -0.035);
  const cap = box(GEO.chimneyCap, SHARED.dark, 0.055, y0 + wallH + 0.152, -0.035);
  g.add(chimney, cap);
  g.add(box(GEO.door, SHARED.dark, -0.04, y0 + 0.039, d / 2 + 0.004));
  windowAt(g, 0.045, y0 + 0.078, d / 2 + 0.004);
  windowAt(g, 0, y0 + 0.07, -d / 2 - 0.004);
  windowAt(g, w / 2 + 0.004, y0 + 0.07, 0, Math.PI / 2);
  windowAt(g, -w / 2 - 0.004, y0 + 0.07, 0, Math.PI / 2);
  return shadowAll(g);
}

export function makeCity(color) {
  return scaled(fromTemplate(`city:${color}`, () => buildCity(color)));
}

function buildCity(color) {
  const m = pieceMats(color);
  const g = new THREE.Group();
  contactShadow(g, 0.3);
  const y0 = 0.022;
  const plinth = box(new THREE.BoxGeometry(0.42, y0, 0.24), SHARED.stone, -0.012, y0 / 2, 0);
  outline(plinth, 0.004);
  g.add(plinth);
  // Haupthaus, zweistöckig
  const hx = 0.05;
  const w = 0.25;
  const d = 0.19;
  const wallH = 0.17;
  framedHouse(g, m, { x: hx, w, d, wallH, y0 });
  gableRoof(g, m, { x: hx, y: y0 + wallH, lenX: w, spanZ: d, h: 0.13 });
  g.add(box(GEO.door, SHARED.dark, hx + 0.06, y0 + 0.039, d / 2 + 0.004));
  for (const wx of [-0.02, 0.1]) windowAt(g, hx + wx, y0 + 0.125, d / 2 + 0.004);
  windowAt(g, hx - 0.02, y0 + 0.055, d / 2 + 0.004);
  windowAt(g, hx + w / 2 + 0.004, y0 + 0.1, 0, Math.PI / 2);
  // Turm aus Stein mit Zinnen und Spitzdach
  const tx = -0.11;
  const tw = 0.13;
  const th = 0.34;
  const tower = box(new THREE.BoxGeometry(tw, th, tw), SHARED.stone, tx, y0 + th / 2, -0.01);
  outline(tower, 0.0045);
  g.add(tower);
  const band = box(new THREE.BoxGeometry(tw + 0.012, 0.016, tw + 0.012), m.trim, tx, y0 + th - 0.01, -0.01);
  g.add(band);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    g.add(box(GEO.merlon, SHARED.stone, tx + sx * 0.048, y0 + th + 0.016, -0.01 + sz * 0.048));
  }
  const spire = new THREE.Mesh(GEO.spire, m.roof);
  spire.position.set(tx, y0 + th + 0.1, -0.01);
  spire.rotation.y = Math.PI / 4;
  outline(spire, 0.004);
  const pole = new THREE.Mesh(GEO.pole, SHARED.pole);
  pole.position.set(tx, y0 + th + 0.24, -0.01);
  const flag = new THREE.Mesh(GEO.flag.clone(), m.flag);
  flag.position.set(tx, y0 + th + 0.3, -0.01);
  flag.userData.flag = true;
  g.add(spire, pole, flag);
  g.add(box(new THREE.BoxGeometry(0.05, 0.085, 0.008), SHARED.dark, tx, y0 + 0.042, -0.01 + tw / 2 + 0.004));
  windowAt(g, tx, y0 + 0.2, -0.01 + tw / 2 + 0.004);
  windowAt(g, tx - tw / 2 - 0.004, y0 + 0.24, -0.01, Math.PI / 2);
  return shadowAll(g);
}

export function makeRoad(color, a, b) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(GEO.road, pieceMats(color).road);
  m.position.y = 0.035;
  outline(m, 0.007);
  g.add(m);
  const shadow = new THREE.Mesh(GEO.contact, SHARED.contact);
  shadow.scale.set(0.7, 1, 0.26);
  shadow.position.y = 0.002;
  shadow.userData.contact = true;
  shadow.raycast = () => {};
  g.add(shadow);
  g.position.set((a.x + b.x) / 2, SURF, (a.y + b.y) / 2);
  g.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  m.castShadow = true;
  m.receiveShadow = true;
  return g;
}

// ---------- Zahlenchips ----------

const TOKEN_R = 0.3;
const TOKEN_H = 0.05;
const tokenBody = (() => {
  const r = TOKEN_R;
  const h = TOKEN_H;
  const pts = [[0, 0], [r - 0.012, 0], [r - 0.002, 0.006], [r, 0.016], [r, h - 0.014], [r - 0.004, h - 0.005], [r - 0.014, h], [0, h]];
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 64);
})();
const tokenFace = new THREE.CircleGeometry(TOKEN_R - 0.013, 64).rotateX(-Math.PI / 2);
const tokenBodyMat = new THREE.MeshStandardMaterial({ color: '#d8c197', roughness: 0.55 });

export function makeToken(faceTex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tokenBody, tokenBodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  const face = new THREE.Mesh(tokenFace, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.62 }));
  face.position.y = TOKEN_H + 0.0006;
  face.receiveShadow = true;
  const shadow = new THREE.Mesh(GEO.contact, SHARED.contact);
  shadow.scale.set(TOKEN_R * 2.7, 1, TOKEN_R * 2.7);
  shadow.position.y = 0.002;
  shadow.userData.contact = true;
  g.add(shadow, body, face);
  g.userData.face = face;
  return g;
}

// ---------- Räuber ----------

export function makeRobber() {
  const g = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({ color: '#2c2b31', roughness: 0.85 });
  const hoodMat = new THREE.MeshStandardMaterial({ color: '#222127', roughness: 0.9 });
  const prof = [[0, 0], [0.15, 0], [0.155, 0.02], [0.125, 0.09], [0.1, 0.2], [0.085, 0.29], [0.095, 0.33], [0.06, 0.36], [0, 0.37]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cloak = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), cloakMat);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), hoodMat);
  hood.scale.set(1, 1.2, 1.05);
  hood.position.y = 0.41;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 12), hoodMat);
  tip.position.set(0, 0.47, -0.035);
  tip.rotation.x = -0.6;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), new THREE.MeshBasicMaterial({ color: '#07070a' }));
  face.position.set(0, 0.4, 0.035);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffc861' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), eyeMat);
  e1.position.set(-0.018, 0.405, 0.083);
  const e2 = e1.clone();
  e2.position.x = 0.018;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 24), new THREE.MeshStandardMaterial({ color: '#5a3a22' }));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.2;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.01), new THREE.MeshStandardMaterial({ color: '#c9a15b', metalness: 0.7, roughness: 0.3 }));
  buckle.position.set(0, 0.2, 0.1);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.55), SHARED.pole);
  staff.position.set(0.13, 0.27, 0.02);
  staff.rotation.z = -0.08;
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.035), new THREE.MeshStandardMaterial({ color: '#ffcf70', emissive: '#ff9d2e', emissiveIntensity: 1.6 }));
  lantern.position.set(-0.12, 0.17, 0.05);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,190,90,0.9)', 'rgba(255,150,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(0.22);
  glow.position.copy(lantern.position);
  g.add(cloak, hood, tip, face, e1, e2, belt, buckle, staff, lantern, glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { eyeMat, glow };
  return g;
}

// ---------- Hologramme (Bauvorschau) ----------

const holoVertex = `
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const holoFragment = `
  uniform vec3 uColor; uniform float uTime; uniform float uHover; uniform float uBase;
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.0 - abs(dot(normalize(vN), v)), 1.6);
    float scan = 0.5 + 0.5 * sin((vW.y - uBase) * 140.0 - uTime * 5.0);
    float sweep = smoothstep(0.0, 0.03, fract(uTime * 0.45) - (vW.y - uBase) * 2.2) * (1.0 - smoothstep(0.03, 0.09, fract(uTime * 0.45) - (vW.y - uBase) * 2.2));
    float a = 0.42 + fres * 0.55 + scan * 0.14 + sweep * 0.45;
    a *= mix(0.8, 1.25, uHover) * (0.86 + 0.14 * sin(uTime * 3.0));
    vec3 col = mix(uColor, vec3(1.0), 0.22 + fres * 0.45 + sweep * 0.4);
    gl_FragColor = vec4(col * mix(1.0, 1.25, uHover), clamp(a, 0.0, 0.95));
  }`;

export function holoMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHover: { value: 0 }, uBase: { value: SURF } },
    vertexShader: holoVertex,
    fragmentShader: holoFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const holoGlowTex = glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');

// Liefert eine Gruppe mit Hologramm-Figur, Bodenleuchten und Trefferfläche.
export function makeHologram(piece, color, board, id) {
  const g = new THREE.Group();
  const mat = holoMaterial(color);
  let model;
  let hit;
  if (piece === 'road') {
    const [a, b] = board.edges[id].v.map((v) => board.vertices[v]);
    model = new THREE.Mesh(GEO.road, mat);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    g.position.set(mid.x, SURF, mid.y);
    g.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
    model.position.y = 0.035;
    hit = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.26), new THREE.MeshBasicMaterial({ visible: false }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.46), new THREE.MeshBasicMaterial({ map: holoGlowTex, color: new THREE.Color(color).lerp(new THREE.Color('#fff4d0'), 0.35), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    model.scale.set(1, 1.5, 1.25);
    // Leuchtender Kern, damit die Straße auch aus der Übersicht auffällt
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.position.y = 0.075;
    g.add(core);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    g.add(glow);
  } else {
    const v = board.vertices[id];
    model = piece === 'city' ? makeCity(color) : makeSettlement(color);
    const extras = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.outline || o.userData.contact) extras.push(o);
      else { o.material = mat; o.castShadow = false; o.receiveShadow = false; }
    });
    for (const o of extras) o.parent.remove(o);
    g.position.set(v.x, SURF, v.y);
    model.rotation.y = Math.atan2(v.x, v.y) + Math.PI / 2;
    // Die Stadt schwebt über der bestehenden Siedlung, verbunden durch einen Lichtstrahl
    model.position.y = piece === 'city' ? 0.42 : 0.015;
    if (piece === 'city') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.2, 0.46, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.y = 0.2;
      g.add(beam);
    }
    hit = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, piece === 'city' ? 1.1 : 0.6, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = piece === 'city' ? 0.5 : 0.26;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ map: holoGlowTex, color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    g.add(glow);
  }
  // Aufsteigende Funken als Holo-Effekt
  const sparks = [];
  for (let i = 0; i < (piece === 'road' ? 5 : 6); i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: holoGlowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(0.035);
    sp.userData = {
      x: piece === 'road' ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * (piece === 'road' ? 0.08 : 0.3),
      phase: Math.random(),
      speed: 0.25 + Math.random() * 0.2,
      height: piece === 'city' ? 0.95 : 0.5,
    };
    g.add(sp);
    sparks.push(sp);
  }
  g.add(model, hit);
  hit.userData = { kind: piece === 'road' ? 'edge' : 'vertex', id, piece };
  g.userData = { kind: hit.userData.kind, id, piece, mat, model, sparks, base: model.position.y, phase: Math.random() * 6 };
  return g;
}

// ---------- Geländedeko ----------

function jitterGeo(geo, amount, seed) {
  const rnd = mulberry(seed);
  const pos = geo.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [(rnd() - 0.5) * amount, (rnd() - 0.5) * amount, (rnd() - 0.5) * amount]);
    const [dx, dy, dz] = map.get(key);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Teile mit Vertex-Farben zu einer Geometrie verschmelzen (ein InstancedMesh pro Baum-/Schafart)
function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const at = (geo, x, y, z) => geo.translate(x, y, z);

function pineGeo(seed, dark) {
  const tiers = [[0.115, 0.17, 0.1], [0.092, 0.15, 0.19], [0.068, 0.13, 0.27], [0.042, 0.1, 0.34]];
  const parts = [tint(at(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 6), 0, 0.06, 0), '#5a3a20')];
  tiers.forEach(([r, h, y], i) => {
    const cone = jitterGeo(new THREE.ConeGeometry(r, h, 10, 2), 0.012, seed + i);
    parts.push(tint(at(cone, 0, y, 0), new THREE.Color(dark).lerp(new THREE.Color('#6f9f45'), i * 0.12)));
  });
  return mergeGeometries(parts);
}

function broadleafGeo(seed) {
  const parts = [tint(at(new THREE.CylinderGeometry(0.014, 0.022, 0.14, 6), 0, 0.07, 0), '#5d3d22')];
  const rnd = mulberry(seed);
  const blobs = [[0, 0.2, 0, 0.1], [0.055, 0.17, 0.02, 0.075], [-0.05, 0.175, -0.02, 0.078], [0.01, 0.25, -0.03, 0.07], [-0.01, 0.18, 0.055, 0.07]];
  blobs.forEach(([x, y, z, r], i) => {
    const b = jitterGeo(new THREE.IcosahedronGeometry(r, 1), r * 0.3, seed * 7 + i);
    parts.push(tint(at(b, x, y, z), new THREE.Color('#3f7431').lerp(new THREE.Color('#79a94a'), rnd() * 0.5)));
  });
  return mergeGeometries(parts);
}

function sheepGeo() {
  const parts = [];
  const body = jitterGeo(new THREE.IcosahedronGeometry(0.07, 2), 0.02, 9);
  body.scale(1.35, 0.92, 1);
  parts.push(tint(at(body, 0, 0.082, 0), '#f7f4ec'));
  const head = new THREE.SphereGeometry(0.03, 10, 8).scale(1.25, 1, 0.95);
  parts.push(tint(at(head, 0.105, 0.1, 0), '#2e2723'));
  for (const s of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.012, 6, 4).scale(1.6, 0.5, 0.8);
    parts.push(tint(at(ear, 0.1, 0.118, s * 0.03), '#2e2723'));
  }
  for (const [lx, lz] of [[0.045, 0.032], [0.045, -0.032], [-0.045, 0.032], [-0.045, -0.032]]) {
    parts.push(tint(at(new THREE.CylinderGeometry(0.009, 0.008, 0.05, 5), lx, 0.025, lz), '#2e2723'));
  }
  return mergeGeometries(parts);
}

function strawGeo() {
  // Heuballen (liegende Rolle) mit dunklerer Stirnseite
  const roll = new THREE.CylinderGeometry(0.055, 0.055, 0.1, 18).rotateZ(Math.PI / 2);
  return mergeGeometries([tint(at(roll, 0, 0.055, 0), '#d9ae52')]);
}

function stookGeo() {
  // Garbenhocke: zusammengestellte Getreidegarben
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sheaf = new THREE.CylinderGeometry(0.012, 0.024, 0.11, 6);
    sheaf.rotateZ(0.28);
    sheaf.rotateY(a);
    parts.push(tint(at(sheaf, Math.cos(a) * 0.02, 0.05, -Math.sin(a) * 0.02), i % 2 ? '#e2bb5c' : '#caa045'));
  }
  parts.push(tint(at(new THREE.ConeGeometry(0.03, 0.05, 7), 0, 0.12, 0), '#b98f36'));
  return mergeGeometries(parts);
}

// Gebackene Umgebungsverdeckung: zum Boden hin dunkler (Bäume, Schafe, Heu stehen satt im Gelände)
function bakeGroundShade(geo, height = 0.12) {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / height));
    const f = 0.55 + 0.45 * t * t * (3 - 2 * t);
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  return geo;
}

const DECOR_DEFS = {
  pineA: [() => pineGeo(3, '#244a22'), '#ffffff', 'light', false, false, true],
  pineB: [() => pineGeo(17, '#2f5a2b'), '#ffffff', 'light', false, false, true],
  broadleaf: [() => broadleafGeo(5), '#ffffff', 'light', false, false, true],
  shrub: [() => jitterGeo(new THREE.IcosahedronGeometry(0.05, 1), 0.02, 21).scale(1.2, 0.7, 1.2), '#4a7a33', true],
  sheep: [() => sheepGeo(), '#ffffff', 'light', false, false, true],
  bale: [() => strawGeo(), '#ffffff', 'light', false, false, true],
  stook: [() => stookGeo(), '#ffffff', 'light', false, false, true],
  brick: [() => new THREE.BoxGeometry(0.075, 0.034, 0.045), '#a94a2c', true],
  clod: [() => jitterGeo(new THREE.SphereGeometry(0.07, 8, 6), 0.02, 4), '#a0492f', true, true],
  kiln: [() => new THREE.CylinderGeometry(0.045, 0.065, 0.1, 12), '#7a3422'],
  kilnGlow: [() => new THREE.CircleGeometry(0.035, 12).rotateX(-Math.PI / 2), '#ffae4a', false, false, true],
  outcrop: [() => jitterGeo(new THREE.IcosahedronGeometry(0.16, 1), 0.07, 11).scale(1.15, 0.85, 1), '#9d9f9b', true, true],
  rock: [() => jitterGeo(new THREE.DodecahedronGeometry(0.07), 0.025, 13), '#8a8c8c', true, true],
  bush: [() => jitterGeo(new THREE.IcosahedronGeometry(0.04, 0), 0.02, 14), '#8a7a4a', true, true],
  cactus: [() => new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), '#5f8a3e'],
  shore: [() => jitterGeo(new THREE.DodecahedronGeometry(0.1, 1), 0.04, 15), '#4f4a44', true, true],
};

// Streut Deko auf alle Felder und baut daraus InstancedMeshes.
export function buildDecor(board, density = 1) {
  const lists = Object.fromEntries(Object.keys(DECOR_DEFS).map((k) => [k, []]));
  const m4 = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz),
  );
  for (const h of board.hexes) {
    const rnd = mulberry(h.id * 7919 + 11);
    const corners = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return [Math.cos(a), Math.sin(a)];
    });
    const inside = (x, z, lim = 0.72) => {
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        if (Math.abs(x * Math.cos(a) + z * Math.sin(a)) > lim) return false;
      }
      return corners.every(([cx, cz]) => Math.hypot(x - cx, z - cz) > 0.36);
    };
    const taken = [];
    const sample = (minR = 0.36, lim = 0.72, gap = 0) => {
      for (let k = 0; k < 40; k++) {
        const x = (rnd() * 2 - 1) * 0.85;
        const z = (rnd() * 2 - 1) * 0.85;
        if (Math.hypot(x, z) < minR || !inside(x, z, lim)) continue;
        if (gap && taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < gap)) continue;
        taken.push([x, z]);
        return [h.x + x, h.y + z, x, z];
      }
      return null;
    };
    const n = (k) => Math.round(k * density);
    switch (h.terrain) {
      case 'forest':
        for (let i = 0; i < n(30); i++) {
          const p = sample(0.4, 0.76, 0.1);
          if (!p) continue;
          // Bäume vor dem Chip (zur Kamera hin) bleiben kleiner, damit die Zahl sichtbar bleibt
          const front = p[3] > 0 && Math.abs(p[2]) < 0.45 ? 0.75 : 1;
          const s = (0.72 + rnd() * 0.45) * front;
          const r = rnd() * 6;
          const kind = rnd();
          if (kind < 0.42) lists.pineA.push(m4(p[0], SURF, p[1], s, s * (0.9 + rnd() * 0.25), s, r));
          else if (kind < 0.78) lists.pineB.push(m4(p[0], SURF, p[1], s, s * (0.9 + rnd() * 0.25), s, r));
          else lists.broadleaf.push(m4(p[0], SURF, p[1], s, s, s, r));
        }
        for (let i = 0; i < n(10); i++) {
          const p = sample(0.36, 0.76, 0.05);
          if (p) lists.shrub.push(m4(p[0], SURF + 0.01, p[1], 1, 1, 1, rnd() * 6));
        }
        break;
      case 'pasture':
        for (let i = 0; i < n(7); i++) {
          const p = sample(0.38, 0.7, 0.16);
          if (!p) continue;
          const s = 0.95 + rnd() * 0.15;
          lists.sheep.push(m4(p[0], SURF, p[1], s, s, s, rnd() * Math.PI * 2));
        }
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.4, 0.72);
          if (p) lists.shrub.push(m4(p[0], SURF + 0.01, p[1], 0.9, 0.9, 0.9, rnd() * 6));
        }
        break;
      case 'fields': {
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.42, 0.68, 0.18);
          if (p) lists.stook.push(m4(p[0], SURF, p[1], 0.8, 0.8, 0.8, rnd() * 6));
        }
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.42, 0.68, 0.16);
          if (p) lists.bale.push(m4(p[0], SURF, p[1], 1, 1, 1, rnd() * 6));
        }
        break;
      }
      case 'hills': {
        for (let pile = 0; pile < n(3); pile++) {
          const p = sample(0.42, 0.66, 0.22);
          if (!p) continue;
          const r = rnd() * 3;
          const c = Math.cos(r);
          const s = Math.sin(r);
          const layout = [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-0.5, 1, 0], [0.5, 1, 0], [0, 2, 0]];
          for (const [ox, oy] of layout) {
            lists.brick.push(m4(p[0] + c * ox * 0.08, SURF + 0.017 + oy * 0.036, p[1] - s * ox * 0.08, 1, 1, 1, r));
          }
        }
        const k = sample(0.44, 0.62, 0.2);
        if (k) {
          lists.kiln.push(m4(k[0], SURF + 0.05, k[1], 1, 1, 1));
          lists.kilnGlow.push(m4(k[0], SURF + 0.101, k[1], 1, 1, 1));
        }
        for (let i = 0; i < n(6); i++) {
          const p = sample(0.36, 0.72, 0.08);
          if (p) lists.clod.push(m4(p[0], SURF, p[1], 0.8 + rnd() * 0.6, 0.35 + rnd() * 0.3, 0.8 + rnd() * 0.6, rnd() * 3));
        }
        break;
      }
      case 'mountains': {
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.44, 0.64, 0.3);
          if (!p) continue;
          const front = p[3] > 0 && Math.abs(p[2]) < 0.45 ? 0.7 : 1;
          const s = (0.75 + rnd() * 0.4) * front;
          lists.outcrop.push(m4(p[0], SURF + 0.06 * s, p[1], s, s * (0.9 + rnd() * 0.5), s, rnd() * 6));
        }
        for (let i = 0; i < n(12); i++) {
          const p = sample(0.36, 0.74, 0.07);
          if (!p) continue;
          const s = 0.4 + rnd() * 0.65;
          lists.rock.push(m4(p[0], SURF + 0.02, p[1], s, s * 0.75, s, rnd() * 6, rnd()));
        }
        break;
      }
      case 'desert':
        for (let i = 0; i < n(2); i++) {
          const p = sample(0.42, 0.66, 0.2);
          if (p) lists.cactus.push(m4(p[0], SURF + 0.08, p[1], 1, 1, 1, 0, (rnd() - 0.5) * 0.2));
        }
        for (let i = 0; i < n(5); i++) {
          const p = sample(0.38, 0.72);
          if (p) lists.bush.push(m4(p[0], SURF + 0.015, p[1], 1, 0.7, 1, rnd() * 6));
        }
        for (let i = 0; i < n(4); i++) {
          const p = sample(0.38, 0.72);
          if (p) lists.rock.push(m4(p[0], SURF + 0.015, p[1], 0.5, 0.4, 0.5, rnd() * 6));
        }
        break;
      default:
    }
  }
  // Felsen an der Wasserlinie rund um die Insel
  const rnd = mulberry(4242);
  for (const e of board.edges) {
    if (e.hexes.length !== 1) continue;
    const h = board.hexes[e.hexes[0]];
    const nx = e.x - h.x;
    const ny = e.y - h.y;
    const len = Math.hypot(nx, ny);
    for (let i = 0; i < 4; i++) {
      if (rnd() < 0.3) continue;
      const t = (rnd() - 0.5) * 0.95;
      const out = 0.06 + rnd() * 0.2;
      const x = e.x + (nx / len) * out + (-ny / len) * t;
      const z = e.y + (ny / len) * out + (nx / len) * t;
      const s = 0.45 + rnd() * 0.9;
      lists.shore.push(m4(x, WATER_Y + 0.02, z, s, s * 0.7, s, rnd() * 6, rnd()));
    }
  }

  const meshes = [];
  const c = new THREE.Color();
  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const [makeGeo, color, vary, flat, glow, vcol] = DECOR_DEFS[k];
    // Bei Farbvariation trägt jede Instanz ihre Farbe selbst (instanceColor wird mit material.color multipliziert)
    const base = vary ? '#ffffff' : color;
    const mat = glow && !vcol
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color: base, roughness: 0.88, flatShading: !!flat, vertexColors: !!vcol });
    const geo = makeGeo();
    if (vcol) bakeGroundShade(geo);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const rv = mulberry(k.length * 31);
    list.forEach((mat4, i) => {
      mesh.setMatrixAt(i, mat4);
      if (vary === 'light') {
        c.setScalar(0.82 + rv() * 0.3);
        mesh.setColorAt(i, c);
      } else if (vary) {
        c.set(color).offsetHSL((rv() - 0.5) * 0.04, (rv() - 0.5) * 0.1, (rv() - 0.5) * 0.12);
        mesh.setColorAt(i, c);
      }
    });
    mesh.castShadow = !['kilnGlow', 'clod'].includes(k);
    mesh.receiveShadow = true;
    mesh.userData.decor = k;
    meshes.push(mesh);
  }
  return meshes;
}

// ---------- Rahmen der Felder ----------

export function hexRimGeometry() {
  const shape = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const [ox, oy] = [Math.cos(a) * 0.99, Math.sin(a) * 0.99];
    const [ix, iy] = [Math.cos(a) * 0.935, Math.sin(a) * 0.935];
    if (i === 0) { shape.moveTo(ox, oy); hole.moveTo(ix, iy); } else { shape.lineTo(ox, oy); hole.lineTo(ix, iy); }
  }
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ---------- Häfen ----------

const dockWood = woodTexture('#8a6038');
const deckGrain = grainTexture('#b89066', 33);
const DOCK = {
  plank: new THREE.MeshStandardMaterial({ map: deckGrain, color: '#e0c49c', roughness: 0.82 }),
  beam: new THREE.MeshStandardMaterial({ map: dockWood, color: '#8c6a4a', roughness: 0.9 }),
  post: new THREE.MeshStandardMaterial({ map: dockWood, color: '#6b4a30', roughness: 0.9 }),
  rope: new THREE.MeshStandardMaterial({ color: '#cdb58a', roughness: 0.95 }),
  iron: new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.5, metalness: 0.6 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffb347', emissiveIntensity: 1.2 }),
  labelBack: new THREE.MeshBasicMaterial({ color: '#3a2412' }),
};
const LABEL_FACE = new THREE.CircleGeometry(0.27, 64);
const LABEL_BACK = new THREE.CircleGeometry(0.283, 64);

// Ladung auf dem Steg zeigt, womit hier gehandelt wird
function cargo(type) {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, ry = 0, extra = {}) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (type) {
    case 'wood': {
      const log = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8).rotateZ(Math.PI / 2);
      for (const [x, y, z] of [[0, 0.018, -0.04], [0, 0.018, 0], [0, 0.018, 0.04], [0, 0.05, -0.02], [0, 0.05, 0.02], [0, 0.082, 0]]) add(log, '#7a4f2a', x, y, z, 0);
      break;
    }
    case 'brick': {
      const brick = new THREE.BoxGeometry(0.06, 0.028, 0.034);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(brick, '#b0482c', (j - 0.5) * 0.064, 0.014 + i * 0.03, 0, (i % 2) * 0.1);
      break;
    }
    case 'sheep': {
      const bale = new THREE.SphereGeometry(0.04, 12, 8).scale(1.2, 0.9, 1);
      for (const [x, z] of [[-0.04, 0], [0.04, 0.01], [0, 0.05]]) add(bale, '#f4efe2', x, 0.035, z);
      break;
    }
    case 'wheat': {
      const sack = new THREE.CapsuleGeometry(0.03, 0.04, 4, 10);
      for (const [x, z, r] of [[-0.04, 0, 0.2], [0.035, 0.01, -0.3], [0, 0.05, 0.1]]) add(sack, '#d8c08a', x, 0.05, z, r);
      break;
    }
    case 'ore': {
      add(new THREE.BoxGeometry(0.1, 0.05, 0.08), '#6b4a30', 0, 0.025, 0, 0, { map: dockWood });
      const lump = new THREE.DodecahedronGeometry(0.024);
      for (const [x, z] of [[-0.025, -0.015], [0.02, 0.01], [0, -0.02], [-0.01, 0.02]]) add(lump, '#7d8288', x, 0.058, z, x * 40, { metalness: 0.3, roughness: 0.6 });
      break;
    }
    default: {
      const barrel = new THREE.CylinderGeometry(0.03, 0.03, 0.07, 12);
      add(barrel, '#7a5030', -0.035, 0.035, 0);
      add(barrel, '#6d4428', 0.03, 0.035, 0.03);
      add(new THREE.BoxGeometry(0.055, 0.055, 0.055), '#b08a60', 0.02, 0.028, -0.045, 0.4, { map: dockWood });
    }
  }
  return g;
}

export function makeDock(hb, board, labelTex) {
  const g = new THREE.Group();
  const edge = board.edges[hb.edge];
  const ang = Math.atan2(hb.ny, hb.nx);
  const tx = -hb.ny;
  const tz = hb.nx;
  const deckY = WATER_Y + 0.13;
  const rnd = mulberry(hb.id * 97 + 5);
  const along = (d, t = 0) => [hb.x + hb.nx * d + tx * t, hb.y + hb.ny * d + tz * t];
  // Einzelne Planken quer zur Stegrichtung, mit Fugen und leicht unterschiedlichen Längen
  const pw = 0.058;
  for (let i = 0; i < 9; i++) {
    const d = 0.12 + i * (pw + 0.008);
    const len = 0.4 + (rnd() - 0.5) * 0.04;
    const p = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.018, len), DOCK.plank);
    const [x, z] = along(d, (rnd() - 0.5) * 0.015);
    p.position.set(x, deckY + (rnd() - 0.5) * 0.004, z);
    p.rotation.y = -ang + (rnd() - 0.5) * 0.03;
    p.material = DOCK.plank.clone();
    p.material.color.offsetHSL(0, 0, (rnd() - 0.5) * 0.12);
    p.castShadow = true;
    p.receiveShadow = true;
    g.add(p);
  }
  const deckEnd = 0.12 + 8 * (pw + 0.008);
  // Längsträger unter den Planken
  for (const t of [-0.15, 0.15]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(deckEnd, 0.03, 0.035), DOCK.beam);
    const [x, z] = along(0.12 + (deckEnd - 0.12) / 2, t);
    beam.position.set(x, deckY - 0.024, z);
    beam.rotation.y = -ang;
    beam.castShadow = true;
    g.add(beam);
  }
  // Pfähle mit Tauwicklung, am Ende mit Poller
  const postGeo = new THREE.CylinderGeometry(0.02, 0.023, 0.4, 8);
  const ringGeo = new THREE.TorusGeometry(0.023, 0.006, 6, 14).rotateX(Math.PI / 2);
  for (const t of [-0.22, 0.22]) for (const d of [0.16, deckEnd - 0.02]) {
    const p = new THREE.Mesh(postGeo, DOCK.post);
    const [x, z] = along(d, t);
    p.position.set(x, WATER_Y + 0.07, z);
    p.castShadow = true;
    const ring = new THREE.Mesh(ringGeo, DOCK.rope);
    ring.position.set(x, deckY + 0.07, z);
    g.add(p, ring);
  }
  // Tau zwischen den äußeren Pfählen als Geländer
  for (const t of [-0.22, 0.22]) {
    const [x1, z1] = along(0.16, t);
    const [x2, z2] = along(deckEnd - 0.02, t);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x1, deckY + 0.07, z1),
      new THREE.Vector3((x1 + x2) / 2, deckY + 0.035, (z1 + z2) / 2),
      new THREE.Vector3(x2, deckY + 0.07, z2),
    );
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.004, 5), DOCK.rope));
  }
  // Rampen von den beiden Hafen-Kreuzungen zum Steg
  const cx = hb.x + hb.nx * 0.2;
  const cz = hb.y + hb.ny * 0.2;
  for (const vid of edge.v) {
    const v = board.vertices[vid];
    const ex = cx + (v.x - hb.x) * 0.3;
    const ez = cz + (v.y - hb.y) * 0.3;
    const len = Math.hypot(v.x - ex, v.y - ez);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.085), DOCK.plank);
    ramp.position.set((v.x + ex) / 2, (SURF - 0.02 + deckY) / 2, (v.y + ez) / 2);
    // Euler XYZ: zuerst Neigung um die lokale z-Achse (+x-Ende nach oben), dann Drehung zur Kreuzung
    ramp.rotation.y = -Math.atan2(v.y - ez, v.x - ex);
    ramp.rotation.z = Math.atan2(SURF - 0.02 - deckY, len);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    g.add(ramp);
  }
  // Ladung
  const load = cargo(hb.type);
  const [lx, lz] = along(0.3, 0.1 * (rnd() < 0.5 ? -1 : 1));
  load.position.set(lx, deckY + 0.009, lz);
  load.rotation.y = -ang + Math.PI / 2;
  g.add(load);
  // Laterne und Schildpfosten am Stegende
  const [px, pz] = along(deckEnd - 0.04, 0);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.2, 8), DOCK.post);
  signPost.position.set(px, deckY + 0.1, pz);
  signPost.castShadow = true;
  const [lpx, lpz] = along(0.16, -0.22);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.12, 6), DOCK.iron);
  lampPost.position.set(lpx, deckY + 0.13, lpz);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.03, 0.024), DOCK.lamp);
  lamp.position.set(lpx, deckY + 0.2, lpz);
  g.add(signPost, lampPost, lamp);
  const baked = bake(g);
  g.clear();
  g.add(...baked.children);
  // Schild: runde Scheibe mit dunklem Rand, wird jedes Bild zur Kamera gedreht
  const label = new THREE.Group();
  const face = new THREE.Mesh(LABEL_FACE, new THREE.MeshBasicMaterial({ map: labelTex }));
  const back = new THREE.Mesh(LABEL_BACK, DOCK.labelBack);
  back.position.z = -0.004;
  label.add(back, face);
  label.position.set(px, 0.24, pz);
  label.userData.billboard = true;
  label.userData.face = face;
  g.add(label);
  g.userData.label = label;
  return g;
}

// ---------- Boote ----------

export function makeBoat(sailColor = '#f3ead6') {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#6b4527', roughness: 0.8 });
  const shape = new THREE.Shape();
  shape.moveTo(-0.24, 0.02);
  shape.quadraticCurveTo(-0.2, -0.04, 0.06, -0.035);
  shape.quadraticCurveTo(0.22, -0.03, 0.3, 0.07);
  shape.lineTo(-0.26, 0.07);
  shape.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), hullMat);
  hull.geometry.translate(0, 0, -0.065);
  hull.castShadow = true;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.01, 0.12), new THREE.MeshStandardMaterial({ color: '#a47a4c' }));
  deck.position.y = 0.07;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.46), hullMat);
  mast.position.set(0, 0.3, 0);
  const sailGeo = new THREE.PlaneGeometry(0.24, 0.28, 6, 6);
  const pos = sailGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(((pos.getX(i) + 0.12) / 0.24) * Math.PI) * 0.035);
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.9, side: THREE.DoubleSide }));
  sail.position.set(0.02, 0.32, 0);
  sail.rotation.y = Math.PI / 2;
  sail.castShadow = true;
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.025), new THREE.MeshStandardMaterial({ color: '#a3261c', side: THREE.DoubleSide }));
  pennant.position.set(-0.03, 0.54, 0);
  g.add(hull, deck, mast, sail, pennant);
  return g;
}

// ---------- Würfel & Schale ----------

export function makeDiceTray() {
  const tray = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#5a3a22'), color: '#9a7a5a', roughness: 0.7 });
  const felt = new THREE.MeshStandardMaterial({ color: '#b89a7a', roughness: 0.95, map: woodTexture('#6a4a33') });
  const gold = new THREE.MeshStandardMaterial({ color: '#d4ad62', metalness: 0.75, roughness: 0.3 });
  const raft = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 1.12), new THREE.MeshStandardMaterial({ color: '#2d2118', roughness: 0.9 }));
  raft.position.y = -0.06;
  raft.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.94), felt);
  base.receiveShadow = true;
  tray.add(raft, base);
  const walls = [[0, 0.08, 0.47, 1.58, 0.16, 0.06], [0, 0.08, -0.47, 1.58, 0.16, 0.06], [0.76, 0.08, 0, 0.06, 0.16, 1.0], [-0.76, 0.08, 0, 0.06, 0.16, 1.0]];
  for (const [x, y, z, w, h, d] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.018, d + 0.01), gold);
    trim.position.set(x, y + h / 2 + 0.006, z);
    tray.add(m, trim);
  }
  for (const [x, z] of [[-0.76, -0.47], [0.76, -0.47], [-0.76, 0.47], [0.76, 0.47]]) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), gold);
    stud.position.set(x, 0.18, z);
    tray.add(stud);
  }
  return tray;
}

export function makeDie() {
  const mats = [2, 5, 1, 6, 3, 4].map((v) => new THREE.MeshStandardMaterial({ map: diceFaceTexture(v), roughness: 0.3 }));
  const d = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 4, 0.06), mats);
  d.castShadow = true;
  return d;
}

// Welche Drehung bringt die Augenzahl v nach oben (BoxGeometry-Flächen: +x,-x,+y,-y,+z,-z = 2,5,1,6,3,4)
export const FACE_EULER = {
  1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
};

export { SQ3 };
