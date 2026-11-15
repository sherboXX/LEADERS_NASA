// 3D scene for burner flames: a porous sphere (or, for BRE, a flat disc) on a feed tube
// inside the Combustion Integrated Rack chamber, an igniter, and the flame ball.
// Scene units are centimetres; the flame field works in millimetres.
import * as THREE from 'three';
import { createVolume } from '../core/flame.js';
import { M, rod, v, cirChamber } from '../core/parts.js';
import { BURNER } from './model.js';

const FIELD = /* glsl */ `
uniform float uRf, uTh, uHot, uSoot, uCool, uG, uDome, uRb, uOut;
vec4 field(vec3 p) {
  if (uDome > 0.5 && p.y < -0.4) return vec4(0.0);
  vec3 q = p;
  float up = 0.0;
  if (uG > 0.002) {                       // buoyancy: stretch upward, taper, flicker
    up = max(p.y / uRf, 0.0);
    float tt = uTime * (2.5 + 4.0 * uG);
    q.x += (vnoise(vec3(p.x * 0.16, p.y * 0.14 - tt, p.z * 0.16)) - 0.5) * uG * up * uRf * 0.55;
    q.y = p.y > 0.0 ? p.y / (1.0 + 3.0 * uG) : p.y * (1.0 + 0.25 * uG);
    q.xz *= 1.0 + 0.8 * uG * up * up / (1.0 + up);
  }
  if (uDome > 0.5) q.y *= 1.3;            // a low dome over the disc
  float r = length(q);
  float lift = clamp(uG * up * 1.4, 0.0, 1.0);
  float s = (r - uRf) / uTh;
  vec3 e = vec3(0.14, 0.34, 1.0) * exp(-s * s) * uHot * 0.22 * (1.0 - 0.75 * lift);
  // soot glows on the fuel side of the sheet: inside it normally, outside it for an inverse flame
  float x = uOut > 0.5 ? clamp((r - uRf) / (0.7 * uRf), 0.0, 1.0) : 1.0 - clamp((r - uRb) / max(uRf - uRb, 0.05), 0.0, 1.0);
  float band = smoothstep(0.04, 0.2, x) * (1.0 - smoothstep(0.3, 0.75, x));
  e += mix(vec3(1.0, 0.62, 0.16), vec3(1.0, 0.3, 0.02), x) * band * uSoot * uHot * 0.075 * (1.0 + 3.0 * lift);
  float cs = (r - uRf * 0.85) / (uTh * 2.4);
  e += vec3(0.42, 0.24, 1.0) * exp(-cs * cs) * uCool * 0.1;
  return vec4(e * smoothstep(uRb * 0.95, uRb * 1.25, length(p)), 0.0);
}`;

export function createScene(stage, S, getPlan, exp) {
  const scene = stage.scene;
  const disc = exp.id === 'bre';
  const chamber = cirChamber();
  chamber.position.y = 2;
  scene.add(chamber, new THREE.HemisphereLight(0x9db4d6, 0x10151d, 0.7));
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  key.position.set(-5, 9, 7);
  const light = new THREE.PointLight(0x5b8dff, 0, 0, 2);
  scene.add(key, light);
  const steel = M.steel();
  const porous = new THREE.MeshStandardMaterial({ color: 0x6d5a3a, metalness: 0.5, roughness: 0.9, emissive: 0xff5a1a, emissiveIntensity: 0 });
  const head = disc ? new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.5, 40), porous) : new THREE.Mesh(new THREE.SphereGeometry(BURNER / 10, 32, 20), porous);
  if (disc) head.position.y = -0.25;
  scene.add(head, rod(v(0, -8, 0), v(0, disc ? -0.5 : -BURNER / 10, 0), disc ? 0.3 : 0.09, steel, 12));
  // thin fibre that glows where the flame crosses it: the experiment's thermometer
  const fibre = rod(v(-6, 0.9, 0), v(6, 0.9, 0), 0.006, new THREE.MeshBasicMaterial({ color: 0x353b46 }), 6);
  scene.add(fibre);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const glows = [-1, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), glowMat); m.scale.x = 4; scene.add(m); return m; });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.9, roughness: 0.5, emissive: 0xff4a12, emissiveIntensity: 0 });
  const igniter = new THREE.Group();
  igniter.add(rod(v(0.45, 0.2, 0.4), v(1.1, 0.2, 0.4), 0.02, wireMat, 8), rod(v(1.1, 0.2, 0.4), v(7, -1.5, 3), 0.05, steel, 8));
  scene.add(igniter);

  const f0 = () => ({ value: 0 });
  const vol = createVolume({ field: FIELD, steps: stage.coarse ? 40 : 56,
    uniforms: { uRf: { value: 10 }, uTh: { value: 0.5 }, uHot: f0(), uSoot: f0(), uCool: f0(), uG: f0(), uDome: { value: disc ? 1 : 0 }, uRb: { value: BURNER }, uOut: f0() } });
  stage.addVolume(vol);
  stage.controls.maxPolarAngle = Math.PI * 0.62;

  const center = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upv = new THREE.Vector3();
  const tint = new THREE.Color();
  const AMBER = new THREE.Color(0xffa044);
  const sm = { r: BURNER, hot: 0, cool: 0, g: S.g };
  let snap = true;
  const rim = (o, radius, sx, sy) => o.set(0, 0, 0).addScaledVector(right, sx * radius).addScaledVector(upv, sy * radius);
  stage.addLabel(disc ? 'Burner disc' : 'Porous burner', (o) => o.set(0, disc ? -0.4 : -0.5, 0), { side: 'left' });
  stage.addLabel('Flame', (o) => rim(o, sm.r / 10, 0.72, 0.72), { when: () => sm.hot > 0.12 && sm.g < 0.05 });
  stage.addLabel('Cool flame (invisible, drawn enhanced)', (o) => rim(o, sm.r * 0.085, 0.72, 0.72), { when: () => sm.cool > 0.25 });
  stage.addLabel('Glowing fibre', (o) => o.set(-sm.r / 10, 0.9, 0), { when: () => sm.hot > 0.3 && sm.r > 11 && !disc, side: 'left' });

  return {
    snap() { snap = true; },
    draw(st, dt) {
      const p = getPlan();
      const a = snap ? 1 : 1 - Math.exp(-dt / 0.07);
      if (snap) { sm.g = S.g; snap = false; }
      sm.r += (st.r - sm.r) * a; sm.hot += (st.hot - sm.hot) * a; sm.cool += (st.cool - sm.cool) * a;
      sm.g += (S.g - sm.g) * (1 - Math.exp(-dt / 0.3));
      right.setFromMatrixColumn(stage.camera.matrixWorld, 0);
      upv.setFromMatrixColumn(stage.camera.matrixWorld, 1);
      const th = 0.25 + 0.02 * sm.r + 0.5 * sm.g;
      const top = sm.r * (1 + 3 * sm.g);
      const reach = (p.inverse ? 1.75 : 1) * sm.r;
      center.set(0, (top - sm.r) / 20, 0);
      vol.place(center, (Math.max(reach, (top + sm.r) / 2) + 4 * th + 0.6 * sm.g * sm.r) / 10, origin);
      vol.mesh.visible = sm.hot + sm.cool > 0.004;
      const U = vol.uniforms;
      U.uRf.value = sm.r; U.uTh.value = th; U.uHot.value = sm.hot; U.uSoot.value = p.sootiness; U.uCool.value = sm.cool;
      U.uG.value = sm.g; U.uOut.value = p.inverse ? 1 : 0;
      igniter.position.set(st.t < 0.6 ? 0 : 2.5, 0, st.t < 0.6 ? 0 : 1.5);
      wireMat.emissiveIntensity = st.ign * 6;
      porous.emissiveIntensity = Math.min(sm.hot * 0.5, 0.6);
      tint.setHex(st.phase === 'cool' ? 0x9a7bff : 0x5b8dff).lerp(AMBER, st.phase === 'cool' ? 0 : Math.min(p.sootiness * 1.4, 1));
      light.color.copy(tint);
      light.intensity = sm.hot * (3 + 9 * p.sootiness) + sm.cool * 1.5;
      const lit = sm.hot > 0.05 && sm.r > 9 && !disc;      // the fibre sits 9 mm above the centre
      const half = Math.sqrt(Math.max(sm.r * sm.r - 81, 0)) / 10;
      glows.forEach((g, i) => { g.visible = lit; g.position.set((i ? 1 : -1) * half, 0.9, 0); });
      const glow = sm.hot * (2.5 + 3 * p.sootiness);
      glowMat.color.setRGB(glow, glow * 0.5, glow * 0.12);
      fibre.visible = !disc;
    },
  };
}
