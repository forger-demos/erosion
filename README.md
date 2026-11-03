# erosion

Grow a mountain range: terrain shaped by water and time, simulated in the browser.

The owner's brief is [docs/brief.md](docs/brief.md). A forger work loop builds it: requests are GitHub issues labelled `ready-for-agent`, each is built on its own branch, and a PR merges only when the gates in `.forger/workloop.config.json`, CI and an independent verifier pass.

## Develop

```
bun install
bun run start
bun run check
bun run bench          # step cost per grid size; optional args: sizes, steps
```

The erosion steps run in a Web Worker (`src/shell/simWorker.ts`) behind the `Simulation` interface in `src/core/erosion/`; the page only renders the frames it sends.

Rain and rock hardness are set in the control panel; each terrain preset carries the erosion settings that suit it (`src/core/erosion/settings.ts`). The Time slider scrubs the run: the worker keeps checkpoints and replays from the nearest earlier one, which is exact because a run is a pure function of seed, settings and step count (`src/core/erosion/timeline.ts`). Screenshots of the three presets after the same run are in `docs/screenshots/preset-*`.

Where WebGL2 can render into float textures (`EXT_color_buffer_float`) the worker runs the same model as fragment passes on an `OffscreenCanvas` (`src/shell/gpu/`) at a larger grid, and the page says which path is running. Otherwise it falls back to the CPU worker and says why. The GPU path is checked against the CPU reference by tolerance in `src/shell/gpu/gpuSimulation.test.ts`, which drives a real Chrome and is skipped, with the reason printed, where none can start. Screenshots of the GPU path in both themes are `docs/screenshots/gpu-path-*`.

Two buttons download the run as PNG files: a 16-bit greyscale heightmap and the 8-bit shaded image with its rivers and lakes. The page asks the worker to run the CPU reference to the step on show, apart from the live run, so a GPU run exports the same CPU-sized files as a CPU run. The PNG encoder is a pure function in `src/core/export/` that writes uncompressed blocks, so the same seed, settings and step give byte-identical files. File names carry the preset, seed and step. Examples are in `docs/examples/`.
