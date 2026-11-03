# Compute path

## Question

Where should the simulation run so it is interactive on a laptop, off the main thread, and still works when the fast path is missing?

## Options

- **WebGPU compute.** The natural fit: storage buffers, compute shaders, no render-target tricks. Support is uneven: shipping in Chromium-based browsers, partial in Safari, and behind a flag in Firefox, per [caniuse](https://caniuse.com/webgpu); the specification is still a working draft. The WGSL specification allows implementations latitude in floating-point accuracy and operation fusion, so results are repeatable per device and driver but not guaranteed identical across them.
- **WebGL2 render-to-texture.** Each simulation pass is a fragment shader writing a float texture (`EXT_color_buffer_float`), ping-ponging between textures. Works in current Chrome, Firefox and Safari, which is the brief's constraint. A pass per stage per step; the stencils in this model are all four-neighbour reads, which suit it. Floating-point behaviour is likewise driver-dependent.
- **CPU in a Web Worker.** Plain typed arrays and the exact code in `src/core/erosion/`. Slowest, but fully deterministic across engines (checked between JavaScriptCore and V8), testable under `bun test`, and available everywhere. The unoptimised spike steps a small grid fast enough to test but far too slowly to reach a river network in a minute at a useful size, so the production CPU path needs a tuned inner loop (no per-cell allocation, flat arrays) and larger grids need the GPU. Measure with a benchmark script, not a number in this note.

## Recommendation

Three tiers behind one interface that takes a seed, parameters and a step count and returns height, water and sediment:

1. **CPU worker is the reference.** It defines correct output, backs every test, serves as the fallback, and renders exports so a saved image is reproducible.
2. **WebGL2 is the fast path** for larger grids and the 3D view, because it is the only GPU route that meets the brief in all three browsers today.
3. **WebGPU is deferred.** Revisit when Firefox ships it unflagged; the shader code is small enough to port.

The GPU path is checked against the reference within a stated tolerance on small grids (it is not bit-identical; see [determinism-and-invariants.md](determinism-and-invariants.md)). Feature detection picks the path; the page says which is running.

## Sources

- Browser support for WebGPU: <https://caniuse.com/webgpu>
- WebGPU and WGSL specifications (floating-point evaluation section lists the accuracy and fusion latitude; read as table of contents only): <https://www.w3.org/TR/webgpu/>, <https://www.w3.org/TR/WGSL/>
- WebGL 2.0 specification and the `EXT_color_buffer_float` extension: <https://registry.khronos.org/webgl/specs/latest/2.0/>, <https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/>
- Web Workers (HTML Living Standard): <https://html.spec.whatwg.org/multipage/workers.html>
