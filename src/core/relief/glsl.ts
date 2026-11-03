import type {Palette, Rgb} from './palette';

function f(v: number): string {
  const s = String(v);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

function vec3(c: Rgb): string {
  return `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

/**
 * GLSL for `groundColour(height, slope, wetness)`, mirroring ./colour.ts with the palette baked in as constants.
 * It sticks to a subset (scalar and vec3 builtins, `.x .y .z`, no infix vector maths) so a test can run the same
 * text as JavaScript and compare it with the TypeScript function.
 */
export function groundColourGlsl(p: Palette): string {
  return `const vec3 SAND = ${vec3(p.sand)};
const vec3 GRASS = ${vec3(p.grass)};
const vec3 ROCK = ${vec3(p.rock)};
const vec3 SNOW = ${vec3(p.snow)};
const vec3 WET = ${vec3(p.wet)};
const float SAND_FROM = ${f(p.sandFrom)};
const float SAND_TO = ${f(p.sandTo)};
const float SNOW_FROM = ${f(p.snowFrom)};
const float SNOW_TO = ${f(p.snowTo)};
const float ROCK_FROM = ${f(p.rockFrom)};
const float ROCK_TO = ${f(p.rockTo)};
const float SNOW_SLOPE_FROM = ${f(p.snowSlopeFrom)};
const float SNOW_SLOPE_TO = ${f(p.snowSlopeTo)};
const float WET_TINT = ${f(p.wetTint)};
const float WET_DARKEN = ${f(p.wetDarken)};

vec3 scale3(vec3 v, float s) {
  return vec3(v.x * s, v.y * s, v.z * s);
}

vec3 groundColour(float height, float slope, float wetness) {
  vec3 c = mix(SAND, GRASS, smoothstep(SAND_FROM, SAND_TO, height));
  c = mix(c, ROCK, smoothstep(ROCK_FROM, ROCK_TO, slope));
  float snow = smoothstep(SNOW_FROM, SNOW_TO, height) * (1.0 - smoothstep(SNOW_SLOPE_FROM, SNOW_SLOPE_TO, slope));
  c = mix(c, SNOW, snow);
  float wet = clamp(wetness, 0.0, 1.0);
  c = mix(c, WET, wet * WET_TINT);
  float dark = 1.0 - wet * WET_DARKEN;
  return scale3(c, dark);
}
`;
}
