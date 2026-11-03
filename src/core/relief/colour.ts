import type {Palette, Rgb} from './palette';

/** 0 below `from`, 1 above `to`, a smooth ramp between. */
export function smoothstep(from: number, to: number, v: number): number {
  const t = (v - from) / (to - from);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

function mix(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Ground colour from height (fraction of the range), slope (rise over run) and wetness (0 to 1).
 * Sand low, grass between, rock where steep, snow high and not too steep; wet ground is darker and bluer.
 */
export function groundColour(height: number, slope: number, wetness: number, p: Palette): [number, number, number] {
  let c = mix(p.sand, p.grass, smoothstep(p.sandFrom, p.sandTo, height));
  c = mix(c, p.rock, smoothstep(p.rockFrom, p.rockTo, slope));
  const snow = smoothstep(p.snowFrom, p.snowTo, height) * (1 - smoothstep(p.snowSlopeFrom, p.snowSlopeTo, slope));
  c = mix(c, p.snow, snow);
  const wet = wetness < 0 ? 0 : wetness > 1 ? 1 : wetness;
  c = mix(c, p.wet, wet * p.wetTint);
  const dark = 1 - wet * p.wetDarken;
  return [c[0] * dark, c[1] * dark, c[2] * dark];
}
