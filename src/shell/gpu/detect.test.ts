import {expect, test} from 'bun:test';
import {detectGpu} from './detect';

const contextWith = (extensions: string[]) => ({getExtension: (name: string) => (extensions.includes(name) ? {} : null)});

test('a context with float colour buffers is accepted', () => {
  const gl = contextWith(['EXT_color_buffer_float']);
  const found = detectGpu(() => ({getContext: () => gl}));
  expect(found.ok).toBe(true);
});

test('a missing extension names the extension', () => {
  const found = detectGpu(() => ({getContext: () => contextWith([])}));
  expect(found).toEqual({ok: false, reason: 'EXT_color_buffer_float is not supported'});
});

test('a canvas that gives no WebGL2 context says so', () => {
  expect(detectGpu(() => ({getContext: () => null}))).toEqual({ok: false, reason: 'WebGL2 is not available'});
});

test('a worker without an offscreen canvas, or one that throws, is a reason and not a crash', () => {
  expect(detectGpu(() => null).ok).toBe(false);
  expect(detectGpu(() => {
    throw new Error('nope');
  }).ok).toBe(false);
});
