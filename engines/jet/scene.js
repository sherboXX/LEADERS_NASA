// 3D scene for gas-jet flames: a fuel nozzle standing in a square coflow duct, an
// igniter, a mesh electrode above the flame for E-FIELD Flames, and the flame itself.
// Scene units are centimetres; the flame field works in millimetres.
import * as THREE from 'three';
import { createVolume } from '../core/flame.js';
import { M, rod, v } from '../core/parts.js';

// Axisymmetric flame: p.y is height above the nozzle exit.
const FIELD = /* glsl */ `
uniform float uL, uW, uLift, uHot, uSoot, uSmoke, uG;
vec4 field(vec3 p) {
  float s = (p.y - uLift) / uL;
  if (s < -0.1 || s > 1.7) return vec4(0.0);
  float tt = uTime * (3.0 + 6.0 * uG);
  vec2 sway = (vec2(vnoise(vec3(p.y * 0.09 - tt, 1.3, 0.0)), vnoise(vec3(4.1, p.y * 0.09 - tt, 2.2))) - 0.5) * uG * max(s, 0.0) * 0.45 * uW;
  float r = length(p.xz + sway);
  float sc = clamp(s, 0.0, 1.0);
  float rf = 0.95 * uW * pow(sc, 0.38) * pow(1.0 - sc, 0.55) + 0.4;   // wide body, closed tip
  float d = (r - rf) / (0.45 + 0.05 * uW);
  float base = smoothstep(-0.07, 0.04, s);
  float tip = 1.0 - smoothstep(0.93, 1.06, s);
  vec3 e = vec3(0.14, 0.34, 1.0) * exp(-d * d) * uHot * 0.2 * base * tip * (1.0 - 0.7 * min(uSoot, 1.0) * smoothstep(0.25, 0.8, s));
  float inside = smoothstep(rf, rf * 0.4, r) * smoothstep(0.16, 0.5, s) * tip;
  e += mix(vec3(1.0, 0.72, 0.25), vec3(1.0, 0.4, 0.05), sc) * inside * uSoot * uHot * 0.055;
  // soot leaving through the tip: a dull red streak, then dark smoke
  float core = exp(-r * r / (0.06 * uW * uW + 1.0));
  float streak = core * smoothstep(0.86, 1.05, s) * (1.0 - smoothstep(1.1, 1.65, s));
  e += vec3(0.75, 0.17, 0.03) * streak * uSmoke * uHot * 0.3;
  float a = (streak * 0.5 + exp(-r * r / (0.2 * uW * uW + 2.0)) * smoothstep(1.0, 1.3, s) * 0.14) * uSmoke * uHot;
  return vec4(e, a);
}`;

export function createScene(stage, S, getPlan, exp) {
  const scene = stage.scene;
  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x10151d, 0.9));
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.2);
  key.position.set(-5, 8, 9);
  const light = new THREE.PointLight(0x5b8dff, 0, 0, 2);
  scene.add(key, light);
  const steel = M.steel();
  const half = 3.8;      // the SPICE duct is 76 mm square
  const bot = -2.5;
  const top = 15;
  for (const [x, z] of [[-half, -half], [half, -half], [half, half], [-half, half]]) scene.add(rod(v(x, bot, z), v(x, top, z), 0.07, steel, 8));
  for (const y of [bot, top]) {
    const c = [v(-half, y, -half), v(half, y, -half), v(half, y, half), v(-half, y, half)];
    c.forEach((a, i) => scene.add(rod(a, c[(i + 1) % 4], 0.07, steel, 8)));
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * half, top - bot, 2 * half),
    new THREE.MeshBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.03, side: THREE.BackSide, depthWrite: false }));
  glass.position.y = (top + bot) / 2;
  scene.add(glass);
  // nozzle, widened so it can be seen; its bore follows the nozzle setting
  const nozzle = rod(v(0, bot, 0), v(0, 0, 0), 0.16, steel, 16, 0.1);
  scene.add(nozzle, rod(v(0, bot - 0.4, 0), v(0, bot, 0), 0.5, M.anodized(), 20));
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.9, roughness: 0.5, emissive: 0xff4a12, emissiveIntensity: 0 });
  const igniter = new THREE.Group();
  igniter.add(rod(v(0.25, 0.3, 0), v(2.6, 0.3, 0), 0.03, wireMat, 8), rod(v(2.6, 0.3, 0), v(half, 0.3, 0), 0.06, steel, 8));
  scene.add(igniter);
  // mesh electrode (E-FIELD Flames only)
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: 0xb8892b, metalness: 0.9, roughness: 0.4, wireframe: true, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 9.5;
  mesh.visible = exp.id === 'efield';
  scene.add(mesh);

  // coflow air
  const N = 140;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 2 * half, bot + Math.random() * (top - bot), (Math.random() - 0.5) * 2 * half], i * 3);
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const air = new THREE.Points(airGeo, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }));
  scene.add(air);

  const f0 = () => ({ value: 0 });
  const vol = createVolume({ field: FIELD, steps: stage.coarse ? 40 : 56,
    uniforms: { uL: { value: 30 }, uW: { value: 8 }, uLift: f0(), uHot: f0(), uSoot: f0(), uSmoke: f0(), uG: f0() } });
  stage.addVolume(vol);
  stage.controls.target.set(0, 5, 0);

  const center = new THREE.Vector3();
  const origin = new THREE.Vector3(0, 0, 0);
  const tint = new THREE.Color();
  let live = { hot: 0, length: 0, lift: 0 };
  stage.addLabel('Fuel nozzle', (o) => o.set(0.2, -1.2, 0), { side: 'left' });
  stage.addLabel('Flame', (o) => o.set(live.width / 20, (live.lift + live.length * 0.45) / 10, 0), { when: () => live.hot > 0.3 });
  stage.addLabel('Soot escaping', (o) => o.set(0.2, (live.lift + live.length * 1.25) / 10, 0), { when: () => live.hot > 0.5 && getPlan().smoke > 0.15 });
  stage.addLabel('Lifted off the nozzle', (o) => o.set(-0.2, live.lift / 20, 0), { when: () => live.hot > 0.3 && live.lift > 3, side: 'left' });
  stage.addLabel('Mesh electrode', (o) => o.set(2.6, 9.5, 0), { when: () => mesh.visible });
  stage.addLabel('Air flows upward', (o) => o.set(-half, bot + 1, half), { when: () => S.air > 1, side: 'left' });

  return {
    draw(st, dt) {
      live = st;
      const p = getPlan();
      const reach = (st.lift + st.length * 1.7) / 10;
      center.set(0, reach / 2, 0);
      vol.place(center, Math.max(reach / 2, st.width / 10) + 0.6, origin);
      vol.mesh.visible = st.hot > 0.01;
      const U = vol.uniforms;
      U.uL.value = st.length; U.uW.value = st.width; U.uLift.value = st.lift; U.uHot.value = st.hot;
      U.uSoot.value = p.soot; U.uSmoke.value = p.smoke; U.uG.value = Math.max(p.pull, 0);
      igniter.position.x = st.t < 0.6 ? 0 : 3;          // swings clear once the flame is lit
      wireMat.emissiveIntensity = st.ign * 6;
      tint.setHex(0x5b8dff).lerp(new THREE.Color(0xffa044), Math.min(p.soot, 1));
      light.color.copy(tint);
      light.position.set(0, (st.lift + st.length * 0.5) / 10, 1.2);
      light.intensity = st.hot * (2 + 8 * p.soot);
      nozzle.scale.x = nozzle.scale.z = 0.7 + S.nozzle * 0.5;
      const rise = (S.air + 30 * Math.sqrt(S.g)) * dt * 0.1;   // slowed 10x so it reads as a drift
      const a = airGeo.attributes.position;
      for (let i = 0; i < N; i++) { let y = a.getY(i) + rise; if (y > top) y = bot; a.setY(i, y); }
      a.needsUpdate = true;
      air.visible = S.air + S.g > 0.5;
    },
  };
}
