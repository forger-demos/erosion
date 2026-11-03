import {createGrid, defaultParams, maxStableDt, type Grid, type Params} from './grid';
import {step} from './step';
import type {PresetId} from '../terrain/presets';

/** Copies of the three fields a viewer needs, detached from the live state. */
export interface Snapshot {
  steps: number;
  height: Float32Array;
  water: Float32Array;
  sediment: Float32Array;
}

/** Everything a run carries from one step to the next; restoring it resumes the run bit for bit. */
export interface Checkpoint {
  steps: number;
  fields: Float32Array[];
  rained: number;
  evaporated: number;
}

export interface Simulation {
  readonly n: number;
  readonly steps: number;
  advance(count: number): void;
  snapshot(): Snapshot;
  save(): Checkpoint;
  restore(checkpoint: Checkpoint): void;
}

export interface SimulationOptions {
  n: number;
  seed: number;
  preset?: PresetId;
  params?: Params;
}

/** The CPU reference behind the interface a worker, a benchmark or a GPU path can share. */
export function createSimulation({n, seed, preset, params = defaultParams}: SimulationOptions): Simulation {
  if (params.dt > maxStableDt(params)) throw new Error('The time step is above the stability limit of the model.');
  const grid: Grid = createGrid(n, seed, preset);
  let steps = 0;
  // The other grid arrays are scratch that each step rewrites before it reads.
  const persistent = (): Float32Array[] => [grid.b, grid.d, grid.s, grid.fl, grid.fr, grid.ft, grid.fb, grid.vx, grid.vy];
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
    save() {
      return {steps, fields: persistent().map((f) => f.slice()), rained: grid.rained, evaporated: grid.evaporated};
    },
    restore(checkpoint) {
      persistent().forEach((f, i) => f.set(checkpoint.fields[i]!));
      grid.rained = checkpoint.rained;
      grid.evaporated = checkpoint.evaporated;
      steps = checkpoint.steps;
    },
  };
}
