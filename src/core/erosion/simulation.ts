import {createGrid, defaultParams, type Grid, type Params} from './grid';
import {step} from './step';
import type {PresetId} from '../terrain/presets';

/** Copies of the three fields a viewer needs, detached from the live state. */
export interface Snapshot {
  steps: number;
  height: Float32Array;
  water: Float32Array;
  sediment: Float32Array;
}

export interface Simulation {
  readonly n: number;
  readonly steps: number;
  advance(count: number): void;
  snapshot(): Snapshot;
}

export interface SimulationOptions {
  n: number;
  seed: number;
  preset?: PresetId;
  params?: Params;
}

/** The CPU reference behind the interface a worker, a benchmark or a GPU path can share. */
export function createSimulation({n, seed, preset, params = defaultParams}: SimulationOptions): Simulation {
  const grid: Grid = createGrid(n, seed, preset);
  let steps = 0;
  return {
    n,
    get steps() {
      return steps;
    },
    advance(count) {
      for (let i = 0; i < count; i++) step(grid, params);
      steps += count;
    },
    snapshot() {
      return {steps, height: grid.b.slice(), water: grid.d.slice(), sediment: grid.s.slice()};
    },
  };
}
