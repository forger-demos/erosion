import {createSimulation, type Simulation, type Snapshot} from './simulation';
import type {PresetId} from '../terrain/presets';

export type Request =
  | {type: 'init'; n: number; seed: number; preset: PresetId}
  | {type: 'play'}
  | {type: 'pause'}
  /** The page has drawn the last frame; the next one may be sent. */
  | {type: 'ack'};

export type Response =
  | {type: 'ready'; n: number}
  | ({type: 'frame'} & Snapshot)
  | {type: 'error'; message: string};

export interface RunnerEnv {
  post(message: Response, transfer: ArrayBuffer[]): void;
  /** Yields to the event loop so a pause or init message can arrive between batches. */
  schedule(fn: () => void): void;
  create?: typeof createSimulation;
}

/**
 * The worker's whole behaviour, free of worker globals so a test can drive it.
 * Stepping never waits for the page, but a frame is only posted once the previous one is acknowledged,
 * so a slow renderer drops frames instead of queueing them.
 */
export function createRunner(env: RunnerEnv, stepsPerBatch = 4): (message: Request) => void {
  const create = env.create ?? createSimulation;
  let sim: Simulation | null = null;
  let playing = false;
  let looping = false;
  let awaitingAck = false;

  function postFrame(): void {
    if (!sim) return;
    const frame = sim.snapshot();
    awaitingAck = true;
    env.post({type: 'frame', ...frame}, [frame.height.buffer, frame.water.buffer, frame.sediment.buffer] as ArrayBuffer[]);
  }

  function tick(): void {
    looping = false;
    if (!playing || !sim) return;
    try {
      sim.advance(stepsPerBatch);
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
          sim = create({n: message.n, seed: message.seed, preset: message.preset});
          awaitingAck = false;
          env.post({type: 'ready', n: message.n}, []);
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
        case 'ack':
          awaitingAck = false;
          break;
      }
    } catch (e) {
      env.post({type: 'error', message: e instanceof Error ? e.message : String(e)}, []);
    }
  };
}
