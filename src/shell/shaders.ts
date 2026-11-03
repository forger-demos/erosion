import {sunDirection} from '../core/relief/hillshade';
import {reliefPalette} from '../core/relief/palette';
import {groundColourGlsl} from '../core/relief/glsl';
import {heightRange} from '../core/terrain/noise';

/** Colour of the distance haze; the canvas is cleared to the same colour. */
export const fogColour: readonly [number, number, number] = [0.66, 0.74, 0.84];

function f(v: number): string {
  const s = String(v);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

/** Vertices are generated from gl_VertexID, so the mesh needs no attributes, only an index buffer. */
export function vertexShader(n: number): string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uHeights;
uniform mat4 uViewProjection;
out vec2 vCell;
out vec3 vWorld;
void main() {
  int x = gl_VertexID % ${n};
  int y = gl_VertexID / ${n};
  float h = texelFetch(uHeights, ivec2(x, y), 0).r;
  vCell = vec2(float(x), float(y));
  vWorld = vec3(float(x) - ${f((n - 1) / 2)}, h, float(y) - ${f((n - 1) / 2)});
  gl_Position = uViewProjection * vec4(vWorld, 1.0);
}
`;
}

/** Wetness and water opacity come from core/water as a two-channel texture. Lighting mirrors core/relief: Horn gradient, the same sun, ambient plus gain times shade, then distance haze. */
export function fragmentShader(n: number): string {
  const {min, max} = heightRange(n);
  const sun = sunDirection;
  const p = reliefPalette;
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uHeights;
uniform highp sampler2D uWater;
uniform vec3 uEye;
in vec2 vCell;
in vec3 vWorld;
out vec4 outColour;
${groundColourGlsl(p)}
float heightAt(int x, int y) {
  return texelFetch(uHeights, ivec2(clamp(x, 0, ${n - 1}), clamp(y, 0, ${n - 1})), 0).r;
}
void main() {
  int x = int(vCell.x + 0.5);
  int y = int(vCell.y + 0.5);
  float a = heightAt(x - 1, y - 1); float b = heightAt(x, y - 1); float c = heightAt(x + 1, y - 1);
  float d = heightAt(x - 1, y);                                   float e = heightAt(x + 1, y);
  float g = heightAt(x - 1, y + 1); float h = heightAt(x, y + 1); float i = heightAt(x + 1, y + 1);
  float dx = (c + 2.0 * e + i - (a + 2.0 * d + g)) / 8.0;
  float dy = (g + 2.0 * h + i - (a + 2.0 * b + c)) / 8.0;
  float shade = max(0.0, (-dx * ${f(sun[0])} - dy * ${f(sun[1])} + ${f(sun[2])}) / sqrt(dx * dx + dy * dy + 1.0));
  vec2 water = texelFetch(uWater, ivec2(x, y), 0).rg;
  vec3 ground = groundColour((vWorld.y - ${f(min)}) / ${f(max - min)}, sqrt(dx * dx + dy * dy), water.x);
  ground = mix(ground, vec3(${p.water.map(f).join(', ')}), water.y);
  float light = ${f(p.ambient)} + ${f(p.gain)} * shade;
  float fog = 1.0 - exp(-length(vWorld - uEye) * ${f(1.6 / (n * 3))});
  outColour = vec4(mix(ground * light, vec3(${fogColour.map(f).join(', ')}), fog), 1.0);
}
`;
}
