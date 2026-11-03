export type Rgb = readonly [number, number, number];

/** Colours and thresholds of the relief. Height is a fraction of the terrain's height range; slope is rise over run. */
export interface Palette {
  sand: Rgb;
  grass: Rgb;
  rock: Rgb;
  snow: Rgb;
  /** Tint that wet ground moves towards. */
  wet: Rgb;
  /** Height fractions between which sand gives way to grass. */
  sandFrom: number;
  sandTo: number;
  /** Height fractions between which snow fades in. */
  snowFrom: number;
  snowTo: number;
  /** Slopes between which ground turns to bare rock. */
  rockFrom: number;
  rockTo: number;
  /** Slopes between which snow stops lying. */
  snowSlopeFrom: number;
  snowSlopeTo: number;
  /** Share of the colour that wetness can replace with the wet tint, and how much it darkens. */
  wetTint: number;
  wetDarken: number;
  /** Light = ambient + gain * hillshade. */
  ambient: number;
  gain: number;
  /** Colour of contour lines and their strength. */
  line: Rgb;
  lineStrength: number;
}

export const reliefPalette: Palette = {
  sand: [0.84, 0.76, 0.54],
  grass: [0.36, 0.5, 0.26],
  rock: [0.47, 0.44, 0.41],
  snow: [0.95, 0.97, 1],
  wet: [0.14, 0.3, 0.45],
  sandFrom: 0.36,
  sandTo: 0.5,
  snowFrom: 0.74,
  snowTo: 0.86,
  rockFrom: 1.3,
  rockTo: 2.3,
  snowSlopeFrom: 0.9,
  snowSlopeTo: 1.7,
  wetTint: 0.5,
  wetDarken: 0.25,
  ambient: 0.45,
  gain: 0.8,
  line: [0.12, 0.1, 0.08],
  lineStrength: 0.45,
};
