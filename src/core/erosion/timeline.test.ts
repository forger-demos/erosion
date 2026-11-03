import {describe, expect, test} from 'bun:test';
import {createSimulation} from './simulation';
import {hashGrid, createGrid} from './grid';
import {totals} from './invariants';
import {createTimeline} from './timeline';
import {clampSettings, paramsFor, scenarios} from './settings';
import {presetIds} from '../terrain/presets';
import {step} from './step';

const n = 24;

function direct(seed: number, steps: number, preset: (typeof presetIds)[number] = 'hills') {
  const sim = createSimulation({n, seed, preset, params: paramsFor(scenarios[preset])});
  sim.advance(steps);
  return sim.snapshot();
}

describe('timeline', () => {
  test('scrubbing to step N equals running to step N, forwards and backwards', () => {
    const options = {n, seed: 4, preset: 'alpine' as const, params: paramsFor(scenarios.alpine)};
    const t = createTimeline(options, {interval: 10});
    t.advance(95);
    for (const target of [37, 0, 90, 10, 95, 41, 41]) {
      t.seek(target);
      expect(t.steps).toBe(target);
      const want = direct(4, target, 'alpine');
      const got = t.snapshot();
      expect(got.height).toEqual(want.height);
      expect(got.water).toEqual(want.water);
      expect(got.sediment).toEqual(want.sediment);
    }
    expect(t.reached).toBe(95);
  });

  test('seeking past the run extends it', () => {
    const t = createTimeline({n, seed: 2, params: paramsFor(scenarios.hills)}, {interval: 10});
    t.seek(33);
    expect(t.reached).toBe(33);
    expect(t.snapshot().height).toEqual(direct(2, 33).height);
  });

  test('a restored run keeps conserving water', () => {
    const grid = createGrid(n, 5);
    const p = paramsFor(scenarios.hills);
    const sim = createSimulation({n, seed: 5, params: p});
    sim.advance(60);
    const cp = sim.save();
    sim.advance(40);
    sim.restore(cp);
    sim.advance(40);
    for (let i = 0; i < 100; i++) step(grid, p);
    expect(sim.snapshot().height).toEqual(grid.b);
    expect(totals(grid).water + grid.evaporated).toBeCloseTo(grid.rained, 3);
  });

  test('thinning keeps the number of checkpoints bounded and scrubbing exact', () => {
    const t = createTimeline({n: 8, seed: 1}, {interval: 2, maxCheckpoints: 4});
    t.advance(70);
    t.seek(13);
    const ref = createSimulation({n: 8, seed: 1});
    ref.advance(13);
    expect(t.snapshot().height).toEqual(ref.snapshot().height);
  });

  test('a bad step is refused', () => {
    const t = createTimeline({n: 8, seed: 1});
    expect(() => t.seek(-1)).toThrow();
    expect(() => t.seek(1.5)).toThrow();
  });
});

describe('scenarios', () => {
  test('a preset id plus a seed reproduces its pinned hash', () => {
    const pinned: Record<string, string> = {};
    for (const id of presetIds) {
      const grid = createGrid(32, 7, id);
      for (let i = 0; i < 200; i++) step(grid, paramsFor(scenarios[id]));
      pinned[id] = hashGrid(grid);
    }
    expect(pinned).toEqual({alpine: '40ca7a10', hills: '4ca1d3dc', canyon: 'bcace206'});
  });

  test('the three presets end in different landscapes', () => {
    const hashes = presetIds.map((id) => {
      const sim = createSimulation({n: 32, seed: 7, preset: id, params: paramsFor(scenarios[id])});
      sim.advance(200);
      return Array.from(sim.snapshot().height).join();
    });
    expect(new Set(hashes).size).toBe(3);
  });

  test('harder rock erodes less', () => {
    const wear = (hardness: number) => {
      const sim = createSimulation({n: 32, seed: 7, params: paramsFor({rain: 0.012, hardness})});
      const before = sim.snapshot().height;
      sim.advance(300);
      const after = sim.snapshot().height;
      let sum = 0;
      for (let i = 0; i < after.length; i++) sum += Math.abs(after[i]! - before[i]!);
      return sum;
    };
    expect(wear(0.9)).toBeLessThan(wear(0.1));
  });

  test('settings are clamped and bad input falls back', () => {
    expect(clampSettings({rain: 5, hardness: -2})).toEqual({rain: 0.03, hardness: 0});
    expect(clampSettings({rain: NaN, hardness: NaN})).toEqual({rain: 0.012, hardness: 0.5});
    expect(paramsFor({rain: 0.012, hardness: 0.5}).ks).toBeCloseTo(0.4, 10);
  });
});
