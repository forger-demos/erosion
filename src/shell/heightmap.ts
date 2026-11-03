import {generateTerrain, toGrey} from '../core/terrain/noise';
import type {PresetId} from '../core/terrain/presets';

export const gridSize = 256;

/** Draws the greyscale heightmap for a seed and preset. Returns false when the canvas has no 2D context. */
export function drawHeightmap(canvas: HTMLCanvasElement, seed: number, preset: PresetId): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = gridSize;
  canvas.height = gridSize;
  const grey = toGrey(generateTerrain(gridSize, seed, preset), gridSize);
  const image = ctx.createImageData(gridSize, gridSize);
  for (let i = 0; i < grey.length; i++) {
    const v = grey[i]!;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return true;
}

/** Reads a seed field: a non-negative whole number, else the fallback. */
export function parseSeed(text: string, fallback: number): number {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 4294967295 ? n : fallback;
}
