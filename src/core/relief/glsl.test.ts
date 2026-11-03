import {describe, expect, test} from 'bun:test';
import {groundColour} from './colour';
import {groundColourGlsl} from './glsl';
import {reliefPalette as p, type Palette} from './palette';

type V = {x: number; y: number; z: number};
const vec3 = (x: number, y: number, z: number): V => ({x, y, z});
function mix(a: V | number, b: V | number, t: number): V | number {
  if (typeof a === 'number') return a + ((b as number) - a) * t;
  const c = b as V;
  return vec3(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t, a.z + (c.z - a.z) * t);
}
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Runs the shader text as JavaScript: the subset it uses differs from JS only by type names. */
function evaluate(palette: Palette): (h: number, s: number, w: number) => [number, number, number] {
  const js = groundColourGlsl(palette)
    .replace(/^const (vec3|float) /gm, 'const ')
    .replace(/^(vec3|float) (\w+)\(([^)]*)\) \{/gm, (_m, _t, name: string, params: string) => `function ${name}(${params.replace(/(vec3|float) /g, '')}) {`)
    .replace(/^(\s+)(vec3|float) (\w+) =/gm, '$1let $3 =');
  const run = new Function('vec3', 'mix', 'clamp', 'smoothstep', `${js}\nreturn groundColour;`);
  const fn = run(vec3, mix, clamp, smoothstep) as (h: number, s: number, w: number) => V;
  return (h, s, w) => {
    const c = fn(h, s, w);
    return [c.x, c.y, c.z];
  };
}

describe('shader colour parity', () => {
  test('matches groundColour on a grid of heights, slopes and wetness', () => {
    const shader = evaluate(p);
    let checked = 0;
    for (let h = -0.1; h <= 1.1; h += 0.1) {
      for (let s = 0; s <= 3; s += 0.25) {
        for (const w of [-0.5, 0, 0.3, 1, 2]) {
          const want = groundColour(h, s, w, p);
          const got = shader(h, s, w);
          for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(want[k]!, 6);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  test('follows a changed palette, so the constants come from the palette and not from the text', () => {
    const other: Palette = {...p, snow: [1, 0, 0], snowFrom: 0.1, snowTo: 0.2, wetTint: 0.9, rockFrom: 5, rockTo: 6};
    const shader = evaluate(other);
    for (const [h, s, w] of [[0.9, 0.2, 0.4], [0.5, 1, 0], [0.15, 0.1, 1]] as const) {
      const want = groundColour(h, s, w, other);
      shader(h, s, w).forEach((v, k) => expect(v).toBeCloseTo(want[k]!, 6));
    }
  });

  test('every float literal has a decimal point so GLSL does not read it as an int', () => {
    const text = groundColourGlsl({...p, sandFrom: 0, sandTo: 1, rockFrom: 2});
    expect(text).toContain('SAND_FROM = 0.0');
    expect(text).toContain('SAND_TO = 1.0');
    expect(text).toContain('ROCK_FROM = 2.0');
  });
});
