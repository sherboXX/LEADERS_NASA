// Reusable hardware pieces and materials. Scene units are centimetres.
import * as THREE from 'three';

export const M = {
  steel: (o = {}) => new THREE.MeshStandardMaterial({ color: 0x8d949e, metalness: 1, roughness: 0.42, ...o }),
  anodized: (o = {}) => new THREE.MeshStandardMaterial({ color: 0x161c26, metalness: 0.55, roughness: 0.62, ...o }),
  ceramic: (o = {}) => new THREE.MeshStandardMaterial({ color: 0xbdb7a8, metalness: 0, roughness: 0.8, ...o }),
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0x0a1120, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.55, ...o }),
};

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder between two points. */
export function rod(a, b, radius, material, radialSegments = 12, radiusEnd = radius) {
  const d = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, d.length(), radialSegments, 1), material);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  return mesh;
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export const v = (x, y, z) => new THREE.Vector3(x, y, z);

/** Wire coil (helix) between two points, as used for hot-wire igniters. */
export function coil(a, b, radius, turns, wire, material) {
  const axis = new THREE.Vector3().subVectors(b, a);
  const len = axis.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().normalize());
  const pts = [];
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const ang = s * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(ang) * radius, s * len, Math.sin(ang) * radius).applyQuaternion(q).add(a));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 6), material);
}

/**
 * Combustion Integrated Rack chamber: a horizontal cylinder (axis along Z) with window
 * ports around its middle. The camera sits inside it.
 */
export function cirChamber({ radius = 20, length = 60, windows = 8 } = {}) {
  const g = new THREE.Group();
  const wall = M.anodized({ side: THREE.BackSide, color: 0x3a4452, metalness: 0.3, roughness: 0.78 });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 72, 1, true), wall);
  shell.rotation.x = Math.PI / 2;
  g.add(shell);
  for (const z of [-length / 2, length / 2]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), M.anodized({ color: 0x323b48, metalness: 0.3, roughness: 0.8 }));
    cap.position.z = z;
    if (z > 0) cap.rotation.y = Math.PI;
    g.add(cap);
  }
  const ribMat = M.anodized({ color: 0x4b5563, metalness: 0.4, roughness: 0.6 });
  for (const z of [-22, -9, 9, 22]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.35, 0.4, 8, 72), ribMat);
    rib.position.z = z;
    g.add(rib);
  }
  const ringMat = M.steel({ color: 0x8b929c, roughness: 0.45 });
  const glassMat = M.glass();
  for (let i = 0; i < windows; i++) {
    const ang = ((i + 0.5) / windows) * Math.PI * 2;
    const port = new THREE.Group();
    port.position.set(Math.cos(ang) * (radius - 0.5), Math.sin(ang) * (radius - 0.5), 0);
    port.lookAt(0, 0, 0);
    port.add(new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.42, 10, 40), ringMat));
    port.add(new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), glassMat));
    g.add(port);
  }
  return g;
}
