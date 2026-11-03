import {describe, expect, test} from 'bun:test';
import {drawHeightmap, gridSize, parseSeed} from './heightmap';

describe('parseSeed', () => {
  test('accepts whole numbers in range', () => {
    expect(parseSeed('42', 1)).toBe(42);
    expect(parseSeed(' 0 ', 1)).toBe(0);
  });
  test('falls back on empty, fractional, negative, or oversized input', () => {
    for (const bad of ['', 'abc', '1.5', '-3', '4294967296']) expect(parseSeed(bad, 9)).toBe(9);
  });
});

describe('drawHeightmap', () => {
  test('reports failure when the canvas has no 2D context', () => {
    const canvas = {getContext: () => null} as unknown as HTMLCanvasElement;
    expect(drawHeightmap(canvas, 1, 'hills')).toBe(false);
  });

  test('writes opaque grey pixels', () => {
    let image: {data: Uint8ClampedArray} | null = null;
    const ctx = {
      createImageData: (w: number, h: number) => (image = {data: new Uint8ClampedArray(w * h * 4)}),
      putImageData: () => {},
    };
    const canvas = {getContext: () => ctx} as unknown as HTMLCanvasElement;
    expect(drawHeightmap(canvas, 1, 'alpine')).toBe(true);
    const d = image!.data;
    expect(d.length).toBe(gridSize * gridSize * 4);
    expect(d[3]).toBe(255);
    expect(d[0]).toBe(d[1]!);
    expect(d[1]).toBe(d[2]!);
  });
});
