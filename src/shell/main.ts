import {presetIds, presets, type PresetId} from '../core/terrain/presets';
import {defaultOrbit, type OrbitState} from '../core/camera/orbit';
import {generateTerrain} from '../core/terrain/noise';
import {gridSize, parseSeed} from './heightmap';
import {attachOrbitControls} from './orbitControls';
import {createSurface, type Surface} from './surface';
import {drawRelief, drawReliefHeights} from './relief';
import {waterOverlay, type WaterOverlay} from '../core/water/overlay';
import {createSimClient, type SimClient} from './simClient';

const seedInput = document.getElementById('seed') as HTMLInputElement;
const picker = document.getElementById('preset') as HTMLSelectElement;
const main = document.getElementById('main') as HTMLCanvasElement;
const contoursBox = document.getElementById('contours') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;
const viewPicker = document.getElementById('view') as HTMLSelectElement;
const surfaceCanvas = document.getElementById('surface') as HTMLCanvasElement;
const playButton = document.getElementById('play') as HTMLButtonElement;
const retryButton = document.getElementById('retry') as HTMLButtonElement;
const stepsOut = document.getElementById('steps') as HTMLOutputElement;
const strip = document.getElementById('strip') as HTMLElement;

for (const id of presetIds) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = presets[id].label;
  picker.append(option);
}

const thumbs = new Map<PresetId, HTMLCanvasElement>();
for (const id of presetIds) {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  const caption = document.createElement('figcaption');
  caption.textContent = presets[id].label;
  figure.append(canvas, caption);
  strip.append(figure);
  thumbs.set(id, canvas);
}

let surface: Surface | null = null;
let surfaceFailed: string | null = null;
let camera: OrbitState = defaultOrbit(gridSize);

function ensureSurface(): Surface | null {
  if (surface || surfaceFailed) return surface;
  const result = createSurface(surfaceCanvas, gridSize);
  if (!result.ok) {
    surfaceFailed = result.reason;
    return null;
  }
  surface = result.surface;
  attachOrbitControls(surfaceCanvas, gridSize, () => camera, (s) => (camera = s), () => requestAnimationFrame(redraw));
  return surface;
}

let client: SimClient | null = null;
let latest: Float32Array | null = null;
let overlay: WaterOverlay | null = null;
let playing = false;
let starting = false;
let failure: string | null = null;

function syncControls(): void {
  playButton.textContent = playing ? 'Pause' : 'Play';
  playButton.disabled = starting;
  retryButton.hidden = failure === null;
  if (failure !== null) status.textContent = failure;
  else if (starting) status.textContent = 'Starting the simulation...';
  else if (status.textContent === 'Starting the simulation...') status.textContent = '';
}

function showFrame(steps: number, height: Float32Array, water: Float32Array): void {
  latest = height;
  overlay = waterOverlay(height, water, gridSize);
  stepsOut.textContent = `Step ${steps}`;
  drawReliefHeights(main, height, contoursBox.checked, overlay);
  if (surface && !surfaceCanvas.hidden) {
    surface.setHeights(overlay.surface);
    surface.setWater(overlay.wetness, overlay.alpha);
    requestAnimationFrame(redraw);
  }
}

function stopClient(): void {
  client?.dispose();
  client = null;
  playing = false;
  starting = false;
}

function startClient(): void {
  stopClient();
  failure = null;
  starting = true;
  let worker: Worker;
  try {
    worker = new Worker('worker.js', {type: 'module'});
  } catch {
    failure = 'This browser cannot start the simulation worker.';
    starting = false;
    syncControls();
    return;
  }
  const mine = createSimClient(worker as never, (m) => {
    if (client !== mine) return;
    if (m.type === 'ready') {
      starting = false;
      mine.send({type: 'play'});
      playing = true;
    } else if (m.type === 'frame') {
      showFrame(m.steps, m.height, m.water);
    } else if (m.type === 'error') {
      failure = `The simulation stopped: ${m.message}`;
      stopClient();
    }
    syncControls();
  });
  client = mine;
  mine.send({type: 'init', n: gridSize, seed: parseSeed(seedInput.value, 1), preset: picker.value as PresetId});
  syncControls();
}

playButton.addEventListener('click', () => {
  if (!client) return startClient();
  playing = !playing;
  client.send({type: playing ? 'play' : 'pause'});
  syncControls();
});
retryButton.addEventListener('click', startClient);

function redraw(): void {
  surface?.draw(camera);
}

function render(reset = true): void {
  if (reset && (client || latest)) {
    stopClient();
    latest = null;
    overlay = null;
    failure = null;
    stepsOut.textContent = 'Step 0';
    syncControls();
  }
  const seed = parseSeed(seedInput.value, 1);
  seedInput.value = String(seed);
  const preset = picker.value as PresetId;
  const ok =
    (latest ? drawReliefHeights(main, latest, contoursBox.checked, overlay ?? undefined) : drawRelief(main, seed, preset, contoursBox.checked)) &&
    presetIds.every((id) => drawRelief(thumbs.get(id)!, seed, id, contoursBox.checked));
  let message = ok ? '' : 'This browser cannot draw the relief: the 2D canvas is unavailable.';
  let show3d = false;
  if (ok && viewPicker.value === '3d') {
    status.textContent = 'Starting the 3D view...';
    const s = ensureSurface();
    if (s) {
      s.setHeights(overlay?.surface ?? latest ?? generateTerrain(gridSize, seed, preset));
      if (overlay) s.setWater(overlay.wetness, overlay.alpha);
      else s.setWater(new Float32Array(gridSize * gridSize), new Float32Array(gridSize * gridSize));
      show3d = true;
    } else {
      message = `${surfaceFailed} The 2D relief is shown instead.`;
      viewPicker.value = '2d';
    }
  }
  status.textContent = message;
  main.hidden = !ok || show3d;
  surfaceCanvas.hidden = !show3d;
  strip.hidden = !ok;
  if (show3d) requestAnimationFrame(redraw);
}

seedInput.addEventListener('change', () => render());
picker.addEventListener('change', () => render());
if (new URLSearchParams(location.search).get('view') === '3d') viewPicker.value = '3d';
contoursBox.addEventListener('change', () => render(false));
viewPicker.addEventListener('change', () => render(false));
window.addEventListener('resize', () => requestAnimationFrame(redraw));
render();
