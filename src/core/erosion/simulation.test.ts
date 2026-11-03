import {expect, test} from 'bun:test';
import {createGrid, defaultParams, hashGrid} from './grid';
import {createSimulation} from './simulation';
import {step} from './step';

test('the interface matches stepping the grid directly', () => {
  const sim = createSimulation({n: 32, seed: 7});
  sim.advance(100);
  sim.advance(300);
  const grid = createGrid(32, 7);
  for (let i = 0; i < 400; i++) step(grid, defaultParams);
  expect(sim.steps).toBe(400);
  expect(sim.snapshot().height).toEqual(grid.b);
  expect(hashGrid(grid)).toBe('0b6ff107');
});

test('a snapshot is detached from the live state', () => {
  const sim = createSimulation({n: 16, seed: 1});
  const before = sim.snapshot();
  const copy = before.height.slice();
  sim.advance(50);
  expect(before.height).toEqual(copy);
  expect(sim.snapshot().height).not.toEqual(copy);
});

test('the rendered relief visibly changes as the simulation runs', async () => {
  const {renderRelief} = await import('../relief/relief');
  const sim = createSimulation({n: 64, seed: 1});
  const before = renderRelief(sim.snapshot().height, 64, {contours: false});
  sim.advance(600);
  const after = renderRelief(sim.snapshot().height, 64, {contours: false});
  let differing = 0;
  for (let i = 0; i < before.length; i += 4) if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) differing++;
  expect(differing / (before.length / 4)).toBeGreaterThan(0.5);
});
