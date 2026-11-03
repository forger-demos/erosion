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
  expect(hashGrid(grid)).toBe('8f1c13f9');
});

test('a snapshot is detached from the live state', () => {
  const sim = createSimulation({n: 16, seed: 1});
  const before = sim.snapshot();
  const copy = before.height.slice();
  sim.advance(50);
  expect(before.height).toEqual(copy);
  expect(sim.snapshot().height).not.toEqual(copy);
});
