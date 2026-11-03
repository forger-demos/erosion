# CPU reference with a WebGL2 fast path

Status: accepted

## Context

The brief needs an interactive frame rate, heavy work off the main thread or on the GPU, a fallback, and support in current Chrome, Firefox and Safari. WebGPU is not unflagged in Firefox and is partial in Safari. See [compute](../research/compute.md).

## Decision

Run the simulation behind one interface with two implementations: a CPU version in a Web Worker that defines correct output, and a WebGL2 render-to-texture version used when available. WebGPU is deferred. The GPU path is checked against the CPU path by tolerance on small grids.

## Consequences

Every browser has a working path, and tests run under `bun test` against the CPU code alone. Two implementations of the same maths must be kept in step, which the tolerance test enforces. The CPU worker hot loop needs tuning beyond the spike. Revisit when WebGPU is broadly available.
