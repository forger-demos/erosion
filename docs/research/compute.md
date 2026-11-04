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

## As built

The worker owns both paths. On `init` it asks `detectGpu` for a WebGL2 context on an `OffscreenCanvas` with `EXT_color_buffer_float`; if that and shader compilation succeed, `createGpuSimulation` steps the model and the run uses the larger GPU grid, otherwise the CPU reference runs at its own size and the page shows the reason. Both sit behind the `Simulation` interface, so the timeline, checkpoints and scrubbing are shared. The grid sizes per path are in `src/core/erosion/path.ts`.

Four passes per step on RGBA32F textures: outflow flux with rain, then depth, velocity and erosion, then sediment transport, then evaporation and thermal weathering. The CPU scatters sediment and thermal material to neighbours; the passes gather the same amounts instead, so only the order of float additions differs. The CPU erosion stage reads the bed as the stage began, the same as the passes do. Measure speed with `bun run bench` for the CPU and by watching the step counter on the page for the GPU.

## Browser notes

- Current Chrome and Firefox load the page, run the worker and draw the relief. The 3D view and the GPU path need WebGL2 with float render targets; where either is missing the page says so and keeps the CPU reference and the 2D relief.
- Safari has not been exercised against this page. It supports WebGL2 and module workers, but `OffscreenCanvas` WebGL inside a worker and `EXT_color_buffer_float` are the pieces to check first; a failure there lands on the CPU fallback with the reason shown.
- The 2D relief resamples the height field bilinearly before shading and tracing contours, so lines are smooth at display size; the canvas is then scaled with the browser's bilinear filter. This costs a fraction of a second of main-thread time per drawn frame on the larger grid.

## Sources

- Browser support for WebGPU: <https://caniuse.com/webgpu>
- WebGPU and WGSL specifications (floating-point evaluation section lists the accuracy and fusion latitude; read as table of contents only): <https://www.w3.org/TR/webgpu/>, <https://www.w3.org/TR/WGSL/>
- WebGL 2.0 specification and the `EXT_color_buffer_float` extension: <https://registry.khronos.org/webgl/specs/latest/2.0/>, <https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/>
- Web Workers (HTML Living Standard): <https://html.spec.whatwg.org/multipage/workers.html>
