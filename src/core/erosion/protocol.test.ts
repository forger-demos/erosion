import {describe, expect, test} from 'bun:test';
import {createRunner, type Request, type Response} from './protocol';
import {createSimulation, type Simulation} from './simulation';
import {paramsFor} from './settings';
import type {Timeline} from './timeline';

function harness(create?: () => Timeline) {
  const out: Response[] = [];
  const queue: (() => void)[] = [];
  const send = createRunner({post: (m) => out.push(m), schedule: (fn) => queue.push(fn), create}, 2);
  const pump = (times: number) => {
    for (let i = 0; i < times; i++) queue.shift()?.();
  };
  const frames = () => out.filter((m) => m.type === 'frame') as Extract<Response, {type: 'frame'}>[];
  return {out, queue, send, pump, frames};
}
const init: Request = {type: 'init', n: 16, seed: 3, preset: 'hills', rain: 0.012, hardness: 0.2};

describe('simulation worker protocol', () => {
  test('init answers ready and sends step 0', () => {
    const h = harness();
    h.send(init);
    expect(h.out[0]).toEqual({type: 'ready', n: 16, path: 'cpu', label: 'Running on the CPU worker, 16 x 16 cells.'});
    expect(h.frames()[0]!.steps).toBe(0);
    expect(h.frames()[0]!.height.length).toBe(256);
  });

  test('play advances in batches and pause stops it', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'ack'});
    h.send({type: 'play'});
    h.pump(3);
    h.send({type: 'pause'});
    h.pump(5);
    expect(h.queue.length).toBe(0);
    const last = h.frames().at(-1)!;
    expect(last.steps).toBeGreaterThan(0);
    expect(last.steps % 2).toBe(0);
  });

  test('no second frame is posted until the first is acknowledged', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'play'});
    h.pump(4);
    expect(h.frames().length).toBe(1);
    h.send({type: 'ack'});
    h.pump(1);
    expect(h.frames().length).toBe(2);
  });

  test('frames match the reference simulation', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'ack'});
    h.send({type: 'play'});
    h.pump(1);
    const frame = h.frames().at(-1)!;
    const ref = createSimulation({n: 16, seed: 3, preset: 'hills', params: paramsFor({rain: 0.012, hardness: 0.2})});
    ref.advance(frame.steps);
    expect(frame.height).toEqual(ref.snapshot().height);
  });

  test('play twice does not start two loops', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'play'});
    h.send({type: 'play'});
    expect(h.queue.length).toBe(1);
  });

  test('play before init reports an error', () => {
    const h = harness();
    h.send({type: 'play'});
    expect(h.out[0]!.type).toBe('error');
  });

  test('a failing step reports the error and stops', () => {
    const h = harness(() => ({
      n: 4,
      steps: 0,
      reached: 0,
      advance: () => {
        throw new Error('boom');
      },
      seek: () => {},
      snapshot: () => ({steps: 0, height: new Float32Array(1), water: new Float32Array(1), sediment: new Float32Array(1)}),
    }));
    h.send(init);
    h.send({type: 'play'});
    h.pump(2);
    expect(h.out.at(-1)).toEqual({type: 'error', message: 'boom'});
    expect(h.queue.length).toBe(0);
  });

  test('re-init resets to step 0 while playing', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'ack'});
    h.send({type: 'play'});
    h.pump(2);
    h.send({type: 'ack'});
    h.send(init);
    h.pump(2);
    expect(h.frames().at(-1)!.steps).toBe(0);
  });

  test('seek pauses, jumps back and sends the same state as running there', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'ack'});
    h.send({type: 'play'});
    for (let i = 0; i < 4; i++) {
      h.pump(1);
      h.send({type: 'ack'});
    }
    h.pump(1);
    const reached = h.frames().at(-1)!.reached;
    expect(reached).toBeGreaterThan(2);
    h.send({type: 'seek', step: 2});
    h.pump(3);
    const frame = h.frames().at(-1)!;
    expect(frame.steps).toBe(2);
    expect(frame.reached).toBe(reached);
    const ref = createSimulation({n: 16, seed: 3, preset: 'hills', params: paramsFor({rain: 0.012, hardness: 0.2})});
    ref.advance(2);
    expect(frame.height).toEqual(ref.snapshot().height);
    expect(h.queue.length).toBe(0);
  });

  test('seek before init and a bad step report errors', () => {
    const h = harness();
    h.send({type: 'seek', step: 1});
    expect(h.out[0]!.type).toBe('error');
    h.send(init);
    h.send({type: 'seek', step: -1});
    expect(h.out.at(-1)!.type).toBe('error');
  });

  describe('path choice', () => {
    const fake = (n: number): Simulation => ({...createSimulation({n, seed: 3}), n});

    test('a working GPU path runs at the GPU size and says so', () => {
      const out: Response[] = [];
      const send = createRunner({post: (m) => out.push(m), schedule: () => {}, gpu: (o) => ({simulation: fake(o.n)})});
      send({...init, gpuN: 24});
      expect(out[0]).toEqual({type: 'ready', n: 24, path: 'gpu', label: 'Running on the GPU (WebGL2), 24 x 24 cells.'});
      expect((out[1] as Extract<Response, {type: 'frame'}>).height.length).toBe(576);
    });

    test('a GPU path that cannot start falls back to the CPU size with the reason', () => {
      const out: Response[] = [];
      const send = createRunner({post: (m) => out.push(m), schedule: () => {}, gpu: () => ({reason: 'EXT_color_buffer_float is not supported'})});
      send({...init, gpuN: 24});
      const ready = out[0] as Extract<Response, {type: 'ready'}>;
      expect(ready.path).toBe('cpu');
      expect(ready.n).toBe(16);
      expect(ready.label).toContain('EXT_color_buffer_float is not supported');
      expect(ready.label).toContain('CPU worker');
    });

    test('with no GPU hook the CPU runs and the label says why', () => {
      const out: Response[] = [];
      createRunner({post: (m) => out.push(m), schedule: () => {}})({...init, gpuN: 24});
      expect((out[0] as Extract<Response, {type: 'ready'}>).path).toBe('cpu');
    });

    test('the GPU path steps in larger batches than the CPU path', () => {
      const out: Response[] = [];
      const queue: (() => void)[] = [];
      const send = createRunner({post: (m) => out.push(m), schedule: (f) => queue.push(f), gpu: (o) => ({simulation: fake(o.n)})}, 2, 7);
      send({...init, gpuN: 16});
      send({type: 'ack'});
      send({type: 'play'});
      queue.shift()!();
      expect((out.at(-1) as Extract<Response, {type: 'frame'}>).steps).toBe(7);
    });
  });

  test('export answers with the CPU reference at the asked step and leaves the live run alone', () => {
    const h = harness();
    h.send(init);
    h.send({type: 'export', step: 5});
    const done = h.out.find((m) => m.type === 'exported') as Extract<Response, {type: 'exported'}>;
    const ref = createSimulation({n: 16, seed: 3, preset: 'hills', params: paramsFor({rain: 0.012, hardness: 0.2})});
    ref.advance(5);
    expect(done.steps).toBe(5);
    expect(done.n).toBe(16);
    expect(done.height).toEqual(ref.snapshot().height);
    expect(done.water).toEqual(ref.snapshot().water);
    expect(h.frames().at(-1)!.steps).toBe(0);
  });

  test('export before init, or at a bad step, reports an error', () => {
    const h = harness();
    h.send({type: 'export', step: 1});
    expect(h.out.at(-1)!.type).toBe('error');
    h.send(init);
    h.send({type: 'export', step: -1});
    expect(h.out.at(-1)!.type).toBe('error');
  });
});
