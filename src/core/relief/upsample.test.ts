import {describe, expect, test} from 'bun:test';
import {reliefScale, upsample} from './upsample';

describe('upsample', () => {
  test('keeps the grid values at the original cell positions and blends between them', () => {
    const out = upsample(new Float32Array([0, 4, 8, 12]), 2, 2);
    expect(Array.from(out.slice(0, 4))).toEqual([0, 2, 4, 4]);
    expect(out[0]).toBe(0);
    expect(out[2 * 4]).toBe(8);
    expect(out[1 * 4 + 1]).toBe(6);
  });

  test('a factor of one is a copy, and gain scales every value', () => {
    const f = new Float32Array([1, 2, 3, 4]);
    expect(Array.from(upsample(f, 2, 1))).toEqual([1, 2, 3, 4]);
    expect(Array.from(upsample(f, 2, 1, 3))).toEqual([3, 6, 9, 12]);
  });

  test('never overshoots the source range', () => {
    const f = new Float32Array([0, 10, 10, 0, 5, 5, 7, 1, 9]);
    const out = upsample(f, 3, 3);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(10);
  });
});

describe('reliefScale', () => {
  test('aims for a similar output edge and caps the cost', () => {
    expect(reliefScale(256)).toBe(3);
    expect(reliefScale(512)).toBe(2);
    expect(reliefScale(16)).toBe(3);
    expect(reliefScale(2048)).toBe(1);
  });
});
