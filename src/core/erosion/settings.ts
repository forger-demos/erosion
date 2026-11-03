import {defaultParams, type Params} from './grid';
import type {PresetId} from '../terrain/presets';

/** What a viewer can turn: how hard it rains and how well the rock resists. */
export interface Settings {
  /** Rain depth per second added to every cell. */
  rain: number;
  /** 0 is soft soil that dissolves fast and slumps at gentle slopes; 1 is hard rock that barely wears. */
  hardness: number;
}

export const rainRange = {min: 0.002, max: 0.03, step: 0.001} as const;
export const hardnessRange = {min: 0, max: 1, step: 0.05} as const;

/** Terrain and erosion parameters that belong together, keyed by terrain preset. */
export const scenarios: Record<PresetId, Settings> = {
  alpine: {rain: 0.012, hardness: 0.7},
  hills: {rain: 0.012, hardness: 0.2},
  canyon: {rain: 0.005, hardness: 0.55},
};

export function clampSettings(s: Settings): Settings {
  const clamp = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
  return {
    rain: clamp(s.rain, rainRange.min, rainRange.max, defaultParams.rain),
    hardness: clamp(s.hardness, hardnessRange.min, hardnessRange.max, 0.5),
  };
}

/** Maps settings onto model parameters; hardness 0.5 with the default rain is the default model. */
export function paramsFor(settings: Settings): Params {
  const {rain, hardness} = clampSettings(settings);
  return {...defaultParams, rain, ks: 0.8 * (1 - hardness), talus: 0.5 + 0.8 * hardness};
}
