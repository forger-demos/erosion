# Determinism and invariants

## Question

How do we get repeatable runs across compute paths, and what can tests assert?

## Determinism

- **CPU path is bit-exact.** All state lives in `Float32Array`, every store rounds to float32, and the arithmetic is `+ - * / sqrt` plus comparisons, which ECMAScript fixes for doubles (`sqrt` is IEEE correctly rounded in practice on the engines tried; the specification is looser, which is why the cross-engine check exists). Cells are updated from a read-only snapshot, so loop order cannot change results. The generator is integer-only.
- **Checked, not assumed.** A fixed run is hashed (FNV-1a over the raw bits) and the hash is pinned in `src/core/erosion/erosion.test.ts`. The same hash came out of Bun (JavaScriptCore) and Node (V8). A hash change means the maths changed and the pin is updated deliberately.
- **GPU paths are repeatable per device, not identical to the CPU.** Shader floating-point results vary by driver and may fuse multiply-add. The GPU path is therefore compared with the reference by tolerance, and its own repeatability by running twice on one device. The tolerances and the checked step counts are in `src/shell/gpu/gpuSimulation.test.ts`, which runs the shader passes in a real browser. Agreement degrades with the number of steps because erosion amplifies small differences, so the claim is for small grids over a few hundred steps, not for a long run; the same test checks bed plus sediment is conserved and nothing is negative or not finite.
- **Scrubbing relies on this.** Because the CPU run is a pure function of seed, settings and step count, the timeline can be replayed from stored checkpoints instead of recording every frame.

## Invariants tests can assert (closed boundaries)

| Invariant | Statement | Tolerance seen on the spike |
|---|---|---|
| Water balance | `sum(d) = initial + rained - evaporated` | relative drift about 1e-9 of rain total; asserted at 1e-6 |
| Bed plus sediment | `sum(b) + sum(s)` unchanged by erosion, deposition, advection, thermal | relative drift about 2e-8; asserted at 1e-6 |
| Finite | no NaN or infinity anywhere | exact |
| Non-negative | water depth and suspended sediment never below zero | exact |
| Repeatable | same seed and settings give the same hash | exact |
| Response | erosion changes most bed cells | qualitative |

The tolerance is float32 rounding accumulated over a few hundred steps; sums are taken in float64 so the check does not add its own error. Open boundaries would need the outflow added to the balance.

Water depth is clamped at zero after the flux update; rounding can leave a value a hair below zero, and the clamp adds far less water than the tolerance.

## Result of the risk check

The chosen model on a small grid is bit-for-bit repeatable for a seed, conserves water and bed-plus-sediment inside the tolerances above, and stays finite and non-negative. The riskiest assumption holds. The deviation that made it hold: sediment advects by donor-cell transfer on the water fluxes instead of the papers' semi-Lagrangian lookup, and sediment is tracked apart from water depth so each balance is its own.

## Sources

- ECMAScript language specification, `Number` arithmetic and `Math.sqrt`: <https://tc39.es/ecma262/>
- IEEE 754-2019, floating-point arithmetic (the rounding rules the CPU path leans on).
- WGSL specification, floating-point evaluation: <https://www.w3.org/TR/WGSL/>
- Jako, Toth 2011 for the model whose equations the check follows: <https://www.old.cescg.org/CESCG-2011/papers/TUBudapest-Jako-Balazs.pdf>
