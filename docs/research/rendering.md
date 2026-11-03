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

## As built

The 3D view draws a grid mesh with no vertex attributes: positions come from `gl_VertexID` and a single-channel float height texture read with `texelFetch`, so no filtering extension is needed. The fragment shader takes the Horn gradient from the texture, uses the same sun as the 2D hillshade, and adds distance haze. Its colour function is generated from the palette by `core/relief/glsl.ts`, and a test runs that text next to the TypeScript `groundColour` on a grid of inputs. Camera and matrix maths are pure functions in `core/camera/`; the shell only forwards pointer, wheel, pinch and key events to them. When WebGL2 cannot start, the page says so and keeps the 2D relief.

## Sources

- Horn, "Hill Shading and the Reflectance Map", Proceedings of the IEEE 1981 (the standard slope/aspect hillshade formulation; cited, not read for this note).
- Jako, Toth, CESCG 2011, section on visualisation of the simulated fields: <https://www.old.cescg.org/CESCG-2011/papers/TUBudapest-Jako-Balazs.pdf>
- WebGL 2.0 specification, texture sampling in the vertex shader: <https://registry.khronos.org/webgl/specs/latest/2.0/>

## As built

`core/water` turns bed height and water depth into one overlay: lakes are connected groups of still, deep water drawn flat at their mean water level; rivers are cells on the water surface with a large steepest-descent catchment; wetness is the larger of the two plus loose water, spilling onto neighbouring banks. The 2D relief lays the water colour over the ground by the overlay's opacity, and the 3D shader reads the same wetness and opacity from a texture, with lakes already flat in the height texture.
