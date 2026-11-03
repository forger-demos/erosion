# Terrain generation

## Question

Which starting terrain erodes into a believable range, from a seed, with identical output on every engine?

## Options

- **Fractional Brownian motion (fBm) of value or gradient noise.** Octaves of smoothed lattice noise at doubling frequency and halving amplitude. Simple, seedable, fast, and the standard input to erosion work. Raw fBm is isotropic and rolling; erosion supplies the drainage structure it lacks.
- **Ridged and domain-warped variants.** Taking `1 - |noise|` per octave gives sharp ridges, and warping the sample position by another noise field breaks the grid look. Good for alpine presets; each adds cost only at generation time.
- **Uplift map plus stream power.** Paint or generate where the crust rises, then run stream-power erosion to equilibrium (Cordonnier et al.). Best large-scale structure, but it needs flow routing over the whole domain and is a different pipeline from the live simulation.
- **Plate or fault-line construction.** Out of scope for a single-page demo.

## Determinism

Noise built from an integer-only generator (`mulberry32`, using `Math.imul`) and polynomial smoothing (`3t^2 - 2t^3`) uses only `+ - *`, which are exactly specified for doubles, so every engine agrees. Avoid `Math.sin`, `Math.pow`, `Math.exp` and friends in generation: the ECMAScript specification leaves their results implementation-approximated. The spike's generator follows this and its output hash matches between JavaScriptCore and V8.

## Recommendation

fBm of smoothed value noise as the base, with ridged and warped variants and an amplitude/frequency recipe per preset (young alpine range, old worn hills, desert canyon). Presets differ in noise shape and in erosion parameters. Hold the uplift-and-stream-power route as a later optional pre-pass.

## Sources

- Musgrave, Kolb, Mace 1989 (fractal terrain with erosion), cited in [erosion-models.md](erosion-models.md); not read for this note.
- Cordonnier et al. 2016, uplift maps as input to stream power: <https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf>
- ECMAScript language specification, numeric operations and `Math` functions: <https://tc39.es/ecma262/>
- Quilez, "fBm" and "domain warping" articles (practical recipes, not peer reviewed): <https://iquilezles.org/articles/fbm/>, <https://iquilezles.org/articles/warp/>
