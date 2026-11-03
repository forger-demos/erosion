import type {Grid, Params} from './grid';

/**
 * One step of the virtual-pipe model (Mei, Decaudin, Hu 2007) with a thermal pass.
 * Closed boundaries, and only + - * / sqrt, so the result depends on the inputs alone.
 * Sediment rides the same fluxes as the water (donor cell), which keeps it exactly
 * conservative; the papers' semi-Lagrangian lookup is not.
 */
export function step(grid: Grid, p: Params): void {
  const {n, b, d, s, fl, fr, ft, fb, vx, vy, d1, d2, db} = grid;
  const cellArea = p.cell * p.cell;
  const idx = (x: number, y: number) => y * n + x;

  // 1. rain
  for (let i = 0; i < n * n; i++) {
    const before = d[i]!;
    const after = before + p.dt * p.rain;
    d[i] = after;
    grid.rained += d[i]! - before;
    d1[i] = d[i]!;
  }

  // 2. outflow flux, scaled so no cell sends out more water than it holds
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const h = b[i]! + d1[i]!;
      const k = p.dt * p.pipeArea * p.g / p.cell;
      let l = x > 0 ? Math.max(0, fl[i]! + k * (h - b[i - 1]! - d1[i - 1]!)) : 0;
      let r = x < n - 1 ? Math.max(0, fr[i]! + k * (h - b[i + 1]! - d1[i + 1]!)) : 0;
      let t = y > 0 ? Math.max(0, ft[i]! + k * (h - b[i - n]! - d1[i - n]!)) : 0;
      let bo = y < n - 1 ? Math.max(0, fb[i]! + k * (h - b[i + n]! - d1[i + n]!)) : 0;
      const total = (l + r + t + bo) * p.dt;
      if (total > 0) {
        const scale = Math.min(1, (d1[i]! * cellArea) / total);
        l *= scale;
        r *= scale;
        t *= scale;
        bo *= scale;
      }
      fl[i] = l;
      fr[i] = r;
      ft[i] = t;
      fb[i] = bo;
    }
  }

  // 3. water depth from net flux
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const inflow =
        (x > 0 ? fr[i - 1]! : 0) +
        (x < n - 1 ? fl[i + 1]! : 0) +
        (y > 0 ? fb[i - n]! : 0) +
        (y < n - 1 ? ft[i + n]! : 0);
      const outflow = fl[i]! + fr[i]! + ft[i]! + fb[i]!;
      // Rounding can leave a hair below zero; clamping adds less than float32 noise of water.
      d2[i] = Math.max(0, d1[i]! + (p.dt * (inflow - outflow)) / cellArea);
    }
  }

  // 4. velocity from flux
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const mean = (d1[i]! + d2[i]!) / 2;
      if (mean < 1e-4) {
        vx[i] = 0;
        vy[i] = 0;
        continue;
      }
      const wx = ((x > 0 ? fr[i - 1]! : 0) - fl[i]! + fr[i]! - (x < n - 1 ? fl[i + 1]! : 0)) / 2;
      const wy = ((y > 0 ? fb[i - n]! : 0) - ft[i]! + fb[i]! - (y < n - 1 ? ft[i + n]! : 0)) / 2;
      vx[i] = wx / (p.cell * mean);
      vy[i] = wy / (p.cell * mean);
    }
  }

  // 5. erosion and deposition; water depth is untouched, mass moves between b and s
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const gx = (b[x < n - 1 ? i + 1 : i]! - b[x > 0 ? i - 1 : i]!) / ((x > 0 && x < n - 1 ? 2 : 1) * p.cell);
      const gy = (b[y < n - 1 ? i + n : i]! - b[y > 0 ? i - n : i]!) / ((y > 0 && y < n - 1 ? 2 : 1) * p.cell);
      const slope = Math.sqrt(gx * gx + gy * gy);
      const sinAlpha = slope / Math.sqrt(1 + slope * slope);
      const speed = Math.sqrt(vx[i]! * vx[i]! + vy[i]! * vy[i]!);
      const depthFactor = Math.min(1, d2[i]! / p.depthMax);
      const capacity = p.kc * Math.max(sinAlpha, 0.01) * speed * depthFactor;
      if (capacity > s[i]!) {
        const amount = p.dt * p.ks * (capacity - s[i]!);
        b[i] = b[i]! - amount;
        s[i] = s[i]! + amount;
      } else {
        const amount = p.dt * p.kd * (s[i]! - capacity);
        b[i] = b[i]! + amount;
        s[i] = s[i]! - amount;
      }
    }
  }

  // 6. sediment travels with the water leaving each cell
  const moved = db;
  moved.fill(0);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const volume = d1[i]! * cellArea;
      if (volume <= 0 || s[i]! <= 0) continue;
      const per = (s[i]! * p.dt) / volume;
      const sends: [number, number][] = [
        [x > 0 ? i - 1 : -1, fl[i]!],
        [x < n - 1 ? i + 1 : -1, fr[i]!],
        [y > 0 ? i - n : -1, ft[i]!],
        [y < n - 1 ? i + n : -1, fb[i]!],
      ];
      for (const [to, flux] of sends) {
        if (to < 0 || flux <= 0) continue;
        const amount = per * flux;
        moved[i] = moved[i]! - amount;
        moved[to] = moved[to]! + amount;
      }
    }
  }
  for (let i = 0; i < n * n; i++) s[i] = Math.max(0, s[i]! + moved[i]!);

  // 7. evaporation
  for (let i = 0; i < n * n; i++) {
    const before = d2[i]!;
    d[i] = before * (1 - p.evaporation * p.dt);
    grid.evaporated += before - d[i]!;
  }

  // 8. thermal weathering: material slumps from over-steep cells to lower neighbours
  db.fill(0);
  const reach = p.talus * p.cell;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      const targets = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1];
      for (const to of targets) {
        if (to < 0) continue;
        const excess = b[i]! - b[to]! - reach;
        if (excess <= 0) continue;
        const amount = (p.thermalRate * excess) / 2;
        db[i] = db[i]! - amount;
        db[to] = db[to]! + amount;
      }
    }
  }
  for (let i = 0; i < n * n; i++) b[i] = b[i]! + db[i]!;
}
