import {defaultParams, maxStableDt} from '../../core/erosion/grid';
import type {Checkpoint, Simulation, SimulationOptions, Snapshot} from '../../core/erosion/simulation';
import {generateTerrain} from '../../core/terrain/noise';
import {carrySource, erodeSource, fluxSource, settleSource, vertexSource} from './shaders';

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

function link(gl: WebGL2RenderingContext, fragment: string): Program {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
  return {program, uniforms: new Map()};
}

/**
 * The WebGL2 fast path behind the same interface as the CPU reference. It matches the reference
 * within a tolerance, not bit for bit, because shader arithmetic is the driver's own; on one device
 * it repeats exactly. Throws when the device cannot render into float textures.
 */
export function createGpuSimulation(gl: WebGL2RenderingContext, {n, seed, preset, params = defaultParams}: SimulationOptions): Simulation {
  if (params.dt > maxStableDt(params)) throw new Error('The time step is above the stability limit of the model.');
  if (n > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('The grid is larger than the largest texture this device supports.');

  const programs = {
    flux: link(gl, fluxSource),
    erode: link(gl, erodeSource),
    carry: link(gl, carrySource),
    settle: link(gl, settleSource),
  };
  const empty = gl.createVertexArray();
  const makeTarget = (): Target => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, n, n);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('This device cannot render into float textures.');
    return {texture, framebuffer};
  };
  // State cycles s0 -> s1 -> s2 -> s0 within a step; flux alternates so a pass never reads what it writes.
  const state = [makeTarget(), makeTarget(), makeTarget()] as const;
  const flux = [makeTarget(), makeTarget()] as const;
  let fluxNow = 0;

  const cell = params.cell;
  const constants: Record<string, number> = {
    uDt: params.dt,
    uRain: params.rain,
    uCell: cell,
    uCellArea: cell * cell,
    uK: (params.dt * params.pipeArea * params.g) / cell,
    uKc: params.kc,
    uKs: params.ks,
    uKd: params.kd,
    uDepthMax: params.depthMax,
    uEvaporation: params.evaporation,
    uReach: params.talus * cell,
    uDiagReach: params.talus * cell * Math.sqrt(2),
    uThermalRate: params.thermalRate,
  };

  function use(p: Program, inputs: Record<string, WebGLTexture>): void {
    gl.useProgram(p.program);
    const location = (name: string) => {
      if (!p.uniforms.has(name)) p.uniforms.set(name, gl.getUniformLocation(p.program, name));
      return p.uniforms.get(name)!;
    };
    gl.uniform1i(location('uN'), n);
    for (const [name, value] of Object.entries(constants)) {
      const at = location(name);
      if (at) gl.uniform1f(at, value);
    }
    Object.entries(inputs).forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location(name), unit);
    });
  }

  function pass(p: Program, inputs: Record<string, WebGLTexture>, into: Target): void {
    use(p, inputs);
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer);
    gl.viewport(0, 0, n, n);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function upload(target: Target, data: Float32Array): void {
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RGBA, gl.FLOAT, data);
  }

  function download(target: Target): Float32Array {
    const out = new Float32Array(n * n * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.readPixels(0, 0, n, n, gl.RGBA, gl.FLOAT, out);
    return out;
  }

  function reset(bed: Float32Array): void {
    const packed = new Float32Array(n * n * 4);
    for (let i = 0; i < n * n; i++) packed[i * 4] = bed[i]!;
    upload(state[0], packed);
    upload(flux[0], new Float32Array(n * n * 4));
    fluxNow = 0;
  }

  gl.bindVertexArray(empty);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  reset(generateTerrain(n, seed, preset ?? 'hills'));
  let steps = 0;

  return {
    n,
    get steps() {
      return steps;
    },
    advance(count) {
      for (let i = 0; i < count; i++) {
        const f = flux[fluxNow]!;
        const g = flux[1 - fluxNow]!;
        pass(programs.flux, {uS: state[0].texture, uF: f.texture}, g);
        pass(programs.erode, {uS: state[0].texture, uF: g.texture}, state[1]);
        pass(programs.carry, {uS0: state[0].texture, uS: state[1].texture, uF: g.texture}, state[2]);
        pass(programs.settle, {uS: state[2].texture}, state[0]);
        fluxNow = 1 - fluxNow;
      }
      // Waiting here keeps a long advance from queueing unbounded work behind the next frame.
      gl.finish();
      steps += count;
    },
    snapshot(): Snapshot {
      const packed = download(state[0]);
      const height = new Float32Array(n * n);
      const water = new Float32Array(n * n);
      const sediment = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) {
        height[i] = packed[i * 4]!;
        water[i] = packed[i * 4 + 1]!;
        sediment[i] = packed[i * 4 + 2]!;
      }
      return {steps, height, water, sediment};
    },
    save(): Checkpoint {
      return {steps, fields: [download(state[0]), download(flux[fluxNow]!)], rained: 0, evaporated: 0};
    },
    restore(checkpoint) {
      upload(state[0], checkpoint.fields[0]!);
      fluxNow = 0;
      upload(flux[0], checkpoint.fields[1]!);
      steps = checkpoint.steps;
    },
  };
}
