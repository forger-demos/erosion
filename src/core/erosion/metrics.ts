/**
 * Measurements of a height field that tell a carved landscape from a numerical artifact.
 * Pure float64 arithmetic over a bed; none of it feeds back into the simulation.
 */

/**
 * Gradient energy along the grid axes divided by gradient energy along the two diagonals.
 * Any orthonormal pair of directions carries the same energy of an isotropic field, so a
 * value near 1 means the grid is not leaving its mark; terracing along the axes pushes it up.
 */
export function axisDiagonalRatio(h: Float32Array, n: number): number {
  let axis = 0;
  let diagonal = 0;
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      const gx = h[i + 1]! - h[i - 1]!;
      const gy = h[i + n]! - h[i - n]!;
      const gu = h[i + n + 1]! - h[i - n - 1]!;
      const gv = h[i + n - 1]! - h[i - n + 1]!;
      axis += gx * gx + gy * gy;
      // A diagonal step is sqrt(2) cells long, so its squared difference counts half.
      diagonal += (gu * gu + gv * gv) / 2;
    }
  }
  return diagonal === 0 ? 1 : axis / diagonal;
}

export interface Drainage {
  /** Largest number of cells (itself included) that drain through one cell. */
  largest: number;
  /** Cells whose catchment is at least the channel threshold. */
  channelCells: number;
}

/**
 * Steepest-descent (eight neighbours) flow accumulation on the bed. Water leaves a cell
 * towards its steepest lower neighbour and stops at a boundary cell or a basin (a cell with
 * no lower neighbour), so a large `largest` means one connected network feeds one outlet.
 */
export function drainage(h: Float32Array, n: number, channelThreshold: number): Drainage {
  const size = n * n;
  const order = Array.from({length: size}, (_, i) => i);
  order.sort((a, b) => h[b]! - h[a]! || a - b);
  const target = new Int32Array(size).fill(-1);
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      let best = -1;
      let bestDrop = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const j = i + dy * n + dx;
          // Diagonal neighbours are sqrt(2) further, so compare drop per length squared.
          const drop = (h[i]! - h[j]!) * (h[i]! - h[j]!) * (dx !== 0 && dy !== 0 ? 0.5 : 1);
          if (h[j]! < h[i]! && drop > bestDrop) {
            bestDrop = drop;
            best = j;
          }
        }
      }
      target[i] = best;
    }
  }
  const acc = new Int32Array(size).fill(1);
  for (const i of order) {
    const t = target[i]!;
    if (t >= 0) acc[t] = acc[t]! + acc[i]!;
  }
  let largest = 0;
  let channelCells = 0;
  for (let i = 0; i < size; i++) {
    if (acc[i]! > largest) largest = acc[i]!;
    if (acc[i]! >= channelThreshold) channelCells++;
  }
  return {largest, channelCells};
}
