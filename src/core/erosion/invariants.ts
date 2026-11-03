import type {Grid} from './grid';

export interface Totals {
  water: number;
  bedPlusSediment: number;
  finite: boolean;
  minWater: number;
  minSediment: number;
}

/** Sums in float64 so the check measures the simulation, not the checker. */
export function totals(grid: Grid): Totals {
  let water = 0;
  let bed = 0;
  let sediment = 0;
  let finite = true;
  let minWater = Infinity;
  let minSediment = Infinity;
  for (let i = 0; i < grid.n * grid.n; i++) {
    const d = grid.d[i]!;
    const b = grid.b[i]!;
    const s = grid.s[i]!;
    if (!Number.isFinite(d) || !Number.isFinite(b) || !Number.isFinite(s)) finite = false;
    water += d;
    bed += b;
    sediment += s;
    minWater = Math.min(minWater, d);
    minSediment = Math.min(minSediment, s);
  }
  return {water, bedPlusSediment: bed + sediment, finite, minWater, minSediment};
}
