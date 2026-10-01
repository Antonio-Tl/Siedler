// 3D-Spielbrett: Szene, Kamera, Figuren, Ziele, Hologramm-Vorschau, Würfel, Kamerafahrten und Effekte.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  canvasTex, tokenTexture, harborTexture, glowTexture, ringTexture, shoreMask, shade, TERRAIN_COLORS,
} from './three/textures.js';
import { paintTerrain, paintCliff } from './three/terrain.js';
import {
  SURF, SLAB, TOP, WATER_Y, makeSettlement, makeCity, makeRoad, makeRobber, makeHologram, buildDecor, hexRimGeometry,
  makeDock, makeBoat, makeDiceTray, makeDie, makeToken, FACE_EULER,
} from './three/models.js';
import { createWater, createClouds } from './three/water.js';
import { resourceImage } from './art.js';

// tex: Kantenlänge der Geländetexturen, env: Umgebungslicht (Glanz auf Holz, Chips, Dächern)
const QUALITY = {
  ultra: { pixelRatio: 3, shadows: 4096, density: 1.3, clouds: true, tex: 2048, env: true },
  high: { pixelRatio: 2, shadows: 2048, density: 1, clouds: true, tex: 1024, env: false },
  medium: { pixelRatio: 1.5, shadows: 1024, density: 0.75, clouds: true, tex: 1024, env: false },
  low: { pixelRatio: 1, shadows: 0, density: 0.5, clouds: false, tex: 512, env: false },
};
const TERRAINS = ['fields', 'pasture', 'forest', 'hills', 'mountains', 'desert'];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
function easeOutBounce(t) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export class Board3D {
  constructor(container, { onPick, onHover, quality = 'high', scenery = true } = {}) {
    this.container = container;
    this.onPick = onPick || (() => {});
    this.onHover = onHover || (() => {});
    this.pieces = { v: new Map(), e: new Map() };
    this.targets = { kind: null, ids: new Set() };
    this.ghostKey = '';
    this.anims = [];
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.boardKey = null;
    this.scenery = scenery;
    this.flags = [];
    this.hexGlow = [];
    this.tokens = [];
    this.baseView = 'angled';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#17625f');
    scene.fog = new THREE.Fog('#17625f', 18, 42);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera = camera;
    this.homeTarget = new THREE.Vector3(0.2, 0, 0.55);
    this.homePos = new THREE.Vector3(0, 8.6, 7.4);
    this.homeDist = 11.8;
    camera.position.copy(this.homePos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(this.homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 17;
    controls.maxPolarAngle = 1.3;
    controls.minPolarAngle = 0.02;
    controls.screenSpacePanning = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.addEventListener('start', () => {
      this.userMoved = true;
      this.cancelCamera();
    });
    controls.update();
    this.controls = controls;

    // Sanftes Umgebungslicht für Glanzlichter auf Holz, Chips und Dächern
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    pmrem.dispose();
    this.hemi = new THREE.HemisphereLight('#fff4de', '#2f5750', 0.95);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff0d2', 2.6);
    sun.position.set(5, 10, 3.5);
    sun.castShadow = true;
    sun.shadow.camera.left = -7.5;
    sun.shadow.camera.right = 7.5;
    sun.shadow.camera.top = 7.5;
    sun.shadow.camera.bottom = -7.5;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 24;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    sun.shadow.radius = 3;
    scene.add(sun);
    this.sun = sun;

    this.water = createWater();
    scene.add(this.water);
    this.clouds = createClouds();
    scene.add(this.clouds);

    this.island = new THREE.Group();
    this.decorGroup = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.targetGroup = new THREE.Group();
    this.ghostGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    scene.add(this.island, this.decorGroup, this.pieceGroup, this.targetGroup, this.ghostGroup, this.fxGroup);

    this.buildDice();
    this.buildBoats();
    this.fxTex = {
      dust: glowTexture('rgba(235,220,190,0.85)', 'rgba(235,220,190,0)'),
      spark: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      ring: ringTexture(),
    };
    this.resTextures = {};

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindEvents();
    this.setQuality(quality);
    this.setScenery(scenery);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- Einstellungen ----------

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.high;
    const prev = this.quality;
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.sun.castShadow = q.shadows > 0;
    if (q.shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      this.sun.shadow.radius = q.shadows >= 4096 ? 4 : 3;
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.clouds.visible = q.clouds;
    this.scene.environment = q.env ? this.envMap : null;
    this.hemi.intensity = q.env ? 0.95 : 1.15;
    this.scene.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
    if (prev && prev.density !== q.density && this.board) this.rebuildDecor();
    if (prev && prev.tex !== q.tex && this.board) this.applyTerrainTextures();
    this.resize();
  }

  setScenery(on) {
    this.scenery = on;
    this.water.userData.uniforms.uCalm.value = on ? 0 : 1;
  }

  // ---------- Umgebung ----------

  buildBoats() {
    this.boats = [];
    const specs = [[6.6, 0.05, 0.3, '#f3ead6'], [7.6, -0.035, 2.1, '#e9d7b0'], [8.4, 0.028, 4.0, '#f3ead6'], [7.0, -0.045, 5.3, '#d9c7a0']];
    for (const [radius, speed, phase, sail] of specs) {
      const g = makeBoat(sail);
      g.position.y = WATER_Y - 0.02;
      this.scene.add(g);
      this.boats.push({ g, radius, speed, phase, a: phase });
    }
    this.placeBoats(0, 0);
  }

  placeBoats(time, dt) {
    for (const b of this.boats) {
      b.a += dt * b.speed;
      b.g.position.x = Math.cos(b.a) * b.radius;
      b.g.position.z = Math.sin(b.a) * b.radius;
      b.g.position.y = WATER_Y - 0.02 + Math.sin(time * 1.6 + b.phase) * 0.015;
      b.g.rotation.y = -b.a + (b.speed > 0 ? Math.PI : 0);
      b.g.rotation.z = Math.sin(time * 1.3 + b.phase) * 0.05;
    }
  }

  buildDice() {
    const tray = makeDiceTray();
    tray.position.set(4.35, WATER_Y + 0.08, 3.35);
    tray.rotation.y = -0.55;
    tray.scale.setScalar(0.92);
    this.scene.add(tray);
    this.tray = tray;
    this.dice = [0, 1].map((i) => {
      const d = makeDie();
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
      this.dice.forEach((d, i) => {
        d.quaternion.copy(this.diceQuat(vals[i], i ? 0.4 : -0.2));
        d.position.set(i ? 0.26 : -0.26, 0.2, i ? 0.08 : -0.05);
      });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const dur = 1350;
      const setups = this.dice.map((d, i) => ({
        final: this.diceQuat(vals[i], (Math.random() - 0.5) * 1.2),
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize(),
        spin: 16 + Math.random() * 8,
        x0: (i ? 0.6 : -0.6) + (Math.random() - 0.5) * 0.2,
        z0: -0.8 - Math.random() * 0.3,
        x1: (i ? 0.26 : -0.26) + (Math.random() - 0.5) * 0.14,
        z1: (i ? 0.1 : -0.08) + (Math.random() - 0.5) * 0.12,
      }));
      this.anims.push((now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = easeOutCubic(t);
        this.dice.forEach((d, i) => {
          const s = setups[i];
          const arc = t < 0.35 ? 1.2 * (1 - (t / 0.35) ** 2) : 0;
          const bounce = t >= 0.35 ? Math.abs(Math.sin(((t - 0.35) / 0.65) * Math.PI * 3)) * (1 - (t - 0.35) / 0.65) ** 2 * 0.35 : 0;
          d.position.set(s.x0 + (s.x1 - s.x0) * e, 0.2 + arc + bounce, s.z0 + (s.z1 - s.z0) * e);
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
    for (const g of [this.island, this.decorGroup, this.pieceGroup, this.targetGroup, this.ghostGroup, this.fxGroup]) this.disposeGroup(g);
    this.pieces = { v: new Map(), e: new Map() };
    this.targets = { kind: null, ids: new Set() };
    this.ghostKey = '';
    this.hoverGhost = null;
    this.focusRing = null;
    this.hexTiles = [];
    this.tokens = [];
    this.hexGlow = [];
    this.flags = [];
    this.synced = false;

    this.water.userData.uniforms.uShore.value = shoreMask(state.board);

    const cliff = paintCliff(this.quality.tex >= 2048 ? 2048 : 1024, { anisotropy: this.maxAniso });
    const rockMat = new THREE.MeshStandardMaterial({ map: cliff.map, normalMap: cliff.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95 });
    const rockGeo = new THREE.CylinderGeometry(1.0, 1.07, 0.72, 6, 1, true);
    rockGeo.translate(0, TOP - 0.36, 0);
    const slabGeo = new THREE.CylinderGeometry(0.95, 0.97, SLAB, 6);
    slabGeo.translate(0, TOP + SLAB / 2, 0);
    const rimGeo = hexRimGeometry();
    const rimMat = new THREE.MeshStandardMaterial({ color: '#ecdcaf', roughness: 0.42, metalness: 0.15 });
    const glowGeo = new THREE.CircleGeometry(0.93, 6, Math.PI / 2);
    glowGeo.rotateX(-Math.PI / 2);
    const tokenTex = {};
    const sideMats = {};
    const rockParts = [];
    const rimParts = [];
    this.slabTops = [];

    for (const h of state.board.hexes) {
      const g = new THREE.Group();
      g.position.set(h.x, 0, h.y);
      rockParts.push(rockGeo.clone().translate(h.x, 0, h.y));
      rimParts.push(rimGeo.clone().translate(h.x, SURF - 0.004, h.y));
      const color = TERRAIN_COLORS[h.terrain];
      // Bis die gemalte Textur fertig ist, trägt das Feld seine Grundfarbe
      const tint = new THREE.Color('#ffffff').offsetHSL(0, 0, ((h.id * 37) % 11 - 5) * 0.008);
      const top = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      top.userData = { terrain: h.terrain, tint };
      // Die Unterseite liegt auf dem Fels und bekommt kein Material (spart einen Draw-Call je Feld)
      const slab = new THREE.Mesh(slabGeo, [
        sideMats[h.terrain] ||= new THREE.MeshStandardMaterial({ color: shade(color, -0.3), roughness: 0.9 }),
        top,
      ]);
      // Gleiche Geländearten drehen ihre Textur, damit Nachbarn nicht identisch aussehen
      slab.rotation.y = ((h.id * 5 + h.q * 2) % 6) * (Math.PI / 3);
      slab.receiveShadow = true;
      slab.userData = { kind: 'hex', id: h.id };
      this.slabTops.push(top);
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = SURF + 0.004;
      glow.userData = { target: 0, color: new THREE.Color('#fff3c4') };
      glow.visible = false;
      g.add(slab, glow);
      this.hexTiles.push(slab);
      this.hexGlow[h.id] = glow;

      if (h.number) {
        tokenTex[h.number] ||= tokenTexture(h.number, this.quality.tex >= 2048 ? 1024 : 512);
        const token = makeToken(tokenTex[h.number]);
        token.position.y = SURF + 0.002;
        g.add(token);
        this.tokens[h.id] = token;
      }
      this.island.add(g);
    }
    // Klippen und Rahmen aller Felder als je ein Mesh
    const rocks = new THREE.Mesh(mergeGeometries(rockParts), rockMat);
    rocks.receiveShadow = true;
    rocks.castShadow = true;
    const rims = new THREE.Mesh(mergeGeometries(rimParts), rimMat);
    rims.receiveShadow = true;
    rims.castShadow = true;
    this.island.add(rocks, rims);
    this.applyTerrainTextures();
    this.rebuildDecor();

    // Häfen mit Stegen und Schildern
    this.harborLabels = [];
    for (const hb of state.board.harbors) {
      const dock = makeDock(hb, state.board, harborTexture(hb.type));
      this.harborLabels.push(dock.userData.label);
      this.island.add(dock);
      if (hb.type !== 'any') {
        resourceImage(hb.type, 160).then((img) => {
          if (!img) return;
          const { face } = dock.userData.label.userData;
          face.material.map = harborTexture(hb.type, img);
          face.material.needsUpdate = true;
        });
      }
    }
    this.setHarborLabels(this.harborsVisible !== false);

    this.robber = makeRobber();
    this.robberHex = null;
    this.island.add(this.robber);
  }

  // Gemalte Geländetexturen nacheinander erzeugen (je Art ein Bild), damit die Oberfläche flüssig bleibt
  async applyTerrainTextures() {
    const job = (this.texJob = (this.texJob || 0) + 1);
    const size = this.quality.tex;
    const needed = TERRAINS.filter((t) => this.slabTops.some((m) => m.userData.terrain === t));
    for (const terrain of needed) {
      await nextFrame();
      if (job !== this.texJob) return;
      const set = paintTerrain(terrain, size, { normalSize: Math.min(1024, size / 2), anisotropy: this.maxAniso });
      for (const m of this.slabTops) {
        if (m.userData.terrain !== terrain) continue;
        m.map = set.map;
        m.normalMap = set.normalMap;
        m.normalScale.set(1, 1);
        m.color.copy(m.userData.tint);
        m.roughness = terrain === 'mountains' ? 0.8 : 0.92;
        m.needsUpdate = true;
      }
    }
  }

  rebuildDecor() {
    this.disposeGroup(this.decorGroup);
    for (const m of buildDecor(this.board, this.quality.density)) this.decorGroup.add(m);
  }

  setHarborLabels(on) {
    this.harborsVisible = on;
    for (const l of this.harborLabels || []) l.visible = on;
  }

  disposeGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    }
  }

  // ---------- Figuren ----------

  sync(state, colorOf) {
    if (!this.board) return;
    const animate = this.synced;
    const seenV = new Set();
    for (const [vid, b] of Object.entries(state.buildings)) {
      const id = Number(vid);
      seenV.add(id);
      const cur = this.pieces.v.get(id);
      const sig = `${b.type}:${b.player}`;
      if (cur && cur.userData.sig === sig) continue;
      if (cur) this.removePiece(cur, animate);
      const v = this.board.vertices[vid];
      const mesh = b.type === 'city' ? this.makeCityTracked(colorOf(b.player)) : makeSettlement(colorOf(b.player));
      mesh.position.set(v.x, SURF, v.y);
      mesh.rotation.y = Math.atan2(v.x, v.y) + Math.PI / 2;
      mesh.userData.sig = sig;
      this.pieceGroup.add(mesh);
      this.pieces.v.set(id, mesh);
      if (animate) this.dropIn(mesh, v.x, v.y);
    }
    for (const [vid, mesh] of this.pieces.v) {
      if (!seenV.has(vid)) { this.removePiece(mesh, false); this.pieces.v.delete(vid); }
    }
    const seenE = new Set();
    for (const [eid, p] of Object.entries(state.roads)) {
      const id = Number(eid);
      seenE.add(id);
      if (this.pieces.e.has(id)) continue;
      const [a, b] = this.board.edges[eid].v.map((v) => this.board.vertices[v]);
      const mesh = makeRoad(colorOf(p), a, b);
      this.pieceGroup.add(mesh);
      this.pieces.e.set(id, mesh);
      if (animate) this.growRoad(mesh);
    }
    for (const [eid, mesh] of this.pieces.e) {
      if (!seenE.has(eid)) { this.pieceGroup.remove(mesh); this.pieces.e.delete(eid); }
    }
    if (this.robberHex !== state.robber) {
      const h = this.board.hexes[state.robber];
      const to = new THREE.Vector3(h.x - 0.5, SURF, h.y + 0.12);
      if (animate && this.robberHex !== null) this.hopRobber(to);
      else this.robber.position.copy(to);
      this.robberHex = state.robber;
    }
    this.synced = true;
  }

  makeCityTracked(color) {
    const city = makeCity(color);
    city.traverse((o) => { if (o.userData.flag) this.flags.push(o); });
    return city;
  }

  removePiece(mesh, animate) {
    const own = new Set();
    mesh.traverse((o) => own.add(o));
    this.flags = this.flags.filter((f) => !own.has(f));
    if (!animate) { this.pieceGroup.remove(mesh); return; }
    const start = performance.now();
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 250);
      mesh.scale.setScalar(Math.max(0.001, 1 - t));
      if (t >= 1) { this.pieceGroup.remove(mesh); return false; }
      return true;
    });
  }

  dropIn(obj, x, z) {
    const start = performance.now();
    const y0 = obj.position.y;
    obj.position.y = y0 + 0.8;
    let dusted = false;
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 650);
      obj.position.y = y0 + 0.8 * (1 - easeOutBounce(t));
      if (!dusted && t > 0.36) { dusted = true; this.dust(x, z, 10); }
      return t < 1;
    });
  }

  growRoad(mesh) {
    const start = performance.now();
    mesh.scale.set(0.001, 1, 1);
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 420);
      mesh.scale.x = Math.max(0.001, easeOutBack(t));
      return t < 1;
    });
    this.dust(mesh.position.x, mesh.position.z, 6);
  }

  hopRobber(to) {
    const from = this.robber.position.clone();
    const start = performance.now();
    const dist = from.distanceTo(to);
    let landed = false;
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 850);
      const e = easeInOut(t);
      this.robber.position.lerpVectors(from, to, e);
      this.robber.position.y = SURF + Math.sin(t * Math.PI) * (0.6 + dist * 0.25);
      this.robber.rotation.z = Math.sin(t * Math.PI * 2) * 0.15;
      if (!landed && t >= 1) { landed = true; this.dust(to.x, to.z, 14); }
      return t < 1;
    });
  }

  // Räuber erwacht: Augen glühen rot auf
  awakenRobber() {
    if (!this.robber) return;
    const { eyeMat, glow } = this.robber.userData;
    const start = performance.now();
    const y0 = this.robber.position.y;
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 2200);
      const k = Math.sin(t * Math.PI);
      eyeMat.color.setRGB(1, 0.78 - k * 0.6, 0.38 - k * 0.35);
      glow.scale.setScalar(0.22 + k * 0.25);
      this.robber.position.y = y0 + Math.abs(Math.sin(t * Math.PI * 4)) * 0.05 * (1 - t);
      return t < 1;
    });
  }

  robberPos() {
    return this.robber ? this.robber.position.clone() : new THREE.Vector3();
  }

  // ---------- Effekte ----------

  dust(x, z, count = 10, color = '#e8dcc0') {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fxTex.dust, color, transparent: true, depthWrite: false, opacity: 0.8 }));
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.35 + Math.random() * 0.3;
      s.position.set(x, SURF + 0.03, z);
      s.scale.setScalar(0.08);
      this.fxGroup.add(s);
      const start = performance.now();
      this.anims.push((now) => {
        const t = Math.min(1, (now - start) / 650);
        const e = easeOutCubic(t);
        s.position.set(x + Math.cos(a) * speed * e * 0.5, SURF + 0.03 + t * 0.12, z + Math.sin(a) * speed * e * 0.5);
        s.scale.setScalar(0.08 + t * 0.16);
        s.material.opacity = 0.8 * (1 - t);
        if (t >= 1) { this.fxGroup.remove(s); s.material.dispose(); return false; }
        return true;
      });
    }
  }

  // Leuchtende Feld-Überlagerung, z. B. für Hover
  setHexGlow(ids, color = '#fff3c4', strength = 0.22) {
    const set = new Set(ids || []);
    this.hexGlow.forEach((g, id) => {
      if (!g) return;
      g.userData.target = set.has(id) ? strength : 0;
      if (set.has(id)) g.userData.color.set(color);
    });
  }

  flashHexes(ids, color = '#ffd76a', dur = 1800) {
    const start = performance.now();
    const list = ids.map((id) => this.hexGlow[id]).filter(Boolean);
    for (const g of list) g.material.color.set(color);
    for (const id of ids) {
      if (this.tokens[id]) this.bounceToken(this.tokens[id]);
      const h = this.board.hexes[id];
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.95, 6, 1, Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(h.x, SURF + 0.02, h.y);
      this.fxGroup.add(ring);
      const rs = performance.now();
      this.anims.push((now) => {
        const t = Math.min(1, (now - rs) / 1100);
        ring.scale.setScalar(0.6 + t * 0.5);
        ring.material.opacity = 0.7 * (1 - t);
        if (t >= 1) { this.fxGroup.remove(ring); ring.geometry.dispose(); return false; }
        return true;
      });
    }
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / dur);
      const o = Math.sin(t * Math.PI) * 0.45;
      for (const g of list) g.material.opacity = Math.max(o, g.userData.target);
      return t < 1;
    });
  }

  bounceToken(tok) {
    const start = performance.now();
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 900);
      tok.position.y = SURF + 0.002 + Math.sin(t * Math.PI) * 0.18;
      tok.rotation.y = easeInOut(t) * Math.PI * 2;
      return t < 1;
    });
  }

  async resTexture(res, count) {
    const key = `${res}:${count}`;
    if (this.resTextures[key]) return this.resTextures[key];
    const img = await resourceImage(res, 160);
    const tex = canvasTex(160, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,248,225,0.95)');
      g.addColorStop(0.62, 'rgba(255,240,200,0.75)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      if (img) ctx.drawImage(img, 26, 22, 108, 108);
      if (count > 1) {
        ctx.fillStyle = '#3d6b2f';
        ctx.beginPath();
        ctx.arc(s - 34, 34, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 28px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`×${count}`, s - 34, 35);
      }
    });
    this.resTextures[key] = tex;
    return tex;
  }

  // Rohstoff-Symbole steigen von den Gebäuden auf
  async floatResources(items) {
    for (const [i, it] of items.entries()) {
      const tex = await this.resTexture(it.res, it.count);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
      s.renderOrder = 20;
      s.scale.setScalar(0.001);
      s.position.set(it.x, SURF + 0.25, it.z);
      this.fxGroup.add(s);
      const start = performance.now() + i * 90;
      this.anims.push((now) => {
        const t = Math.min(1, Math.max(0, (now - start) / 1700));
        s.position.y = SURF + 0.25 + easeOutCubic(t) * 0.55;
        s.scale.setScalar(t < 0.2 ? Math.max(0.001, easeOutBack(t / 0.2) * 0.42) : 0.42);
        s.material.opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        if (t >= 1) { this.fxGroup.remove(s); s.material.dispose(); return false; }
        return true;
      });
    }
  }

  // Feuerwerk über der Insel beim Sieg
  celebrate(colors = ['#ffd76a', '#ff7a59', '#7ad1ff', '#b2f27a']) {
    const start = performance.now();
    let next = 0;
    this.anims.push((now) => {
      const el = now - start;
      if (el > next && el < 6000) {
        next += 380 + Math.random() * 300;
        const cx = (Math.random() - 0.5) * 6;
        const cz = (Math.random() - 0.5) * 5;
        const cy = 1.8 + Math.random() * 1.2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 28; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fxTex.spark, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
          s.position.set(cx, cy, cz);
          s.scale.setScalar(0.12);
          this.fxGroup.add(s);
          const bs = performance.now();
          this.anims.push((n2) => {
            const t = Math.min(1, (n2 - bs) / 1300);
            s.position.set(cx + dir.x * t * 1.3, cy + dir.y * t * 1.3 - t * t * 0.8, cz + dir.z * t * 1.3);
            s.material.opacity = 1 - t;
            if (t >= 1) { this.fxGroup.remove(s); s.material.dispose(); return false; }
            return true;
          });
        }
      }
      return el < 7500;
    });
  }

  worldToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const { clientWidth: w, clientHeight: h } = this.container;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
  }

  // ---------- Ziele und Hologramme ----------

  setTargets(kind, ids = [], { hoverGhost = null } = {}) {
    const idSet = new Set(ids);
    this.hoverGhostSpec = hoverGhost;
    const same = kind === this.targets.kind && idSet.size === this.targets.ids.size && [...idSet].every((i) => this.targets.ids.has(i));
    if (same) return;
    this.disposeGroup(this.targetGroup);
    this.targets = { kind, ids: idSet };
    this.setHover(null);
    if (!kind || !this.board) return;
    const glow = new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 1, depthWrite: false });
    this.glowMat = glow;
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    if (kind === 'vertex') {
      const ring = new THREE.TorusGeometry(0.115, 0.026, 8, 28);
      const dot = new THREE.CircleGeometry(0.15, 24);
      const dotMat = new THREE.MeshBasicMaterial({ map: this.fxTex.spark, color: '#ffe9a8', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const id of idSet) {
        const v = this.board.vertices[id];
        const g = new THREE.Group();
        g.position.set(v.x, SURF + 0.03, v.y);
        const r = new THREE.Mesh(ring, glow);
        r.rotation.x = Math.PI / 2;
        const d = new THREE.Mesh(dot, dotMat);
        d.rotation.x = -Math.PI / 2;
        d.position.y = 0.005;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hitMat);
        hit.userData = { kind: 'vertex', id };
        g.add(r, d, hit);
        g.userData = { kind: 'vertex', id };
        this.targetGroup.add(g);
      }
    } else if (kind === 'edge') {
      const barGeo = new THREE.BoxGeometry(0.5, 0.05, 0.12);
      const hitGeo = new THREE.BoxGeometry(0.55, 0.2, 0.26);
      for (const id of idSet) {
        const e = this.board.edges[id];
        const [a, b] = e.v.map((v) => this.board.vertices[v]);
        const g = new THREE.Group();
        g.position.set((a.x + b.x) / 2, SURF + 0.02, (a.y + b.y) / 2);
        g.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.userData = { kind: 'edge', id };
        g.add(new THREE.Mesh(barGeo, glow), hit);
        g.userData = { kind: 'edge', id };
        this.targetGroup.add(g);
      }
    } else if (kind === 'hex') {
      const ringGeo = new THREE.RingGeometry(0.8, 0.94, 6, 1, Math.PI / 2);
      for (const id of idSet) {
        const h = this.board.hexes[id];
        const m = new THREE.Mesh(ringGeo, glow);
        m.rotation.x = -Math.PI / 2;
        m.position.set(h.x, SURF + 0.03, h.y);
        m.userData = { kind: 'hex', id };
        this.targetGroup.add(m);
      }
    }
  }

  // Bauvorschau: halbtransparente Hologramm-Figuren an allen bezahlbaren Plätzen
  setGhosts(list = [], color = '#ffffff') {
    const key = `${color}|${list.map((g) => `${g.piece}:${g.id}`).sort().join(',')}`;
    if (key === this.ghostKey || !this.board) return;
    this.ghostKey = key;
    this.hoverGhost = null;
    this.disposeGroup(this.ghostGroup);
    this.hoveredKey = undefined;
    for (const spec of list) {
      const holo = makeHologram(spec.piece, color, this.board, spec.id);
      this.ghostGroup.add(holo);
      const start = performance.now() + Math.random() * 220;
      holo.scale.setScalar(0.001);
      this.anims.push((now) => {
        const t = Math.min(1, Math.max(0, (now - start) / 380));
        holo.scale.setScalar(Math.max(0.001, easeOutBack(t)));
        return t < 1;
      });
    }
  }

  clearHoverGhost() {
    if (this.hoverGhost) {
      this.ghostGroup.remove(this.hoverGhost);
      this.hoverGhost = null;
    }
  }

  // ---------- Eingabe ----------

  bindEvents() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0 || this.panMode) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const hit = this.pick(e);
        if (hit) this.onPick(hit.kind, hit.id, hit.piece);
      }
      down = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      this.setHover(this.pick(e), e);
    });
    el.addEventListener('pointerleave', () => this.setHover(null));
    el.addEventListener('wheel', () => { this.userMoved = true; this.cancelCamera(); }, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) { this.keys.add(k); this.cancelCamera(); }
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objs = [...this.ghostGroup.children.filter((g) => g !== this.hoverGhost), ...this.targetGroup.children];
    if (objs.length) {
      const hits = this.raycaster.intersectObjects(objs, true);
      const h = hits.find((x) => x.object.userData.kind);
      if (h) return { ...h.object.userData };
    }
    if (this.targets.kind === 'hex') {
      const hits = this.raycaster.intersectObjects(this.hexTiles, false);
      const h = hits.find((x) => this.targets.ids.has(x.object.userData.id));
      return h ? { kind: 'hex', id: h.object.userData.id } : null;
    }
    return null;
  }

  setHover(hit, e) {
    const key = hit ? `${hit.kind}:${hit.id}:${hit.piece || ''}` : null;
    if (key !== this.hoveredKey) {
      this.hoveredKey = key;
      this.renderer.domElement.style.cursor = hit ? 'pointer' : '';
      for (const g of this.targetGroup.children) g.userData.hover = !!hit && g.userData.id === hit.id && g.userData.kind === hit.kind;
      for (const g of this.ghostGroup.children) {
        if (g.userData.mat) g.userData.mat.uniforms.uHover.value = hit && g.userData.id === hit.id && g.userData.piece === hit.piece ? 1 : 0;
      }
      // Angrenzende Felder eines Bauplatzes bzw. das Räuberziel hervorheben
      if (hit && hit.kind === 'vertex' && this.board) this.setHexGlow(this.board.vertices[hit.id].hexes, '#fff3c4', 0.18);
      else if (hit && hit.kind === 'hex') this.setHexGlow([hit.id], '#ff8a6a', 0.28);
      else this.setHexGlow([]);
      // Hologramm unter dem Mauszeiger (z. B. in der Gründungsphase)
      this.clearHoverGhost();
      if (hit && this.hoverGhostSpec && hit.kind === 'vertex' && !hit.piece && this.board) {
        this.hoverGhost = makeHologram(this.hoverGhostSpec.piece, this.hoverGhostSpec.color, this.board, hit.id);
        this.hoverGhost.userData.mat.uniforms.uHover.value = 1;
        this.ghostGroup.add(this.hoverGhost);
      }
    }
    if (hit && e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.onHover({ ...hit, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else if (!hit) {
      this.onHover(null);
    }
  }

  // ---------- Kamera ----------

  // lift: Ziel Richtung Kamera verschieben, damit der Fokus im Bild weiter oben erscheint
  viewFor(target, { dist = 5, polar = 0.75, azimuth = null, lift = 0 } = {}) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const az = azimuth ?? Math.atan2(off.x, off.z);
    const t = new THREE.Vector3(target.x + Math.sin(az) * lift, target.y ?? 0, target.z + Math.cos(az) * lift);
    const pos = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(dist).add(t);
    return { pos, target: t };
  }

  flyTo({ pos, target }, dur = 900) {
    this.cancelCamera(false);
    return new Promise((resolve) => {
      const fromP = this.camera.position.clone();
      const fromT = this.controls.target.clone();
      const start = performance.now();
      this.camAnim = {
        resolve,
        step: (now) => {
          const t = Math.min(1, (now - start) / dur);
          const e = easeInOut(t);
          this.camera.position.lerpVectors(fromP, pos, e);
          this.controls.target.lerpVectors(fromT, target, e);
          if (t >= 1) { this.camAnim = null; resolve(true); }
        },
      };
    });
  }

  // byUser: Eingabe des Spielers bricht laufende Kamerafahrten ab
  cancelCamera(byUser = true) {
    if (this.camAnim) {
      const r = this.camAnim.resolve;
      this.camAnim = null;
      r(false);
    }
    if (byUser) this.cinematicId = (this.cinematicId || 0) + 1;
  }

  // Im Hauptmenü steht die Insel so weit weg, dass sie ganz in den freien Raum neben den Menüflächen passt
  setMenuMode(on, freeWidth = 0) {
    const before = this.menuMode ? this.menuDist() : 0;
    this.menuMode = on;
    this.menuFree = freeWidth || this.menuFree || 0;
    const after = on ? this.menuDist() : 0;
    // Die Kamerasteuerung darf so weit zurück, sonst würde sie die Menü-Ansicht wieder heranziehen;
    // nach dem Verlassen gilt die normale Grenze erst, wenn die Kamera wieder angekommen ist
    if (on) this.controls.maxDistance = Math.max(this.controls.maxDistance, after + 1);
    const changed = (before > 0) !== on || (on && Math.abs(after - before) > 0.6);
    if (changed && !this.userMoved) this.flyTo(this.baseViewSpec(), on ? 1600 : 1100).then(() => { if (!this.menuMode) this.resize(); });
    else if (!on) this.resize();
  }

  menuDist() {
    const w = this.container.clientWidth || 1;
    const free = Math.max(260, Math.min(w, this.menuFree || w * 0.5));
    const halfH = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const d = (6 * w) / (2 * 0.58 * free * Math.tan(halfH));
    return Math.min(this.homeDist * 2.8, Math.max(this.homeDist, d));
  }

  baseViewSpec() {
    if (this.menuMode) {
      const dir = this.homePos.clone().sub(this.homeTarget).normalize();
      return { pos: dir.multiplyScalar(this.menuDist()), target: new THREE.Vector3(0, 0, 0) };
    }
    if (this.baseView === 'top') {
      const dist = this.topDist || this.homeDist;
      return { pos: new THREE.Vector3(0, dist, 0.6), target: new THREE.Vector3(0, 0, 0.1) };
    }
    return { pos: this.homePos.clone(), target: this.homeTarget.clone() };
  }

  setBaseView(kind, animate = true) {
    if (this.baseView === kind) return;
    this.baseView = kind;
    this.userMoved = false;
    const v = this.baseViewSpec();
    if (animate) this.flyTo(v, 1400);
    else {
      this.cancelCamera(false);
      this.camera.position.copy(v.pos);
      this.controls.target.copy(v.target);
    }
  }

  // Kamerafahrt: Stationen anfahren, dort etwas zeigen und zurück zur Ausgangsansicht
  async cinematic(stops) {
    const id = (this.cinematicId || 0) + 1;
    this.cinematicId = id;
    const back = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    const wasMoved = this.userMoved;
    for (const s of stops) {
      if (this.cinematicId !== id) return false;
      if (s.view) {
        const ok = await this.flyTo(s.view, s.dur || 800);
        if (!ok) return false;
      }
      if (s.action) await s.action();
      if (s.hold) await new Promise((r) => setTimeout(r, s.hold));
    }
    if (this.cinematicId !== id) return false;
    await this.flyTo(wasMoved ? back : this.baseViewSpec(), 900);
    return true;
  }

  trayView() {
    const p = this.tray.position;
    return this.viewFor({ x: p.x, y: p.y, z: p.z }, { dist: 3.3, polar: 0.62, azimuth: 0.35 });
  }

  hexesView(ids, lift = 0) {
    const hs = ids.map((i) => this.board.hexes[i]);
    const cx = hs.reduce((s, h) => s + h.x, 0) / hs.length;
    const cz = hs.reduce((s, h) => s + h.y, 0) / hs.length;
    const spread = Math.max(0, ...hs.map((h) => Math.hypot(h.x - cx, h.y - cz)));
    return this.viewFor({ x: cx, y: 0, z: cz }, { dist: 4.6 + spread * 1.3, polar: 0.72, lift });
  }

  pointView(x, z, dist = 3.6, lift = 0) {
    return this.viewFor({ x, y: 0, z }, { dist, polar: 0.7, lift });
  }

  getZoom() {
    const d = this.camera.position.distanceTo(this.controls.target);
    return 1 - (d - this.controls.minDistance) / (this.controls.maxDistance - this.controls.minDistance);
  }

  setZoom(f) {
    const c = this.controls;
    const d = c.maxDistance - Math.min(1, Math.max(0, f)) * (c.maxDistance - c.minDistance);
    const dir = this.camera.position.clone().sub(c.target).normalize();
    this.camera.position.copy(c.target).addScaledVector(dir, d);
    this.userMoved = true;
    c.update();
  }

  rotate(dir) {
    this.cancelCamera();
    const c = this.controls;
    const offset = this.camera.position.clone().sub(c.target);
    const start = performance.now();
    const total = (dir * Math.PI) / 4;
    let done = 0;
    this.userMoved = true;
    this.anims.push((now) => {
      const t = Math.min(1, (now - start) / 450);
      const step = total * easeOutCubic(t) - done;
      done += step;
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), step);
      this.camera.position.copy(c.target).add(offset);
      return t < 1;
    });
  }

  resetView() {
    this.cancelCamera();
    this.userMoved = false;
    this.flyTo(this.baseViewSpec(), 700);
  }

  setPanMode(on) {
    this.panMode = on;
    this.controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  // Bildausschnitt seitlich verschieben (z. B. damit die Insel im Hauptmenü im freien Raum steht)
  setViewShift(px = 0) {
    this.viewShift = px;
    this.applyViewShift();
  }

  applyViewShift() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (this.viewShift && w && h) this.camera.setViewOffset(w, h, -this.viewShift, 0, w, h);
    else this.camera.clearViewOffset();
  }

  // Langsame Umrundung, z. B. als Hintergrund des Startmenüs
  setOrbit(on) {
    this.orbiting = on;
  }

  // Hervorhebungsring für die geführte Inseltour
  showFocusRing(x, z, radius = 0.9) {
    this.clearFocusRing();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.fxTex.ring, transparent: true, depthWrite: false, depthTest: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, SURF + 0.06, z);
    m.renderOrder = 10;
    m.userData.base = radius;
    this.focusRing = m;
    this.fxGroup.add(m);
  }

  clearFocusRing() {
    if (this.focusRing) { this.fxGroup.remove(this.focusRing); this.focusRing = null; }
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
    this.camera.fov = aspect < 1 ? 50 : 38;
    this.camera.updateProjectionMatrix();
    this.applyViewShift();
    const halfH = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * aspect);
    const dist = Math.max(11.8, 5.6 / Math.tan(halfH));
    this.homeDist = dist;
    // Draufsicht: ganze Insel samt Häfen in Höhe und Breite
    const halfV = (this.camera.fov * Math.PI) / 360;
    this.topDist = Math.max(5.9 / Math.tan(halfV), 6.1 / Math.tan(halfH));
    // Etwas steiler als früher: Chips und Figuren bleiben aus der Grundansicht gut lesbar
    const dir = new THREE.Vector3(0, 8.9, 5.7).normalize();
    this.homePos = dir.multiplyScalar(dist).add(this.homeTarget);
    this.controls.maxDistance = Math.max(17, dist + 3, this.topDist + 1, this.menuMode ? this.menuDist() + 1 : 0);
    if (!this.userMoved && !this.camAnim && !this.orbiting) {
      const v = this.baseViewSpec();
      this.camera.position.copy(v.pos);
      this.controls.target.copy(v.target);
    }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = now / 1000;
    this.anims = this.anims.filter((fn) => fn(now) !== false);
    if (this.camAnim) this.camAnim.step(now);

    if (this.orbiting && !this.camAnim) {
      const off = this.camera.position.clone().sub(this.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.06);
      this.camera.position.copy(this.controls.target).add(off);
    }

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
        this.userMoved = true;
      }
    }

    if (this.scenery) {
      const u = this.water.userData;
      u.uniforms.uTime.value = time;
      u.normalMap.offset.set(time * 0.012, time * 0.008);
      this.clouds.userData.update(dt);
      this.placeBoats(time, dt);
      for (const f of this.flags) f.rotation.y = Math.sin(time * 3 + f.id) * 0.35;
    }

    // Ziele pulsieren
    const pulse = 1 + Math.sin(time * 4) * 0.1;
    if (this.glowMat) this.glowMat.color.setHSL(0.12, 1, 0.74 + Math.sin(time * 4) * 0.1);
    for (const g of this.targetGroup.children) {
      if (this.targets.kind === 'hex') g.material.opacity = 0.55 + Math.sin(time * 4) * 0.3;
      else g.scale.setScalar(g.userData.hover ? 1.4 : pulse);
    }
    for (const g of this.ghostGroup.children) {
      const d = g.userData;
      if (!d.mat) continue;
      d.mat.uniforms.uTime.value = time;
      d.model.position.y = d.base + (d.piece === 'road' ? 0.004 : 0.015) * Math.sin(time * 2.2 + d.phase) + (d.mat.uniforms.uHover.value ? 0.02 : 0);
      if (d.piece === 'city') d.model.rotation.y += dt * 0.4;
      if (d.piece === 'road') d.model.scale.x = 1 + Math.sin(time * 3 + d.phase) * 0.04;
      for (const sp of d.sparks || []) {
        const u = sp.userData;
        const f = (time * u.speed + u.phase) % 1;
        sp.position.set(u.x, 0.02 + f * u.height, u.z);
        sp.material.opacity = Math.sin(f * Math.PI) * (d.mat.uniforms.uHover.value ? 1 : 0.7);
      }
    }
    for (const g of this.hexGlow) {
      if (!g) continue;
      if (g.userData.target > 0 || g.material.opacity > 0) {
        if (g.userData.target > 0) g.material.color.lerp(g.userData.color, 0.2);
        g.material.opacity += (g.userData.target - g.material.opacity) * 0.12;
        if (g.material.opacity < 0.002) g.material.opacity = 0;
      }
      g.visible = g.material.opacity > 0;
    }
    if (this.focusRing) {
      const k = 1 + Math.sin(time * 3) * 0.05;
      const b = this.focusRing.userData.base;
      this.focusRing.scale.set(b * 2.4 * k, b * 1.9 * k, 1);
    }
    if (this.robber) this.robber.rotation.y = Math.sin(time * 0.6) * 0.35;
    for (const l of this.harborLabels || []) l.quaternion.copy(this.camera.quaternion);

    this.controls.update();
    // Nebel wandert mit der Kamera mit, damit die Insel auch aus der Ferne klar bleibt
    const camDist = this.camera.position.distanceTo(this.controls.target);
    this.scene.fog.near = Math.max(18, camDist * 1.1);
    this.scene.fog.far = Math.max(42, camDist * 2.6);
    if (this.onCamera) this.onCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
