# fBm terrain from integer-seeded noise

Status: accepted

## Context

Starting terrain must come from a seed, look like a range once eroded, and be identical on every engine. `Math.sin`, `Math.pow` and similar are implementation-approximated. See [terrain-generation](../research/terrain-generation.md).

## Decision

Generate the bed from octaves of smoothed value noise driven by an integer-only generator (`mulberry32`), using only `+ - *`. Presets vary octave count, amplitude falloff and ridged or warped variants. An uplift map with stream power is a possible later pre-pass, not part of the first build.

## Consequences

Terrain is exactly reproducible and testable on tiny grids. Raw noise has no drainage structure, so the look depends on erosion running. Ridged and warped variants cost nothing at run time. Anything needing transcendental functions in generation is avoided or replaced by polynomials.
