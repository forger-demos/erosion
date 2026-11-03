import {createRunner, type Request} from '../core/erosion/protocol';
import {detectGpu} from './gpu/detect';
import {createGpuSimulation} from './gpu/gpuSimulation';

const scope = self as unknown as {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<Request>) => void) | null;
};

const handle = createRunner({
  post: (message, transfer) => scope.postMessage(message, transfer),
  schedule: (fn) => void setTimeout(fn, 0),
  gpu: (options) => {
    const found = detectGpu(() => (typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(options.n, options.n)));
    if (!found.ok) return {reason: found.reason};
    try {
      return {simulation: createGpuSimulation(found.gl, options)};
    } catch (e) {
      return {reason: e instanceof Error ? e.message : String(e)};
    }
  },
});
scope.onmessage = (e) => handle(e.data);
