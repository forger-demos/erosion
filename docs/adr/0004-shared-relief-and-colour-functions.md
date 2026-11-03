# One hillshade and colour function for both views

Status: accepted

## Context

The brief asks for a lit 3D surface, a shaded-relief map with contours, water, and colour by height, slope and wetness. Two views would otherwise drift apart. See [rendering](../research/rendering.md).

## Decision

Hillshade, contour tests and the height/slope/wetness colour mapping are pure functions in `core`, tested on tiny grids and used by the 2D relief and by the 3D shader code that mirrors them. Water and wetness are overlays driven by simulation output. Build the 2D relief first.

## Consequences

The first visible result needs no GPU, and colour presets are data. The shader copy of the colour function must be kept consistent with the TypeScript one; the plan has a slice that checks it. Rendering code stays in `shell`.
