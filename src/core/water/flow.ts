/**
 * Steepest-descent (eight neighbours) flow accumulation: how many cells, itself included, drain through each cell.
 * Water leaves a cell towards its steepest lower neighbour; a cell with none (a pit, a lake surface, the border) keeps it.
 * Ties break on cell index so the result never depends on visiting order.
 */
export function flowAccumulation(surface: Float32Array, n: number): Int32Array {
  const size = n * n;
  const order = new Uint32Array(size);
  for (let i = 0; i < size; i++) order[i] = i;
  order.sort((a, b) => surface[b]! - surface[a]! || a - b);
  const acc = new Int32Array(size).fill(1);
  for (const i of order) {
    const x = i % n;
    const y = (i - x) / n;
    if (x === 0 || y === 0 || x === n - 1 || y === n - 1) continue;
    let best = -1;
    let bestDrop = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const j = i + dy * n + dx;
        const rise = surface[i]! - surface[j]!;
        if (rise <= 0) continue;
        // A diagonal step is sqrt(2) cells long, so compare squared drop per squared length.
        const drop = rise * rise * (dx !== 0 && dy !== 0 ? 0.5 : 1);
        if (drop > bestDrop) {
          bestDrop = drop;
          best = j;
        }
      }
    }
    if (best >= 0) acc[best] = acc[best]! + acc[i]!;
  }
  return acc;
}
