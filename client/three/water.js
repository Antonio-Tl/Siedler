// Meer mit Flachwasser, Brandungslinien und Glitzern sowie ziehende Wolken.
import * as THREE from 'three';
import { canvasTex, mulberry, cloudTexture } from './textures.js';
import { WATER_Y } from './models.js';

function waterNormalMap() {
  const tex = canvasTex(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    const rnd = mulberry(99);
    let h = new Float32Array(s * s).map(() => rnd());
    for (let pass = 0; pass < 4; pass++) {
      const n = new Float32Array(s * s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const i = y * s + x;
        n[i] = (h[i] * 2 + h[((y + 1) % s) * s + x] + h[y * s + ((x + 1) % s)] + h[((y + s - 1) % s) * s + x] + h[y * s + ((x + s - 1) % s)]) / 6;
      }
      h = n;
    }
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const dx = (h[y * s + ((x + 1) % s)] - h[i]) * 10;
      const dy = (h[((y + 1) % s) * s + x] - h[i]) * 10;
      img.data[i * 4] = 128 + dx * 127;
      img.data[i * 4 + 1] = 128 + dy * 127;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 11);
  return tex;
}

export function createWater() {
  const normalMap = waterNormalMap();
  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: null },
    uExtent: { value: 20 },
    uCalm: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({
    color: '#1f8a86', roughness: 0.58, metalness: 0.02, normalMap, normalScale: new THREE.Vector2(0.09, 0.09),
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform float uTime; uniform sampler2D uShore; uniform float uExtent; uniform float uCalm;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 suv = vWPos.xz / uExtent + 0.5;
        float shore = texture2D(uShore, suv).r;
        float t = uTime * (1.0 - uCalm);
        float n = vnoise(vWPos.xz * 1.3 + t * 0.15) * 0.6 + vnoise(vWPos.xz * 3.1 - t * 0.2) * 0.4;
        // Farben in sRGB angeben und in den linearen Raum umrechnen
        vec3 deep = pow(vec3(0.06, 0.34, 0.35), vec3(2.2));
        vec3 mid = pow(vec3(0.11, 0.47, 0.46), vec3(2.2));
        vec3 shallow = pow(vec3(0.33, 0.7, 0.63), vec3(2.2));
        vec3 col = mix(deep, mid, smoothstep(0.1, 0.6, shore + n * 0.08));
        col = mix(col, shallow, smoothstep(0.62, 0.95, shore));
        // Brandungswellen, die zur Küste laufen
        float band = sin(shore * 30.0 - t * 1.6 + n * 5.0);
        float foam = smoothstep(0.93, 1.0, band) * smoothstep(0.78, 0.9, shore) * (1.0 - smoothstep(0.93, 1.0, shore)) * 0.35 * smoothstep(0.35, 0.65, n);
        foam += smoothstep(0.91, 0.975, shore) * (0.45 + 0.4 * n);
        col = mix(col, vec3(0.85, 0.9, 0.88), clamp(foam, 0.0, 1.0) * 0.7);
        // leichte Glanzflecken im offenen Wasser
        float glint = smoothstep(0.86, 1.0, vnoise(vWPos.xz * 6.0 + t * 0.6)) * (1.0 - shore) * 0.018;
        diffuseColor.rgb = col + glint;`);
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  water.userData = { uniforms, normalMap };
  return water;
}

export function createClouds() {
  const g = new THREE.Group();
  const rnd = mulberry(314);
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(i + 1), transparent: true, opacity: 0.55, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2;
    const s = 3 + rnd() * 4;
    m.scale.set(s, s * (0.5 + rnd() * 0.4), 1);
    const ang = rnd() * Math.PI * 2;
    const r = 6.5 + rnd() * 9;
    m.position.set(Math.cos(ang) * r, WATER_Y + 0.9 + rnd() * 0.8, Math.sin(ang) * r);
    m.renderOrder = 2;
    g.add(m);
    clouds.push({ m, speed: 0.08 + rnd() * 0.1 });
  }
  g.userData.update = (dt) => {
    for (const c of clouds) {
      c.m.position.x += c.speed * dt;
      if (c.m.position.x > 18) c.m.position.x = -18;
      // Wolken meiden das Spielfeld, damit die Insel frei bleibt
      const d = Math.hypot(c.m.position.x, c.m.position.z);
      c.m.material.opacity = 0.5 * Math.min(1, Math.max(0, (d - 5.5) / 2.5));
    }
  };
  return g;
}
