import {expect, test} from 'bun:test';
import type {Request, Response} from '../core/erosion/protocol';
import {createSimClient, type WorkerLike} from './simClient';

function fake() {
  const sent: Request[] = [];
  let terminated = false;
  const worker: WorkerLike = {
    postMessage: (m) => void sent.push(m),
    terminate: () => (terminated = true),
    onmessage: null,
    onerror: null,
  };
  return {worker, sent, terminated: () => terminated};
}

test('frames are acknowledged after the handler runs', () => {
  const f = fake();
  const seen: Response[] = [];
  createSimClient(f.worker, (m) => seen.push(m));
  const frame = {type: 'frame', steps: 1, height: new Float32Array(1), water: new Float32Array(1), sediment: new Float32Array(1)} as const;
  f.worker.onmessage!({data: frame});
  expect(seen).toEqual([frame]);
  expect(f.sent).toEqual([{type: 'ack'}]);
});

test('worker errors surface as error messages', () => {
  const f = fake();
  const seen: Response[] = [];
  createSimClient(f.worker, (m) => seen.push(m));
  f.worker.onerror!({message: 'nope'});
  f.worker.onerror!({});
  expect(seen[0]).toEqual({type: 'error', message: 'nope'});
  expect(seen[1]!.type).toBe('error');
});

test('send forwards and dispose terminates', () => {
  const f = fake();
  const client = createSimClient(f.worker, () => {});
  client.send({type: 'pause'});
  client.dispose();
  expect(f.sent).toEqual([{type: 'pause'}]);
  expect(f.terminated()).toBe(true);
});
