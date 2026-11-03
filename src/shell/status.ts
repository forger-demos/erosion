export interface StatusInput {
  /** The 2D canvas could not be used at all. */
  terrainFailed: boolean;
  /** The simulation stopped or could not start; the message says why. */
  failure: string | null;
  starting: boolean;
  /** Step being rebuilt from a checkpoint while scrubbing. */
  replayingTo: number | null;
  exporting: boolean;
  /** Outcome of the last export, success or failure. */
  exportResult: string | null;
  /** Why the 3D view is not shown, when it was asked for. */
  surfaceNote: string | null;
  /** A frame from the simulation has been shown. */
  hasRun: boolean;
}

export const idleMessage = 'Press Play to run the erosion. Downloads unlock once it has run.';

/** One line for the status region. The most blocking state wins, so a failure is never hidden behind a progress message. */
export function describeStatus(s: StatusInput): string {
  if (s.terrainFailed) return 'This browser cannot draw the relief: the 2D canvas is unavailable.';
  if (s.failure !== null) return s.failure;
  if (s.starting) return 'Starting the simulation (compiling shaders)...';
  if (s.replayingTo !== null) return `Replaying to step ${s.replayingTo}...`;
  if (s.exporting) return 'Running the CPU reference for the export...';
  if (s.exportResult !== null) return s.exportResult;
  if (s.surfaceNote !== null) return `${s.surfaceNote} The 2D relief is shown instead.`;
  return s.hasRun ? '' : idleMessage;
}
