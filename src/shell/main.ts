import {presetIds, presets, type PresetId} from '../core/terrain/presets';
import {defaultOrbit, type OrbitState} from '../core/camera/orbit';
import {generateTerrain} from '../core/terrain/noise';
import {gridSize, parseSeed} from './heightmap';
import {attachOrbitControls} from './orbitControls';
import {createSurface, type Surface} from './surface';
import {drawRelief} from './relief';

const seedInput = document.getElementById('seed') as HTMLInputElement;
const picker = document.getElementById('preset') as HTMLSelectElement;
const main = document.getElementById('main') as HTMLCanvasElement;
const contoursBox = document.getElementById('contours') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;
const viewPicker = document.getElementById('view') as HTMLSelectElement;
const surfaceCanvas = document.getElementById('surface') as HTMLCanvasElement;
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

function redraw(): void {
  surface?.draw(camera);
}

function render(): void {
  const seed = parseSeed(seedInput.value, 1);
  seedInput.value = String(seed);
  const preset = picker.value as PresetId;
  const ok =
    drawRelief(main, seed, preset, contoursBox.checked) &&
    presetIds.every((id) => drawRelief(thumbs.get(id)!, seed, id, contoursBox.checked));
  let message = ok ? '' : 'This browser cannot draw the relief: the 2D canvas is unavailable.';
  let show3d = false;
  if (ok && viewPicker.value === '3d') {
    status.textContent = 'Starting the 3D view...';
    const s = ensureSurface();
    if (s) {
      s.setHeights(generateTerrain(gridSize, seed, preset));
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

seedInput.addEventListener('change', render);
picker.addEventListener('change', render);
if (new URLSearchParams(location.search).get('view') === '3d') viewPicker.value = '3d';
contoursBox.addEventListener('change', render);
viewPicker.addEventListener('change', render);
window.addEventListener('resize', () => requestAnimationFrame(redraw));
render();
