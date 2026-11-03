# Brief: grow a mountain range

I want to watch a landscape form: raw noise turning into ridges, valleys, rivers and lakes as water and time wear it down.

## What I want to see

- A terrain generated from a seed, shown as a lit 3D surface I can orbit, and as a shaded-relief map with contour lines.
- An erosion simulation I can play, pause and scrub: rain falls, water carves channels, sediment fills valleys, slopes slump. After a minute of running, a river network that looks like one from a satellite photo appears.
- Controls for rain, rock hardness and time, and a few presets (young alpine range, old worn hills, desert canyon).
- Water rendered as rivers and lakes, and colour by height, slope and wetness so snow, rock, grass and sand land in believable places.
- Export the result as a PNG heightmap and a shaded image.

## What makes it right

- Same seed and settings give the same landscape, bit for bit, so results can be tested.
- The simulation conserves what it should (water and sediment do not appear from nowhere) and never produces NaN or holes; tests check these invariants on small grids.
- It is smooth on a laptop: an interactive frame rate at a useful grid size, with the heavy work off the main thread or on the GPU, whichever the research recommends, with a fallback when the fast path is unavailable.

## Constraints

No API keys and no paid services. Works in current Chrome, Firefox and Safari; light and dark page chrome around the view.

## How to start

Research before building: the erosion models in the literature (droplet, grid-based shallow water, stream power), what each looks like and costs, how to render, WebGPU or WebGL2 or CPU workers. Write it down with sources, decide, then plan the build as small slices that each end in something I can see, and start building straight after.
