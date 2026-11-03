import {describe, expect, test} from 'bun:test';
import {gridIndices, createSurface} from './surface';
import {fragmentShader, vertexShader} from './shaders';

describe('createSurface', () => {
  test('reports WebGL2 as unavailable when the canvas gives no context', () => {
    const canvas = {getContext: () => null} as unknown as HTMLCanvasElement;
    const r = createSurface(canvas, 16);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('WebGL2');
  });
  test('reports failure when asking for a context throws', () => {
    const canvas = {getContext: () => { throw new Error('blocked'); }} as unknown as HTMLCanvasElement;
    expect(createSurface(canvas, 16).ok).toBe(false);
  });
  test('reports a shader error instead of throwing', () => {
    const gl = new Proxy({}, {get: (_t, k) => (k === 'getShaderParameter' ? () => false : k === 'getShaderInfoLog' ? () => 'bad' : () => 1)});
    const canvas = {getContext: () => gl} as unknown as HTMLCanvasElement;
    const r = createSurface(canvas, 16);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('bad');
  });
});

describe('gridIndices', () => {
  test('a 3x3 grid has eight triangles that stay inside the grid', () => {
    const idx = gridIndices(3);
    expect(idx.length).toBe(8 * 3);
    expect(Math.max(...idx)).toBe(8);
    expect(Array.from(idx.slice(0, 6))).toEqual([0, 3, 1, 1, 3, 4]);
  });
});

describe('shader sources', () => {
  test('are GLSL ES 3.00 and carry the grid size and the colour function', () => {
    expect(vertexShader(64).startsWith('#version 300 es')).toBe(true);
    expect(vertexShader(64)).toContain('gl_VertexID % 64');
    const f = fragmentShader(64);
    expect(f.startsWith('#version 300 es')).toBe(true);
    expect(f).toContain('vec3 groundColour(');
    expect(f).toContain('clamp(x, 0, 63)');
    expect(f).toContain('texelFetch(uWater');
  });
});

describe('createSurface with a context', () => {
  function fakeGl(calls: string[]) {
    return new Proxy(
      {},
      {
        get: (_t, k: string) => {
          if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
          if (/^[A-Z_0-9]+$/.test(k)) return 1;
          return (...args: unknown[]) => {
            calls.push(k);
            return args.length ? 1 : 1;
          };
        },
      },
    );
  }
  const fakeCanvas = (gl: unknown) =>
    ({getContext: () => gl, clientWidth: 300, clientHeight: 200, width: 1, height: 1}) as unknown as HTMLCanvasElement;

  test('uploads heights, sizes the canvas to its display size and draws every triangle', () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(fakeGl(calls));
    const r = createSurface(canvas, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    r.surface.setHeights(new Float32Array(16));
    const before = calls.filter((c) => c === 'texSubImage2D').length;
    r.surface.setWater(new Float32Array(16).fill(1), new Float32Array(16).fill(0.5));
    expect(calls.filter((c) => c === 'texSubImage2D').length).toBe(before + 1);
    r.surface.draw({yaw: 0, pitch: 0.5, distance: 100});
    expect(calls).toContain('texSubImage2D');
    expect(calls).toContain('drawElements');
    expect(canvas.width).toBe(300 * (globalThis.devicePixelRatio || 1));
    expect(canvas.height).toBe(200 * (globalThis.devicePixelRatio || 1));
  });
  test('reports a link failure instead of throwing', () => {
    const gl = new Proxy({}, {get: (_t, k: string) => (k === 'getProgramParameter' ? () => false : k === 'getShaderParameter' ? () => true : k === 'getProgramInfoLog' ? () => 'link bad' : () => 1)});
    const r = createSurface(fakeCanvas(gl), 4);
    expect(r.ok).toBe(false);
  });
});
