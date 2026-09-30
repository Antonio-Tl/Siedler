// 3D-Modelle: Spielfiguren, Räuber, Hologramme, Geländedeko, Häfen, Boote und Würfel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry, shade, woodTexture, glowTexture, diceFaceTexture } from './textures.js';

export const TOP = 0;
export const SLAB = 0.07;
export const SURF = TOP + SLAB;
export const WATER_Y = -0.3;

const SQ3 = Math.sqrt(3);

// ---------- Figuren ----------

const matCache = new Map();
function pieceMats(color) {
  if (!matCache.has(color)) {
    const light = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.75;
    matCache.set(color, {
      roof: new THREE.MeshStandardMaterial({ color: light ? '#f3efe6' : color, roughness: 0.55 }),
      roofDark: new THREE.MeshStandardMaterial({ color: shade(color, -0.3), roughness: 0.6 }),
      wall: new THREE.MeshStandardMaterial({ color: light ? '#cfc4ae' : new THREE.Color('#efe4cc').lerp(new THREE.Color(color), 0.12), roughness: 0.8 }),
      base: new THREE.MeshStandardMaterial({ color: shade(color, -0.15), roughness: 0.6 }),
      road: new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
      flag: new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }),
    });
  }
  return matCache.get(color);
}

const SHARED = {
  dark: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 }),
  window: new THREE.MeshStandardMaterial({ color: '#f6d98c', emissive: '#f2b544', emissiveIntensity: 0.35, roughness: 0.4 }),
  brick: new THREE.MeshStandardMaterial({ color: '#7a3a26', roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.8 }),
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
  plate: new THREE.CylinderGeometry(0.135, 0.145, 0.02, 6),
  plateBig: new THREE.CylinderGeometry(0.2, 0.21, 0.02, 6),
  wall: new THREE.BoxGeometry(0.16, 0.12, 0.13),
  roof: roofGeo(0.2, 0.1, 0.18),
  chimney: new THREE.BoxGeometry(0.028, 0.07, 0.028),
  door: new THREE.BoxGeometry(0.035, 0.065, 0.006),
  window: new THREE.BoxGeometry(0.006, 0.03, 0.03),
  hall: new THREE.BoxGeometry(0.25, 0.13, 0.16),
  hallRoof: roofGeo(0.19, 0.095, 0.27),
  tower: new THREE.BoxGeometry(0.13, 0.3, 0.13),
  merlon: new THREE.BoxGeometry(0.035, 0.035, 0.035),
  spire: new THREE.ConeGeometry(0.1, 0.13, 4),
  pole: new THREE.CylinderGeometry(0.005, 0.005, 0.16),
  flag: new THREE.PlaneGeometry(0.08, 0.05, 6, 1),
  road: new RoundedBoxGeometry(0.54, 0.055, 0.09, 2, 0.02),
};
GEO.flag.translate(0.04, 0, 0);

function shadowAll(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeSettlement(color) {
  const m = pieceMats(color);
  const g = new THREE.Group();
  const plate = new THREE.Mesh(GEO.plate, m.base);
  plate.position.y = 0.01;
  const wall = new THREE.Mesh(GEO.wall, m.wall);
  wall.position.y = 0.08;
  const roof = new THREE.Mesh(GEO.roof, m.roof);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 0.14;
  const chimney = new THREE.Mesh(GEO.chimney, SHARED.brick);
  chimney.position.set(0.045, 0.2, 0.03);
  const door = new THREE.Mesh(GEO.door, SHARED.dark);
  door.position.set(0, 0.052, 0.066);
  const w1 = new THREE.Mesh(GEO.window, SHARED.window);
  w1.position.set(0.081, 0.09, 0);
  const w2 = w1.clone();
  w2.position.x = -0.081;
  g.add(plate, wall, roof, chimney, door, w1, w2);
  return shadowAll(g);
}

export function makeCity(color) {
  const m = pieceMats(color);
  const g = new THREE.Group();
  const plate = new THREE.Mesh(GEO.plateBig, m.base);
  plate.position.y = 0.01;
  const hall = new THREE.Mesh(GEO.hall, m.wall);
  hall.position.set(0.045, 0.085, 0.01);
  const hallRoof = new THREE.Mesh(GEO.hallRoof, m.roof);
  hallRoof.rotation.y = Math.PI / 2;
  hallRoof.position.set(0.045, 0.15, 0.01);
  const tower = new THREE.Mesh(GEO.tower, m.wall);
  tower.position.set(-0.09, 0.17, -0.01);
  g.add(plate, hall, hallRoof, tower);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mer = new THREE.Mesh(GEO.merlon, m.wall);
    mer.position.set(-0.09 + x * 0.047, 0.335, -0.01 + z * 0.047);
    g.add(mer);
  }
  const spire = new THREE.Mesh(GEO.spire, m.roof);
  spire.position.set(-0.09, 0.39, -0.01);
  spire.rotation.y = Math.PI / 4;
  const pole = new THREE.Mesh(GEO.pole, SHARED.pole);
  pole.position.set(-0.09, 0.5, -0.01);
  const flag = new THREE.Mesh(GEO.flag.clone(), m.flag);
  flag.position.set(-0.09, 0.55, -0.01);
  flag.userData.flag = true;
  const door = new THREE.Mesh(GEO.door, SHARED.dark);
  door.position.set(-0.09, 0.05, 0.056);
  const win = new THREE.Mesh(GEO.window, SHARED.window);
  win.position.set(0.171, 0.09, 0.01);
  const win2 = new THREE.Mesh(GEO.window, SHARED.window);
  win2.rotation.y = Math.PI / 2;
  win2.position.set(-0.09, 0.24, 0.066);
  g.add(spire, pole, flag, door, win, win2);
  return shadowAll(g);
}

export function makeRoad(color, a, b) {
  const m = new THREE.Mesh(GEO.road, pieceMats(color).road);
  m.position.set((a.x + b.x) / 2, SURF + 0.03, (a.y + b.y) / 2);
  m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
    model.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; } });
    g.position.set(v.x, SURF, v.y);
    model.rotation.y = Math.atan2(v.x, v.y) + Math.PI / 2;
    // Die Stadt schwebt über der bestehenden Siedlung, verbunden durch einen Lichtstrahl
    model.position.y = piece === 'city' ? 0.26 : 0.015;
    if (piece === 'city') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.3, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.y = 0.13;
      g.add(beam);
    }
    hit = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, piece === 'city' ? 0.8 : 0.45, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = piece === 'city' ? 0.35 : 0.2;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), new THREE.MeshBasicMaterial({ map: holoGlowTex, color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
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
      x: piece === 'road' ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 0.22,
      z: (Math.random() - 0.5) * (piece === 'road' ? 0.08 : 0.22),
      phase: Math.random(),
      speed: 0.25 + Math.random() * 0.2,
      height: piece === 'city' ? 0.7 : 0.35,
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

const DECOR_DEFS = {
  trunk: [() => new THREE.CylinderGeometry(0.014, 0.022, 0.1, 5), '#5b3a1f'],
  pine1: [() => new THREE.ConeGeometry(0.1, 0.16, 7), '#2d5629', true],
  pine2: [() => new THREE.ConeGeometry(0.078, 0.14, 7), '#356330', true],
  pine3: [() => new THREE.ConeGeometry(0.052, 0.12, 7), '#3d6f35', true],
  leaf: [() => jitterGeo(new THREE.IcosahedronGeometry(0.085, 1), 0.03, 3), '#4f8a3a', true, true],
  sheep: [() => jitterGeo(new THREE.IcosahedronGeometry(0.055, 1), 0.018, 9).scale(1.35, 0.95, 1), '#f6f3ea', false, true],
  sheepHead: [() => new THREE.SphereGeometry(0.026, 8, 6).scale(1.2, 1, 1), '#2b2622'],
  sheepLeg: [() => new THREE.CylinderGeometry(0.007, 0.007, 0.045, 4), '#2b2622'],
  stalk: [() => new THREE.ConeGeometry(0.016, 0.09, 4), '#e8c45c', true],
  hay: [() => new THREE.CylinderGeometry(0.06, 0.075, 0.07, 10), '#d7a946', true],
  hayTop: [() => new THREE.ConeGeometry(0.075, 0.06, 10), '#c99a3a'],
  brick: [() => new THREE.BoxGeometry(0.075, 0.034, 0.045), '#a94a2c', true],
  clod: [() => jitterGeo(new THREE.SphereGeometry(0.07, 8, 6), 0.02, 4), '#a0492f', true, true],
  kiln: [() => new THREE.CylinderGeometry(0.045, 0.065, 0.1, 10), '#7a3422'],
  kilnGlow: [() => new THREE.CircleGeometry(0.035, 10).rotateX(-Math.PI / 2), '#ffae4a', false, false, true],
  peak: [() => jitterGeo(new THREE.IcosahedronGeometry(0.17, 1), 0.06, 11).scale(1, 1.45, 1), '#a4a6a3', true, true],
  snow: [() => jitterGeo(new THREE.IcosahedronGeometry(0.065, 0), 0.02, 12).scale(1, 0.9, 1), '#f4f5f2', false, true],
  rock: [() => jitterGeo(new THREE.DodecahedronGeometry(0.07), 0.025, 13), '#77797b', true, true],
  dune: [() => new THREE.SphereGeometry(0.16, 14, 8).scale(1, 0.22, 1), '#dcc58c'],
  bush: [() => jitterGeo(new THREE.IcosahedronGeometry(0.04, 0), 0.02, 14), '#8a7a4a', true, true],
  cactus: [() => new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), '#5f8a3e'],
  shore: [() => jitterGeo(new THREE.DodecahedronGeometry(0.1), 0.04, 15), '#4f4a44', true, true],
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
      return corners.every(([cx, cz]) => Math.hypot(x - cx, z - cz) > 0.34);
    };
    const taken = [];
    const sample = (minR = 0.34, lim = 0.72, gap = 0) => {
      for (let k = 0; k < 40; k++) {
        const x = (rnd() * 2 - 1) * 0.85;
        const z = (rnd() * 2 - 1) * 0.85;
        if (Math.hypot(x, z) < minR || !inside(x, z, lim)) continue;
        if (gap && taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < gap)) continue;
        taken.push([x, z]);
        return [h.x + x, h.y + z];
      }
      return null;
    };
    const n = (k) => Math.round(k * density);
    switch (h.terrain) {
      case 'forest':
        for (let i = 0; i < n(26); i++) {
          const p = sample(0.32, 0.74, 0.1);
          if (!p) continue;
          const s = 0.75 + rnd() * 0.6;
          lists.trunk.push(m4(p[0], SURF + 0.05 * s, p[1], s, s, s));
          if (rnd() < 0.78) {
            const r = rnd() * 6;
            lists.pine1.push(m4(p[0], SURF + 0.13 * s, p[1], s, s, s, r));
            lists.pine2.push(m4(p[0], SURF + 0.22 * s, p[1], s, s, s, r));
            lists.pine3.push(m4(p[0], SURF + 0.3 * s, p[1], s, s, s, r));
          } else {
            lists.leaf.push(m4(p[0], SURF + 0.15 * s, p[1], s, s * 1.1, s, rnd() * 6));
          }
        }
        break;
      case 'pasture':
        for (let i = 0; i < n(7); i++) {
          const p = sample(0.34, 0.7, 0.14);
          if (!p) continue;
          const r = rnd() * Math.PI * 2;
          const c = Math.cos(r);
          const s = Math.sin(r);
          lists.sheep.push(m4(p[0], SURF + 0.065, p[1], 1, 1, 1, r));
          lists.sheepHead.push(m4(p[0] + c * 0.075, SURF + 0.08, p[1] - s * 0.075, 1, 1, 1, r));
          for (const [lx, lz] of [[0.035, 0.025], [0.035, -0.025], [-0.035, 0.025], [-0.035, -0.025]]) {
            lists.sheepLeg.push(m4(p[0] + c * lx + s * lz, SURF + 0.022, p[1] - s * lx + c * lz, 1, 1, 1));
          }
        }
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.36, 0.72);
          if (p) lists.bush.push(m4(p[0], SURF + 0.02, p[1], 1.2, 0.8, 1.2, rnd() * 6));
        }
        break;
      case 'fields': {
        const dir = rnd() * Math.PI;
        for (let i = 0; i < n(70); i++) {
          const p = sample(0.33, 0.74);
          if (!p) continue;
          const s = 0.8 + rnd() * 0.45;
          lists.stalk.push(m4(p[0], SURF + 0.055 * s, p[1], s, s, s, dir, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25));
        }
        for (let i = 0; i < n(2); i++) {
          const p = sample(0.42, 0.66, 0.2);
          if (!p) continue;
          lists.hay.push(m4(p[0], SURF + 0.035, p[1], 1, 1, 1, rnd() * 6));
          lists.hayTop.push(m4(p[0], SURF + 0.1, p[1], 1, 1, 1));
        }
        break;
      }
      case 'hills': {
        for (let pile = 0; pile < n(3); pile++) {
          const p = sample(0.4, 0.66, 0.22);
          if (!p) continue;
          const r = rnd() * 3;
          const c = Math.cos(r);
          const s = Math.sin(r);
          const layout = [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-0.5, 1, 0], [0.5, 1, 0], [0, 2, 0]];
          for (const [ox, oy] of layout) {
            lists.brick.push(m4(p[0] + c * ox * 0.08, SURF + 0.017 + oy * 0.036, p[1] - s * ox * 0.08, 1, 1, 1, r));
          }
        }
        const k = sample(0.42, 0.62, 0.2);
        if (k) {
          lists.kiln.push(m4(k[0], SURF + 0.05, k[1], 1, 1, 1));
          lists.kilnGlow.push(m4(k[0], SURF + 0.101, k[1], 1, 1, 1));
        }
        for (let i = 0; i < n(8); i++) {
          const p = sample(0.33, 0.72, 0.08);
          if (p) lists.clod.push(m4(p[0], SURF, p[1], 1 + rnd(), 0.45 + rnd() * 0.35, 1 + rnd(), rnd() * 3));
        }
        break;
      }
      case 'mountains': {
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.4, 0.62, 0.3);
          if (!p) continue;
          const s = 0.8 + rnd() * 0.45;
          const r = rnd() * 6;
          lists.peak.push(m4(p[0], SURF + 0.13 * s, p[1], s, s, s, r));
          lists.snow.push(m4(p[0], SURF + 0.33 * s, p[1], s, s, s, r));
        }
        for (let i = 0; i < n(10); i++) {
          const p = sample(0.33, 0.74, 0.08);
          if (!p) continue;
          const s = 0.45 + rnd() * 0.7;
          lists.rock.push(m4(p[0], SURF + 0.025, p[1], s, s * 0.8, s, rnd() * 6, rnd()));
        }
        break;
      }
      case 'desert':
        for (let i = 0; i < n(4); i++) {
          const p = sample(0.36, 0.66, 0.2);
          if (p) lists.dune.push(m4(p[0], SURF, p[1], 1 + rnd() * 0.6, 1, 0.7 + rnd() * 0.3, rnd() * 3));
        }
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.4, 0.7, 0.12);
          if (p) lists.cactus.push(m4(p[0], SURF + 0.08, p[1], 1, 1, 1, 0, (rnd() - 0.5) * 0.2));
        }
        for (let i = 0; i < n(5); i++) {
          const p = sample(0.36, 0.72);
          if (p) lists.bush.push(m4(p[0], SURF + 0.015, p[1], 1, 0.7, 1, rnd() * 6));
        }
        for (let i = 0; i < n(3); i++) {
          const p = sample(0.36, 0.72);
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
    for (let i = 0; i < 3; i++) {
      if (rnd() < 0.35) continue;
      const t = (rnd() - 0.5) * 0.9;
      const out = 0.06 + rnd() * 0.18;
      const x = e.x + (nx / len) * out + (-ny / len) * t;
      const z = e.y + (ny / len) * out + (nx / len) * t;
      const s = 0.5 + rnd() * 0.9;
      lists.shore.push(m4(x, WATER_Y + 0.02, z, s, s * 0.7, s, rnd() * 6, rnd()));
    }
  }

  const meshes = [];
  const c = new THREE.Color();
  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const [makeGeo, color, vary, flat, glow] = DECOR_DEFS[k];
    // Bei Farbvariation trägt jede Instanz ihre Farbe selbst (instanceColor wird mit material.color multipliziert)
    const base = vary ? '#ffffff' : color;
    const mat = glow
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color: base, roughness: 0.88, flatShading: !!flat });
    const mesh = new THREE.InstancedMesh(makeGeo(), mat, list.length);
    const rv = mulberry(k.length * 31);
    list.forEach((mat4, i) => {
      mesh.setMatrixAt(i, mat4);
      if (vary) {
        c.set(color).offsetHSL((rv() - 0.5) * 0.04, (rv() - 0.5) * 0.1, (rv() - 0.5) * 0.12);
        mesh.setColorAt(i, c);
      }
    });
    mesh.castShadow = !['dune', 'kilnGlow', 'clod'].includes(k);
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

export function makeDock(hb, board, labelTex) {
  const g = new THREE.Group();
  const plank = new THREE.MeshStandardMaterial({ map: dockWood, color: '#caa27a', roughness: 0.85 });
  const post = new THREE.MeshStandardMaterial({ color: '#4b3220', roughness: 0.9 });
  const edge = board.edges[hb.edge];
  const ang = Math.atan2(hb.ny, hb.nx);
  const tx = -hb.ny;
  const tz = hb.nx;
  const deckY = WATER_Y + 0.12;
  const cx = hb.x + hb.nx * 0.36;
  const cz = hb.y + hb.ny * 0.36;
  // Planken quer zur Stegrichtung
  const plankGeo = new THREE.BoxGeometry(0.06, 0.02, 0.46);
  for (let i = -3; i <= 3; i++) {
    const p = new THREE.Mesh(plankGeo, plank);
    p.position.set(cx + hb.nx * i * 0.065, deckY + (i % 2) * 0.002, cz + hb.ny * i * 0.065);
    p.rotation.y = -ang;
    p.castShadow = true;
    p.receiveShadow = true;
    g.add(p);
  }
  const postGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.34, 6);
  for (const s of [-1, 1]) for (const d of [0.16, 0.56]) {
    const p = new THREE.Mesh(postGeo, post);
    p.position.set(hb.x + hb.nx * d + tx * s * 0.2, WATER_Y + 0.05, hb.y + hb.ny * d + tz * s * 0.2);
    p.castShadow = true;
    g.add(p);
  }
  // Rampen von den beiden Hafen-Kreuzungen zum Steg
  for (const vid of edge.v) {
    const v = board.vertices[vid];
    const ex = cx - hb.nx * 0.18 + (v.x - hb.x) * 0.35;
    const ez = cz - hb.ny * 0.18 + (v.y - hb.y) * 0.35;
    const len = Math.hypot(v.x - ex, v.y - ez);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.08), plank);
    ramp.position.set((v.x + ex) / 2, (SURF - 0.02 + deckY) / 2, (v.y + ez) / 2);
    // Euler XYZ: zuerst Neigung um die lokale z-Achse (+x-Ende nach oben), dann Drehung zur Kreuzung
    ramp.rotation.y = -Math.atan2(v.y - ez, v.x - ex);
    ramp.rotation.z = Math.atan2(SURF - 0.02 - deckY, len);
    ramp.castShadow = true;
    g.add(ramp);
  }
  // Fass und Kiste als Kleinigkeiten
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), new THREE.MeshStandardMaterial({ color: '#7a5030' }));
  barrel.position.set(cx + tx * 0.15, deckY + 0.04, cz + tz * 0.15);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshStandardMaterial({ map: dockWood, color: '#b08a60' }));
  crate.position.set(cx - tx * 0.15 + hb.nx * 0.1, deckY + 0.035, cz - tz * 0.15 + hb.ny * 0.1);
  crate.rotation.y = 0.4;
  barrel.castShadow = crate.castShadow = true;
  g.add(barrel, crate);
  // Schild
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthWrite: false }));
  label.position.set(hb.x + hb.nx * 0.68, 0.2, hb.y + hb.ny * 0.68);
  label.scale.setScalar(0.5);
  label.renderOrder = 5;
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
