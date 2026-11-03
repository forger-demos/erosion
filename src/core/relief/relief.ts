import {heightRange} from '../terrain/noise';
import {groundColour} from './colour';
import {contourMask} from './contours';
import {hillshade, slopeMap} from './hillshade';
import {reliefPalette, type Palette} from './palette';
import type {WaterOverlay} from '../water/overlay';

export interface ReliefOptions {
  contours: boolean;
  /** Rivers, lakes and wetness; absent means no water is drawn and the ground is dry. */
  water?: WaterOverlay;
  palette?: Palette;
}

/** Height difference between contour lines: a sixteenth of the terrain's height range. */
export function contourInterval(n: number): number {
  const {min, max} = heightRange(n);
  return (max - min) / 16;
}

function byte(v: number): number {
  const s = v * 255;
  return s < 0 ? 0 : s > 255 ? 255 : s;
}

/**
 * Shaded, coloured relief as opaque RGBA bytes, row-major, for a height field of n x n cells.
 * With a water overlay the terrain is lit from its drawn surface, so a lake shades as flat.
 */
export function renderRelief(bed: Float32Array, n: number, opts: ReliefOptions): Uint8ClampedArray {
  const heights = opts.water?.surface ?? bed;
  const p = opts.palette ?? reliefPalette;
  const {min, max} = heightRange(n);
  const shade = hillshade(heights, n);
  const slope = slopeMap(heights, n);
  const lines = opts.contours ? contourMask(heights, n, contourInterval(n)) : null;
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    let [r, g, b] = groundColour((heights[i]! - min) / (max - min), slope[i]!, opts.water?.wetness[i] ?? 0, p);
    const a = opts.water?.alpha[i] ?? 0;
    if (a > 0) {
      r += (p.water[0] - r) * a;
      g += (p.water[1] - g) * a;
      b += (p.water[2] - b) * a;
    }
    const light = p.ambient + p.gain * shade[i]!;
    let rgb: [number, number, number] = [r * light, g * light, b * light];
    if (lines && lines[i]) {
      const t = p.lineStrength;
      rgb = [rgb[0] + (p.line[0] - rgb[0]) * t, rgb[1] + (p.line[1] - rgb[1]) * t, rgb[2] + (p.line[2] - rgb[2]) * t];
    }
    out[i * 4] = byte(rgb[0]);
    out[i * 4 + 1] = byte(rgb[1]);
    out[i * 4 + 2] = byte(rgb[2]);
    out[i * 4 + 3] = 255;
  }
  return out;
}
