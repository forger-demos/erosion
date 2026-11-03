import {viewProjection, eyePosition, orbitTarget, type OrbitState} from '../core/camera/orbit';
import {fogColour, fragmentShader, vertexShader} from './shaders';

export interface Surface {
  /** Replaces the surface shown: the bed, with lakes drawn flat at their water level. */
  setHeights(heights: Float32Array): void;
  /** Replaces the water layer: per cell, wetness then water opacity. Absent means dry. */
  setWater(wetness: Float32Array, alpha: Float32Array): void;
  draw(state: OrbitState): void;
}

export type SurfaceResult = {ok: true; surface: Surface} | {ok: false; reason: string};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
  return shader;
}

/** Indices of two triangles per grid square. */
export function gridIndices(n: number): Uint32Array {
  const out = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const i = y * n + x;
      out.set([i, i + n, i + 1, i + 1, i + n, i + n + 1], k);
      k += 6;
    }
  }
  return out;
}

/** Sets up the lit surface for an n x n height field. Fails with a reason when WebGL2 or float textures are unavailable. */
export function createSurface(canvas: HTMLCanvasElement, n: number): SurfaceResult {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', {antialias: true});
  } catch {
    gl = null;
  }
  if (!gl) return {ok: false, reason: 'WebGL2 is not available in this browser.'};
  try {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShader(n)));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader(n)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
    const indices = gridIndices(n);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, n, n);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const waterTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, waterTexture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32F, n, n);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uHeights'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'uWater'), 1);
    const pair = new Float32Array(n * n * 2);
    const viewProjectionLoc = gl.getUniformLocation(program, 'uViewProjection');
    const eyeLoc = gl.getUniformLocation(program, 'uEye');
    const context = gl;
    return {
      ok: true,
      surface: {
        setHeights(heights) {
          context.bindTexture(context.TEXTURE_2D, texture);
          context.texSubImage2D(context.TEXTURE_2D, 0, 0, 0, n, n, context.RED, context.FLOAT, heights);
        },
        setWater(wetness, alpha) {
          for (let i = 0; i < n * n; i++) {
            pair[i * 2] = wetness[i]!;
            pair[i * 2 + 1] = alpha[i]!;
          }
          context.activeTexture(context.TEXTURE1);
          context.bindTexture(context.TEXTURE_2D, waterTexture);
          context.texSubImage2D(context.TEXTURE_2D, 0, 0, 0, n, n, context.RG, context.FLOAT, pair);
          context.activeTexture(context.TEXTURE0);
        },
        draw(state) {
          const w = canvas.clientWidth * (globalThis.devicePixelRatio || 1);
          const h = canvas.clientHeight * (globalThis.devicePixelRatio || 1);
          if (canvas.width !== Math.round(w) || canvas.height !== Math.round(h)) {
            canvas.width = Math.max(1, Math.round(w));
            canvas.height = Math.max(1, Math.round(h));
          }
          context.viewport(0, 0, canvas.width, canvas.height);
          context.clearColor(fogColour[0], fogColour[1], fogColour[2], 1);
          context.enable(context.DEPTH_TEST);
          context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
          context.useProgram(program);
          context.bindVertexArray(vao);
          context.bindTexture(context.TEXTURE_2D, texture);
          context.activeTexture(context.TEXTURE1);
          context.bindTexture(context.TEXTURE_2D, waterTexture);
          context.activeTexture(context.TEXTURE0);
          context.uniformMatrix4fv(viewProjectionLoc, false, viewProjection(state, canvas.width / canvas.height, n));
          context.uniform3fv(eyeLoc, eyePosition(state, orbitTarget(n)));
          context.drawElements(context.TRIANGLES, indices.length, context.UNSIGNED_INT, 0);
        },
      },
    };
  } catch (error) {
    return {ok: false, reason: `The 3D view could not start: ${error instanceof Error ? error.message : String(error)}`};
  }
}
