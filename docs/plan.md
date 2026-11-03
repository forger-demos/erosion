# Build plan

The build as ordered vertical slices. Each ends in something visible in a screenshot, names its acceptance, and keeps maths and data logic in pure `core` modules apart from rendering in `shell`. Decisions are in [docs/adr](adr); the reasoning is in [docs/research](research). The ticket order and dependencies live in the GitHub issues, which are the backlog.

## Ground rules

- `core` holds pure, tested logic (noise, erosion, hillshade, colour, contours, flow, export encoding). `shell` holds the page, canvas, WebGL, workers and DOM, and imports `core` only.
- The CPU path is the reference ([ADR 0003](adr/0003-cpu-reference-webgl2-fast-path.md), [ADR 0005](adr/0005-determinism-contract-and-invariant-tests.md)). Tests run on small grids under `bun test`.
- Each slice updates the page so the UI gate's screenshots show the new result in light and dark, phone and desktop.

## Slices

1. **Terrain from a seed.** Promote the seeded noise from the spike into a terrain module with presets as data (young alpine range, old worn hills, desert canyon), ridged and warped variants. The page shows a greyscale heightmap for a seed, with a seed field. *Visible:* three presets side by side as heightmaps. *Acceptance:* same seed and preset give the same hash; heights finite and inside a stated range; presets differ.
2. **Shaded relief, contours and colour.** Pure hillshade, contour and height/slope colour functions in `core`; a 2D canvas view. *Visible:* a coloured relief map with contour lines. *Acceptance:* hillshade, contours and colour pinned on tiny grids; the view never reads simulation code.
3. **Lit 3D surface with orbit.** WebGL2 mesh displaced from a height texture, lit, with orbit and zoom, and a toggle between 2D relief and 3D. *Visible:* the terrain as an orbitable surface. *Acceptance:* camera maths tested as pure functions; a screenshot at a fixed camera; a message when WebGL2 is missing.
4. **Erosion in a worker with play and pause.** Move the spike's step into a tuned CPU worker behind a simulation interface; messages carry height, water and sediment; play, pause and a step counter. *Visible:* the relief changes as it runs and ridges and valleys sharpen. *Acceptance:* the invariants and pinned hash from the spike hold for the tuned loop; a benchmark script reports step cost; the main thread never runs steps.
5. **Water, rivers and wetness.** Water depth and flow overlay as rivers and flat lakes; wetness feeds the colour function. *Visible:* a river network on the relief and in 3D. *Acceptance:* the overlay and wetness colour are pure and pinned; lakes are flat at bed plus depth.
6. **Controls and presets.** Rain, rock hardness and time controls; presets set terrain and erosion parameters together; scrubbing replays from checkpoints. *Visible:* the control panel and three clearly different outcomes. *Acceptance:* a preset id plus seed reproduces its hash; scrubbing to step N equals running to step N.
7. **WebGL2 compute path and fallback.** The same model as fragment passes on float textures, chosen by feature detection, with the page stating which path runs. *Visible:* a larger grid running smoothly. *Acceptance:* matches the CPU reference within a stated tolerance on small grids; repeatable on one device; the fallback engages when the extension is absent.
8. **Export.** PNG heightmap and shaded image, produced from the reference path so they are reproducible. *Visible:* downloaded files shown in the README. *Acceptance:* encoder round-trips on tiny grids; export of a seed twice is byte-identical.
9. **Polish across browsers.** Light and dark chrome, keyboard access, loading, error and empty states, and a pass in Chrome, Firefox and Safari. *Visible:* the finished page. *Acceptance:* the UI gate passes in both themes and both viewports; the browser pass is recorded in the PR.
10. **Showcase.** The README opens with the screenshots and a short story of what the page shows, how to run it, and the three presets. *Visible:* the README. *Acceptance:* screenshots are the ones the UI gate produced; claims in the README match the page.

## Not in this plan

Stream-power pre-pass, WebGPU, layered rock types and open boundaries. Each would be its own decision.
