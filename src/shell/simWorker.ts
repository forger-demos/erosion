import {createRunner, type Request} from '../core/erosion/protocol';

const scope = self as unknown as {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<Request>) => void) | null;
};

const handle = createRunner({
  post: (message, transfer) => scope.postMessage(message, transfer),
  schedule: (fn) => void setTimeout(fn, 0),
});
scope.onmessage = (e) => handle(e.data);
