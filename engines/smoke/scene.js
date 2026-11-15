// 3D scene for the smoke engine: a heated sample at one end of a duct, smoke particles
// carried (or not) toward two detectors at the other end. Scene units are centimetres.
import * as THREE from 'three';
import { M, rod, box, v, coil } from '../core/parts.js';
import { MATERIALS, DISTANCE } from './model.js';

const N = 900;

export function createScene(stage, S, getPlan) {
  const scene = stage.scene;
  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x10151d, 1.0));
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.3);
  key.position.set(-10, 20, 30);
  scene.add(key);
  const steel = M.steel();
  const anod = M.anodized();
  const X0 = -DISTANCE / 2;      // sample
  const X1 = DISTANCE / 2;       // detectors
  const H = 14;                  // half height and half depth of the duct

  // duct frame
  for (const y of [-H, H]) for (const z of [-H, H]) scene.add(rod(v(X0 - 12, y, z), v(X1 + 10, y, z), 0.25, steel, 8));
  for (const x of [X0 - 12, X1 + 10]) {
    const c = [v(x, -H, -H), v(x, H, -H), v(x, H, H), v(x, -H, H)];
    c.forEach((a, i) => scene.add(rod(a, c[(i + 1) % 4], 0.25, steel, 8)));
  }
  // heater: a coil of wire around a small sample
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.9, roughness: 0.5, emissive: 0xff4a12, emissiveIntensity: 0 });
  const sampleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const sample = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 5, 20), sampleMat);
  sample.position.set(X0, 0, 0);
  scene.add(sample, coil(v(X0, -2.6, 0), v(X0, 2.6, 0), 1.25, 9, 0.16, coilMat), box(3, 1, 3, anod, X0, -H + 0.5, 0), rod(v(X0, -H + 1, 0), v(X0, -2.6, 0), 0.25, steel, 8));
  // the two detectors, each with a status lamp
  const lamp = () => new THREE.MeshBasicMaterial({ color: 0x38d98a });
  const ionLamp = lamp();
  const scatLamp = lamp();
  const detector = (y, mat) => {
    scene.add(box(7, 7, 9, M.steel({ color: 0x5d6673, roughness: 0.6 }), X1, y, 0), box(0.4, 5, 7, M.anodized({ color: 0x0d1118 }), X1 - 3.6, y, 0));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat);
    led.position.set(X1 - 3.7, y + 2.3, 3.2);
    scene.add(led);
  };
  detector(6, ionLamp);
  detector(-6, scatLamp);

  // smoke
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const age = new Float32Array(N).fill(1e9);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const g2 = dot.getContext('2d');
  const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 64, 64);
  const smokeMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), color: 0xc9d2de, size: 2, transparent: true, opacity: 0.35, depthWrite: false });
  const smoke = new THREE.Points(geo, smokeMat);
  smoke.frustumCulled = false;
  scene.add(smoke);
  const park = (i) => { pos[i * 3] = 0; pos[i * 3 + 1] = -500; pos[i * 3 + 2] = 0; age[i] = 1e9; };
  for (let i = 0; i < N; i++) park(i);
  let next = 0;
  let debt = 0;
  let live = { emit: 0, ionAlarm: false, scatterAlarm: false };
  const life = 26;

  stage.controls.target.set(0, 0, 0);
  stage.addLabel('Heated sample', (o) => o.set(X0, 3, 0), { side: 'left' });
  stage.addLabel('Ionisation detector', (o) => o.set(X1, 9.5, 0));
  stage.addLabel('Light-scattering detector', (o) => o.set(X1, -9.5, 0));
  stage.addLabel('Smoke', (o) => o.set(X0 + 6, 5, 0), { when: () => live.cloud > 0.25 });

  return {
    snap() { for (let i = 0; i < N; i++) park(i); },
    draw(st, dt) {
      live = st;
      const p = getPlan();
      sampleMat.color.setHex(MATERIALS[S.material].color);
      coilMat.emissiveIntensity = p.dusty ? 0 : st.heat * Math.min(S.heat / 120, 6);
      ionLamp.color.setHex(st.ionAlarm ? 0xff3b2e : 0x38d98a);
      scatLamp.color.setHex(st.scatterAlarm ? 0xff3b2e : 0x38d98a);
      smokeMat.size = 1.2 + Math.min(p.d, 900) / 110;
      smokeMat.opacity = p.dusty ? 0.6 : 0.34;

      const step = Math.min(dt, 0.05) * (S.playing ? Math.max(1, (p.lapse || 1) * S.speed * 0.5) : 0);
      debt += st.emit * 60 * step;
      while (debt >= 1) {
        debt -= 1;
        const i = next;
        next = (next + 1) % N;
        const a = Math.random() * 6.283;
        pos[i * 3] = X0 + Math.cos(a) * 1.4; pos[i * 3 + 1] = (Math.random() - 0.5) * 4; pos[i * 3 + 2] = Math.sin(a) * 1.4;
        vel[i * 3] = Math.cos(a) * 1.2; vel[i * 3 + 1] = (Math.random() - 0.5) * 1.2; vel[i * 3 + 2] = Math.sin(a) * 1.2;
        age[i] = 0;
      }
      const drift = S.v;                 // fan, cm/s along the duct
      const rise = 14 * S.g;             // buoyant rise, cm/s
      for (let i = 0; i < N; i++) {
        if (age[i] > life) continue;
        age[i] += step;
        const k = i * 3;
        vel[k] += (drift - vel[k]) * Math.min(1, step * 1.5) + (Math.random() - 0.5) * 3 * step;
        vel[k + 1] += (rise - vel[k + 1]) * Math.min(1, step * 1.5) + (Math.random() - 0.5) * 3 * step;
        vel[k + 2] += -vel[k + 2] * Math.min(1, step) + (Math.random() - 0.5) * 3 * step;
        pos[k] += vel[k] * step; pos[k + 1] += vel[k + 1] * step; pos[k + 2] += vel[k + 2] * step;
        if (pos[k + 1] > H - 0.6) { pos[k + 1] = H - 0.6; vel[k] += (4 * S.g) * step * 8; } // rising smoke spreads along the ceiling
        if (pos[k] > X1 - 3.5 || age[i] > life || Math.abs(pos[k + 2]) > H) park(i);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
