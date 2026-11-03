# Virtual-pipe shallow-water erosion with thermal weathering

Status: accepted

## Context

The brief wants rain carving channels, sediment filling valleys, slopes slumping, rivers and lakes, and tests that water and sediment are conserved. Droplet erosion is serial and has no water field. Stream power is global and has no rain or lakes. See [erosion-models](../research/erosion-models.md).

## Decision

Simulate on a uniform grid with the virtual-pipe shallow-water model (Mei, Decaudin, Hu) plus a thermal weathering pass. Move sediment by donor-cell transfer on the water fluxes rather than semi-Lagrangian lookup. Thermal weathering looks at all eight neighbours, the diagonals at their true distance, because four alone leave terraces along the grid lines. Use closed boundaries. The pure implementation lives in `src/core/erosion/`.

## Consequences

Every step is a local stencil, so the same maths ports to fragment shaders. Water, sediment and bed height each have an exact balance to test. Channels need many steps to form, so presets and a GPU path matter. Stream power may be added later as a terrain pre-pass without changing this model. The time step is bounded by `maxStableDt`, and tests assert that the carved landscape forms a channel network without a grid-aligned bias. Open boundaries and layered rock are out of scope.
