import * as THREE from 'three';

// Kenney track pieces are authored entry-at-origin, facing local +Z, so the
// whole layout can be built as a "turtle graphics" chain: each piece advances
// a cursor (position + heading) by a fixed local offset/turn, instead of
// snapping into an explicit grid. A straight piece is a TILE_LENGTH segment;
// railroad-corner-large is a 90 degree arc whose chord (4,4) implies radius
// TILE_LENGTH (chord = radius*sqrt(2) for a quarter circle).
export const TILE_LENGTH = 4;
export const CORNER_RADIUS = TILE_LENGTH;
export const ARC_SAMPLES = 10;

export const PIECE_TYPES = {
  straight: { modelId: 'railroad-straight', turnDeg: 0, mirror: false },
  cornerR: { modelId: 'railroad-corner-large', turnDeg: -90, mirror: false },
  cornerL: { modelId: 'railroad-corner-large', turnDeg: 90, mirror: true },
};

export const DAMAGED_MODEL = {
  straight: 'railroad-damaged-straight',
  cornerR: 'railroad-damaged-corner-large',
  cornerL: 'railroad-damaged-corner-large',
};

function arcSamples(turnDeg) {
  if (turnDeg === 0) {
    return [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, TILE_LENGTH)];
  }
  const sign = Math.sign(turnDeg);
  const center = new THREE.Vector3(sign * CORNER_RADIUS, 0, 0);
  const pts = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = (i / ARC_SAMPLES) * (Math.PI / 2);
    const x = center.x - sign * CORNER_RADIUS * Math.cos(t);
    const z = CORNER_RADIUS * Math.sin(t);
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return pts;
}

export class TrackChain {
  constructor() {
    this.pieces = []; // {type, damaged, pos: Vector3, headingDeg}
    this.cursorPos = new THREE.Vector3(0, 0, 0);
    this.cursorHeading = 0;
  }

  get length() {
    return this.pieces.length;
  }

  canAppend() {
    return true;
  }

  append(type, damaged = false) {
    const def = PIECE_TYPES[type];
    const placement = {
      type,
      damaged,
      pos: this.cursorPos.clone(),
      headingDeg: this.cursorHeading,
    };
    this.pieces.push(placement);

    const samples = arcSamples(def.turnDeg);
    const local = samples[samples.length - 1];
    const world = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(this.cursorHeading));
    this.cursorPos.add(world);
    this.cursorHeading += def.turnDeg;
    return placement;
  }

  removeLast() {
    if (!this.pieces.length) return;
    this.pieces.pop();
    this._replay();
  }

  clear() {
    this.pieces = [];
    this._replay();
  }

  _replay() {
    const saved = this.pieces;
    this.pieces = [];
    this.cursorPos.set(0, 0, 0);
    this.cursorHeading = 0;
    for (const p of saved) this.append(p.type, p.damaged);
  }

  isClosedLoop(tolerance = 0.08) {
    if (this.pieces.length < 4) return false;
    const distFromStart = this.cursorPos.length();
    const headingMod = ((this.cursorHeading % 360) + 360) % 360;
    const headingOk = headingMod < 1 || headingMod > 359;
    return distFromStart < tolerance && headingOk;
  }

  // Flattened polyline of {pos, headingDeg} for train movement, looping back
  // to the first point. Does not include the final duplicate of pos[0].
  buildPath() {
    const path = [];
    for (const piece of this.pieces) {
      const def = PIECE_TYPES[piece.type];
      const samples = arcSamples(def.turnDeg);
      const rot = THREE.MathUtils.degToRad(piece.headingDeg);
      for (let i = 0; i < samples.length - 1; i++) {
        const s = samples[i];
        const world = s.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(piece.pos);
        path.push(world);
      }
    }
    return path;
  }
}

export function isCorner(type) {
  return type === 'cornerR' || type === 'cornerL';
}
