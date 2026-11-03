import {afterAll, beforeAll, describe, expect, setDefaultTimeout, test} from 'bun:test';
import {chromium, type Browser, type Page} from 'playwright';
import {paramsFor, scenarios} from '../../core/erosion/settings';
import {cpuGridSize, gpuGridSize} from '../../core/erosion/path';
import {createSimulation} from '../../core/erosion/simulation';
import {presetIds, type PresetId} from '../../core/terrain/presets';
import type {GpuRun} from './browserEntry';

/**
 * The WebGL2 path against the CPU reference, in a real browser. Needs a Chrome that can start and
 * give a WebGL2 context with float colour buffers (software rendering is enough); where it cannot,
 * every test here is skipped and says why.
 */
const tolerance = {
  /** Largest bed-height difference on a small grid at the checked steps; about ten times what software rendering shows. */
  height: 2e-4,
  /** Largest water-depth difference. */
  water: 2e-4,
  /** Mass conservation, as a fraction of the total, for the bed plus sediment. */
  mass: 1e-7,
};

setDefaultTimeout(60_000);

const n = 32;
const seed = 7;
const plan = [10, 40, 150];

let browser: Browser | null = null;
let page: Page | null = null;
let skipReason: string | null = null;

beforeAll(async () => {
  try {
    browser = await chromium.launch({channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
    page = await browser.newPage();
    const out = await Bun.build({entrypoints: [new URL('./browserEntry.ts', import.meta.url).pathname], target: 'browser'});
    if (!out.success) throw new Error(out.logs.join('\n'));
    await page.setContent('<html></html>');
    await page.addScriptTag({content: await out.outputs[0]!.text()});
    skipReason = await page.evaluate(() => window.gpuAvailable());
  } catch (e) {
    skipReason = `no browser could be started (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`;
  }
  if (skipReason) console.warn(`GPU tolerance tests skipped: ${skipReason}`);
});

afterAll(async () => {
  await browser?.close();
});

const run = (preset: PresetId, settings = scenarios[preset]): Promise<GpuRun[]> =>
  page!.evaluate(([a, b, c, d, e]) => window.runGpu(a, b, c, d, e), [n, seed, preset, paramsFor(settings), plan] as const);

function cpu(preset: PresetId): ReturnType<ReturnType<typeof createSimulation>['snapshot']>[] {
  const sim = createSimulation({n, seed, preset, params: paramsFor(scenarios[preset])});
  return plan.map((count) => {
    sim.advance(count);
    return sim.snapshot();
  });
}

const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
};
const sum = (a: ArrayLike<number>): number => Array.from(a).reduce((x, y) => x + y, 0);

describe('WebGL2 path against the CPU reference', () => {
  for (const preset of presetIds) {
    test(`${preset}: height and water stay within the stated tolerance at every checked step`, async () => {
      if (skipReason) return;
      const gpu = await run(preset);
      const ref = cpu(preset);
      gpu.forEach((g, k) => {
        expect(g.steps).toBe(ref[k]!.steps);
        expect(maxDiff(g.height, ref[k]!.height)).toBeLessThanOrEqual(tolerance.height);
        expect(maxDiff(g.water, ref[k]!.water)).toBeLessThanOrEqual(tolerance.water);
      });
    });

    test(`${preset}: bed plus sediment is conserved, nothing is negative or not finite`, async () => {
      if (skipReason) return;
      const first = createSimulation({n, seed, preset}).snapshot();
      const start = sum(first.height) + sum(first.sediment);
      for (const g of await run(preset)) {
        const all = [...g.height, ...g.water, ...g.sediment];
        expect(all.every(Number.isFinite)).toBe(true);
        expect(Math.min(...g.water)).toBeGreaterThanOrEqual(0);
        expect(Math.min(...g.sediment)).toBeGreaterThanOrEqual(0);
        const total = sum(g.height) + sum(g.sediment);
        expect(Math.abs(total - start) / start).toBeLessThanOrEqual(tolerance.mass);
      }
    });
  }

  test('two runs on one device give the same bits', async () => {
    if (skipReason) return;
    const a = await run('hills');
    const b = await run('hills');
    expect(b).toEqual(a);
  });
});

const software = /swiftshader|llvmpipe|software|basic render/i;

describe('WebGL2 path speed', () => {
  test('on a hardware GPU a grid larger than the CPU path uses steps faster than the CPU steps its own', async () => {
    const hardware = await chromium.launch({channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu']}).catch(() => null);
    if (!hardware) return console.warn('GPU speed test skipped: no browser could be started');
    try {
      const probe = await hardware.newPage();
      await probe.setContent('<html></html>');
      const out = await Bun.build({entrypoints: [new URL('./browserEntry.ts', import.meta.url).pathname], target: 'browser'});
      await probe.addScriptTag({content: await out.outputs[0]!.text()});
      const renderer = await probe.evaluate(() => window.gpuRenderer());
      if (software.test(renderer) || (await probe.evaluate(() => window.gpuAvailable()))) return console.warn(`GPU speed test skipped: no hardware WebGL2 device (${renderer})`);
      const gpuMs = await probe.evaluate(([size, steps]) => window.timeGpu(size, steps), [gpuGridSize, 100] as const);
      const sim = createSimulation({n: cpuGridSize, seed: 1, preset: 'alpine'});
      sim.advance(10);
      const start = performance.now();
      sim.advance(30);
      const cpuMs = (performance.now() - start) / 30;
      // 60 frames a second with one step per frame is the floor for interactive; the CPU number is the grid it manages.
      expect(gpuMs).toBeLessThan(1000 / 60);
      expect(gpuMs).toBeLessThan(cpuMs);
    } finally {
      await hardware.close();
    }
  });
});
