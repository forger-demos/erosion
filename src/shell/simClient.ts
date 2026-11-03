import type {Request, Response} from '../core/erosion/protocol';

/** The slice of Worker the client uses, so a test can stand in for it. */
export interface WorkerLike {
  postMessage(message: Request): void;
  terminate(): void;
  onmessage: ((e: {data: Response}) => void) | null;
  onerror: ((e: {message?: string}) => void) | null;
}

export interface SimClient {
  send(message: Request): void;
  dispose(): void;
}

/** Wires a worker to handlers; every frame is acknowledged after the handler returns. */
export function createSimClient(worker: WorkerLike, onMessage: (message: Response) => void): SimClient {
  worker.onmessage = (e) => {
    onMessage(e.data);
    if (e.data.type === 'frame') worker.postMessage({type: 'ack'});
  };
  worker.onerror = (e) => onMessage({type: 'error', message: e.message || 'The simulation worker failed to start.'});
  return {send: (m) => worker.postMessage(m), dispose: () => worker.terminate()};
}
