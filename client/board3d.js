// 3D-Spielbrett mit Three.js: Insel, Gelände, Häfen, Figuren, Räuber, Würfel und Kamera.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TOP = 0; // Oberkante der Geländeplatten
const SLAB = 0.07;
const SURF = TOP + SLAB; // Spielfläche
const WATER_Y = -0.3;

const TERRAIN_COLORS = {
  forest: '#4f7a3a', pasture: '#93c25b', fields: '#dcb24a', hills: '#bf5b3c', mountains: '#9a9b98', desert: '#e6d3a0',
};
const RES_EMOJI = { wood: '🪵', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '🪨', any: '⚓' };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 0) c.lerp(new THREE.Color('#000'), -f);
  else c.lerp(new THREE.Color('#fff'), f);
  return `#${c.getHexString()}`;
}

function terrainTexture(terrain, seed) {
  const base = TERRAIN_COLORS[terrain];
  const rnd = mulberry(seed);
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const dots = terrain === 'desert' ? 900 : 1600;
    for (let i = 0; i < dots; i++) {
      const f = (rnd() - 0.5) * 0.35;
      ctx.fillStyle = shade(base, f);
      ctx.globalAlpha = 0.35 + rnd() * 0.4;
      const r = 1 + rnd() * (terrain === 'mountains' ? 5 : 3);
      ctx.beginPath();
      ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (terrain === 'fields') {
      ctx.strokeStyle = shade(base, -0.18);
      ctx.lineWidth = 3;
      for (let y = 8; y < s; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y + 6);
        ctx.stroke();
      }
    }
    if (terrain === 'hills') {
      ctx.strokeStyle = shade(base, -0.25);
      ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, 10 + rnd() * 18, rnd() * 3, rnd() * 3 + 2);
        ctx.stroke();
      }
    }
    if (terrain === 'desert') {
      ctx.strokeStyle = shade(base, -0.12);
      ctx.lineWidth = 2;
      for (let y = 10; y < s; y += 22) {
        ctx.beginPath();
        for (let x = 0; x <= s; x += 8) ctx.lineTo(x, y + Math.sin(x / 20 + y) * 5);
        ctx.stroke();
      }
    }
  });
}

function tokenTexture(n) {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    const grad = ctx.createRadialGradient(c, c * 0.8, 10, c, c, c);
    grad.addColorStop(0, '#fbf3dc');
    grad.addColorStop(1, '#e8d6ae');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#a88a55';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6e5634';
    ctx.beginPath();
    ctx.arc(c, c, c - 18, 0, Math.PI * 2);
    ctx.stroke();
    const red = n === 6 || n === 8;
    ctx.fillStyle = red ? '#a3261c' : '#2e2519';
    ctx.font = `700 ${red ? 132 : 122}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), c, c - 12);
    const pips = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[n];
    for (let i = 0; i < pips; i++) {
      ctx.beginPath();
      ctx.arc(c + (i - (pips - 1) / 2) * 17, c + 62, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function harborTexture(type) {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#f4e8c8';
    ctx.strokeStyle = '#6b4a27';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(c, c, c - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 78px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(type === 'any' ? '3:1' : '2:1', c, c - 30);
    ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(RES_EMOJI[type], c, c + 50);
  });
}

function diceFaceTexture(v) {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = v === 1 ? '#a3261c' : '#1f1b16';
    const p = {
      1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
      4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
      5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
      6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
    }[v];
    for (const [x, y] of p) {
      ctx.beginPath();
      ctx.arc(x * s, y * s, v === 1 ? 15 : 11, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Welche Drehung bringt die Augenzahl v nach oben (BoxGeometry-Flächen: +x,-x,+y,-y,+z,-z = 2,5,1,6,3,4)
const FACE_EULER = {
  1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
};

export class Board3D {
  constructor(container, { onPick, onHover } = {}) {
    this.container = container;
    this.onPick = onPick || (() => {});
    this.onHover = onHover || (() => {});
    this.pieces = { v: new Map(), e: new Map() };
    this.targets = { kind: null, ids: new Set() };
    this.anims = [];
    this.hovered = null;
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.boardKey = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1f6f6c');
    scene.fog = new THREE.Fog('#1f6f6c', 16, 38);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera = camera;
    this.homePos = new THREE.Vector3(0, 8.6, 7.4);
    this.homeTarget = new THREE.Vector3(0.2, 0, 0.55);
    camera.position.copy(this.homePos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(this.homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 17;
    controls.maxPolarAngle = 1.3;
    controls.minPolarAngle = 0.1;
    controls.screenSpacePanning = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.update();
    controls.addEventListener('start', () => { this.userMoved = true; });
    this.controls = controls;

    // Licht
    scene.add(new THREE.HemisphereLight('#fff6e3', '#35584f', 1.25));
    const sun = new THREE.DirectionalLight('#fff0d4', 2.4);
    sun.position.set(5, 10, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    this.buildWater();
    this.buildDice();
    this.buildBoats();

    this.island = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.targetGroup = new THREE.Group();
    scene.add(this.island, this.pieceGroup, this.targetGroup);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- Umgebung ----------

  buildWater() {
    const normal = canvasTex(256, (ctx, s) => {
      const img = ctx.createImageData(s, s);
      const rnd = mulberry(99);
      const h = new Float32Array(s * s).map(() => rnd());
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          const i = y * s + x;
          h[i] = (h[i] + h[((y + 1) % s) * s + x] + h[y * s + ((x + 1) % s)] + h[((y + s - 1) % s) * s + x]) / 4;
        }
      }
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const dx = (h[y * s + ((x + 1) % s)] - h[i]) * 6;
        const dy = (h[((y + 1) % s) * s + x] - h[i]) * 6;
        img.data[i * 4] = 128 + dx * 127;
        img.data[i * 4 + 1] = 128 + dy * 127;
        img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
    normal.colorSpace = THREE.NoColorSpace;
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(14, 14);
    this.waterNormal = normal;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: '#2a9690', roughness: 0.22, metalness: 0.05, normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35) }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    water.receiveShadow = true;
    this.scene.add(water);

    // Helles Flachwasser um die Insel
    const shallowTex = canvasTex(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(120,214,196,0.85)');
      g.addColorStop(0.55, 'rgba(90,190,178,0.45)');
      g.addColorStop(1, 'rgba(60,160,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const shallow = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({ map: shallowTex, transparent: true, depthWrite: false }),
    );
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.y = WATER_Y + 0.01;
    this.scene.add(shallow);
  }

  buildBoats() {
    this.boats = [];
    const hullMat = new THREE.MeshStandardMaterial({ color: '#6b4527', roughness: 0.8 });
    const sailMat = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.9, side: THREE.DoubleSide });
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-0.22, 0);
    hullShape.lineTo(0.16, 0);
    hullShape.lineTo(0.28, 0.07);
    hullShape.lineTo(-0.25, 0.07);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.13, bevelEnabled: false });
    hullGeo.translate(0, 0, -0.065);
    const specs = [[6.4, 0.05, 0.3], [7.4, -0.035, 2.1], [8.2, 0.028, 4.0], [6.9, -0.045, 5.3]];
    for (const [radius, speed, phase] of specs) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.castShadow = true;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42), hullMat);
      mast.position.set(0, 0.27, 0);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), sailMat);
      sail.position.set(0.03, 0.3, 0);
      sail.rotation.y = Math.PI / 2;
      sail.castShadow = true;
      g.add(hull, mast, sail);
      g.position.y = WATER_Y - 0.02;
      this.scene.add(g);
      this.boats.push({ g, radius, speed, phase });
    }
  }

  buildDice() {
    const tray = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.75 });
    const felt = new THREE.MeshStandardMaterial({ color: '#3d2a1b', roughness: 1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.95), felt);
    base.receiveShadow = true;
    tray.add(base);
    const walls = [[0, 0.09, 0.47, 1.56, 0.18, 0.06], [0, 0.09, -0.47, 1.56, 0.18, 0.06], [0.75, 0.09, 0, 0.06, 0.18, 1.0], [-0.75, 0.09, 0, 0.06, 0.18, 1.0]];
    for (const [x, y, z, w, h, d] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      tray.add(m);
    }
    tray.position.set(4.35, WATER_Y + 0.06, 3.35);
    tray.rotation.y = -0.55;
    tray.scale.setScalar(0.9);
    this.scene.add(tray);
    this.tray = tray;

    const mats = [2, 5, 1, 6, 3, 4].map((v) => new THREE.MeshStandardMaterial({ map: diceFaceTexture(v), roughness: 0.35 }));
    const geo = new RoundedBoxGeometry(0.32, 0.32, 0.32, 3, 0.05);
    this.dice = [0, 1].map((i) => {
      const d = new THREE.Mesh(geo, mats);
      d.castShadow = true;
      d.position.set(i ? 0.25 : -0.25, 0.2, i ? 0.08 : -0.05);
      tray.add(d);
      return d;
    });
    this.showDice([5, 2], false);
  }

  diceQuat(v, yaw) {
    const [x, y, z] = FACE_EULER[v];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q);
  }

  showDice([a, b], animate = true) {
    const vals = [a, b];
    if (!animate) {
      this.dice.forEach((d, i) => d.quaternion.copy(this.diceQuat(vals[i], i ? 0.4 : -0.2)));
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const dur = 1100;
      const setups = this.dice.map((d, i) => ({
        final: this.diceQuat(vals[i], (Math.random() - 0.5) * 1.2),
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).normalize(),
        spin: 14 + Math.random() * 8,
        x0: (i ? 0.25 : -0.25) + (Math.random() - 0.5) * 0.3,
        z0: (Math.random() - 0.5) * 0.4,
        x1: (i ? 0.25 : -0.25) + (Math.random() - 0.5) * 0.12,
        z1: (i ? 0.1 : -0.08) + (Math.random() - 0.5) * 0.1,
      }));
      this.anims.push((now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - (1 - t) ** 3;
        this.dice.forEach((d, i) => {
          const s = setups[i];
          const bounce = Math.abs(Math.cos(t * Math.PI * 2.5)) * (1 - t) ** 2 * 1.1;
          d.position.set(s.x0 + (s.x1 - s.x0) * e, 0.2 + bounce, s.z0 + (s.z1 - s.z0) * e);
          const q = new THREE.Quaternion().setFromAxisAngle(s.axis, s.spin * (1 - e));
          d.quaternion.copy(s.final).multiply(q);
        });
        if (t >= 1) { resolve(); return false; }
        return true;
      });
    });
  }

  // ---------- Insel ----------

  build(state) {
    const key = `${state.islandName}|${state.board.hexes.map((h) => h.terrain[0] + (h.number || 0)).join('')}`;
    if (key === this.boardKey) return;
    this.boardKey = key;
    this.board = state.board;
    this.disposeGroup(this.island);
    this.disposeGroup(this.pieceGroup);
    this.disposeGroup(this.targetGroup);
    this.pieces = { v: new Map(), e: new Map() };
    this.hexTiles = [];
    this.robber = null;

    const rockMat = new THREE.MeshStandardMaterial({ color: '#4d3b2b', roughness: 0.95 });
    const rockGeo = new THREE.CylinderGeometry(1.0, 1.06, 0.72, 6);
    rockGeo.translate(0, TOP - 0.36, 0);
    const slabGeo = new THREE.CylinderGeometry(0.965, 0.985, SLAB, 6);
    slabGeo.translate(0, TOP + SLAB / 2, 0);

    const decor = { tree: [], treeTop: [], trunk: [], sheep: [], sheepHead: [], wheat: [], brick: [], clod: [], rock: [], peak: [], snow: [], dune: [], cactus: [] };

    for (const h of state.board.hexes) {
      const g = new THREE.Group();
      g.position.set(h.x, 0, h.y);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.receiveShadow = true;
      rock.castShadow = true;
      const color = TERRAIN_COLORS[h.terrain];
      const slab = new THREE.Mesh(slabGeo, [
        new THREE.MeshStandardMaterial({ color: shade(color, -0.25), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ map: terrainTexture(h.terrain, h.id * 17 + 3), roughness: 0.92 }),
        new THREE.MeshStandardMaterial({ color: shade(color, -0.4) }),
      ]);
      slab.receiveShadow = true;
      slab.userData = { kind: 'hex', id: h.id };
      g.add(rock, slab);
      this.hexTiles.push(slab);

      if (h.number) {
        const token = new THREE.Mesh(
          new THREE.CylinderGeometry(0.27, 0.28, 0.05, 40),
          [new THREE.MeshStandardMaterial({ color: '#a88a55' }), new THREE.MeshStandardMaterial({ map: tokenTexture(h.number), roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#a88a55' })],
        );
        token.position.y = SURF + 0.025;
        token.rotation.y = Math.PI / 2; // Deckel-UVs drehen, damit die Zahl zur Kamera zeigt
        token.castShadow = true;
        token.receiveShadow = true;
        g.add(token);
      }
      this.island.add(g);
      this.scatter(h, decor);
    }
    this.buildDecor(decor);
    this.buildHarbors(state.board);

    // Räuber
    const pts = [];
    const prof = [[0, 0], [0.13, 0], [0.13, 0.03], [0.09, 0.06], [0.08, 0.2], [0.11, 0.27], [0.07, 0.31], [0.1, 0.38], [0.07, 0.45], [0, 0.47]];
    for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
    const robber = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshStandardMaterial({ color: '#26252a', roughness: 0.5, metalness: 0.2 }));
    robber.castShadow = true;
    this.robber = robber;
    this.robberHex = null;
    this.synced = false;
    this.island.add(robber);
  }

  scatter(h, decor) {
    const rnd = mulberry(h.id * 7919 + 11);
    const inside = (x, z) => {
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        if (Math.abs(x * Math.cos(a) + z * Math.sin(a)) > 0.72) return false;
      }
      return true;
    };
    const sample = (minR = 0.34) => {
      for (let k = 0; k < 30; k++) {
        const x = (rnd() * 2 - 1) * 0.8;
        const z = (rnd() * 2 - 1) * 0.8;
        if (Math.hypot(x, z) < minR || !inside(x, z)) continue;
        return [h.x + x, h.y + z];
      }
      return null;
    };
    const m = (x, y, z, sx, sy, sz, ry = 0, rx = 0) => new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(sx, sy, sz),
    );
    switch (h.terrain) {
      case 'forest':
        for (let i = 0; i < 17; i++) {
          const p = sample(0.33);
          if (!p) continue;
          const s = 0.75 + rnd() * 0.55;
          decor.trunk.push(m(p[0], SURF + 0.05 * s, p[1], s, s, s));
          decor.tree.push(m(p[0], SURF + 0.19 * s, p[1], s, s, s, rnd() * 6));
          decor.treeTop.push(m(p[0], SURF + 0.31 * s, p[1], s, s, s, rnd() * 6));
        }
        break;
      case 'pasture':
        for (let i = 0; i < 6; i++) {
          const p = sample(0.34);
          if (!p) continue;
          const r = rnd() * Math.PI * 2;
          decor.sheep.push(m(p[0], SURF + 0.06, p[1], 1, 1, 1, r));
          decor.sheepHead.push(m(p[0] + Math.cos(r) * 0.075, SURF + 0.085, p[1] - Math.sin(r) * 0.075, 1, 1, 1, r));
        }
        for (let i = 0; i < 5; i++) {
          const p = sample(0.3);
          if (p) decor.clod.push(m(p[0], SURF, p[1], 0.9, 0.35, 0.9));
        }
        break;
      case 'fields':
        for (let i = 0; i < 34; i++) {
          const p = sample(0.33);
          if (!p) continue;
          const s = 0.8 + rnd() * 0.5;
          decor.wheat.push(m(p[0], SURF + 0.06 * s, p[1], s, s, s, rnd() * 6));
        }
        break;
      case 'hills':
        for (let pile = 0; pile < 2; pile++) {
          const p = sample(0.4);
          if (!p) continue;
          const r = rnd() * 3;
          for (let k = 0; k < 5; k++) {
            const layer = k < 3 ? 0 : 1;
            const off = layer ? (k - 3.5) * 0.085 : (k - 1) * 0.085;
            decor.brick.push(m(p[0] + Math.cos(r) * off, SURF + 0.022 + layer * 0.042, p[1] - Math.sin(r) * off, 1, 1, 1, r));
          }
        }
        for (let i = 0; i < 7; i++) {
          const p = sample(0.33);
          if (p) decor.clod.push(m(p[0], SURF, p[1], 1 + rnd(), 0.5 + rnd() * 0.4, 1 + rnd(), rnd() * 3));
        }
        break;
      case 'mountains': {
        const peaks = 3;
        for (let i = 0; i < peaks; i++) {
          const p = sample(0.4);
          if (!p) continue;
          const s = 0.8 + rnd() * 0.5;
          decor.peak.push(m(p[0], SURF + 0.2 * s, p[1], s, s, s, rnd() * 6));
          decor.snow.push(m(p[0], SURF + 0.335 * s, p[1], s, s, s, rnd() * 6));
        }
        for (let i = 0; i < 7; i++) {
          const p = sample(0.33);
          if (!p) continue;
          const s = 0.5 + rnd() * 0.7;
          decor.rock.push(m(p[0], SURF + 0.03, p[1], s, s * 0.8, s, rnd() * 6, rnd()));
        }
        break;
      }
      case 'desert':
        for (let i = 0; i < 4; i++) {
          const p = sample(0.36);
          if (p) decor.dune.push(m(p[0], SURF, p[1], 1 + rnd() * 0.6, 1, 0.7 + rnd() * 0.3, rnd() * 3));
        }
        for (let i = 0; i < 2; i++) {
          const p = sample(0.4);
          if (p) decor.cactus.push(m(p[0], SURF + 0.09, p[1], 1, 1, 1));
        }
        break;
      default:
    }
  }

  buildDecor(decor) {
    const defs = {
      trunk: [new THREE.CylinderGeometry(0.018, 0.024, 0.1, 5), '#5b3a1f'],
      tree: [new THREE.ConeGeometry(0.105, 0.24, 7), '#2f5a2c', true],
      treeTop: [new THREE.ConeGeometry(0.075, 0.18, 7), '#3b6e34', true],
      sheep: [new THREE.SphereGeometry(0.055, 12, 8).scale(1.35, 0.95, 1), '#f7f5ef'],
      sheepHead: [new THREE.SphereGeometry(0.028, 8, 6), '#2b2622'],
      wheat: [new THREE.ConeGeometry(0.03, 0.14, 5), '#e8c25a', true],
      brick: [new THREE.BoxGeometry(0.08, 0.04, 0.05), '#9e3f24', true],
      clod: [new THREE.SphereGeometry(0.07, 8, 6), '#9a4a30', true],
      rock: [new THREE.DodecahedronGeometry(0.075), '#76787a', true],
      peak: [new THREE.ConeGeometry(0.2, 0.4, 6), '#7f8284', true],
      snow: [new THREE.ConeGeometry(0.083, 0.13, 6), '#f4f4f0'],
      dune: [new THREE.SphereGeometry(0.16, 12, 8).scale(1, 0.25, 1), '#d9c28a'],
      cactus: [new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), '#5f8a3e'],
    };
    for (const [k, list] of Object.entries(decor)) {
      if (!list.length) continue;
      const [geo, color, vary] = defs[k];
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: k === 'rock' || k === 'peak' }), list.length);
      const c = new THREE.Color();
      list.forEach((mat, i) => {
        mesh.setMatrixAt(i, mat);
        if (vary) {
          c.set(color).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.12);
          mesh.setColorAt(i, c);
        }
      });
      if (k === 'clod') {
        // Weideland-Hügel grün, Hügelland rot
        list.forEach((mat, i) => {
          const pos = new THREE.Vector3().setFromMatrixPosition(mat);
          const hex = this.board.hexes.reduce((best, h) => (Math.hypot(h.x - pos.x, h.y - pos.z) < Math.hypot(best.x - pos.x, best.y - pos.z) ? h : best));
          c.set(hex.terrain === 'pasture' ? '#7fb24b' : '#a54f33').offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
          mesh.setColorAt(i, c);
        });
      }
      mesh.castShadow = k !== 'dune' && k !== 'clod';
      mesh.receiveShadow = true;
      this.island.add(mesh);
    }
  }

  buildHarbors(board) {
    this.harborLabels = [];
    const plank = new THREE.MeshStandardMaterial({ color: '#8a6038', roughness: 0.85 });
    const post = new THREE.MeshStandardMaterial({ color: '#4b3220', roughness: 0.9 });
    for (const hb of board.harbors) {
      const edge = board.edges[hb.edge];
      const ang = Math.atan2(hb.ny, hb.nx);
      const g = new THREE.Group();
      // Steg, der von der Küstenkante ins Wasser ragt
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.26), plank);
      deck.position.set(hb.x + hb.nx * 0.33, WATER_Y + 0.13, hb.y + hb.ny * 0.33);
      deck.rotation.y = -ang + Math.PI / 2;
      deck.castShadow = true;
      deck.receiveShadow = true;
      g.add(deck);
      for (const s of [-1, 1]) for (const d of [0.2, 0.46]) {
        const px = hb.x + hb.nx * d + -hb.ny * s * 0.2;
        const pz = hb.y + hb.ny * d + hb.nx * s * 0.2;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3), post);
        p.position.set(px, WATER_Y + 0.05, pz);
        p.castShadow = true;
        g.add(p);
      }
      // Stege zu den beiden Ecken
      for (const vid of edge.v) {
        const v = board.vertices[vid];
        const tx = hb.x + hb.nx * 0.33;
        const tz = hb.y + hb.ny * 0.33;
        const len = Math.hypot(v.x - tx, v.y - tz);
        const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.07), plank);
        b.position.set((v.x + tx) / 2, SURF - 0.04 + (WATER_Y + 0.13 - SURF + 0.04) * 0.4, (v.y + tz) / 2);
        b.rotation.y = -Math.atan2(v.y - tz, v.x - tx);
        b.castShadow = true;
        g.add(b);
      }
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: harborTexture(hb.type), depthWrite: false }));
      label.position.set(hb.x + hb.nx * 0.8, 0.3, hb.y + hb.ny * 0.8);
      label.scale.setScalar(0.56);
      label.renderOrder = 5;
      this.harborLabels.push(label);
      g.add(label);
      this.island.add(g);
    }
  }

  setHarborLabels(on) {
    for (const l of this.harborLabels || []) l.visible = on;
  }

  disposeGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  }

  // ---------- Figuren ----------

  static pieceMaterials = new Map();

  mats(color) {
    if (!Board3D.pieceMaterials.has(color)) {
      Board3D.pieceMaterials.set(color, {
        body: new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
        roof: new THREE.MeshStandardMaterial({ color: shade(color, -0.35), roughness: 0.6 }),
      });
    }
    return Board3D.pieceMaterials.get(color);
  }

  static roofGeo(w, h, d) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  }

  makeSettlement(color) {
    const { body, roof } = this.mats(color);
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.15), body);
    b.position.y = 0.065;
    const r = new THREE.Mesh(Board3D.roofGeo(0.21, 0.11, 0.18), roof);
    r.rotation.y = Math.PI / 2;
    r.position.y = 0.13;
    g.add(b, r);
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    return g;
  }

  makeCity(color) {
    const { body, roof } = this.mats(color);
    const g = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.17), body);
    hall.position.set(0.04, 0.065, 0);
    const hallRoof = new THREE.Mesh(Board3D.roofGeo(0.2, 0.1, 0.3), roof);
    hallRoof.rotation.y = 0;
    hallRoof.position.set(0.04, 0.13, 0);
    hallRoof.rotation.y = Math.PI / 2;
    hallRoof.scale.set(1, 1, 1);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.13), body);
    tower.position.set(-0.1, 0.15, 0);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.14, 4), roof);
    spire.position.set(-0.1, 0.37, 0);
    spire.rotation.y = Math.PI / 4;
    g.add(hall, hallRoof, tower, spire);
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    return g;
  }

  makeRoad(color, edge) {
    const { body } = this.mats(color);
    const [a, b] = edge.v.map((v) => this.board.vertices[v]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.085), body);
    m.position.set((a.x + b.x) / 2, SURF + 0.035, (a.y + b.y) / 2);
    m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  popIn(obj, delay = 0) {
    const start = performance.now() + delay;
    const target = obj.scale.clone();
    obj.scale.setScalar(0.001);
    this.anims.push((now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 420));
      const s = t < 1 ? 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2 : 1; // easeOutBack
      obj.scale.set(target.x * Math.max(0.001, s), target.y * Math.max(0.001, s), target.z * Math.max(0.001, s));
      return t < 1;
    });
  }

  sync(state, colorOf) {
    if (!this.board) return;
    const animate = this.synced;
    // Gebäude
    const seenV = new Set();
    for (const [vid, b] of Object.entries(state.buildings)) {
      seenV.add(Number(vid));
      const cur = this.pieces.v.get(Number(vid));
      const sig = `${b.type}:${b.player}`;
      if (cur && cur.userData.sig === sig) continue;
      if (cur) this.pieceGroup.remove(cur);
      const v = this.board.vertices[vid];
      const mesh = b.type === 'city' ? this.makeCity(colorOf(b.player)) : this.makeSettlement(colorOf(b.player));
      mesh.position.set(v.x, SURF, v.y);
      mesh.rotation.y = Math.atan2(v.x, v.y) + Math.PI / 2;
      mesh.userData.sig = sig;
      this.pieceGroup.add(mesh);
      this.pieces.v.set(Number(vid), mesh);
      if (animate) this.popIn(mesh);
    }
    for (const [vid, mesh] of this.pieces.v) {
      if (!seenV.has(vid)) { this.pieceGroup.remove(mesh); this.pieces.v.delete(vid); }
    }
    // Straßen
    const seenE = new Set();
    for (const [eid, p] of Object.entries(state.roads)) {
      seenE.add(Number(eid));
      if (this.pieces.e.has(Number(eid))) continue;
      const mesh = this.makeRoad(colorOf(p), this.board.edges[eid]);
      this.pieceGroup.add(mesh);
      this.pieces.e.set(Number(eid), mesh);
      if (animate) this.popIn(mesh);
    }
    for (const [eid, mesh] of this.pieces.e) {
      if (!seenE.has(eid)) { this.pieceGroup.remove(mesh); this.pieces.e.delete(eid); }
    }
    // Räuber
    if (this.robberHex !== state.robber) {
      const h = this.board.hexes[state.robber];
      const to = new THREE.Vector3(h.x - 0.36, SURF, h.y + 0.12);
      if (animate && this.robberHex !== null) {
        const from = this.robber.position.clone();
        const start = performance.now();
        this.anims.push((now) => {
          const t = Math.min(1, (now - start) / 700);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          this.robber.position.lerpVectors(from, to, e);
          this.robber.position.y = SURF + Math.sin(t * Math.PI) * 1.2;
          return t < 1;
        });
      } else {
        this.robber.position.copy(to);
      }
      this.robberHex = state.robber;
    }
    this.synced = true;
  }

  // ---------- Ziele (gültige Plätze) ----------

  setTargets(kind, ids = []) {
    const idSet = new Set(ids);
    const same = kind === this.targets.kind && idSet.size === this.targets.ids.size && [...idSet].every((i) => this.targets.ids.has(i));
    if (same) return;
    this.disposeGroup(this.targetGroup);
    this.targets = { kind, ids: idSet };
    this.setHover(null);
    if (!kind || !this.board) return;
    const glow = new THREE.MeshBasicMaterial({ color: '#ffe7a3', transparent: true, opacity: 0.95, depthWrite: false });
    this.glowMat = glow;
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    if (kind === 'vertex') {
      const ring = new THREE.TorusGeometry(0.1, 0.022, 8, 28);
      const dot = new THREE.CircleGeometry(0.05, 20);
      for (const id of idSet) {
        const v = this.board.vertices[id];
        const g = new THREE.Group();
        g.position.set(v.x, SURF + 0.03, v.y);
        const r = new THREE.Mesh(ring, glow);
        r.rotation.x = Math.PI / 2;
        const d = new THREE.Mesh(dot, glow.clone());
        d.material.opacity = 0.6;
        d.rotation.x = -Math.PI / 2;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hitMat);
        hit.userData = { kind: 'vertex', id };
        g.add(r, d, hit);
        g.userData = { kind: 'vertex', id };
        this.targetGroup.add(g);
      }
    } else if (kind === 'edge') {
      for (const id of idSet) {
        const e = this.board.edges[id];
        const [a, b] = e.v.map((v) => this.board.vertices[v]);
        const g = new THREE.Group();
        g.position.set((a.x + b.x) / 2, SURF + 0.02, (a.y + b.y) / 2);
        g.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), glow);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.26), hitMat);
        hit.userData = { kind: 'edge', id };
        g.add(bar, hit);
        g.userData = { kind: 'edge', id };
        this.targetGroup.add(g);
      }
    } else if (kind === 'hex') {
      const ringGeo = new THREE.RingGeometry(0.78, 0.94, 6, 1, Math.PI / 2);
      const fillGeo = new THREE.CircleGeometry(0.93, 6, Math.PI / 2);
      for (const id of idSet) {
        const h = this.board.hexes[id];
        const g = new THREE.Group();
        g.position.set(h.x, SURF + 0.03, h.y);
        const ring = new THREE.Mesh(ringGeo, glow);
        ring.rotation.x = -Math.PI / 2;
        const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: '#fff2c4', transparent: true, opacity: 0, depthWrite: false }));
        fill.rotation.x = -Math.PI / 2;
        fill.position.y = 0.005;
        g.add(ring, fill);
        g.userData = { kind: 'hex', id, fill };
        this.targetGroup.add(g);
      }
    }
  }

  // ---------- Eingabe ----------

  bindEvents() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      this.stopTour();
    });
    el.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0 || this.panMode) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const hit = this.pick(e);
        if (hit) this.onPick(hit.kind, hit.id);
      }
      down = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      const hit = this.pick(e);
      this.setHover(hit, e);
    });
    el.addEventListener('pointerleave', () => this.setHover(null));
    el.addEventListener('wheel', () => this.stopTour(), { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) this.keys.add(k);
      if (k === ' ' && !this.spaceHeld) {
        this.spaceHeld = true;
        this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === ' ') {
        this.spaceHeld = false;
        if (!this.panMode) this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  pick(e) {
    if (!this.targets.kind) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.targets.kind === 'hex') {
      const hits = this.raycaster.intersectObjects(this.hexTiles, false);
      const h = hits.find((x) => this.targets.ids.has(x.object.userData.id));
      return h ? { kind: 'hex', id: h.object.userData.id } : null;
    }
    const hits = this.raycaster.intersectObjects(this.targetGroup.children, true);
    const h = hits.find((x) => x.object.userData.kind);
    return h ? { ...h.object.userData } : null;
  }

  setHover(hit, e) {
    const key = hit ? `${hit.kind}:${hit.id}` : null;
    if (key !== this.hoveredKey) {
      this.hoveredKey = key;
      this.renderer.domElement.style.cursor = hit ? 'pointer' : '';
      for (const g of this.targetGroup.children) g.userData.hover = hit && g.userData.id === hit.id;
    }
    if (hit && e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.onHover({ ...hit, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else if (!hit) {
      this.onHover(null);
    }
  }

  // ---------- Kamera ----------

  getZoom() {
    const d = this.camera.position.distanceTo(this.controls.target);
    return 1 - (d - this.controls.minDistance) / (this.controls.maxDistance - this.controls.minDistance);
  }

  setZoom(f) {
    const c = this.controls;
    const d = c.maxDistance - Math.min(1, Math.max(0, f)) * (c.maxDistance - c.minDistance);
    const dir = this.camera.position.clone().sub(c.target).normalize();
    this.camera.position.copy(c.target).addScaledVector(dir, d);
    c.update();
  }

  rotate(dir) {
    this.stopTour();
    const c = this.controls;
    const offset = this.camera.position.clone().sub(c.target);
    const start = performance.now();
    const total = (dir * Math.PI) / 4;
    let done = 0;
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 450);
      const e = 1 - (1 - t) ** 3;
      const step = total * e - done;
      done += step;
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), step);
      this.camera.position.copy(c.target).add(offset);
      return t < 1;
    });
  }

  resetView() {
    this.stopTour();
    const fromP = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const start = performance.now();
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 700);
      const e = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(fromP, this.homePos, e);
      this.controls.target.lerpVectors(fromT, this.homeTarget, e);
      return t < 1;
    });
  }

  setPanMode(on) {
    this.panMode = on;
    this.controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  startTour(onEnd) {
    this.stopTour();
    const start = performance.now();
    const target = new THREE.Vector3(0, 0, 0);
    this.tourEnd = onEnd;
    this.tour = (now) => {
      const t = (now - start) / 16000;
      if (t >= 1) { this.stopTour(); this.resetView(); return; }
      const a = t * Math.PI * 2 + Math.PI / 2;
      const r = 6.2 - Math.sin(t * Math.PI) * 1.5;
      this.controls.target.lerp(target, 0.05);
      this.camera.position.set(Math.cos(a) * r, 3.4 + Math.sin(t * Math.PI * 2) * 0.8, Math.sin(a) * r);
    };
  }

  stopTour() {
    if (!this.tour) return;
    this.tour = null;
    if (this.tourEnd) this.tourEnd();
    this.tourEnd = null;
  }

  // ---------- Schleife ----------

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Abstand so wählen, dass die ganze Insel samt Häfen ins Bild passt
    this.camera.fov = aspect < 1 ? 50 : 38;
    this.camera.updateProjectionMatrix();
    const halfH = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * aspect);
    const dist = Math.max(11.8, 5.6 / Math.tan(halfH));
    const dir = new THREE.Vector3(0, 8.6, 7.05).normalize();
    this.homePos = dir.multiplyScalar(dist).add(this.homeTarget);
    this.controls.maxDistance = Math.max(17, dist + 3);
    if (!this.userMoved && !this.tour) {
      this.camera.position.copy(this.homePos);
      this.controls.target.copy(this.homeTarget);
    }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = now / 1000;
    this.anims = this.anims.filter((fn) => fn(now) !== false);
    if (this.tour) this.tour(now);

    if (this.keys.size) {
      const fwd = this.controls.target.clone().sub(this.camera.position).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      const move = new THREE.Vector3();
      if (this.keys.has('w')) move.add(fwd);
      if (this.keys.has('s')) move.sub(fwd);
      if (this.keys.has('d')) move.add(right);
      if (this.keys.has('a')) move.sub(right);
      move.normalize().multiplyScalar(dt * 5);
      const t = this.controls.target.clone().add(move);
      if (Math.hypot(t.x, t.z) < 7) {
        this.controls.target.add(move);
        this.camera.position.add(move);
      }
    }

    this.waterNormal.offset.set(time * 0.012, time * 0.008);
    for (const b of this.boats) {
      const a = b.phase + time * b.speed;
      b.g.position.x = Math.cos(a) * b.radius;
      b.g.position.z = Math.sin(a) * b.radius;
      b.g.position.y = WATER_Y - 0.02 + Math.sin(time * 1.6 + b.phase) * 0.015;
      b.g.rotation.y = -a + (b.speed > 0 ? Math.PI : 0);
      b.g.rotation.z = Math.sin(time * 1.3 + b.phase) * 0.05;
    }
    const pulse = 1 + Math.sin(time * 4) * 0.1;
    if (this.glowMat) this.glowMat.color.setHSL(0.12, 1, 0.72 + Math.sin(time * 4) * 0.12);
    for (const g of this.targetGroup.children) {
      const s = g.userData.hover ? 1.4 : pulse;
      if (this.targets.kind === 'hex') {
        g.userData.fill.material.opacity = g.userData.hover ? 0.28 : 0;
      } else {
        g.scale.setScalar(s);
      }
    }
    if (this.robber) this.robber.rotation.y = Math.sin(time * 0.6) * 0.3;

    this.controls.update();
    if (this.onCamera) this.onCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
