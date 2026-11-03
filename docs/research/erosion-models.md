# Erosion models

## Question

Which erosion model gives river networks, sediment fans and slumped slopes, runs interactively in a browser, and can be tested for conservation and repeatability?

## Options

### Particle (droplet) erosion

Drops are released one at a time, roll downhill, pick up and deposit sediment, and die. Cheap per drop and easy to write, and it carves convincing gullies. The cost is order: drops read and write the same cells, so a parallel version races, and a serial one is the only repeatable one. It has no water field, so lakes, rivers and wetness have to be inferred afterwards. Poor fit for a GPU and for a replayable timeline.

### Grid shallow water with virtual pipes

Each cell holds bed height, water depth and suspended sediment, and exchanges water with its four neighbours through virtual pipes driven by the difference in water-surface height. Velocity comes from the fluxes, erosion and deposition from a capacity `C = Kc * sin(alpha) * |v|` (scaled down in deep water), and sediment travels with the water. The model is Mei, Decaudin and Hu (2007); Jako and Toth restate and refine it, and that restatement is the text read for this note. Every step is a local stencil over a grid, with no cell reading what another cell writes in the same pass, so it is deterministic and maps one-to-one onto fragment shaders or compute shaders. Cost is a few passes over the grid per step. Parameters: time step, gravity, pipe area and length, rain, evaporation, `Kc`, `Ks`, `Kd`, a maximum erosion depth, and for thermal weathering a talus angle and rate. Gives water depth directly, so rivers, lakes and wetness fall out. Weakness: channels form slowly at low resolution, and the semi-Lagrangian sediment advection in the papers does not conserve sediment exactly.

### Thermal weathering

A pass that moves material from a cell to lower neighbours where the slope exceeds the talus angle. Local, conservative, and cheap. Alone it only smooths; paired with a hydraulic model it keeps valley walls at believable angles. Stava, Benes, Brisbin and Krivanek (2008) combine shallow-water, thermal and layered material on the GPU.

### Stream power

`dh/dt = u - k * A^m * S^n` (uplift minus erosion by drainage area `A` and slope `S`), as used by Cordonnier et al. (2016) with `n = 1`, `m = 0.5`. Drainage area needs a flow-routing pass over the whole graph, which is global and serial (linear time with a stream tree) rather than a local stencil. It produces the most realistic large dendritic networks and ridge lines from an uplift map, and it is the right tool for building a mountain from nothing over geological time. It has no water body, no sediment, no lakes at rendering time, so it cannot animate rain falling.

## Recommendation

Use the virtual-pipe model plus thermal weathering as the live simulation, with two changes from the papers: sediment moves by donor-cell transfer on the water fluxes (exactly conservative) and the closed boundary keeps all mass in the domain. Keep stream power in reserve as an optional pre-pass for the starting terrain, not part of the first build. Reject droplets as the primary model.

## Check

`src/core/erosion/` implements the recommended model on a small grid. Its tests pin the behaviour: the same seed and settings give the same state bit for bit (also identical between Bun's JavaScriptCore and Node's V8), water balances against rain minus evaporation, bed plus suspended sediment is constant, and nothing goes NaN or negative. See [determinism-and-invariants.md](determinism-and-invariants.md) for the tolerances.

## Sources

- Mei, Decaudin, Hu, "Fast Hydraulic Erosion Simulation and Visualization on GPU", Pacific Graphics 2007. The PDF was not reachable from this environment; the equations were taken from the restatement below. <https://hgpu.org/?p=2256>
- Jako, Toth, "Fast Hydraulic and Thermal Erosion on the GPU", CESCG 2011 (read in full): <https://www.old.cescg.org/CESCG-2011/papers/TUBudapest-Jako-Balazs.pdf>
- Stava, Benes, Brisbin, Krivanek, "Interactive Terrain Modeling Using Hydraulic Erosion", SCA 2008 (related-work and method sections read): <https://www.cs.purdue.edu/cgvlab/www/resources/papers/Stava-2008-Interactive_Terrain_Modeling_Using_Hydraulic_Erosion.pdf>
- Cordonnier, Braun, Cani, Benes, Galin, Peytavie, Guerin, "Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion", Computer Graphics Forum 2016 (stream power equation and algorithm overview read): <https://www.cs.purdue.edu/homes/bbenes/papers/Cordonier16CGF.pdf>
- Musgrave, Kolb, Mace, "The Synthesis and Rendering of Eroded Fractal Terrains", SIGGRAPH 1989, the origin of grid hydraulic and thermal erosion. Cited by the papers above; not read for this note.
