import {expect, test} from 'bun:test';
import {cpuGridSize, describePath, fallbackNotice, gpuGridSize, gridSizeFor} from './path';

test('the GPU path runs a larger grid than the CPU path', () => {
  expect(gridSizeFor('gpu')).toBe(gpuGridSize);
  expect(gridSizeFor('cpu')).toBe(cpuGridSize);
  expect(gpuGridSize).toBeGreaterThan(cpuGridSize);
});

test('the label names the path and the size, with a notice when given', () => {
  expect(describePath('gpu', 512)).toBe('Running on the GPU (WebGL2), 512 x 512 cells.');
  expect(describePath('cpu', 256, 'Because.')).toBe('Running on the CPU worker, 256 x 256 cells. Because.');
});

test('a fallback notice carries the reason once, without doubled full stops', () => {
  expect(fallbackNotice('WebGL2 is not available.')).toBe('The GPU path is unavailable (WebGL2 is not available), so the CPU worker runs at a smaller size.');
});
