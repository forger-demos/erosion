import {generateTerrain} from '../terrain/noise';
import type {PresetId} from '../terrain/presets';

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

/**
 * Longest time step the pipe model integrates stably: the flux and depth updates form a
 * wave equation whose fastest (checkerboard) mode needs dt^2 * 8 * g * pipeArea / cell^3 <= 4.
 */
export function maxStableDt(p: Pick<Params, 'g' | 'pipeArea' | 'cell'>): number {
  return Math.sqrt((p.cell * p.cell * p.cell) / (2 * p.pipeArea * p.g));
}

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

/** An empty-water grid whose bed is the seeded terrain for a preset. */
export function createGrid(n: number, seed: number, preset: PresetId = 'hills'): Grid {
  const size = n * n;
  return {
    n,
    b: generateTerrain(n, seed, preset),
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
