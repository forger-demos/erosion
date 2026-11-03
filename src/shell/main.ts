import {presetIds, presets, type PresetId} from '../core/terrain/presets';
import {parseSeed} from './heightmap';
import {drawRelief} from './relief';

const seedInput = document.getElementById('seed') as HTMLInputElement;
const picker = document.getElementById('preset') as HTMLSelectElement;
const main = document.getElementById('main') as HTMLCanvasElement;
const contoursBox = document.getElementById('contours') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;
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

function render(): void {
  const seed = parseSeed(seedInput.value, 1);
  seedInput.value = String(seed);
  const ok =
    drawRelief(main, seed, picker.value as PresetId, contoursBox.checked) &&
    presetIds.every((id) => drawRelief(thumbs.get(id)!, seed, id, contoursBox.checked));
  status.textContent = ok ? '' : 'This browser cannot draw the relief: the 2D canvas is unavailable.';
  main.hidden = !ok;
  strip.hidden = !ok;
}

seedInput.addEventListener('change', render);
picker.addEventListener('change', render);
contoursBox.addEventListener('change', render);
render();
