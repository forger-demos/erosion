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
