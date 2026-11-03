import {mulberry32} from './prng';

export interface Params {
  /** Seconds per step. */
  dt: number;
  /** Gravity, pipe area and pipe length of the virtual pipe model. */
  g: number;
  pipeArea: number;
  cell: number;
  /** Rain depth per second added to every cell. */
  rain: number;
  /** Sediment capacity, dissolve rate, deposit rate. */
  kc: number;
  ks: number;
  kd: number;
  /** Water depth at which erosion reaches full strength. */
  depthMax: number;
  /** Evaporation fraction per second. */
  evaporation: number;
  /** Thermal weathering: tangent of the talus angle and the share of the excess moved per step. */
  talus: number;
  thermalRate: number;
}

export const defaultParams: Params = {
  dt: 0.05,
  g: 9.81,
  pipeArea: 1,
  cell: 1,
  rain: 0.012,
  kc: 0.6,
  ks: 0.4,
  kd: 0.4,
  depthMax: 0.5,
  evaporation: 0.02,
  talus: 0.9,
  thermalRate: 0.1,
};

export interface Grid {
  n: number;
  /** Bed height, water depth, suspended sediment (as bed-height equivalent). */
  b: Float32Array;
  d: Float32Array;
  s: Float32Array;
  /** Outflow flux to left, right, up, down neighbours. */
  fl: Float32Array;
  fr: Float32Array;
  ft: Float32Array;
  fb: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Scratch: water depth after rain, and after the flux update. */
  d1: Float32Array;
  d2: Float32Array;
  /** Scratch: bed change from thermal weathering. */
  db: Float32Array;
  /** Running totals of water added by rain and removed by evaporation, in float64. */
  rained: number;
  evaporated: number;
}

/** A ridge-and-valley bed from seeded value noise, using only +, -, * so every engine agrees. */
export function createGrid(n: number, seed: number): Grid {
  const size = n * n;
  const grid: Grid = {
    n,
    b: new Float32Array(size),
    d: new Float32Array(size),
    s: new Float32Array(size),
    fl: new Float32Array(size),
    fr: new Float32Array(size),
    ft: new Float32Array(size),
    fb: new Float32Array(size),
    vx: new Float32Array(size),
    vy: new Float32Array(size),
    d1: new Float32Array(size),
    d2: new Float32Array(size),
    db: new Float32Array(size),
    rained: 0,
    evaporated: 0,
  };
  const rand = mulberry32(seed);
  let amp = n / 4;
  let step = n >> 1;
  while (step >= 1) {
    const lattice = Math.floor(n / step) + 2;
    const values = new Float32Array(lattice * lattice);
    for (let i = 0; i < values.length; i++) values[i] = rand();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const gx = Math.floor(x / step);
        const gy = Math.floor(y / step);
        const fx = x / step - gx;
        const fy = y / step - gy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const v00 = values[gy * lattice + gx]!;
        const v10 = values[gy * lattice + gx + 1]!;
        const v01 = values[(gy + 1) * lattice + gx]!;
        const v11 = values[(gy + 1) * lattice + gx + 1]!;
        const top = v00 + (v10 - v00) * sx;
        const bottom = v01 + (v11 - v01) * sx;
        grid.b[y * n + x]! += amp * (top + (bottom - top) * sy);
      }
    }
    amp *= 0.5;
    step >>= 1;
  }
  return grid;
}

/** FNV-1a over the bit patterns of the state arrays; equal hashes mean bit-for-bit equal runs. */
export function hashGrid(grid: Grid): string {
  let h = 0x811c9dc5;
  for (const arr of [grid.b, grid.d, grid.s]) {
    const bits = new Uint32Array(arr.buffer, arr.byteOffset, arr.length);
    for (let i = 0; i < bits.length; i++) {
      h = Math.imul(h ^ bits[i]!, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}
