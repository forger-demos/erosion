import {describe, expect, test} from 'bun:test';
import {groundColour, smoothstep} from './colour';
import {contourMask} from './contours';
import {hillshade, slopeMap} from './hillshade';
import {reliefPalette as p} from './palette';
import {contourInterval, renderRelief} from './relief';
import {generateTerrain} from '../terrain/noise';
import {presetIds} from '../terrain/presets';

const flatShade = 1 / Math.sqrt(3);

function ramp(n: number, f: (x: number, y: number) => number): Float32Array {
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = f(x, y);
  return h;
}

describe('hillshade', () => {
  test('flat ground has the same brightness everywhere', () => {
    const s = hillshade(ramp(4, () => 5), 4);
    for (const v of s) expect(v).toBeCloseTo(flatShade, 6);
  });
  test('a slope rising to the east faces the sun and is brighter than flat', () => {
    // normal (-1,0,1)/sqrt2, sun (-1,-1,1)/sqrt3: dot = 2 / sqrt6
    const s = hillshade(ramp(5, (x) => x), 5);
    expect(s[2 * 5 + 2]).toBeCloseTo(2 / Math.sqrt(6), 6);
  });
  test('a slope rising to the west faces away and is in shadow', () => {
    // normal (1,0,1)/sqrt2: dot = (-1 + 1) / sqrt6 = 0
    const s = hillshade(ramp(5, (x) => -x), 5);
    expect(s[2 * 5 + 2]).toBeCloseTo(0, 6);
  });
  test('north-facing and south-facing slopes differ the same way', () => {
    const lit = hillshade(ramp(5, (_x, y) => y), 5)[12]!;
    const dark = hillshade(ramp(5, (_x, y) => -y), 5)[12]!;
    expect(lit).toBeCloseTo(2 / Math.sqrt(6), 6);
    expect(dark).toBeCloseTo(0, 6);
  });
  test('slope is rise over run, and zero on flat ground', () => {
    expect(slopeMap(ramp(5, (x) => 2 * x), 5)[12]).toBeCloseTo(2, 6);
    expect(slopeMap(ramp(3, () => 1), 3).every((v) => v === 0)).toBe(true);
  });
  test('edges use the nearest cell instead of reading outside', () => {
    const s = hillshade(ramp(3, (x) => x), 3);
    for (const v of s) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('contourMask', () => {
  test('marks the cells next to a band change on a 4x4 ramp', () => {
    const h = ramp(4, (x) => x); // bands of width 2: 0,0,1,1 across each row
    const m = contourMask(h, 4, 2);
    expect(Array.from(m)).toEqual([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]);
  });
  test('marks the vertical change too', () => {
    const m = contourMask(ramp(3, (_x, y) => y), 3, 1);
    expect(Array.from(m)).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0]);
  });
  test('flat ground and a non-positive interval give no lines', () => {
    expect(contourMask(ramp(3, () => 3), 3, 2).every((v) => v === 0)).toBe(true);
    expect(contourMask(ramp(3, (x) => x), 3, 0).every((v) => v === 0)).toBe(true);
  });
});

describe('groundColour', () => {
  const dry = (h: number, s: number) => groundColour(h, s, 0, p);
  test('low flat ground is sand, mid ground grass, steep ground rock, high flat ground snow', () => {
    expect(dry(0, 0)).toEqual([...p.sand]);
    expect(dry(0.6, 0)).toEqual([...p.grass]);
    expect(dry(0.6, 3)).toEqual([...p.rock]);
    expect(dry(0.95, 0)).toEqual([...p.snow]);
  });
  test('snow does not lie on steep high ground, which shows rock', () => {
    expect(dry(0.95, 3)).toEqual([...p.rock]);
  });
  test('wetness darkens and shifts towards blue', () => {
    const d = dry(0.6, 0);
    const w = groundColour(0.6, 0, 1, p);
    expect(w[0]).toBeLessThan(d[0]);
    expect(w[2] / w[0]).toBeGreaterThan(d[2] / d[0]);
    expect(groundColour(0.6, 0, 5, p)).toEqual(w);
    expect(groundColour(0.6, 0, -1, p)).toEqual(d);
  });
  test('smoothstep is 0, 0.5, 1 at the start, middle and end', () => {
    expect([smoothstep(0, 2, -1), smoothstep(0, 2, 1), smoothstep(0, 2, 3)]).toEqual([0, 0.5, 1]);
  });
});

describe('renderRelief', () => {
  test('is opaque, sized n*n*4, and draws lines only when asked', () => {
    const n = 16;
    const h = generateTerrain(n, 1, 'alpine');
    const plain = renderRelief(h, n, {contours: false});
    const lined = renderRelief(h, n, {contours: true});
    expect(plain.length).toBe(n * n * 4);
    for (let i = 3; i < plain.length; i += 4) expect(plain[i]).toBe(255);
    expect(Array.from(lined)).not.toEqual(Array.from(plain));
    const mask = contourMask(h, n, contourInterval(n));
    for (let i = 0; i < n * n; i++) {
      const same = [0, 1, 2].every((c) => plain[i * 4 + c] === lined[i * 4 + c]);
      expect(same).toBe(!mask[i]);
    }
  });
  test('is repeatable and every preset gives a sand-to-snow spread of colours', () => {
    for (const id of presetIds) {
      const h = generateTerrain(64, 7, id);
      const a = renderRelief(h, 64, {contours: true});
      expect(Array.from(a)).toEqual(Array.from(renderRelief(h, 64, {contours: true})));
      const distinct = new Set<number>();
      for (let i = 0; i < a.length; i += 4) distinct.add((a[i]! << 16) | (a[i + 1]! << 8) | a[i + 2]!);
      expect(distinct.size).toBeGreaterThan(20);
    }
  });
  test('wetness darkens the picture', () => {
    const n = 8;
    const h = ramp(n, () => 20);
    const dry = renderRelief(h, n, {contours: false});
    const wet = renderRelief(h, n, {contours: false, wetness: new Float32Array(n * n).fill(1)});
    expect(wet[0]!).toBeLessThan(dry[0]!);
  });
});
