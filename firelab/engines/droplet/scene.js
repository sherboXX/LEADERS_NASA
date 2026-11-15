// 3D scene of the droplet engine, modelled on NASA's flight video of FLEX: the polished
// igniter arms with hairpin wire loops, the Z-shaped fibre frame, the machined backplate
// with red cable loops behind an arched window, chamber lights that go off for the burn,
// the camera's round viewing port and its sensor speckle. The flame goes through the
// same looks as on the video: an almond-shaped kernel between the igniters, a white-hot
// ball while soot glows, then a thin blue bubble with a pale soot ring inside.
// Scene units are centimetres; the flame field works in millimetres.
import * as THREE from 'three';
import { createVolume } from '../core/flame.js';
import { M, rod, v, cirChamber } from '../core/parts.js';
import { lerp } from '../core/ui.js';
import { SETUP, stateAt, clamp } from './model.js';

// Light emitted (rgb) and absorbed (a) per millimetre around the droplet.
const FIELD = /* glsl */ `
uniform float uRf, uTh, uHot, uSoot, uRs, uRd, uCool, uCoolR, uG, uFlash, uVap, uVapR, uStretch, uShell, uCloud, uGain, uGlow, uSooty;
uniform vec3 uAxis, uView;
// A thin curling streamer of soot leaving the shell, with a glowing clump at its tip.
float streamer(vec3 q, float r, float xo, float w, float rTip, vec3 d0, vec3 c) {
  vec3 off = q - normalize(d0 + c * xo) * r;
  vec3 tip = q - normalize(d0 + c) * rTip;
  return exp(-dot(off, off) / (w * w)) * smoothstep(-0.05, 0.1, xo) * (1.0 - smoothstep(0.75, 1.0, xo)) * 2.2
    + exp(-dot(tip, tip) / (w * w * 2.2)) * 8.0;
}
vec4 field(vec3 p) {
  vec3 q = p;
  if (uStretch > 1.001) q -= uAxis * dot(q, uAxis) * (1.0 - 1.0 / uStretch);   // kernel drawn out between the igniters
  float up = 0.0;
  if (uG > 0.002) {                       // buoyancy: stretch upward, taper, flicker
    vec3 b = q;
    up = max(b.y / uRf, 0.0);
    float tt = uTime * (2.5 + 4.0 * uG);
    float sway = uG * up * uRf * 0.55;
    q.x += (vnoise(vec3(b.x * 0.16, b.y * 0.14 - tt, b.z * 0.16)) - 0.5) * sway;
    q.z += (vnoise(vec3(b.z * 0.16 + 31.7, b.y * 0.14 - tt, b.x * 0.16)) - 0.5) * sway;
    q.y = b.y > 0.0 ? b.y / (1.0 + 3.0 * uG) : b.y * (1.0 + 0.25 * uG);
    q.xz *= 1.0 + 0.8 * uG * up * up / (1.0 + up);
  }
  float r = length(q);
  float lift = clamp(uG * up * 1.4, 0.0, 1.0);

  float young = clamp(uFlash * 2.2, 0.0, 1.0);                    // the kernel is orange before it is blue
  float s = (r - uRf) / uTh;              // reaction sheet: an electric-blue bubble with a violet fringe, brightest at its limb
  vec3 sheet = mix(vec3(0.06, 0.3, 1.0), vec3(0.45, 0.18, 1.0), smoothstep(-0.3, 1.3, s));
  // Against glowing soot a camera cannot pick out the faint blue, so in a sooty flame the sheet
  // shows only at the limb; without soot the whole bubble is seen.
  float sooted = clamp(uSoot * 1.6 + uGlow * uSooty, 0.0, 1.0);
  float facing = abs(dot(q, uView)) / max(r, 0.001);          // 1 on the faces toward and away from the camera
  float rim = mix(1.0, 1.0 - smoothstep(0.3, 0.92, facing), sooted);
  vec3 e = sheet * exp(-s * s) * uHot * 0.3 * uGain * (1.0 + 0.3 * uGlow) * rim * (1.0 - 0.75 * lift) * (1.0 - 0.8 * young);
  e += vec3(0.04, 0.13, 0.6) * (1.0 - smoothstep(uRf * 0.55, uRf, r)) * uHot * 0.006 * uGain * (1.0 - sooted);

  // Incandescent soot: yellow-white next to the droplet, through orange, to deep red where it
  // thins out toward the sheet. It fills the flame while soot is plentiful and shrinks back as it thins.
  float x = clamp((r - uRs) / max(uRf - uRs, 0.05), 0.0, 1.0);
  float much = clamp(uSoot, 0.0, 1.0);
  float reach = mix(0.3, 0.97, much);
  float band = smoothstep(0.0, 0.1, x) * (1.0 - smoothstep(reach * 0.5, reach, x)) * step(uRs, r);
  float xr = x / reach;
  // (Colours are linear light: these look far deeper here than they do on screen. Keep the summed
  // brightness near 1 outside the core, or the tone mapping bleaches the orange to cream.)
  vec3 fire = mix(mix(vec3(1.0, 0.55, 0.09), vec3(1.0, 0.26, 0.015), smoothstep(0.0, 0.5, xr)), vec3(0.9, 0.09, 0.0), smoothstep(0.5, 1.0, xr));
  float mottle = 0.7 + 0.6 * vnoise(q * 0.3 + vec3(0.0, uTime * 0.5, 7.0));   // glowing soot is never perfectly even
  e += fire * band * mottle * uSoot * uSoot * (0.13 + 0.2 * uGlow) * (1.0 + 6.0 * lift) * (1.0 - 0.5 * young);

  // The first seconds: a fireball that fills the young flame and floods the camera
  // (orange for fuels that make soot, blue-white for those that do not).
  if (uGlow > 0.003) {
    float fr = r / (0.5 * uRf);
    vec3 ball = mix(vec3(1.0, 0.6, 0.13), vec3(1.0, 0.24, 0.015), smoothstep(0.1, 1.0, fr));
    float fuelSoot = smoothstep(0.15, 0.6, uSooty);              // clean fuels such as methanol stay blue and modest
    e += mix(vec3(0.1, 0.32, 1.0), ball, fuelSoot) * exp(-fr * fr) * mottle * uGlow * 0.6 * mix(0.3, 1.0, fuelSoot) * (1.0 - 0.45 * young);
  }

  float a = 0.0;
  if (uShell + uCloud > 0.01 && r < uRs * 2.4) {   // soot shell: a thin pale ring round the droplet with curling streamers; it outlives the flame as a dull cloud
    vec3 n = q / max(r, 0.001);
    float lump = vnoise(n * 2.3 + vec3(0.0, uTime * 0.1, 4.0));
    float fine = vnoise(n * 6.0 + vec3(uTime * 0.17, 2.0, 0.0));
    float w = 0.05 * uRs + 0.07;
    float ss = (r - uRs * (0.93 + 0.14 * lump)) / w;
    float soot = exp(-ss * ss) * (0.5 + 0.7 * fine);
    float len = clamp(0.8 * uRf / uRs - 1.0, 0.25, 1.0);          // streamers stay inside the flame
    float xo = (r / uRs - 1.0) / len;
    float rTip = uRs * (1.0 + len);
    soot += streamer(q, r, xo, w, rTip, vec3(-0.82, 0.42, 0.38), vec3(-0.1, 0.9, 0.5))
      + streamer(q, r, xo, w, rTip, vec3(0.74, -0.5, 0.45), vec3(0.5, 0.8, -0.6))
      + streamer(q, r, xo, w, rTip, vec3(0.1, -0.86, -0.5), vec3(0.9, 0.2, 0.4));
    soot *= 1.0 - uG;
    e += vec3(1.0, 0.5, 0.1) * soot * uShell * uHot * 0.45 + vec3(0.55, 0.25, 0.09) * soot * uCloud * 0.07;
    a = soot * (uShell + uCloud) * 0.3;
  }

  float cs = (r - uCoolR) / (uTh * 2.4);                          // cool flame, drawn enhanced
  e += vec3(0.5, 0.2, 1.0) * exp(-cs * cs) * uCool * 0.13;

  if (uFlash > 0.003) {                   // ignition kernel: orange, hollow round the droplet, white-hot where it meets the igniters
    float kr = (r - 0.7 * uRf) / (0.25 * uRf);
    float kt = (r - 0.88 * uRf) / (0.18 * uRf);
    float pole = abs(dot(q, uAxis)) / max(r, 0.001);
    e += (vec3(1.0, 0.3, 0.03) * exp(-kr * kr) * 0.4 + vec3(1.0, 0.6, 0.2) * pow(pole, 9.0) * exp(-kt * kt) * 0.9) * uFlash;
  }

  float fog = exp(-r * r / (uVapR * uVapR)) * uVap;               // leftover fuel vapour
  e += vec3(0.5, 0.56, 0.66) * fog * 0.012;
  a += fog * 0.02;

  float outside = smoothstep(uRd * 0.9, uRd * 1.15, length(p));
  return vec4(e * outside, a * outside);
}`;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const IGN_DIR = new THREE.Vector3(-0.78, 0.6, 0.12).normalize();   // igniters sit on a diagonal, as on the video
const FIBRE = new THREE.Vector3(0.16, 1, 0).normalize();            // the fibre is nearly vertical
const BLUE = new THREE.Color(0x5b8dff);
const AMBER = new THREE.Color(0xffa044);
const VIOLET = new THREE.Color(0x9a7bff);
const EMBER = new THREE.Color(0xff5a1e);
const GLARE = new THREE.Color(0xff9a3c);
const SMOOTH = ['rf', 'hot', 'soot', 'rs', 'cool', 'coolR', 'vapour', 'vapourR', 'light'];
const DEG = Math.PI / 180;

// Tone curve for this lab. three's Neutral curve keeps the hue of bright light and fades it toward
// white, which turns fire cream. This one eases each channel to 1 on its own, so bright fire runs
// red, orange, yellow, white, as on film. Below 0.75 it matches Neutral (same toe for the blacks).
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	float low = min( color.r, min( color.g, color.b ) );
	color -= low < 0.08 ? low - 6.25 * low * low : 0.04;
	return min( color, 0.75 ) + 0.25 * ( 1.0 - exp( - max( color - 0.75, 0.0 ) / 0.25 ) );
}`);

/** Soft round dot, used for glows and (stretched) for the camera's light streaks. */
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** What the camera sees behind the droplet: the machined insert, cable loops, bolts, a lens. */
function backdrop() {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0x6f7781, metalness: 0.8, roughness: 0.58 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x07090c, metalness: 0.1, roughness: 0.95 });
  const shape = new THREE.Shape();
  shape.moveTo(-26, -18); shape.lineTo(26, -18); shape.lineTo(26, 17); shape.lineTo(-26, 17); shape.closePath();
  const hole = new THREE.Path();                       // keyhole: a slot behind the droplet under an arched window
  hole.moveTo(-3.4, -2.5); hole.lineTo(-3.4, 0.3); hole.absarc(0, 0.3, 3.4, Math.PI, 0, true); hole.lineTo(3.4, -2.5); hole.closePath();
  shape.holes.push(hole);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 2, curveSegments: 28 }), alu);
  plate.position.z = -6.4;
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8), dark);
  recess.position.set(0, 0.6, -7.6);
  g.add(plate, recess);
  // red cable loops behind the window
  const red = new THREE.MeshStandardMaterial({ color: 0xd2231c, metalness: 0, roughness: 0.32 });
  const loops = [[[-5.2, 4.4], [-2.7, 2.7], [-2.2, 0.3], [-2.9, -1.5], [-5.2, -2.6]], [[-1.3, 6], [-1.0, 3.0], [0.15, 1.2], [1.3, 2.7], [1.0, 6]],
    [[5.2, 3.6], [2.7, 2.5], [2.1, 0.5], [2.8, -1.3], [5.2, -2.0]], [[-5.2, -1.0], [-1.6, -1.95], [1.4, -1.75], [5.2, -0.8]],
    [[-0.4, 6], [-1.9, 2.2], [-1.3, -0.6], [-0.2, -3.6]], [[2.2, 6], [1.9, 3.2], [3.0, 1.6], [5.2, 1.4]]];
  for (const pts of loops) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y], i) => v(x, y, -7.15 + (i % 2) * 0.3))), 48, 0.12, 8), red));
  // bolts
  const bolt = new THREE.MeshStandardMaterial({ color: 0x9ea6b0, metalness: 0.86, roughness: 0.4, flatShading: true });
  for (const [x, y] of [[-4.7, 2.5], [4.7, 2.5], [-4.7, -3.3], [4.7, -3.3], [-8.4, -0.4], [8.4, -0.4]]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.34, 6), bolt);
    head.rotation.x = Math.PI / 2;
    head.position.set(x, y, -5.25);
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 24), bolt);
    washer.rotation.x = Math.PI / 2;
    washer.position.set(x, y, -5.44);
    const socket = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), dark);   // hex socket in the cap
    socket.position.set(x, y, -5.075);
    g.add(head, washer, socket);
  }
  // camera lens port at the bottom
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0, roughness: 0.06, clearcoat: 1 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(3.1, 48), glass);
  lens.position.set(0, -7.1, -5.3);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.34, 12, 48), alu);
  rim.position.copy(lens.position);
  g.add(lens, rim);
  for (const [radius, hex] of [[2.4, 0xff2a2a], [1.7, 0x2a6cff]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 6, 48, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55 }));
    ring.position.set(0, -7.1, -5.25);
    ring.rotation.z = 0.5;
    g.add(ring);
  }
  // connector and its wires, top right
  const gold = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.9), new THREE.MeshStandardMaterial({ color: 0xc9a13a, metalness: 1, roughness: 0.35 }));
  gold.position.set(5.9, 3.9, -5.1);
  g.add(gold);
  [0x2f9e44, 0x2a6cff, 0xd2231c, 0xe8e8e8].forEach((hex, i) => g.add(new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([v(5.1, 3.7 + i * 0.12, -4.6), v(3.4, 4.5 + i * 0.2, -4.3), v(1.4, 5.3 + i * 0.1, -4.8)]), 16, 0.06, 6),
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45 }))));
  return g;
}

/** Multi-user Droplet Combustion Apparatus as the flight camera shows it (centimetres). */
function buildHardware(scene, coarse) {
  const steel = M.steel();
  const polished = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 1, roughness: 0.24 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x8f8f8b, metalness: 0, roughness: 0.95 });
  const dot = softDot();
  const chamber = cirChamber();
  chamber.position.y = 2;
  scene.add(chamber, backdrop());

  // deployment needles: thin, opposed, they place the droplet and pull away
  const needle = (sign) => {
    const g = new THREE.Group();
    g.add(rod(v(0, 0, 0), v(4.2, 0, 0), 0.014, steel, 8), rod(v(4.2, 0, 0), v(4.7, 0, 0), 0.014, polished, 12, 0.09), rod(v(4.7, 0, 0), v(14, 0, 0), 0.09, polished, 12));
    if (sign < 0) g.rotation.y = Math.PI;
    scene.add(g);
    return g;
  };

  // igniters: a hairpin loop of hot wire on a ceramic post, on a stepped polished arm
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x8a8a88, metalness: 0.9, roughness: 0.45, emissive: 0xff5a1e, emissiveIntensity: 0 });
  const arc = [];
  for (let a = 40; a <= 320; a += 14) arc.push(v(0.13 + 0.13 * Math.cos(a * DEG), 0.13 * Math.sin(a * DEG), 0));
  const loop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(0.5, 0.045, 0), ...arc, v(0.5, -0.045, 0)]), 72, 0.012, 6);
  const glows = [];
  const igniter = (dir) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(loop, wireMat), rod(v(0.48, 0, 0), v(0.95, 0, 0), 0.075, ceramic, 12),
      rod(v(0.95, 0, 0), v(1.5, 0, 0), 0.13, polished, 20), rod(v(1.5, 0, 0), v(2.9, 0, 0), 0.24, polished, 24),
      rod(v(2.9, 0, 0), v(3.3, 0, 0), 0.31, polished, 6), rod(v(3.3, 0, 0), v(5.6, 0, 0), 0.2, polished, 20),
      rod(v(5.6, 0, 0), v(6.3, 0, 0), 0.3, polished, 20), rod(v(6.3, 0, 0), v(15, 0, 0), 0.16, polished, 16));
    const mk = (sx, sy) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffa25c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(0.13, 0, 0.05);
      s.scale.set(sx, sy, 1);
      g.add(s);
      return s;
    };
    glows.push({ halo: mk(1.2, 1.2), streak: mk(0.13, 4.4) });
    g.quaternion.setFromUnitVectors(X_AXIS, dir);
    scene.add(g);
    return g;
  };

  // fibre frame: two offset arms with the fibre strung between their tips (unlit, so the flame light does not blow it out)
  const tip = FIBRE.clone().multiplyScalar(1.75);
  const low = tip.clone().negate();
  const fibreMat = new THREE.MeshBasicMaterial({ color: 0x9aa3b0 });   // dimmed with the chamber lights in draw()
  const fibre = new THREE.Group();
  fibre.add(rod(low, tip, 0.009, fibreMat, 6),
    rod(tip, v(13, tip.y + 0.3, -0.4), 0.062, polished, 12), rod(low, v(-13, low.y - 0.3, -0.4), 0.062, polished, 12));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const glow = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), glowMat); fibre.add(m); return m; };
  const glowTop = glow();
  const glowBot = glow();
  scene.add(fibre);

  // the droplet: clear liquid that bends the view behind it (a plain glossy bead on phones)
  const dropMat = coarse
    ? new THREE.MeshPhysicalMaterial({ color: 0xdcecff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.4 })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transmission: 1, thickness: 2, ior: 1.39, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 2.2 });
  const droplet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), dropMat);
  droplet.renderOrder = 2;
  droplet.userData.noDepth = true;      // the flame is drawn through it
  scene.add(droplet);

  // chamber lighting: a ring of small lamps round the camera, plus fill
  // camera glare: the young flame floods the lens
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xff7a22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  glare.renderOrder = 4;
  glare.visible = false;
  scene.add(glare);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x10151d, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(-3, 5, 12);
  const leds = [0, 1, 2, 3, 4, 5].map((i) => {       // their reflections are the ring of bright dots on the droplet
    const l = new THREE.PointLight(0xffffff, 0, 0, 2);
    l.position.set(13 * Math.cos(i * 60 * DEG + 0.35), 13 * Math.sin(i * 60 * DEG + 0.35), 6);
    return l;
  });
  const redLed = new THREE.PointLight(0xff2a1a, 0, 0, 2);   // the red glint on the droplet
  redLed.position.set(2, 9, 7);
  const light = new THREE.PointLight(0xffffff, 0, 0, 2);
  scene.add(hemi, key, light, redLed, ...leds);

  return { needleR: needle(1), needleL: needle(-1), ignA: igniter(IGN_DIR), ignB: igniter(IGN_DIR.clone().negate()),
    wireMat, glows, fibre, fibreMat, glowTop, glowBot, glowMat, droplet, dropMat, light, hemi, key, leds, redLed, glare };
}

/** Coloured single-pixel speckle: radiation hits on the flight camera's sensor, visible once the lights are off. */
function sensorNoise(stage) {
  const n = 1300;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const hues = [[1, 0.15, 0.15], [0.2, 1, 0.3], [0.3, 0.4, 1], [1, 0.3, 1]];
  for (let i = 0; i < n; i++) {
    pos.set([(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3.8, -2], i * 3);
    const k = 0.3 + 0.5 * Math.random();
    col.set(hues[i % 4].map((c) => c * k), i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false;
  pts.renderOrder = 20;
  stage.camera.add(pts);
  stage.scene.add(stage.camera);
  return pts;
}

/** Builds the apparatus and returns { draw(state, dt), snap(), newDrift(), option(name, on) }. */
export function createScene(stage, S, getPlan) {
  const hw = buildHardware(stage.scene, stage.coarse);
  const speck = sensorNoise(stage);
  stage.renderer.domElement.parentElement.classList.add('port');
  const f0 = () => ({ value: 0 });
  const vol = createVolume({ field: FIELD, steps: stage.coarse ? 40 : 60,
    uniforms: { uRf: { value: 1 }, uTh: { value: 0.5 }, uHot: f0(), uSoot: f0(), uRs: { value: 1 }, uRd: { value: 1 },
      uCool: f0(), uCoolR: { value: 1 }, uG: f0(), uFlash: f0(), uVap: f0(), uVapR: { value: 1 },
      uStretch: { value: 1 }, uAxis: { value: IGN_DIR.clone() }, uShell: f0(), uCloud: f0(), uGain: { value: 1 }, uGlow: f0(), uSooty: f0(), uView: { value: new THREE.Vector3(0, 0, 1) } } });
  stage.addVolume(vol);
  // The scene is built for the flight camera's side of the backplate: orbiting stays in front of it,
  // and the slow drift sways about that line of sight instead of circling round.
  stage.renderer.toneMapping = THREE.CustomToneMapping;   // the fire curve defined at the top of this file
  stage.controls.maxPolarAngle = Math.PI * 0.64;
  stage.controls.minPolarAngle = Math.PI * 0.34;
  stage.controls.minAzimuthAngle = -0.5;
  stage.controls.maxAzimuthAngle = 0.62;
  const driftSpeed = Math.abs(stage.controls.autoRotateSpeed) || 0.3;

  const pos = new THREE.Vector3();
  const center = new THREE.Vector3();
  const drift = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upv = new THREE.Vector3();
  const tint = new THREE.Color();
  const opt = { dark: true, noise: true };
  const pull = () => Math.max(S.g, Math.min((S.flow || 0) / 12, 0.42)); // gravity, or slow airflow past the drop
  const sm = { g: pull(), lamp: 1, shell: 0, cloud: 0 };
  for (const key of SMOOTH) sm[key] = 0;
  let live = stateAt(getPlan(), S.t);
  let snap = true;
  let twinkle = 0;

  // labels sit on the rim that faces the camera
  const rim = (o, radius, sx, sy) => o.copy(pos).addScaledVector(right, sx * radius).addScaledVector(upv, sy * radius);
  stage.addLabel('Deployment needle', (o) => o.set(hw.needleR.position.x + 1.4, 0, 0));
  stage.addLabel('Hot-wire igniter', (o) => o.copy(hw.ignB.position), { when: () => sm.lamp > 0.5 || live.coil > 0.1 });
  stage.addLabel('Fibre', (o) => o.copy(FIBRE).multiplyScalar(-1.3), { when: () => S.tether === 'fibre' && sm.lamp > 0.5, side: 'left' });
  stage.addLabel('Fuel droplet', (o) => rim(o, live.d / 20, 0.72, 0.72), { when: () => live.t < 0 });
  stage.addLabel('Flame', (o) => rim(o, sm.rf / 10, 0.72, 0.72), { when: () => sm.hot > 0.12 && sm.g < 0.05 });
  stage.addLabel('Soot shell', (o) => rim(o, sm.rs / 10, -0.72, -0.72), { when: () => sm.shell > 0.5 && sm.soot < 0.45 && sm.g < 0.05, side: 'left' });
  stage.addLabel('Cool flame (invisible, drawn enhanced)', (o) => rim(o, sm.coolR / 10, 0.72, 0.72), { when: () => sm.cool > 0.25 });
  stage.addLabel('Unburned fuel vapour', (o) => rim(o, sm.vapourR / 10, 0.72, 0.72), { when: () => sm.vapour > 0.3 });

  return {
    newDrift() {
      drift.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4).normalize().multiplyScalar(0.03);
    },
    snap() { snap = true; },
    /** 'dark': chamber lights go off for the burn. 'noise': camera sensor speckle. */
    option(name, on) { opt[name] = on; },
    draw(st, dt) {
      live = st;
      const plan = getPlan();
      const a = snap ? 1 : 1 - Math.exp(-dt / 0.07);
      const slow = snap ? 1 : 1 - Math.exp(-dt / 0.45);
      if (snap) sm.g = pull();
      snap = false;
      for (const key of SMOOTH) sm[key] += (st[key] - sm[key]) * a;
      sm.g += (pull() - sm.g) * (1 - Math.exp(-dt / 0.3));
      // chamber lights: on for the set-up, off while it burns, back on afterwards
      const burning = st.t > SETUP.heat && st.t < plan.tEnd + 2.5;
      sm.lamp += ((burning && opt.dark ? 0.035 : 1) - sm.lamp) * slow;
      // the soot shell forms in the first seconds and outlives the flame as a dull cloud
      const sooty = Math.min(plan.soot0 * 1.3, 1);
      sm.shell += ((st.phase === 'hot' ? sooty * clamp((st.t - 0.5) / 1.5, 0, 1) : 0) - sm.shell) * a;
      sm.cloud += ((st.t > plan.tb ? sooty * clamp(1 - (st.t - plan.tb) / 9, 0, 1) : 0) - sm.cloud) * a;
      const az = stage.controls.getAzimuthalAngle();
      if (az > 0.34) stage.controls.autoRotateSpeed = driftSpeed; else if (az < -0.14) stage.controls.autoRotateSpeed = -driftSpeed;   // a positive speed turns toward negative azimuth
      right.setFromMatrixColumn(stage.camera.matrixWorld, 0);
      upv.setFromMatrixColumn(stage.camera.matrixWorld, 1);

      const rd = st.d / 20;
      pos.copy(drift).multiplyScalar(S.tether === 'free' ? Math.max(0, st.t - SETUP.retract) : 0);
      stage.controls.target.lerp(pos, 0.04);
      hw.droplet.visible = st.d > 0.04;
      hw.droplet.position.copy(pos);
      hw.droplet.scale.set(rd * (1 + st.wobble), rd * (1 - st.wobble / 2), rd * (1 - st.wobble / 2));
      const d0 = plan.c.d0;
      const reachN = lerp(0.7 * d0 / 20, 7.5, st.needle);
      hw.needleR.position.x = reachN;
      hw.needleL.position.x = -reachN;
      const reach = lerp(2.7, d0 / 20 + 0.3, st.ign);
      hw.ignA.position.copy(IGN_DIR).multiplyScalar(reach);
      hw.ignB.position.copy(IGN_DIR).multiplyScalar(-reach);
      const kernel = st.t >= 0 && st.hot > 0 ? Math.exp(-st.t / 0.45) : 0;   // the first half second, while the flame is still an ignition kernel
      const wire = Math.max(st.coil, 0.85 * kernel);                         // the loops stay white-hot until the kernel has formed
      const glow = st.t >= 0 && st.phase === 'hot' ? Math.exp(-st.t / 1.6) * Math.min(1, st.hot) : 0;   // how hard the young flame glows
      hw.wireMat.emissiveIntensity = wire * 12;
      for (const g of hw.glows) {
        g.halo.material.opacity = Math.min(1, wire * 0.75);
        g.halo.scale.setScalar(0.6 + wire * 0.6);
        g.streak.material.opacity = wire * wire * 0.5;
      }
      hw.fibre.visible = S.tether === 'fibre';

      // flame volume: bounding sphere follows the (possibly stretched) flame
      const stretch = 1 + 0.9 * kernel;
      const th = 0.16 + 0.014 * sm.rf + 0.5 * sm.g;
      const top = sm.rf * (1 + 3 * sm.g);
      const bottom = sm.rf / (1 + 0.25 * sm.g);
      const cy = (top - bottom) / 2;
      let radius = (Math.max((top + bottom) / 2, Math.hypot(sm.rf, cy)) + 3 * th + 0.6 * sm.g * sm.rf) * stretch;
      if (sm.cool > 0.01) radius = Math.max(radius, sm.coolR + 7 * th);
      if (sm.vapour > 0.01) radius = Math.max(radius, sm.vapourR * 2.2);
      if (sm.cloud > 0.01) radius = Math.max(radius, sm.rs * 2.3 + 0.6);
      center.copy(pos);
      center.y += cy / 10;
      vol.place(center, radius / 10, pos);
      vol.mesh.visible = sm.hot + sm.cool + sm.vapour + sm.cloud + st.flash > 0.004;
      const U = vol.uniforms;
      U.uRf.value = sm.rf; U.uTh.value = th; U.uHot.value = sm.hot; U.uSoot.value = sm.soot; U.uRs.value = sm.rs;
      U.uRd.value = st.d / 2; U.uCool.value = sm.cool; U.uCoolR.value = sm.coolR; U.uG.value = sm.g;
      U.uFlash.value = Math.max(st.flash, 0.7 * kernel); U.uVap.value = sm.vapour; U.uVapR.value = Math.max(sm.vapourR, 0.5);
      U.uStretch.value = stretch; U.uShell.value = sm.shell; U.uCloud.value = sm.cloud;
      U.uGlow.value = glow; U.uSooty.value = sooty;
      U.uView.value.copy(stage.camera.position).sub(pos).normalize();
      U.uGain.value = (1 + 1.2 * sm.lamp) * (1 + 1.4 * Math.min(sm.g, 1));   // the faint sheet needs help against lit metal and in a tall 1 g flame

      // the igniters, then the flame, light the hardware
      if (st.phase === 'cool') tint.copy(VIOLET);
      else tint.copy(BLUE).lerp(AMBER, clamp(sm.soot * 1.5, 0, 1)).lerp(EMBER, st.t < 0.05 ? 1 : kernel);   // red-orange while it ignites
      hw.light.color.copy(tint);
      hw.light.intensity = sm.light * 14 + wire * 9 + glow * 30;
      hw.light.position.copy(center);
      hw.dropMat.emissive.copy(tint);
      hw.dropMat.emissiveIntensity = Math.min(sm.light * 0.35, 1.2);
      const glowOn = S.tether === 'fibre' && sm.hot > 0.03;
      hw.glowTop.visible = glowOn;
      hw.glowBot.visible = glowOn;
      hw.glowTop.position.copy(FIBRE).multiplyScalar((top * (1 - 0.5 * Math.min(sm.g, 1))) / 10);
      hw.glowBot.position.copy(FIBRE).multiplyScalar(-bottom / 10);
      const gi = sm.hot * (3 + 3 * sm.soot);
      hw.glowMat.color.setRGB(gi, gi * 0.82, gi * 0.6);

      hw.hemi.intensity = 0.55 * sm.lamp;
      hw.key.intensity = 0.95 * sm.lamp;
      for (const l of hw.leds) l.intensity = 15 * sm.lamp;
      hw.redLed.intensity = 14 * sm.lamp;
      hw.fibreMat.color.setScalar(lerp(0.03, 0.6, sm.lamp));
      stage.scene.environmentIntensity = 0.03 + 0.27 * sm.lamp;
      speck.material.opacity = opt.noise ? (1 - sm.lamp) * 0.85 : 0;
      twinkle += dt;
      if (twinkle > 0.14) { twinkle = 0; speck.geometry.setDrawRange(Math.floor(Math.random() * 300), 1000); }   // most pixels stay, some come and go
      // camera glare and bloom: hardest in the first seconds, then settling to a steady glow
      const fierce = glow + 0.22 * clamp(sm.soot, 0, 1) * sm.hot;
      hw.glare.visible = fierce > 0.01;
      hw.glare.position.copy(center);
      hw.glare.scale.setScalar((sm.rf / 10) * (5 + 4 * glow) + 0.8 * glow);
      hw.glare.material.color.copy(BLUE).lerp(GLARE, sooty);
      hw.glare.material.opacity = Math.min(0.6, 0.5 * fierce);
      // With the lights off the bloom threshold drops, so saturated orange and blue spread their own
      // colour; at the usual 0.9 only the near-white core blooms and washes them out.
      stage.bloom.strength = lerp(0.32, 0.2, sm.lamp) + 0.2 * glow;
      stage.bloom.radius = 0.55 + 0.3 * glow;
      stage.bloom.threshold = lerp(0.28, 0.9, sm.lamp);
    },
  };
}
