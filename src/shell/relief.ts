import type {WaterOverlay} from '../core/water/overlay';
import {renderRelief} from '../core/relief/relief';
import {generateTerrain} from '../core/terrain/noise';
import type {PresetId} from '../core/terrain/presets';
import {gridSize} from './heightmap';

/** Draws the coloured relief for a seed and preset. Returns false when the canvas has no 2D context. */
export function drawRelief(canvas: HTMLCanvasElement, seed: number, preset: PresetId, contours: boolean): boolean {
  return drawReliefHeights(canvas, generateTerrain(gridSize, seed, preset), contours);
}

/** Draws the coloured relief for a height field, such as a frame from the running simulation, with its water if any. */
export function drawReliefHeights(canvas: HTMLCanvasElement, heights: Float32Array, contours: boolean, water?: WaterOverlay): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = gridSize;
  canvas.height = gridSize;
  const rgba = renderRelief(heights, gridSize, {contours, water});
  const image = ctx.createImageData(gridSize, gridSize);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return true;
}
