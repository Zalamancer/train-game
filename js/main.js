import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { preload, loadModel, LOCOMOTIVES, CARRIAGES, TRACK } from './assets.js';
import { TrackChain, PIECE_TYPES, DAMAGED_MODEL } from './track.js';
import { TrainPath, TrainConsist } from './train.js';
import { spawnCargo, updateCargo, disposeCargo } from './cargo.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecae6);
scene.fog = new THREE.Fog(0x8ecae6, 70, 200);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(18, 20, 26);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 8;
controls.maxDistance = 140;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a3a, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(40, 60, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x5c8a52 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
scene.add(ground);

const grid = new THREE.GridHelper(200, 50, 0x2f4a2c, 0x3c5c38);
scene.add(grid);

const trackGroup = new THREE.Group();
scene.add(trackGroup);

const chain = new TrackChain();
let mode = 'build';
let trainConsist = null;
let trainPath = null;
let cargoState = null;
let speedMultiplier = 1;
let followCam = false;
let buildVersion = 0;

const hud = {
  pieces: document.getElementById('stat-pieces'),
  cargo: document.getElementById('stat-cargo'),
  laps: document.getElementById('stat-laps'),
  banner: document.getElementById('mode-banner'),
  buildPanel: document.getElementById('build-panel'),
  playPanel: document.getElementById('play-panel'),
  playBtn: document.getElementById('btn-play'),
  loading: document.getElementById('loading'),
};

function updateHud() {
  hud.pieces.textContent = `Pieces: ${chain.length}`;
  hud.cargo.textContent = cargoState ? `Cargo: ${cargoState.collected}/${cargoState.total}` : 'Cargo: 0/0';
  hud.laps.textContent = `Laps: ${trainConsist ? trainConsist.laps : 0}`;
}

function updatePlayButtonState() {
  const closed = chain.isClosedLoop();
  hud.playBtn.disabled = !closed;
  hud.banner.textContent = closed ? 'Loop complete — ready to run!' : '';
}

// Kenney's track GLBs anchor their named root node at the rail surface, but
// the actual mesh node sits 1 unit below it (a Unity-export pivot artifact) —
// counteract it here so the rendered rail lines up with y=0, matching the
// ground plane and the train's path coordinates.
const TRACK_MESH_Y_OFFSET = 1;

async function rebuildTrackMeshes() {
  const version = ++buildVersion;
  const meshes = await Promise.all(
    chain.pieces.map(async (piece) => {
      const def = PIECE_TYPES[piece.type];
      const modelId = piece.damaged ? DAMAGED_MODEL[piece.type] : def.modelId;
      const mesh = await loadModel(modelId);
      if (def.mirror) {
        mesh.scale.x = -1;
        mesh.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone();
            o.material.side = THREE.DoubleSide;
          }
        });
      }
      mesh.position.set(piece.pos.x, piece.pos.y + TRACK_MESH_Y_OFFSET, piece.pos.z);
      mesh.rotation.y = THREE.MathUtils.degToRad(piece.headingDeg);
      return mesh;
    })
  );
  if (version !== buildVersion) return;
  trackGroup.clear();
  for (const m of meshes) trackGroup.add(m);
}

function placePiece(type, damaged = false) {
  if (mode !== 'build') return;
  chain.append(type, damaged);
  rebuildTrackMeshes();
  updateHud();
  updatePlayButtonState();
}

function undo() {
  if (mode !== 'build') return;
  chain.removeLast();
  rebuildTrackMeshes();
  updateHud();
  updatePlayButtonState();
}

function clearAll() {
  if (mode !== 'build') return;
  chain.clear();
  rebuildTrackMeshes();
  updateHud();
  updatePlayButtonState();
}

const palette = document.getElementById('palette');
function makePaletteBtn(label, onClick) {
  const b = document.createElement('button');
  b.className = 'palette-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  palette.appendChild(b);
}
makePaletteBtn('Straight ↑', () => placePiece('straight'));
makePaletteBtn('Curve Left ↰', () => placePiece('cornerL'));
makePaletteBtn('Curve Right ↱', () => placePiece('cornerR'));
makePaletteBtn('Damaged Straight ⚠', () => placePiece('straight', true));

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-clear').addEventListener('click', clearAll);

const locoSelect = document.getElementById('loco-select');
for (const l of LOCOMOTIVES) {
  const o = document.createElement('option');
  o.value = l.id;
  o.textContent = l.label;
  locoSelect.appendChild(o);
}
const carriageSelect = document.getElementById('carriage-select');
for (const c of CARRIAGES) {
  const o = document.createElement('option');
  o.value = c.id;
  o.textContent = c.label;
  carriageSelect.appendChild(o);
}

async function startPlay() {
  if (!chain.isClosedLoop()) return;
  mode = 'play';
  hud.buildPanel.classList.add('hidden');
  hud.playPanel.classList.remove('hidden');
  const points = chain.buildPath();
  trainPath = new TrainPath(points);
  trainConsist = new TrainConsist(scene);
  await trainConsist.setComposition(locoSelect.value, carriageSelect.value, 2);
  cargoState = spawnCargo(scene, trainPath);
  updateHud();
}

function stopPlay() {
  mode = 'build';
  hud.buildPanel.classList.remove('hidden');
  hud.playPanel.classList.add('hidden');
  if (trainConsist) {
    scene.remove(trainConsist.group);
    trainConsist = null;
  }
  if (cargoState) {
    disposeCargo(cargoState);
    cargoState = null;
  }
  trainPath = null;
  updateHud();
}

hud.playBtn.addEventListener('click', startPlay);
document.getElementById('btn-stop').addEventListener('click', stopPlay);

const speedSlider = document.getElementById('speed-slider');
speedSlider.addEventListener('input', () => {
  speedMultiplier = parseFloat(speedSlider.value);
});

const cameraBtn = document.getElementById('btn-camera');
cameraBtn.addEventListener('click', () => {
  followCam = !followCam;
  cameraBtn.textContent = followCam ? 'Camera: Follow' : 'Camera: Free';
  controls.enabled = !followCam;
});

window.addEventListener('keydown', (e) => {
  if (mode !== 'build') return;
  switch (e.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      placePiece('straight');
      break;
    case 'a':
    case 'arrowleft':
      placePiece('cornerL');
      break;
    case 'd':
    case 'arrowright':
      placePiece('cornerR');
      break;
    case 'z':
      undo();
      break;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function stepSimulation(dt) {
  if (mode === 'play' && trainConsist && trainPath) {
    trainConsist.update(dt, trainPath, speedMultiplier);
    const headPos = trainConsist.headPosition;
    if (cargoState && headPos) {
      const collected = updateCargo(cargoState, headPos);
      if (collected > 0) updateHud();
    }
    if (followCam && headPos) {
      const desired = headPos.clone().add(new THREE.Vector3(0, 9, 14));
      camera.position.lerp(desired, 0.06);
      controls.target.lerp(headPos, 0.15);
    }
    hud.laps.textContent = `Laps: ${trainConsist.laps}`;
  }
  controls.update();
  renderer.render(scene, camera);
}

let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  stepSimulation(dt);
}

async function init() {
  const ids = [
    TRACK.straight,
    TRACK.corner,
    DAMAGED_MODEL.straight,
    DAMAGED_MODEL.cornerR,
    ...LOCOMOTIVES.map((l) => l.id),
    ...CARRIAGES.map((c) => c.id),
  ];
  await preload(ids);
  hud.loading.classList.add('hidden');
  await rebuildTrackMeshes();
  updateHud();
  updatePlayButtonState();
  animate();
}

window.__game = {
  chain,
  scene,
  camera,
  renderer,
  controls,
  placePiece,
  undo,
  clearAll,
  startPlay,
  stopPlay,
  step(n = 1, dt = 0.05) {
    for (let i = 0; i < n; i++) stepSimulation(dt);
  },
  getMode: () => mode,
  getTrainConsist: () => trainConsist,
  getCargoState: () => cargoState,
};

init();
