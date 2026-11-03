import {mulberry32} from '../erosion/prng';
import {presets, type PresetId} from './presets';

/**
 * Heights lie in [0, n / 2) for a grid of n cells: octave amplitudes sum to less than
 * amplitude * n / (1 - gain), and with a first amplitude of n / 4 and gain at most 0.5 that is under n / 2 (tested).
 */
export function heightRange(n: number): {min: number; max: number} {
  return {min: 0, max: n / 2};
}

interface Lattice {
  size: number;
  values: Float32Array;
}

function makeLattice(n: number, step: number, rand: () => number): Lattice {
  const size = Math.floor(n / step) + 2;
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i++) values[i] = rand();
  return {size, values};
}

/** Smoothed value noise at (px, py), in [0, 1). Only + - * and a floor, so every engine agrees. */
function sample(l: Lattice, step: number, px: number, py: number): number {
  const gx = Math.floor(px / step);
  const gy = Math.floor(py / step);
  const fx = px / step - gx;
  const fy = py / step - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v00 = l.values[gy * l.size + gx]!;
  const v10 = l.values[gy * l.size + gx + 1]!;
  const v01 = l.values[(gy + 1) * l.size + gx]!;
  const v11 = l.values[(gy + 1) * l.size + gx + 1]!;
  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

/** Folds a coordinate back into [0, limit]. Clamping instead would send every cell the warp pushes past an edge to the same border sample, which draws streaks along that edge. */
function reflect(v: number, limit: number): number {
  const folded = v < 0 ? -v : v > limit ? 2 * limit - v : v;
  return folded < 0 ? 0 : folded > limit ? limit : folded;
}

/** A height field of n x n cells, row-major, from a seed and a preset. */
export function generateTerrain(n: number, seed: number, presetId: PresetId): Float32Array {
  const preset = presets[presetId];
  const heights = new Float32Array(n * n);
  const rand = mulberry32(seed);

  // The warp field has its own generator so it never shifts the octave lattices.
  let warpX: Lattice | null = null;
  let warpY: Lattice | null = null;
  const warpStep = Math.max(1, n >> 2);
  if (preset.warp > 0) {
    const warpRand = mulberry32(seed ^ 0x9e3779b9);
    warpX = makeLattice(n, warpStep, warpRand);
    warpY = makeLattice(n, warpStep, warpRand);
  }
  const limit = n - 1;

  let amp = n * preset.amplitude;
  let step = n >> 1;
  let octave = 0;
  while (step >= 1 && octave < preset.octaves) {
    const lattice = makeLattice(n, step, rand);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let px = x;
        let py = y;
        if (warpX && warpY) {
          const shift = n * preset.warp;
          px += (sample(warpX, warpStep, x, y) * 2 - 1) * shift;
          py += (sample(warpY, warpStep, x, y) * 2 - 1) * shift;
          px = reflect(px, limit);
          py = reflect(py, limit);
        }
        let v = sample(lattice, step, px, py);
        if (preset.ridged) {
          const t = v * 2 - 1;
          v = 1 - (t < 0 ? -t : t);
        }
        heights[y * n + x]! += amp * v;
      }
    }
    amp *= preset.gain;
    step >>= 1;
    octave++;
  }
  return heights;
}

/** FNV-1a over the bit patterns of a height field; equal hashes mean bit-for-bit equal terrain. */
export function hashHeights(heights: Float32Array): string {
  let h = 0x811c9dc5;
  const bits = new Uint32Array(heights.buffer, heights.byteOffset, heights.length);
  for (let i = 0; i < bits.length; i++) h = Math.imul(h ^ bits[i]!, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Heights scaled to 0..255 for a greyscale image, using the documented range so presets compare. */
export function toGrey(heights: Float32Array, n: number): Uint8ClampedArray {
  const {max} = heightRange(n);
  const out = new Uint8ClampedArray(heights.length);
  for (let i = 0; i < heights.length; i++) out[i] = (heights[i]! / max) * 255;
  return out;
}
