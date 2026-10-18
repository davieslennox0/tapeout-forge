# 2.2: with-buffers vs no-buffers convention check (across all 46 replayable tasks)

## Direct evidence from the task bank's own declared reference fields
For primitive single-gate tasks, the true minimal NAND-only circuit is trivially known by
inspection, so refNand/refDepth can be checked directly against it:

| task | function | true minimal gates/depth | declared refNand/refDepth | matches +2/+2 (buffers)? |
|---|---|---|---|---|
| 1 | single-bit inverter | 1 gate, depth 1 | 3 / 3 | YES: 1+2=3, 1+2=3 |
| 2 | 2-input NAND (the primitive itself) | 1 gate, depth 1 | 3 / 3 | YES: 1+2=3, 1+2=3 |
| 3 | 2-input AND | 2 gates, depth 2 | 4 / 4 | YES: 2+2=4, 2+2=4 |

Every one of the 3 simplest, unambiguous-by-inspection tasks shows refNand = trueGates + 2*nOut
and refDepth = trueDepth + 2 exactly. This independently confirms the with-buffers convention is
baked into FabX's own declared reference values across the task bank, not just an artifact of
Task 8 (which was the only prior evidence, from Phase 1b/1c).

## Flip analysis (recompute all 46 under both conventions, independent script)
With-buffers (current convention): beat 22, tie 11, lose 13 (matches docs/FABX-REPLAY.md).
No-buffers (hypothetical): beat 42, tie 2, lose 2.

**22/46 task verdicts would flip if FabX used no-buffers instead.** Full list in
packages/core/scripts/convention_check.py's output (committed below). Two patterns stand out:
- All 11 with-buffers TIES (simple gates: NOT, NAND, AND, OR, NOR, XOR, 1-bit MUX, 1-bit
  splitter, half-subtractor, full-subtractor, XNOR) flip to "beat" by 5x-100x+ under no-buffers -
  structurally implausible (these are already near-minimal reference circuits; beating a 2-input
  AND gate's own reference by 256x is not a real optimization, it's a convention artifact).
- Tasks 24/25 (pure bit-permutation: fixed shift, bit-reverse) flip from "lose" (clamped at the
  q=1/4 floor) to exact "tie" under no-buffers - these need 0 real gates (bare wire), and
  no-buffers would let that show as parity with the reference instead of a structural loss.

## Conclusion
The with-buffers convention is correct with high confidence (direct task-bank evidence across 3
independent primitive-gate tasks, not just Task 8's single data point). docs/FABX-REPLAY.md's
counts (beat 22/tie 11/lose 13) stand. The one place this matters for interpretation: tasks 24/25
are a convention/representation artifact (our model can't emit a bare-wire output), not a real
optimizer shortfall - already flagged in docs/BEAT-ANALYSIS.md (2.0).
