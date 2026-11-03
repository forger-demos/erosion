import type {Simulation, SimulationOptions, Snapshot} from './simulation';
import {describePath, fallbackNotice, type SimPath} from './path';
import {paramsFor} from './settings';
import {createTimeline, type Timeline} from './timeline';
import type {PresetId} from '../terrain/presets';

export type Request =
  /** `gpuN`, when present, asks for the GPU path at that size; `n` is the size the CPU path runs at. */
  | {type: 'init'; n: number; gpuN?: number; seed: number; preset: PresetId; rain: number; hardness: number}
  | {type: 'play'}
  | {type: 'pause'}
  /** Pauses and jumps to a step, replaying from a checkpoint when it is behind the run. */
  | {type: 'seek'; step: number}
  /** Runs the CPU reference to a step, apart from the live run, and answers with its fields. */
  | {type: 'export'; step: number}
  /** The page has drawn the last frame; the next one may be sent. */
  | {type: 'ack'};

export type Response =
  /** `n` is the grid the run actually uses, and `label` says which path steps it and why. */
  | {type: 'ready'; n: number; path: SimPath; label: string}
  /** `reached` is the furthest step the run has been to, which bounds what can be scrubbed to. */
  | ({type: 'frame'; reached: number} & Snapshot)
  /** The reference state at `steps` on the CPU grid of edge `n`; the live run is untouched. */
  | {type: 'exported'; steps: number; n: number; height: Float32Array; water: Float32Array}
  | {type: 'error'; message: string};

export interface RunnerEnv {
  post(message: Response, transfer: ArrayBuffer[]): void;
  /** Yields to the event loop so a pause or init message can arrive between batches. */
  schedule(fn: () => void): void;
  create?: (options: SimulationOptions) => Timeline;
  /** Tries the GPU path; the reason it gives when it cannot becomes the page's notice. */
  gpu?: (options: SimulationOptions) => {simulation: Simulation} | {reason: string};
}

/**
 * The worker's whole behaviour, free of worker globals so a test can drive it.
 * Stepping never waits for the page, but a frame is only posted once the previous one is acknowledged,
 * so a slow renderer drops frames instead of queueing them.
 */
export function createRunner(env: RunnerEnv, stepsPerBatch = 4, gpuStepsPerBatch = 8): (message: Request) => void {
  const create = env.create ?? createTimeline;
  let sim: Timeline | null = null;
  let playing = false;
  let looping = false;
  let awaitingAck = false;
  let batch = stepsPerBatch;
  /** What the run was started with, so an export can rebuild the CPU reference for it. */
  let reference: SimulationOptions | null = null;

  function postFrame(): void {
    if (!sim) return;
    const frame = sim.snapshot();
    awaitingAck = true;
    env.post({type: 'frame', reached: sim.reached, ...frame}, [frame.height.buffer, frame.water.buffer, frame.sediment.buffer] as ArrayBuffer[]);
  }

  function tick(): void {
    looping = false;
    if (!playing || !sim) return;
    try {
      sim.advance(batch);
      if (!awaitingAck) postFrame();
    } catch (e) {
      playing = false;
      env.post({type: 'error', message: e instanceof Error ? e.message : String(e)}, []);
      return;
    }
    looping = true;
    env.schedule(tick);
  }

  return (message) => {
    try {
      switch (message.type) {
        case 'init':
          playing = false;
          const params = paramsFor(message);
          let path: SimPath = 'cpu';
          let notice: string | undefined;
          sim = null;
          reference = {n: message.n, seed: message.seed, preset: message.preset, params};
          if (message.gpuN) {
            const options = {n: message.gpuN, seed: message.seed, preset: message.preset, params};
            const attempt = env.gpu ? env.gpu(options) : {reason: 'the GPU path is not available here'};
            if ('simulation' in attempt) {
              sim = createTimeline(options, {create: () => attempt.simulation});
              path = 'gpu';
            } else {
              notice = fallbackNotice(attempt.reason);
            }
          }
          const n = path === 'gpu' ? message.gpuN! : message.n;
          sim ??= create({n, seed: message.seed, preset: message.preset, params});
          batch = path === 'gpu' ? gpuStepsPerBatch : stepsPerBatch;
          awaitingAck = false;
          env.post({type: 'ready', n, path, label: describePath(path, n, notice)}, []);
          postFrame();
          break;
        case 'play':
          if (!sim) throw new Error('The simulation has not been initialised.');
          playing = true;
          if (!looping) {
            looping = true;
            env.schedule(tick);
          }
          break;
        case 'pause':
          playing = false;
          break;
        case 'seek':
          if (!sim) throw new Error('The simulation has not been initialised.');
          playing = false;
          sim.seek(message.step);
          postFrame();
          break;
        case 'export': {
          if (!reference) throw new Error('The simulation has not been initialised.');
          if (!Number.isInteger(message.step) || message.step < 0) throw new Error('A step must be a whole number of zero or more.');
          const run = create(reference);
          run.advance(message.step);
          const done = run.snapshot();
          env.post({type: 'exported', steps: done.steps, n: reference.n, height: done.height, water: done.water}, [done.height.buffer, done.water.buffer] as ArrayBuffer[]);
          break;
        }
        case 'ack':
          awaitingAck = false;
          break;
      }
    } catch (e) {
      env.post({type: 'error', message: e instanceof Error ? e.message : String(e)}, []);
    }
  };
}
