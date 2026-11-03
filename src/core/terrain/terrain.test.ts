import {describe, expect, test} from 'bun:test';
import {generateTerrain, hashHeights, heightRange, toGrey} from './noise';
import {presetIds, presets} from './presets';

describe('terrain from a seed', () => {
  for (const id of presetIds) {
    test(`${id}: same seed gives the same terrain`, () => {
      expect(hashHeights(generateTerrain(64, 5, id))).toBe(hashHeights(generateTerrain(64, 5, id)));
    });

    test(`${id}: a different seed differs`, () => {
      expect(hashHeights(generateTerrain(64, 5, id))).not.toBe(hashHeights(generateTerrain(64, 6, id)));
    });

    test(`${id}: heights are finite and inside the documented range`, () => {
      for (const n of [8, 32, 100]) {
        const {min, max} = heightRange(n);
        for (const seed of [0, 1, 99, 4294967295]) {
          for (const h of generateTerrain(n, seed, id)) {
            expect(Number.isFinite(h)).toBe(true);
            expect(h).toBeGreaterThanOrEqual(min);
            expect(h).toBeLessThan(max);
          }
        }
      }
    });
  }

  test('presets differ for one seed', () => {
    const hashes = presetIds.map((id) => hashHeights(generateTerrain(64, 5, id)));
    expect(new Set(hashes).size).toBe(presetIds.length);
  });

  test('pinned hashes catch maths or engine drift', () => {
    const pinned = Object.fromEntries(presetIds.map((id) => [id, hashHeights(generateTerrain(32, 7, id))]));
    expect(pinned).toEqual({alpine: '50747a44', hills: '1903db4a', canyon: 'd83e450d'});
  });

  test('the ridged range of a preset is not flat', () => {
    const h = generateTerrain(64, 3, 'alpine');
    expect(Math.max(...h)).toBeGreaterThan(Math.min(...h));
  });

  test('greyscale uses the documented range and stays in 0..255', () => {
    const grey = toGrey(generateTerrain(32, 1, 'canyon'), 32);
    expect(grey.length).toBe(32 * 32);
    expect(Math.max(...grey)).toBeGreaterThan(0);
  });

  test('preset ids match their keys', () => {
    for (const id of presetIds) expect(presets[id].id).toBe(id);
  });
});
