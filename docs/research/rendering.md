# Rendering

## Question

How is the result shown: a surface you can orbit, a map with contours, water, and believable colour?

## Options and what each costs

- **Lit 3D surface (WebGL2).** A grid mesh displaced by a height texture sampled in the vertex shader, normals from central differences in the fragment shader, a directional light plus ambient, and fog for depth. One draw call; the height texture can be the simulation's own on the GPU path, so no readback. Orbit by rotating a camera matrix.
- **Shaded relief with contours (Canvas 2D or a fragment shader).** Hillshade is the dot product of the surface normal and a light direction (low sun at the north-west reads best). Contours are isolines every fixed height step, drawn by testing where a cell's height crosses a multiple of the interval. Pure functions of the height array, so they can be tested on tiny grids and shared by the CPU and GPU views.
- **Water.** Draw where depth exceeds a threshold, tinted by depth, with the water surface at bed plus depth so lakes are flat. Rivers are the connected thin high-flow cells; drawing flow speed or accumulated flow as brightness gives the satellite-photo network without extra geometry.
- **Colour.** A function of height, slope and wetness: sand low and dry, grass at moderate height and slope, rock where slope is steep, snow high and not too steep, darker and bluer with wetness. Written as a pure function from those three inputs to colour so presets can tune it and tests can pin it.

## Recommendation

One colour function and one hillshade function in `core`, used by both views. The 2D relief is the first thing built, since it needs no GPU and gives a screenshot immediately; the 3D surface follows. Water and wetness are overlays driven by simulation output. Light and dark page chrome around the view use the existing design tokens.

## Sources

- Horn, "Hill Shading and the Reflectance Map", Proceedings of the IEEE 1981 (the standard slope/aspect hillshade formulation; cited, not read for this note).
- Jako, Toth, CESCG 2011, section on visualisation of the simulated fields: <https://www.old.cescg.org/CESCG-2011/papers/TUBudapest-Jako-Balazs.pdf>
- WebGL 2.0 specification, texture sampling in the vertex shader: <https://registry.khronos.org/webgl/specs/latest/2.0/>
