# Determinism contract and invariant tests

Status: accepted

## Context

The brief requires the same landscape from the same seed and settings, bit for bit, plus conservation and no NaN or holes. GPU shaders cannot promise bit equality across devices. See [determinism-and-invariants](../research/determinism-and-invariants.md).

## Decision

The CPU path is the bit-exact reference: float32 state, only `+ - * / sqrt`, snapshot-based updates, integer-only generator. A hashed fixed run is pinned in a test. Invariants asserted on small grids with closed boundaries: water balance, bed plus sediment constant, finite, non-negative. The GPU path is held to a stated tolerance against the reference and to repeatability on one device. The timeline is replayed from seed and settings with checkpoints.

## Consequences

Exports are produced from the reference, so saved images are reproducible. Changing the maths means updating the pinned hash on purpose. Open boundaries would need the outflow in the water balance. Scrubbing backward costs a replay from the nearest checkpoint.
