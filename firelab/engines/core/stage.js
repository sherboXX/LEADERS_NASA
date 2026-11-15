// Shared 3D stage: renderer, camera, orbit controls, HDR bloom, a depth pre-pass that
// lets volumetric flames hide behind solid hardware, projected labels, and a frame loop
// that pauses when the engine is off screen.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DEFAULTS = {
  fov: 32, near: 0.1, far: 200, background: 0x04070d,
  camera: [2.6, 1.4, 8.6], target: [0, 0, 0], minDistance: 2.2, maxDistance: 24,
  bloom: { strength: 0.55, radius: 0.55, threshold: 0.9 }, exposure: 1, env: 0.2,
  label: '3D view of the experiment',
};

export function createStage(host, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.info.autoReset = false;      // counted per frame below, across every pass
  const canvas = renderer.domElement;
  canvas.className = 'fl-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', o.label);
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = o.env;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(o.fov, 1, o.near, o.far);
  camera.position.fromArray(o.camera);
  const controls = new OrbitControls(camera, canvas);
  controls.target.fromArray(o.target);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.7, zoomSpeed: 0.7,
    minDistance: o.minDistance, maxDistance: o.maxDistance, autoRotate: !reduce, autoRotateSpeed: 0.3,
  });
  let fly = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; fly = null; });

  const maxPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let pr = maxPR;
  let w = 1;
  let h = 1;
  renderer.setPixelRatio(pr);
  const composer = new EffectComposer(renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: coarse ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), o.bloom.strength, o.bloom.radius, o.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Depth of the solid hardware, sampled by the volume shaders.
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const bufSize = new THREE.Vector2(1, 1);
  const volumes = [];
  const hidden = [];
  let depthRT = null;
  function makeDepth() {
    if (depthRT) { depthRT.depthTexture.dispose(); depthRT.dispose(); }
    renderer.getDrawingBufferSize(bufSize);
    depthRT = new THREE.WebGLRenderTarget(bufSize.x, bufSize.y, { depthTexture: new THREE.DepthTexture(bufSize.x, bufSize.y) });
  }
  function depthPass() {
    hidden.length = 0;
    scene.traverse((obj) => {
      const m = obj.material;
      if (m && obj.visible && (obj.userData.noDepth || m.transparent || m.depthWrite === false)) {
        obj.visible = false;
        hidden.push(obj);
      }
    });
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = depthMat;
    renderer.setRenderTarget(depthRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = null;
    scene.background = bg;
    for (const obj of hidden) obj.visible = true;
  }

  const labels = []; // labels pinned to points in the scene (filled by addLabel)
  let box = null;    // the area labels may use
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // tall (phone) viewports: widen the view so the hardware stays in frame
    camera.fov = o.fov * (camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.9 : 1);
    // keep the subject in the middle of the area the page's panels leave free
    const f = o.frame ? o.frame() : null;
    if (f) camera.setViewOffset(w, h, w / 2 - f.cx, h / 2 - f.cy, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    box = o.bounds ? o.bounds() : null;
    for (const L of labels) L.width = 0; // text size may have changed
    makeDepth();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Labels pinned to points in the scene.
  const labelLayer = document.createElement('div');
  labelLayer.className = 'fl-labels';
  host.append(labelLayer);
  const v3 = new THREE.Vector3();
  function addLabel(text, pos, { when = () => true, side = 'right' } = {}) {
    const node = document.createElement('span');
    node.className = `fl-label fl-label--${side}`;
    node.textContent = text;
    labelLayer.append(node);
    labels.push({ node, pos, when, left: side === 'left', width: 0 });
  }
  function updateLabels() {
    if (labelLayer.hidden) return;
    for (const L of labels) {
      const p = L.when() ? L.pos(v3) : null;
      let on = false;
      if (p) {
        p.project(camera);
        const x = (p.x + 1) / 2 * w;
        const y = (1 - p.y) / 2 * h;
        L.width ||= L.node.offsetWidth;
        // show a label only if its whole text fits inside the view
        // show a label only if its whole text fits in the area the panels leave free
        const x0 = box ? box.x0 : 0;
        const x1 = box ? box.x1 : w;
        on = p.z < 1 && y > (box ? box.y0 : 0) + 14 && y < (box ? box.y1 : h) - 14
          && (L.left ? x < x1 && x - 42 - L.width > x0 : x > x0 && x + 42 + L.width < x1);
        if (on) L.node.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      }
      L.node.style.opacity = on ? 1 : 0;
    }
  }

  const frameFns = [];
  let last = 0;
  let time = 0;
  let acc = 0;
  let frames = 0;
  let lastMs = 0;
  let drawn = { calls: 0, triangles: 0 };
  function frame(now) {
    const raw = Math.max((now - last) / 1000, 0);
    const dt = Math.min(raw, 0.05) || 0.016;
    last = now;
    time += dt;
    for (const fn of frameFns) fn(dt, time);
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      camera.position.lerpVectors(fly.from, fly.to, fly.t * fly.t * (3 - 2 * fly.t));
      if (fly.t >= 1) fly = null;
    }
    controls.update(dt);
    if (volumes.length) {
      depthPass();
      for (const v of volumes) {
        const u = v.material.uniforms;
        u.tDepth.value = depthRT.depthTexture;
        u.uRes.value.copy(bufSize);
        u.uNear.value = camera.near;
        u.uFar.value = camera.far;
        u.uTime.value = time;
      }
    }
    composer.render(dt);
    drawn = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.info.reset();
    updateLabels();
    // drop resolution (never raise it again) if the device cannot keep up; long gaps mean
    // the browser throttled a background tab, which says nothing about the device
    if (raw > 0.1) { acc = 0; frames = 0; return; }
    acc += raw;
    frames += 1;
    if (acc >= 1.5) {
      const ms = (acc / frames) * 1000;
      lastMs = ms;
      acc = 0;
      frames = 0;
      if (time > 3 && ms > 27 && pr > 0.8) { pr = Math.max(0.75, pr - 0.25); resize(); }
    }
  }

  let inView = true;
  let running = false;
  function sync() {
    const run = inView && !document.hidden;
    if (run === running) return;
    running = run;
    last = performance.now();
    renderer.setAnimationLoop(run ? frame : null);
  }
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); });
  io.observe(host);
  document.addEventListener('visibilitychange', sync);
  sync();

  const home = { position: camera.position.clone(), target: controls.target.clone() };
  return {
    scene, camera, renderer, controls, bloom, coarse, reduce,
    onFrame: (fn) => frameFns.push(fn),
    resize,
    /** Glide the camera to a position (scene units) over `seconds`. */
    flyTo(pos, seconds = 1.6) {
      fly = { from: camera.position.clone(), to: new THREE.Vector3().fromArray(pos), t: 0, dur: Math.max(seconds, 0.01) };
    },
    /** Average GPU-finished frame time in ms, for validation runs. */
    benchmark(n = 20) {
      const gl = renderer.getContext();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { frame(performance.now()); gl.finish(); }
      return +((performance.now() - t0) / n).toFixed(2);
    },
    frameMs: () => ({ ms: +lastMs.toFixed(1), pixelRatio: pr, width: w, height: h, ...drawn }),
    addVolume: (v) => { volumes.push(v.mesh); scene.add(v.mesh); },
    addLabel,
    showLabels: (on) => { labelLayer.hidden = !on; },
    resetView: () => { camera.position.copy(home.position); controls.target.copy(home.target); },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      controls.dispose();
      composer.dispose();
      if (depthRT) { depthRT.depthTexture.dispose(); depthRT.dispose(); }
      renderer.dispose();
      canvas.remove();
      labelLayer.remove();
    },
  };
}
