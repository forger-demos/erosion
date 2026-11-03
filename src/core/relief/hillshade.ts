/** Height gradient (rise per cell) by Horn's 3x3 kernel; edges reuse the nearest cell. */
export function gradientAt(heights: Float32Array, n: number, x: number, y: number): {dx: number; dy: number} {
  const at = (cx: number, cy: number): number =>
    heights[(cy < 0 ? 0 : cy >= n ? n - 1 : cy) * n + (cx < 0 ? 0 : cx >= n ? n - 1 : cx)]!;
  const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
  const d = at(x - 1, y), f = at(x + 1, y);
  const g = at(x - 1, y + 1), h = at(x, y + 1), i = at(x + 1, y + 1);
  return {dx: (c + 2 * f + i - (a + 2 * d + g)) / 8, dy: (g + 2 * h + i - (a + 2 * b + c)) / 8};
}

/**
 * Unit vector towards a low sun in the north-west (x east, y south, z up) for a map with north at the top.
 * Built with sqrt only so it is the same number on every engine.
 */
export const sunDirection: readonly [number, number, number] = (() => {
  const len = Math.sqrt(3);
  return [-1 / len, -1 / len, 1 / len];
})();

/** Brightness of a surface with the given gradient under the sun: 0 in shadow, about 0.58 on flat ground. */
export function shadeFromGradient(dx: number, dy: number): number {
  const len = Math.sqrt(dx * dx + dy * dy + 1);
  const dot = (-dx * sunDirection[0] - dy * sunDirection[1] + sunDirection[2]) / len;
  return dot > 0 ? dot : 0;
}

/** Hillshade of a height field, row-major, one brightness per cell. Heights are in cell units. */
export function hillshade(heights: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const {dx, dy} = gradientAt(heights, n, x, y);
      out[y * n + x] = shadeFromGradient(dx, dy);
    }
  }
  return out;
}

/** Steepness (rise over run) of every cell. */
export function slopeMap(heights: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const {dx, dy} = gradientAt(heights, n, x, y);
      out[y * n + x] = Math.sqrt(dx * dx + dy * dy);
    }
  }
  return out;
}
