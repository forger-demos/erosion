/**
 * Marks the cells where a contour line of the given height interval passes: a cell is marked when it
 * lies in a different height band from its east or south neighbour. Each isoline is one cell wide.
 */
export function contourMask(heights: Float32Array, n: number, interval: number): Uint8Array {
  const out = new Uint8Array(n * n);
  if (!(interval > 0)) return out;
  const band = (i: number): number => Math.floor(heights[i]! / interval);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const b = band(i);
      if ((x + 1 < n && band(i + 1) !== b) || (y + 1 < n && band(i + n) !== b)) out[i] = 1;
    }
  }
  return out;
}
