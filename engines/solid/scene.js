// 3D scene for flame spread over a solid sheet: a flow duct with the sample held upright,
// air entering from below, an igniter wire, the charring sample and the flame.
// Scene units are centimetres; the flame field works in millimetres.
import * as THREE from 'three';
import { createVolume } from '../core/flame.js';
import { M, rod, v } from '../core/parts.js';
import { MATERIALS } from './model.js';

// p.y runs along the flow from the base of the flame, p.z is the distance from the sheet.
const FIELD = /* glsl */ `
uniform float uLf, uHalfW, uHot, uSoot, uG, uStand;
vec4 field(vec3 p) {
  float s = p.y / uLf;
  if (s < -0.06 || s > 1.2) return vec4(0.0);
  float across = smoothstep(uHalfW + 2.0, uHalfW - 4.0, abs(p.x));
  float ends = smoothstep(-0.05, 0.1, s) * (1.0 - smoothstep(0.78, 1.15, s));
  float wob = (vnoise(vec3(p.x * 0.07, p.y * 0.05 - uTime * (1.5 + 5.0 * uG), 3.0)) - 0.5) * (0.8 + 3.0 * uG) * s;
  float h = uStand * (0.3 + 1.25 * sqrt(max(s, 0.0))) * (1.0 - 0.6 * smoothstep(0.7, 1.12, s)) + wob;
  float d = (abs(p.z) - h) / (0.8 + 0.22 * h);
  vec3 e = vec3(0.14, 0.34, 1.0) * exp(-d * d) * uHot * 0.2 * (1.0 - 0.6 * s * uSoot);
  float inner = smoothstep(h, h * 0.3, abs(p.z)) * smoothstep(0.12, 0.5, s);
  e += mix(vec3(1.0, 0.36, 0.04), vec3(1.0, 0.66, 0.2), s) * inner * uSoot * uHot * 0.06;
  return vec4(e * across * ends, 0.0);
}`;

const SHEET_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// The sheet: fresh material ahead of the front, a glowing edge at it, char behind it.
const SHEET_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFront, uDown, uGlow;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float along = mix(vUv.y, 1.0 - vUv.y, uDown);
  float edge = uFront + (hash(floor(vUv * vec2(40.0, 6.0))) - 0.5) * 0.012;
  float burned = smoothstep(edge + 0.004, edge - 0.004, along);
  vec2 g = abs(fract(vUv * vec2(26.0, 60.0)) - 0.5);
  float weave = 0.86 + 0.14 * smoothstep(0.5, 0.3, max(g.x, g.y));
  vec3 fresh = uColor * weave * 0.55;
  vec3 char = vec3(0.045, 0.04, 0.038) + 0.05 * smoothstep(0.42, 0.5, max(g.x, g.y));
  vec3 col = mix(fresh, char, burned);
  col += vec3(1.0, 0.32, 0.05) * exp(-abs(along - edge) * 160.0) * uGlow * 2.2;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createScene(stage, S, getPlan) {
  const scene = stage.scene;
  const plan0 = getPlan();
  const L = plan0.len / 10;          // cm
  const W = plan0.width / 10;
  const half = Math.max(W * 0.5 + 2.2, 3.8);
  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x10151d, 0.9));
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.2);
  key.position.set(-4, 6, 9);
  const light = new THREE.PointLight(0xffa044, 0, 0, 2);
  scene.add(key, light);

  // duct: four posts, top and bottom frames, faint glass walls
  const steel = M.steel();
  const top = L / 2 + 0.25 * L + 1.5;
  const bot = -L / 2 - 0.2 * L - 1.5;
  for (const [x, z] of [[-half, -half], [half, -half], [half, half], [-half, half]]) scene.add(rod(v(x, bot, z), v(x, top, z), 0.08 + L * 0.004, steel, 8));
  for (const y of [bot, top]) {
    const c = [v(-half, y, -half), v(half, y, -half), v(half, y, half), v(-half, y, half)];
    c.forEach((a, i) => scene.add(rod(a, c[(i + 1) % 4], 0.08 + L * 0.004, steel, 8)));
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * half, top - bot, 2 * half),
    new THREE.MeshBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.035, side: THREE.BackSide, depthWrite: false }));
  glass.position.y = (top + bot) / 2;
  scene.add(glass);
  // sample holder rails
  for (const x of [-W / 2 - 0.12, W / 2 + 0.12]) scene.add(rod(v(x, -L / 2 - 0.6, 0), v(x, L / 2 + 0.6, 0), 0.06 + L * 0.002, M.anodized(), 8));

  const sheetMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uFront: { value: 0 }, uDown: { value: 0 }, uGlow: { value: 0 } } });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, L), sheetMat);
  scene.add(sheet);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.9, roughness: 0.5, emissive: 0xff4a12, emissiveIntensity: 0 });
  const wire = rod(v(-W / 2 - 0.3, 0, 0.12), v(W / 2 + 0.3, 0, 0.12), 0.03 + L * 0.0015, wireMat, 8);
  scene.add(wire);

  // air drifting up the duct
  const N = 160;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 2 * half, bot + Math.random() * (top - bot), (Math.random() - 0.5) * 2 * half], i * 3);
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const air = new THREE.Points(airGeo, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.05 + L * 0.004, transparent: true, opacity: 0.5, depthWrite: false }));
  scene.add(air);

  const f0 = () => ({ value: 0 });
  const vol = createVolume({ field: FIELD, steps: stage.coarse ? 36 : 52,
    uniforms: { uLf: { value: 10 }, uHalfW: { value: W * 5 }, uHot: f0(), uSoot: f0(), uG: f0(), uStand: { value: 4 } } });
  stage.addVolume(vol);
  stage.controls.target.set(0, 0, 0);

  const center = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let frontY = -L / 2;
  let baseY = -L / 2;
  let live = { hot: 0, ign: 0 };
  stage.addLabel('Sample', (o) => o.set(W / 2, L * 0.32, 0));
  stage.addLabel('Igniter wire', (o) => o.copy(wire.position), { when: () => live.ign > 0.05, side: 'left' });
  stage.addLabel('Flame', (o) => o.set(W / 2, baseY + getPlan().flame / 20, 0.4), { when: () => live.hot > 0.15 });
  stage.addLabel('Char', (o) => o.set(-W / 2, (frontY + (S.dir === 'with' ? -L / 2 : L / 2)) / 2, 0), { when: () => live.burned > 0.12, side: 'left' });
  stage.addLabel('Air flows upward', (o) => o.set(-half, bot + 1, half), { when: () => S.v > 0.5, side: 'left' });

  return {
    draw(st, dt) {
      live = st;
      const p = getPlan();
      const up = S.dir === 'with';                       // the flame spreads with the flow (upward) or against it (downward)
      sheetMat.uniforms.uColor.value.setHex(MATERIALS[S.material].color);
      sheetMat.uniforms.uFront.value = st.burned;
      sheetMat.uniforms.uDown.value = up ? 0 : 1;
      sheetMat.uniforms.uGlow.value = st.hot;
      frontY = up ? -L / 2 + st.front / 10 : L / 2 - st.front / 10;
      wire.position.y = up ? -L / 2 + 0.15 : L / 2 - 0.15;
      wireMat.emissiveIntensity = st.ign * 6;

      const lf = Math.max(st.flame, 3) / 10;             // cm
      baseY = up ? frontY - 0.5 * lf : frontY - 0.1 * lf; // the flame always trails off downstream (upward)
      origin.set(0, baseY, 0);
      center.set(0, baseY + lf * 0.55, 0);
      vol.place(center, Math.hypot(lf * 0.7, W / 2 + 0.6) + 0.8, origin);
      vol.mesh.visible = st.hot > 0.01;
      const U = vol.uniforms;
      U.uLf.value = lf * 10; U.uHot.value = st.hot; U.uSoot.value = p.soot; U.uG.value = S.g;
      U.uStand.value = (2.4 + 3.2 / (1 + p.veff / 12)) * Math.sqrt(p.width / 20);
      light.position.set(0, baseY + lf * 0.5, 1.5 + W * 0.2);
      light.intensity = st.hot * (4 + 14 * p.soot) * (1 + W * 0.5);

      const speed = (S.v + 30 * Math.sqrt(S.g)) / 100 * 100 * dt * 0.1; // cm per frame, slowed 10x so it reads as a drift
      const a = airGeo.attributes.position;
      for (let i = 0; i < N; i++) { let y = a.getY(i) + speed; if (y > top) y = bot; a.setY(i, y); }
      a.needsUpdate = true;
      air.visible = S.v + S.g > 0.01;
    },
  };
}
