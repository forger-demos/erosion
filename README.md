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
