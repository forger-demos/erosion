import {describe, expect, test} from 'bun:test';
import {createGrid, defaultParams, hashGrid, type Grid} from './grid';
import {totals} from './invariants';
import {step} from './step';

function run(n: number, seed: number, steps: number): Grid {
  const grid = createGrid(n, seed);
  for (let i = 0; i < steps; i++) step(grid, defaultParams);
  return grid;
}

describe('virtual-pipe erosion on a small grid', () => {
  test('same seed and settings give bit-for-bit the same state', () => {
    expect(hashGrid(run(32, 7, 400))).toBe(hashGrid(run(32, 7, 400)));
  });

  test('a different seed gives a different landscape', () => {
    expect(hashGrid(run(32, 7, 50))).not.toBe(hashGrid(run(32, 8, 50)));
  });

  test('the hash of a fixed run is pinned, so engine or maths drift is caught (moved when thermal weathering gained its diagonal neighbours)', () => {
    expect(hashGrid(run(32, 7, 400))).toBe('0b6ff107');
  });

  test('water is conserved: rain in, evaporation out, nothing else', () => {
    const grid = createGrid(32, 7);
    const start = totals(grid);
    for (let i = 0; i < 400; i++) step(grid, defaultParams);
    const end = totals(grid);
    const expected = start.water + grid.rained - grid.evaporated;
    expect(grid.rained).toBeGreaterThan(0);
    expect(Math.abs(end.water - expected)).toBeLessThanOrEqual(1e-6 * grid.rained);
  });

  test('bed plus suspended sediment is conserved', () => {
    const grid = createGrid(32, 7);
    const start = totals(grid);
    for (let i = 0; i < 400; i++) step(grid, defaultParams);
    const end = totals(grid);
    expect(Math.abs(end.bedPlusSediment - start.bedPlusSediment)).toBeLessThanOrEqual(
      1e-6 * Math.abs(start.bedPlusSediment),
    );
  });

  test('no NaN, no negative water or sediment', () => {
    const t = totals(run(32, 7, 400));
    expect(t.finite).toBe(true);
    expect(t.minWater).toBeGreaterThanOrEqual(0);
    expect(t.minSediment).toBeGreaterThanOrEqual(0);
  });

  test('erosion actually moves material', () => {
    const before = createGrid(32, 7);
    const after = run(32, 7, 400);
    let changed = 0;
    for (let i = 0; i < before.b.length; i++) if (before.b[i] !== after.b[i]) changed++;
    expect(changed).toBeGreaterThan(before.b.length / 2);
  });

  test('a dry landscape stays still apart from slumping, with zero velocity', () => {
    const grid = createGrid(16, 3);
    step(grid, {...defaultParams, rain: 0});
    expect(totals(grid).water).toBe(0);
    expect(grid.vx.every((v) => v === 0)).toBe(true);
  });
});
