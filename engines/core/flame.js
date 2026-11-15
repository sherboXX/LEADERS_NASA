// Volumetric emission/absorption ray-marcher. Each engine supplies a GLSL function
//   vec4 field(vec3 p)   p in millimetres from the field origin
// returning rgb = light emitted per mm and a = light absorbed per mm.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const HEAD = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uOrigin;
uniform float uRadius;
uniform float uUnit;
uniform int uSteps;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uTime;
varying vec3 vWorld;

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
                 mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
                 mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

const MAIN = /* glsl */ `
void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd);
  float disc = b * b - (dot(oc, oc) - uRadius * uRadius);
  if (disc < 0.0) discard;
  disc = sqrt(disc);
  float t0 = max(-b - disc, 0.0);
  float t1 = -b + disc;

  // stop at solid hardware
  float depth = texture2D(tDepth, gl_FragCoord.xy / uRes).x;
  float viewZ = (uNear * uFar) / ((uFar - uNear) * depth - uFar);
  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  t1 = min(t1, -viewZ / max(dot(rd, fwd), 1e-4));
  if (t1 <= t0) discard;

  float dt = (t1 - t0) / float(uSteps);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float dmm = dt * uUnit;
  vec3 col = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < uSteps; i++) {
    vec3 p = (ro + rd * (t0 + (float(i) + jitter) * dt) - uOrigin) * uUnit;
    vec4 f = field(p);
    col += trans * f.rgb * dmm;
    trans *= exp(-f.a * dmm);
    if (trans < 0.01) break;
  }
  gl_FragColor = vec4(col, 1.0 - trans);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * @param field    GLSL source defining `vec4 field(vec3 p)` plus its own uniforms
 * @param uniforms extra uniforms used by the field
 * @param steps    ray-march samples per pixel
 * @param unit     millimetres per scene unit (scenes are in cm, so 10)
 */
export function createVolume({ field, uniforms = {}, steps = 48, unit = 10 }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector3() }, uOrigin: { value: new THREE.Vector3() },
      uRadius: { value: 1 }, uUnit: { value: unit }, uSteps: { value: steps },
      tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 }, uFar: { value: 200 }, uTime: { value: 0 },
      ...uniforms,
    },
    vertexShader: VERT,
    fragmentShader: HEAD + field + MAIN,
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false, side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  const u = material.uniforms;
  /** Bounding sphere (scene units) and, optionally, a different origin for the field. */
  function place(center, radius, origin = center) {
    mesh.position.copy(center);
    mesh.scale.setScalar(radius * 1.1);
    u.uCenter.value.copy(center);
    u.uOrigin.value.copy(origin);
    u.uRadius.value = radius;
  }
  return { mesh, material, uniforms: u, place };
}
