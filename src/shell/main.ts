import {presetIds, presets, type PresetId} from '../core/terrain/presets';
import {defaultOrbit, type OrbitState} from '../core/camera/orbit';
import {generateTerrain} from '../core/terrain/noise';
import {gridSize, parseSeed} from './heightmap';
import {attachOrbitControls} from './orbitControls';
import {createSurface, type Surface} from './surface';
import {drawRelief, drawReliefHeights} from './relief';
import {waterOverlay, type WaterOverlay} from '../core/water/overlay';
import {clampSettings, hardnessRange, rainRange, scenarios} from '../core/erosion/settings';
import {createSimClient, type SimClient} from './simClient';
import {gpuGridSize} from '../core/erosion/path';

const seedInput = document.getElementById('seed') as HTMLInputElement;
const picker = document.getElementById('preset') as HTMLSelectElement;
const main = document.getElementById('main') as HTMLCanvasElement;
const contoursBox = document.getElementById('contours') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;
const viewPicker = document.getElementById('view') as HTMLSelectElement;
let surfaceCanvas = document.getElementById('surface') as HTMLCanvasElement;
const pathOut = document.getElementById('path') as HTMLElement;
const playButton = document.getElementById('play') as HTMLButtonElement;
const retryButton = document.getElementById('retry') as HTMLButtonElement;
const stepsOut = document.getElementById('steps') as HTMLOutputElement;
const rainInput = document.getElementById('rain') as HTMLInputElement;
const hardnessInput = document.getElementById('hardness') as HTMLInputElement;
const rainOut = document.getElementById('rain-out') as HTMLOutputElement;
const hardnessOut = document.getElementById('hardness-out') as HTMLOutputElement;
const timeInput = document.getElementById('time') as HTMLInputElement;
const strip = document.getElementById('strip') as HTMLElement;

for (const id of presetIds) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = presets[id].label;
  picker.append(option);
}

for (const [input, range] of [[rainInput, rainRange], [hardnessInput, hardnessRange]] as const) {
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
}

function applyScenario(id: PresetId): void {
  rainInput.value = String(scenarios[id].rain);
  hardnessInput.value = String(scenarios[id].hardness);
  showSettings();
}

function showSettings(): void {
  rainOut.textContent = Number(rainInput.value).toFixed(3);
  hardnessOut.textContent = Number(hardnessInput.value).toFixed(2);
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
/** Edge of the grid on show: the preview's, until a run says what size its path uses. */
let size = gridSize;
let camera: OrbitState = defaultOrbit(size);

function ensureSurface(): Surface | null {
  if (surface || surfaceFailed) return surface;
  const result = createSurface(surfaceCanvas, size);
  if (!result.ok) {
    surfaceFailed = result.reason;
    return null;
  }
  surface = result.surface;
  attachOrbitControls(surfaceCanvas, size, () => camera, (s) => (camera = s), () => requestAnimationFrame(redraw));
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
  else if (starting) status.textContent = 'Starting the simulation (compiling shaders)...';
  else if (replaying) status.textContent = `Replaying to step ${timeInput.value}...`;
  else if (status.textContent?.startsWith('Replaying') || status.textContent === 'Starting the simulation (compiling shaders)...') status.textContent = '';
}

let replaying = false;

function showFrame(steps: number, reached: number, height: Float32Array, water: Float32Array): void {
  timeInput.max = String(reached);
  timeInput.value = String(steps);
  timeInput.disabled = false;
  timeInput.setAttribute('aria-valuetext', `Step ${steps} of ${reached}`);
  replaying = false;
  latest = height;
  overlay = waterOverlay(height, water, size);
  stepsOut.textContent = `Step ${steps}`;
  drawReliefHeights(main, height, contoursBox.checked, overlay);
  const shown = surfaceCanvas.hidden ? null : ensureSurface();
  if (shown) {
    shown.setHeights(overlay.surface);
    shown.setWater(overlay.wetness, overlay.alpha);
    requestAnimationFrame(redraw);
  }
}

/** A surface is built for one grid size; a different size needs a fresh canvas, since a canvas keeps its first context. */
function resize(n: number): void {
  if (n === size) return;
  size = n;
  camera = defaultOrbit(size);
  const fresh = surfaceCanvas.cloneNode(false) as HTMLCanvasElement;
  surfaceCanvas.replaceWith(fresh);
  surfaceCanvas = fresh;
  surface = null;
  surfaceFailed = null;
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
      resize(m.n);
      pathOut.textContent = m.label;
      starting = false;
      mine.send({type: 'play'});
      playing = true;
    } else if (m.type === 'frame') {
      showFrame(m.steps, m.reached, m.height, m.water);
    } else if (m.type === 'error') {
      failure = `The simulation stopped: ${m.message}`;
      replaying = false;
      stopClient();
    }
    syncControls();
  });
  client = mine;
  const {rain, hardness} = clampSettings({rain: Number(rainInput.value), hardness: Number(hardnessInput.value)});
  mine.send({type: 'init', n: gridSize, gpuN: gpuGridSize, seed: parseSeed(seedInput.value, 1), preset: picker.value as PresetId, rain, hardness});
  syncControls();
}

playButton.addEventListener('click', () => {
  if (!client) return startClient();
  playing = !playing;
  client.send({type: playing ? 'play' : 'pause'});
  syncControls();
});
retryButton.addEventListener('click', startClient);

timeInput.addEventListener('input', () => {
  if (!client) return;
  playing = false;
  replaying = true;
  client.send({type: 'seek', step: Number(timeInput.value)});
  syncControls();
});

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
    timeInput.max = '0';
    timeInput.value = '0';
    timeInput.disabled = true;
    replaying = false;
    pathOut.textContent = '';
    resize(gridSize);
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
      else s.setWater(new Float32Array(size * size), new Float32Array(size * size));
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
picker.addEventListener('change', () => {
  applyScenario(picker.value as PresetId);
  render();
});
for (const input of [rainInput, hardnessInput]) {
  input.addEventListener('input', showSettings);
  input.addEventListener('change', () => render());
}
if (new URLSearchParams(location.search).get('view') === '3d') viewPicker.value = '3d';
contoursBox.addEventListener('change', () => render(false));
viewPicker.addEventListener('change', () => render(false));
window.addEventListener('resize', () => requestAnimationFrame(redraw));
applyScenario(picker.value as PresetId);
render();
