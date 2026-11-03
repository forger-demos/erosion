import {createSimulation, type Checkpoint, type SimulationOptions, type Simulation, type Snapshot} from './simulation';

/**
 * A run you can move back and forth in. The run is a pure function of seed, settings and step count,
 * so going back restores the nearest earlier checkpoint and steps forward again.
 */
export interface Timeline {
  readonly steps: number;
  /** The furthest step the run has reached. */
  readonly reached: number;
  advance(count: number): void;
  seek(step: number): void;
  snapshot(): Snapshot;
}

export interface TimelineOptions {
  create?: (options: SimulationOptions) => Simulation;
  /** Steps between checkpoints at first. */
  interval?: number;
  /** Checkpoints kept; past this every other one is dropped and the interval doubles. */
  maxCheckpoints?: number;
}

export function createTimeline(options: SimulationOptions, {create = createSimulation, interval: first = 50, maxCheckpoints = 64}: TimelineOptions = {}): Timeline {
  const sim = create(options);
  let interval = first;
  let reached = 0;
  const checkpoints = new Map<number, Checkpoint>([[0, sim.save()]]);

  function thin(): void {
    interval *= 2;
    for (const at of [...checkpoints.keys()]) if (at % interval !== 0) checkpoints.delete(at);
  }

  function advance(count: number): void {
    let left = count;
    while (left > 0) {
      const chunk = Math.min(left, interval - (sim.steps % interval));
      sim.advance(chunk);
      left -= chunk;
      if (sim.steps % interval === 0 && !checkpoints.has(sim.steps)) {
        checkpoints.set(sim.steps, sim.save());
        if (checkpoints.size > maxCheckpoints) thin();
      }
      reached = Math.max(reached, sim.steps);
    }
  }

  return {
    get steps() {
      return sim.steps;
    },
    get reached() {
      return reached;
    },
    advance,
    seek(step) {
      if (!Number.isInteger(step) || step < 0) throw new Error('A step must be a whole number of zero or more.');
      if (step < sim.steps) {
        let from = 0;
        for (const at of checkpoints.keys()) if (at <= step && at > from) from = at;
        sim.restore(checkpoints.get(from)!);
      }
      advance(step - sim.steps);
    },
    snapshot: () => sim.snapshot(),
  };
}
