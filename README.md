# Loop Line — Toy Railway Builder

A 3D toy railway builder game built with Three.js. Design your own train loops by laying track pieces, select a locomotive and carriage, then watch your train run the circuit.

## Run

Open `index.html` directly in a web browser. No build step or server required.

## Structure

- **index.html** — Main entry point; sets up Three.js canvas and HUD UI
- **js/main.js** — Game loop, scene setup, camera controls, mode management (build/play)
- **js/track.js** — Track piece definitions, placement logic, loop validation
- **js/train.js** — Train path following, locomotive/carriage consist management
- **js/cargo.js** — Cargo spawning and pickup mechanics
- **js/assets.js** — Model loading via GLTFLoader, locomotive and carriage roster
- **css/style.css** — Canvas, HUD, UI panel styling
- **vendor/three/** — Three.js library (bundled as ES modules)
- **assets/kenney_train-kit/** — 3D GLB models for track pieces, locomotives, and carriages

## Notes

All code is client-side vanilla JavaScript with no build step or dependencies to install. The Three.js library and Kenney train kit assets are bundled locally. Simply open the HTML file in a modern browser to play.