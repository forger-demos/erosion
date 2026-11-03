/** Which implementation of the model is stepping the terrain. */
export type SimPath = 'gpu' | 'cpu';

/** Grid edge for each path: the CPU worker keeps the size it can step at an interactive rate. */
export const cpuGridSize = 256;
export const gpuGridSize = 512;

export function gridSizeFor(path: SimPath): number {
  return path === 'gpu' ? gpuGridSize : cpuGridSize;
}

/** The line the page shows so the viewer knows what is running and why. */
export function describePath(path: SimPath, n: number, notice?: string): string {
  const label = path === 'gpu' ? 'GPU (WebGL2)' : 'CPU worker';
  return `Running on the ${label}, ${n} x ${n} cells.${notice ? ` ${notice}` : ''}`;
}

/** The notice for a fallback; the reason is the detector's or the constructor's own words. */
export function fallbackNotice(reason: string): string {
  return `The GPU path is unavailable (${reason.replace(/\.$/, '')}), so the CPU worker runs at a smaller size.`;
}
