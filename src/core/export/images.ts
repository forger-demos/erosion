import {heightRange} from '../terrain/noise';
import {renderRelief} from '../relief/relief';
import {waterOverlay} from '../water/overlay';
import {encodePng} from './png';

/** A 16-bit greyscale PNG of the bed, scaled over the terrain's full height range so files compare across steps. */
export function heightmapPng(height: Float32Array, n: number): Uint8Array {
  const {max} = heightRange(n);
  const data = new Uint8Array(n * n * 2);
  for (let i = 0; i < n * n; i++) {
    const s = (height[i]! / max) * 65535 + 0.5;
    const v = s < 0 ? 0 : s > 65535 ? 65535 : Math.floor(s);
    data[i * 2] = v >> 8;
    data[i * 2 + 1] = v & 0xff;
  }
  return encodePng({width: n, height: n, depth: 16, channels: 1, data});
}

/** An 8-bit RGBA PNG of the shaded relief with its rivers and lakes, as the page draws it. */
export function shadedPng(height: Float32Array, water: Float32Array, n: number, contours: boolean): Uint8Array {
  const rgba = renderRelief(height, n, {contours, water: waterOverlay(height, water, n)});
  return encodePng({width: n, height: n, depth: 8, channels: 4, data: rgba});
}

export type ExportKind = 'heightmap' | 'shaded';

/** The download name: it says what the file is and which run, so two exports never collide. */
export function exportFilename(kind: ExportKind, preset: string, seed: number, step: number): string {
  return `erosion-${preset}-seed${seed}-step${step}-${kind === 'heightmap' ? 'height16' : 'shaded'}.png`;
}
