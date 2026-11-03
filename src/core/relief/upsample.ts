/** Output edge the relief aims for; contours drawn at the grid's own resolution show cell-sized steps once the canvas is scaled up. */
const targetEdge = 768;
const maxScale = 3;

/** Whole-number factor to draw an n x n field at: more for small grids, never below 1 and never past a cost cap. */
export function reliefScale(n: number): number {
  const k = Math.round(targetEdge / n);
  return k < 1 ? 1 : k > maxScale ? maxScale : k;
}

/**
 * Bilinear resample of an n x n field to (n * k) x (n * k), with corners kept in place.
 * `gain` multiplies every value; heights use k so that slope per cell and the fraction of the height range are unchanged.
 */
export function upsample(field: Float32Array, n: number, k: number, gain = 1): Float32Array {
  const m = n * k;
  const out = new Float32Array(m * m);
  const last = n - 1;
  for (let y = 0; y < m; y++) {
    const sy = y / k;
    const y0 = Math.min(Math.floor(sy), last);
    const y1 = y0 < last ? y0 + 1 : y0;
    const fy = sy - y0;
    for (let x = 0; x < m; x++) {
      const sx = x / k;
      const x0 = Math.min(Math.floor(sx), last);
      const x1 = x0 < last ? x0 + 1 : x0;
      const fx = sx - x0;
      const top = field[y0 * n + x0]! + (field[y0 * n + x1]! - field[y0 * n + x0]!) * fx;
      const bottom = field[y1 * n + x0]! + (field[y1 * n + x1]! - field[y1 * n + x0]!) * fx;
      out[y * m + x] = (top + (bottom - top) * fy) * gain;
    }
  }
  return out;
}
