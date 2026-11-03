import type {WaterOverlay} from '../core/water/overlay';
import {renderRelief} from '../core/relief/relief';
import {generateTerrain} from '../core/terrain/noise';
import type {PresetId} from '../core/terrain/presets';
import {reliefScale, upsample} from '../core/relief/upsample';
import {gridSize} from './heightmap';

/** Draws the coloured relief for a seed and preset. Returns false when the canvas has no 2D context. */
export function drawRelief(canvas: HTMLCanvasElement, seed: number, preset: PresetId, contours: boolean): boolean {
  return drawReliefHeights(canvas, generateTerrain(gridSize, seed, preset), contours);
}

/** Draws the coloured relief for a height field, such as a frame from the running simulation, with its water if any. */
export function drawReliefHeights(canvas: HTMLCanvasElement, heights: Float32Array, contours: boolean, water?: WaterOverlay): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const n = Math.round(Math.sqrt(heights.length));
  const k = reliefScale(n);
  const m = n * k;
  canvas.width = m;
  canvas.height = m;
  // Resampling first lets contours be traced on the smooth field; scaling heights by k keeps slope per cell and the height fraction as they were.
  const scaled = water && {
    ...water,
    surface: upsample(water.surface, n, k, k),
    lake: new Uint8Array(0),
    river: new Float32Array(0),
    wetness: upsample(water.wetness, n, k),
    alpha: upsample(water.alpha, n, k),
  };
  const rgba = renderRelief(upsample(heights, n, k, k), m, {contours, water: scaled});
  const image = ctx.createImageData(m, m);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return true;
}
