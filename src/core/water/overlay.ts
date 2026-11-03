import {smoothstep} from '../relief/colour';
import {flowAccumulation} from './flow';
import {findLakes} from './lakes';

export interface WaterOptions {
  /** Water depth from which a cell is part of a lake. */
  lakeDepth: number;
  /** Largest water-surface step between neighbouring lake cells; steeper deep water is a river. */
  flatTol: number;
  /** Cells upstream from which a cell starts to read as a river, and from which it is fully a river. */
  riverFrom: number;
  riverTo: number;
  /** Depth at which loose water on a slope reaches full wetness. */
  wetDepth: number;
  /** Opacity of a lake, and of a river at full strength. */
  lakeOpacity: number;
  riverOpacity: number;
  /** Share of a neighbour's wetness that spills onto a dry cell beside it. */
  bankSpill: number;
}

export const defaultWater: WaterOptions = {
  lakeDepth: 0.02,
  flatTol: 0.05,
  riverFrom: 24,
  riverTo: 96,
  wetDepth: 0.01,
  lakeOpacity: 0.85,
  riverOpacity: 0.75,
  bankSpill: 0.6,
};

export interface WaterOverlay {
  /** Height to draw: flat at the water level in lakes, the bed elsewhere. */
  surface: Float32Array;
  lake: Uint8Array;
  /** River strength 0 to 1 from accumulated flow; zero inside lakes. */
  river: Float32Array;
  /** Wetness 0 to 1 for the colour function. */
  wetness: Float32Array;
  /** Opacity 0 to 1 of the water colour laid over the ground. */
  alpha: Float32Array;
}

/**
 * Turns bed height and water depth into the river and lake overlay and the wetness that feeds the ground colour.
 * Before the first step there is no water, so every layer is empty.
 */
export function waterOverlay(bed: Float32Array, depth: Float32Array, n: number, o: WaterOptions = defaultWater): WaterOverlay {
  const size = n * n;
  const {mask: lake, surface} = findLakes(bed, depth, n, o.lakeDepth, o.flatTol);
  const top = new Float32Array(size);
  for (let i = 0; i < size; i++) top[i] = bed[i]! + depth[i]!;
  const acc = flowAccumulation(top, n);
  const river = new Float32Array(size);
  const wet = new Float32Array(size);
  const alpha = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (lake[i]) {
      wet[i] = 1;
      alpha[i] = o.lakeOpacity;
      continue;
    }
    const r = depth[i]! >= o.wetDepth ? smoothstep(o.riverFrom, o.riverTo, acc[i]!) : 0;
    river[i] = r;
    alpha[i] = r * o.riverOpacity;
    const loose = smoothstep(0, o.wetDepth, depth[i]!);
    wet[i] = r > loose ? r : loose;
  }
  const wetness = Float32Array.from(wet);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let spill = 0;
      if (x > 0 && wet[i - 1]! > spill) spill = wet[i - 1]!;
      if (x < n - 1 && wet[i + 1]! > spill) spill = wet[i + 1]!;
      if (y > 0 && wet[i - n]! > spill) spill = wet[i - n]!;
      if (y < n - 1 && wet[i + n]! > spill) spill = wet[i + n]!;
      spill *= o.bankSpill;
      if (spill > wetness[i]!) wetness[i] = spill;
    }
  }
  return {surface, lake, river, wetness, alpha};
}
