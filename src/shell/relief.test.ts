import {describe, expect, test} from 'bun:test';
import {gridSize} from './heightmap';
import {drawRelief, drawReliefHeights} from './relief';

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
    expect(image!.data.length).toBe(gridSize * gridSize * 9 * 4);
    expect(image!.data[3]).toBe(255);
    const d = image!.data;
    let coloured = false;
    for (let i = 0; i < d.length; i += 4) coloured ||= d[i] !== d[i + 1] || d[i + 1] !== d[i + 2];
    expect(coloured).toBe(true);
  });

  test('sizes the canvas from the height field, so a larger grid is not read as rows of the default width', () => {
    const sizes: number[] = [];
    const ctx = {
      createImageData: (w: number, h: number) => (sizes.push(w, h), {data: new Uint8ClampedArray(w * h * 4)}),
      putImageData: () => {},
    };
    const canvas = {getContext: () => ctx, width: 0, height: 0} as unknown as HTMLCanvasElement;
    drawReliefHeights(canvas, new Float32Array(40 * 40), false);
    expect(sizes).toEqual([120, 120]);
    expect([canvas.width, canvas.height]).toEqual([120, 120]);
  });
});
