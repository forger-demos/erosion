export interface Lakes {
  /** 1 where a cell belongs to a lake. */
  mask: Uint8Array;
  /** Height to draw: the lake's one water level inside a lake, the bed elsewhere. */
  surface: Float32Array;
}

/**
 * Lakes are connected (four neighbours) groups of still, deep water: cells holding at least `minDepth` whose water
 * surface differs by no more than `flatTol` from each deep neighbour. Deep water that drops across cells is a
 * river and is left to the flow overlay.
 * Each group is drawn flat at the mean of bed plus depth over its cells: settled water has one level,
 * and the mean removes the ripple a running simulation still carries.
 */
export function findLakes(bed: Float32Array, depth: Float32Array, n: number, minDepth: number, flatTol: number): Lakes {
  const size = n * n;
  const mask = new Uint8Array(size);
  const surface = Float32Array.from(bed);
  const seen = new Uint8Array(size);
  const deep = (i: number): boolean => depth[i]! >= minDepth;
  const still = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    if (!deep(i)) continue;
    const x = i % n;
    const top = bed[i]! + depth[i]!;
    const next = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i >= n ? i - n : -1, i < size - n ? i + n : -1];
    still[i] = 1;
    for (const j of next) {
      if (j < 0 || !deep(j)) continue;
      const d = top - (bed[j]! + depth[j]!);
      if (d > flatTol || -d > flatTol) still[i] = 0;
    }
  }
  const stack: number[] = [];
  for (let start = 0; start < size; start++) {
    if (seen[start] || !still[start]) continue;
    const members: number[] = [];
    let total = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      total += bed[i]! + depth[i]!;
      const x = i % n;
      const next = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i >= n ? i - n : -1, i < size - n ? i + n : -1];
      for (const j of next) {
        if (j >= 0 && !seen[j] && still[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const level = total / members.length;
    for (const i of members) {
      mask[i] = 1;
      surface[i] = level;
    }
  }
  return {mask, surface};
}
