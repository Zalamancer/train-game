import * as THREE from 'three';
import { loadModel } from './assets.js';

const COUPLING_GAP = 1.6;

function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += a.distanceTo(b);
  }
  return total;
}

// Cumulative arc-length lookup table so position-at-distance is O(log n).
function buildCumulative(points) {
  const cum = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    cum.push(cum[i] + a.distanceTo(b));
  }
  return cum;
}

export class TrainPath {
  constructor(points) {
    this.points = points;
    this.cumulative = buildCumulative(points);
    this.total = this.cumulative[this.cumulative.length - 1];
  }

  sampleAt(distance) {
    const d = ((distance % this.total) + this.total) % this.total;
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = this.points[lo % this.points.length];
    const b = this.points[(lo + 1) % this.points.length];
    const segLen = this.cumulative[lo + 1] - this.cumulative[lo];
    const t = segLen > 1e-6 ? (d - this.cumulative[lo]) / segLen : 0;
    const pos = a.clone().lerp(b, t);
    const dir = b.clone().sub(a);
    const headingRad = Math.atan2(dir.x, dir.z);
    return { pos, headingRad };
  }
}

export class TrainConsist {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cars = []; // { mesh, offset }
    this.distance = 0;
    this.laps = 0;
    this.speed = 6; // units/sec at speed multiplier 1
  }

  async setComposition(locoId, carriageId, carriageCount) {
    this.group.clear();
    this.cars = [];
    let offset = 0;
    const locoMesh = await loadModel(locoId);
    this.cars.push({ mesh: locoMesh, offset });
    this.group.add(locoMesh);
    offset -= COUPLING_GAP + 3.2;
    for (let i = 0; i < carriageCount; i++) {
      const mesh = await loadModel(carriageId);
      this.cars.push({ mesh, offset });
      this.group.add(mesh);
      offset -= COUPLING_GAP + 2.6;
    }
  }

  update(dt, path, speedMultiplier) {
    if (!path || !path.total) return;
    this.distance += dt * this.speed * speedMultiplier;
    this.laps = Math.floor(this.distance / path.total);
    for (const car of this.cars) {
      const { pos, headingRad } = path.sampleAt(this.distance + car.offset);
      car.mesh.position.copy(pos);
      car.mesh.rotation.y = headingRad;
    }
  }

  get headPosition() {
    return this.cars[0]?.mesh.position;
  }
}

export { pathLength };
