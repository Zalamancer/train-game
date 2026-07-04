import * as THREE from 'three';

const COLLECT_RADIUS = 1.6;
const SPACING = 12; // world units between cargo crates along the loop

export function spawnCargo(scene, path) {
  const count = Math.max(3, Math.round(path.total / SPACING));
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.45, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x55360a, roughness: 0.4 });
  const markers = [];
  for (let i = 0; i < count; i++) {
    const d = (i / count) * path.total;
    const { pos } = path.sampleAt(d);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.copy(pos).add(new THREE.Vector3(0, 1.1, 0));
    group.add(mesh);
    markers.push({ mesh, collected: false });
  }
  scene.add(group);
  return { scene, group, markers, total: count, collected: 0 };
}

export function updateCargo(cargoState, headPos) {
  if (!headPos) return 0;
  let newlyCollected = 0;
  for (const m of cargoState.markers) {
    if (m.collected) continue;
    m.mesh.rotation.y += 0.05;
    m.mesh.position.y = 1.1 + Math.sin(performance.now() / 300 + m.mesh.id) * 0.08;
    if (m.mesh.position.distanceTo(headPos) < COLLECT_RADIUS) {
      m.collected = true;
      m.mesh.visible = false;
      cargoState.collected++;
      newlyCollected++;
    }
  }
  return newlyCollected;
}

export function disposeCargo(cargoState) {
  cargoState.scene.remove(cargoState.group);
}
