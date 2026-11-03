import {heightRange} from '../terrain/noise';
import {groundColour} from './colour';
import {contourMask} from './contours';
import {hillshade, slopeMap} from './hillshade';
import {reliefPalette, type Palette} from './palette';

export interface ReliefOptions {
  contours: boolean;
  /** Per-cell wetness 0 to 1; absent means dry everywhere. */
  wetness?: Float32Array;
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

/** Shaded, coloured relief as opaque RGBA bytes, row-major, for a height field of n x n cells. */
export function renderRelief(heights: Float32Array, n: number, opts: ReliefOptions): Uint8ClampedArray {
  const p = opts.palette ?? reliefPalette;
  const {min, max} = heightRange(n);
  const shade = hillshade(heights, n);
  const slope = slopeMap(heights, n);
  const lines = opts.contours ? contourMask(heights, n, contourInterval(n)) : null;
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const [r, g, b] = groundColour((heights[i]! - min) / (max - min), slope[i]!, opts.wetness?.[i] ?? 0, p);
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
