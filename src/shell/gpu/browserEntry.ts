import type {Params} from '../../core/erosion/grid';
import type {PresetId} from '../../core/terrain/presets';
import {detectGpu} from './detect';
import {createGpuSimulation} from './gpuSimulation';

export interface GpuRun {
  steps: number;
  height: number[];
  water: number[];
  sediment: number[];
}

declare global {
  interface Window {
    gpuAvailable(): string | null;
    runGpu(n: number, seed: number, preset: PresetId, params: Params | undefined, plan: number[]): GpuRun[];
  }
}

/** Entry bundled into a page by the tolerance test; it is never part of the shipped app. */
window.gpuAvailable = () => {
  const found = detectGpu(() => new OffscreenCanvas(1, 1));
  return found.ok ? null : found.reason;
};

/** Runs `plan` as step counts, snapshotting after each, on a fresh context. */
window.runGpu = (n, seed, preset, params, plan) => {
  const found = detectGpu(() => new OffscreenCanvas(n, n));
  if (!found.ok) throw new Error(found.reason);
  const sim = createGpuSimulation(found.gl, {n, seed, preset, params});
  return plan.map((count) => {
    sim.advance(count);
    const s = sim.snapshot();
    return {steps: s.steps, height: Array.from(s.height), water: Array.from(s.water), sediment: Array.from(s.sediment)};
  });
};
