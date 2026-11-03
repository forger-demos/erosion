import {createSimulation} from '../src/core/erosion/simulation';

const sizes = (process.argv[2] ?? '64,128,256').split(',').map(Number);
const steps = Number(process.argv[3] ?? 50);

for (const n of sizes) {
  const sim = createSimulation({n, seed: 1});
  sim.advance(5);
  const start = performance.now();
  sim.advance(steps);
  const ms = (performance.now() - start) / steps;
  console.log(`${n}x${n}: ${ms.toFixed(3)} ms/step over ${steps} steps`);
}
