# TapeOut Forge

A compiler/optimizer/equivalence-checker for [TapeOut](https://tapeout.net) circuits on X Layer.
Built for the X Layer TapeOut Accelerate hackathon (Oct 16 - Dec 7 2026).

## What it does

Given a boolean spec, an existing TapeOut netlist, or a FabX task reference, Forge returns the
cheapest or shallowest provably-equivalent NAND/LATCH circuit, with an independently-verified
equivalence proof, and can register the result on-chain (ForgeRegistry) or build a (dry-run)
tape-out submission. It is infrastructure for other TapeOut builders, not a consumer app.

## Users

Circuit builders and FabX Proof-of-Design miners on X Layer; contracts that depend on a circuit
and want a checkable equivalence proof; processor creators as ecosystem partners.

## Status (honest, as of Phase 2 - see BUILD.md for the full history)

- **Core engine** (packages/core): netlist parse/serialize, exhaustive + SAT equivalence
  checking, exact synthesis (proven minimal, nIn<=3), ABC-assisted optimization, cost/FabX C+q
  reporting. 45+ tests passing, including a fuzz suite that has caught 2 real bugs.
- **Real FabX replay** (docs/FABX-REPLAY.md): across the 46/100 FabX tasks that have a complete,
  verifiable spec (the other 54 are sampled-only - fitting them would be overfitting, so they
  are excluded, not guessed at): **beat 22, tie 11, lose 13**. Every beat independently
  re-verified with a second, from-scratch tool (docs/BEAT-VERIFY.md) - 0 disagreements.
- **ForgeRegistry** (contracts/): an ownerless on-chain registry, ABI-verified against the real
  deployed processor on a fork, with real measured gas for n=3..6 (docs/GAS-VERIFY.md).
- **Tape-out dry run** (docs/TAPEOUT-DRYRUN.md): real calldata + real fees for 8 real circuits.
  Full gas measurement is blocked on a genuine on-chain restriction (minting transistors appears
  gated beyond a funded EOA - likely FAB-Genesis NFT ownership, unconfirmed) - reported honestly
  rather than worked around.
- **Known gaps**: no proven-exact synthesis above 3 inputs (13/46 real tasks still lose); LATCH
  `step()` semantics and FabX's hidden reward variables (F, K_task, n, m) remain genuinely
  UNVERIFIED, not just unattempted.

## Revenue (UNVALIDATED - see BUILD.md section 5)

No pricing or paying users yet. Because FabX's vectors and circuits are public and only the
single lowest-cost design wins (winner-take-the-bonus, not proportional), a one-off optimization
has little standalone pricing power. Candidate value: batch coverage/speed across all tasks,
monitoring for new tasks or beaten incumbents, registry listings, a paid API/CI tier for large
circuits, and a watchtower/challenge service if FabX's challenge mechanism turns out to be
rewarded (currently unknown). Needs at least one real builder conversation before the demo.

## Silicon export (stretch goal, not part of Phases 0-2)

A feasibility spike (github.com/davieslennox0/maj3-silicon-spike) confirmed a TapeOut NAND/LATCH
netlist can be mechanically mapped to a real, DRC-clean Sky130 GDS via TinyTapeout's own CI.
**Tapeout-ready export. We have not ordered fabrication. Ordering is a separate paid step that
the circuit owner completes on Tiny Tapeout. We do not claim a physical chip exists.** See
docs/LIMITS.md.

## Docs

BUILD.md (single source of truth, full phase history) - docs/FABX-REPLAY.md - docs/BEAT-ANALYSIS.md
- docs/BEAT-VERIFY.md - docs/CONVENTION-CHECK.md - docs/GAS-VERIFY.md - docs/TAPEOUT-DRYRUN.md
- docs/BENCH.md - docs/VECTOR-SPEC-CHECK.md - docs/NEW.md - docs/REUSED.md - docs/LIMITS.md
