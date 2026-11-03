import {describe, expect, test} from 'bun:test';
import {createGrid, defaultParams, maxStableDt} from './grid';
import {totals} from './invariants';
import {axisDiagonalRatio, drainage} from './metrics';
import {createSimulation} from './simulation';
import {step} from './step';
import {presetIds} from '../terrain/presets';

const n = 128;
const steps = 400;
/** A cell with at least this many cells upstream counts as part of a channel. */
const channelThreshold = 128;

describe.each(presetIds)('after a fixed run on the %s preset', (preset) => {
  const grid = createGrid(n, 1, preset);
  const before = {
    ratio: axisDiagonalRatio(grid.b, n),
    flow: drainage(grid.b, n, channelThreshold),
  };
  for (let i = 0; i < steps; i++) step(grid, defaultParams);
  const after = {
    ratio: axisDiagonalRatio(grid.b, n),
    flow: drainage(grid.b, n, channelThreshold),
  };

  test('a connected channel network drains at least 5% of the grid through one cell', () => {
    expect(after.flow.largest / (n * n)).toBeGreaterThanOrEqual(0.05);
  });

  test('the channel network grows at least twofold', () => {
    expect(after.flow.channelCells).toBeGreaterThanOrEqual(2 * before.flow.channelCells);
  });

  test('gradient energy along the axes stays within 0.9 to 1.2 of that along the diagonals', () => {
    for (const ratio of [before.ratio, after.ratio]) {
      expect(ratio).toBeGreaterThanOrEqual(0.9);
      expect(ratio).toBeLessThanOrEqual(1.2);
    }
  });

  test('the run stays finite and non-negative', () => {
    const t = totals(grid);
    expect(t.finite).toBe(true);
    expect(t.minWater).toBeGreaterThanOrEqual(0);
  });
});

describe('time step stability', () => {
  test('the default time step is below the limit with margin', () => {
    expect(defaultParams.dt).toBeLessThanOrEqual(0.5 * maxStableDt(defaultParams));
  });

  test('a run at the limit stays finite and conserves water', () => {
    const params = {...defaultParams, dt: maxStableDt(defaultParams) * 0.99};
    const grid = createGrid(32, 7);
    for (let i = 0; i < 300; i++) step(grid, params);
    const t = totals(grid);
    expect(t.finite).toBe(true);
    expect(Math.abs(t.water - (grid.rained - grid.evaporated))).toBeLessThanOrEqual(1e-5 * grid.rained);
  });

  test('a simulation refuses a time step above the limit', () => {
    const params = {...defaultParams, dt: maxStableDt(defaultParams) * 1.5};
    expect(() => createSimulation({n: 16, seed: 1, params})).toThrow('stability');
  });
});

describe('metrics', () => {
  test('a tilted plane is isotropic and axis-aligned blocks are not', () => {
    const plane = new Float32Array(n * n);
    const blocks = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        plane[y * n + x] = x + 2 * y;
        blocks[y * n + x] = x % 4 < 2 && y % 4 < 2 ? 1 : 0;
      }
    }
    expect(axisDiagonalRatio(plane, n)).toBeCloseTo(1, 6);
    expect(axisDiagonalRatio(blocks, n)).toBeGreaterThan(1.5);
  });

  test('a bowl drains every interior cell into its centre', () => {
    const m = 33;
    const bowl = new Float32Array(m * m);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) bowl[y * m + x] = (x - 16) ** 2 + (y - 16) ** 2;
    expect(drainage(bowl, m, 10).largest).toBeGreaterThanOrEqual((m - 2) * (m - 2));
  });
});
