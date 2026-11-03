/** The slice of a canvas the detector touches, so a test can inject a fake. */
export interface CanvasLike {
  getContext(id: 'webgl2'): unknown;
}

export type GpuDetection = {ok: true; gl: WebGL2RenderingContext} | {ok: false; reason: string};

interface ContextLike {
  getExtension(name: string): unknown;
}

/** Finds a WebGL2 context that can render into float textures, or says why there is none. */
export function detectGpu(createCanvas: () => CanvasLike | null): GpuDetection {
  let canvas: CanvasLike | null;
  try {
    canvas = createCanvas();
  } catch {
    canvas = null;
  }
  if (!canvas) return {ok: false, reason: 'no offscreen canvas in this worker'};
  const gl = canvas.getContext('webgl2') as ContextLike | null;
  if (!gl) return {ok: false, reason: 'WebGL2 is not available'};
  if (!gl.getExtension('EXT_color_buffer_float')) return {ok: false, reason: 'EXT_color_buffer_float is not supported'};
  return {ok: true, gl: gl as WebGL2RenderingContext};
}
