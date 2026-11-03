import {describe, expect, test} from 'bun:test';
import {groundColour} from '../relief/colour';
import {reliefPalette as p} from '../relief/palette';
import {createSimulation} from '../erosion/simulation';
import {presetIds} from '../terrain/presets';
import {flowAccumulation} from './flow';
import {findLakes} from './lakes';
import {defaultWater, waterOverlay} from './overlay';

describe('flowAccumulation', () => {
  test('a tilted plane gathers each row into its lowest cell, pinned', () => {
    const n = 4;
    const s = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s[y * n + x] = 10 - x;
    // Border cells do not pass flow on; interior cells pass it east.
    const acc = flowAccumulation(s, n);
    expect(Array.from(acc.slice(4, 8))).toEqual([1, 1, 2, 3]);
  });

  test('a V valley collects both slopes along its floor, pinned', () => {
    const n = 5;
    const s = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s[y * n + x] = Math.abs(x - 2) * 2 + (n - y) * 0.1;
    const acc = flowAccumulation(s, n);
    const column = [1, 2, 3, 4].map((y) => acc[y * n + 2]);
    expect(column).toEqual([3, 6, 9, 10]);
    expect(acc[1 * n + 1]).toBe(1);
  });

  test('is the same when computed twice', () => {
    const s = Float32Array.from({length: 36}, (_, i) => ((i * 7) % 5) + (i % 3));
    expect(flowAccumulation(s, 6)).toEqual(flowAccumulation(s, 6));
  });
});

describe('findLakes', () => {
  const n = 6;
  const bed = new Float32Array(n * n);
  const depth = new Float32Array(n * n);
  // A basin of four cells filled to level 3 with a tiny ripple, and one separate puddle.
  for (const [i, b] of [[7, 1], [8, 2], [13, 1.5], [14, 2.5]] as const) {
    bed[i] = b;
    depth[i] = 3 - b + (i === 8 ? 0.001 : -0.001);
  }
  bed[30] = 0;
  depth[30] = 0.5;
  depth[20] = 0.005;
  const lakes = findLakes(bed, depth, n, 0.02, 0.05);

  test('marks connected deep cells and nothing else', () => {
    expect(Array.from(lakes.mask.entries()).filter(([, v]) => v).map(([i]) => i)).toEqual([7, 8, 13, 14, 30]);
  });

  test('every cell of a lake shares one surface height', () => {
    for (const i of [7, 8, 13, 14]) expect(lakes.surface[i]).toBeCloseTo(lakes.surface[7]!, 6);
    expect(lakes.surface[7]).toBeCloseTo(3, 2);
  });

  test('dry and shallow cells keep the bed', () => {
    expect(lakes.surface[20]).toBe(0);
    expect(lakes.surface[0]).toBe(0);
  });

  test('a lake on a simulated terrain is flat within tolerance', () => {
    const n2 = 48;
    const sim = createSimulation({n: n2, seed: 3, preset: 'hills'});
    sim.advance(300);
    const snap = sim.snapshot();
    const found = findLakes(snap.height, snap.water, n2, 0.02, 0.05);
    let lakeCells = 0;
    for (let i = 0; i < n2 * n2; i++) {
      if (!found.mask[i]) continue;
      lakeCells++;
      // The drawn level is a component mean, so it stays close to bed plus depth wherever the water is settled.
      expect(Math.abs(found.surface[i]! - (snap.height[i]! + snap.water[i]!))).toBeLessThan(0.25);
    }
    expect(lakeCells).toBeGreaterThan(0);
  });
});

describe('waterOverlay', () => {
  test('is empty before the first step', () => {
    const n = 8;
    const bed = Float32Array.from({length: n * n}, (_, i) => (i % n) * 0.3);
    const o = waterOverlay(bed, new Float32Array(n * n), n);
    expect(o.wetness.every((v) => v === 0)).toBe(true);
    expect(o.alpha.every((v) => v === 0)).toBe(true);
    expect(o.lake.every((v) => v === 0)).toBe(true);
    expect(o.surface).toEqual(bed);
  });

  test('pins a lake, a bank and a river on a tiny grid', () => {
    const n = 8;
    const bed = new Float32Array(n * n);
    const depth = new Float32Array(n * n);
    depth[2 * n + 2] = depth[2 * n + 3] = 0.5;
    const o = waterOverlay(bed, depth, n, {...defaultWater, lakeDepth: 0.1});
    expect(o.lake[2 * n + 2]).toBe(1);
    expect(o.wetness[2 * n + 2]).toBe(1);
    expect(o.alpha[2 * n + 2]).toBeCloseTo(defaultWater.lakeOpacity, 6);
    expect(o.wetness[2 * n + 4]).toBeCloseTo(defaultWater.bankSpill, 6);
    expect(o.wetness[5 * n + 5]).toBe(0);
  });

  test('rivers appear only where water and a large catchment meet', () => {
    const n = 12;
    const bed = new Float32Array(n * n);
    const depth = new Float32Array(n * n).fill(0.015);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) bed[y * n + x] = Math.abs(x - 6) * 0.5 + (n - y) * 0.1;
    const o = waterOverlay(bed, depth, n, {...defaultWater, riverFrom: 3, riverTo: 8});
    expect(o.river[10 * n + 6]).toBe(1);
    expect(o.river[10 * n + 1]).toBe(0);
    expect(o.alpha[10 * n + 6]).toBeCloseTo(defaultWater.riverOpacity, 6);
  });
});

describe('wetness in the ground colour', () => {
  const cases = {
    sand: [0.2, 0.1],
    grass: [0.6, 0.3],
    rock: [0.6, 3],
    snow: [0.95, 0.2],
  } as const;
  const lum = (c: number[]) => 0.3 * c[0]! + 0.6 * c[1]! + 0.1 * c[2]!;

  for (const [name, [h, s]] of Object.entries(cases)) {
    test(`darkens ${name}`, () => {
      expect(lum(groundColour(h, s, 1, p))).toBeLessThan(lum(groundColour(h, s, 0, p)));
    });
  }

  test('wet snow is still the brightest ground and wet rock still greyer than wet grass', () => {
    const snow = groundColour(0.95, 0.2, 1, p);
    const grass = groundColour(0.6, 0.3, 1, p);
    const rock = groundColour(0.6, 3, 1, p);
    expect(lum(snow)).toBeGreaterThan(lum(grass));
    expect(lum(snow)).toBeGreaterThan(lum(rock));
    expect(Math.abs(rock[0] - rock[1])).toBeLessThan(Math.abs(grass[0] - grass[1]) + 0.2);
  });

  test('wetness outside 0..1 is clamped', () => {
    expect(groundColour(0.6, 0.3, 5, p)).toEqual(groundColour(0.6, 0.3, 1, p));
  });
});

describe.each(presetIds)('a few hundred steps on %s', (preset) => {
  const n = 96;
  const sim = createSimulation({n, seed: 1, preset});
  sim.advance(300);
  const snap = sim.snapshot();
  const o = waterOverlay(snap.height, snap.water, n);

  test('draws a connected river network', () => {
    const cells: number[] = [];
    for (let i = 0; i < n * n; i++) if (o.river[i]! > 0 || o.lake[i]) cells.push(i);
    expect(cells.length).toBeGreaterThan(0);
    const inSet = new Set(cells);
    const seen = new Set<number>();
    let largest = 0;
    for (const start of cells) {
      if (seen.has(start)) continue;
      let size = 0;
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const i = stack.pop()!;
        size++;
        const x = i % n;
        for (const dy of [-1, 0, 1]) {
          for (const dx of [-1, 0, 1]) {
            if (x + dx < 0 || x + dx >= n) continue;
            const j = i + dy * n + dx;
            if (inSet.has(j) && !seen.has(j)) {
              seen.add(j);
              stack.push(j);
            }
          }
        }
      }
      if (size > largest) largest = size;
    }
    expect(largest).toBeGreaterThanOrEqual(n / 2);
  });

  test('wetness and alpha stay within 0..1', () => {
    for (let i = 0; i < n * n; i++) {
      expect(o.wetness[i]).toBeGreaterThanOrEqual(0);
      expect(o.wetness[i]).toBeLessThanOrEqual(1);
      expect(o.alpha[i]).toBeGreaterThanOrEqual(0);
      expect(o.alpha[i]).toBeLessThanOrEqual(1);
    }
  });
});

test('src/core/water imports nothing from the DOM, the shell or workers', async () => {
  const {Glob} = await import('bun');
  for await (const file of new Glob('*.ts').scan({cwd: import.meta.dir})) {
    if (file.endsWith('.test.ts')) continue;
    const text = await Bun.file(`${import.meta.dir}/${file}`).text();
    expect(text).not.toMatch(/\b(document|window|HTMLCanvasElement|Worker|OffscreenCanvas|Math\.|Date)\b/);
    expect(text).not.toMatch(/from '\.\.\/\.\.\/shell/);
  }
});
