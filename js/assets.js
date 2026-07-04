import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_BASE = 'assets/kenney_train-kit/Models/glb/';
const loader = new GLTFLoader();
const cache = new Map();

export const TRACK = {
  straight: 'railroad-straight',
  corner: 'railroad-corner-large',
};

export const LOCOMOTIVES = [
  { id: 'train-locomotive-a', label: 'Steam Classic' },
  { id: 'train-locomotive-b', label: 'Steam Heavy' },
  { id: 'train-diesel-a', label: 'Diesel' },
  { id: 'train-electric-bullet-a', label: 'Bullet Train' },
  { id: 'train-electric-city-a', label: 'City Electric' },
  { id: 'train-electric-subway-a', label: 'Subway' },
  { id: 'train-tram-modern', label: 'Modern Tram' },
];

export const CARRIAGES = [
  { id: 'train-carriage-box', label: 'Boxcar' },
  { id: 'train-carriage-container-blue', label: 'Container (Blue)' },
  { id: 'train-carriage-container-red', label: 'Container (Red)' },
  { id: 'train-carriage-container-green', label: 'Container (Green)' },
  { id: 'train-carriage-coal', label: 'Coal Hopper' },
  { id: 'train-carriage-tank', label: 'Tanker' },
  { id: 'train-carriage-lumber', label: 'Lumber Flatcar' },
  { id: 'train-carriage-flatbed', label: 'Flatbed' },
];

function loadRaw(id) {
  if (!cache.has(id)) {
    const url = `${MODEL_BASE}${id}.glb`;
    cache.set(id, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return cache.get(id);
}

export async function loadModel(id) {
  const scene = await loadRaw(id);
  return scene.clone(true);
}

export async function preload(ids) {
  await Promise.all(ids.map(loadRaw));
}
