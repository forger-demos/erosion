import {describe, expect, test} from 'bun:test';
import {gridSize} from './heightmap';
import {drawRelief} from './relief';

describe('drawRelief', () => {
  test('reports failure when the canvas has no 2D context', () => {
    const canvas = {getContext: () => null} as unknown as HTMLCanvasElement;
    expect(drawRelief(canvas, 1, 'hills', true)).toBe(false);
  });

  test('puts an opaque coloured image on the canvas', () => {
    let image: {data: Uint8ClampedArray} | null = null;
    let put = 0;
    const ctx = {
      createImageData: (w: number, h: number) => (image = {data: new Uint8ClampedArray(w * h * 4)}),
      putImageData: () => put++,
    };
    const canvas = {getContext: () => ctx} as unknown as HTMLCanvasElement;
    expect(drawRelief(canvas, 1, 'alpine', false)).toBe(true);
    expect(put).toBe(1);
    expect(image!.data.length).toBe(gridSize * gridSize * 4);
    expect(image!.data[3]).toBe(255);
    const d = image!.data;
    let coloured = false;
    for (let i = 0; i < d.length; i += 4) coloured ||= d[i] !== d[i + 1] || d[i + 1] !== d[i + 2];
    expect(coloured).toBe(true);
  });
});
