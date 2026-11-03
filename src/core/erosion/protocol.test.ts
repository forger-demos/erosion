import {describe, expect, test} from 'bun:test';
import {createRunner, type Request, type Response} from './protocol';
import {createSimulation} from './simulation';
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
    expect(h.out[0]).toEqual({type: 'ready', n: 16});
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
});
