# Silicon export (BUILD.md Phase 4, stretch)

**Tapeout-ready export. We have not ordered fabrication. Ordering is a separate paid step that
the circuit owner completes on Tiny Tapeout. We do not claim a physical chip exists.**

## What this project claims, and what it does not

This project can turn a flat, combinational TAP-02 NAND netlist into:
1. Plain structural Verilog (`packages/silicon`'s `toStructuralVerilog`).
2. A Tiny Tapeout `ttsky`-shaped top module (`toTtskyWrapper`: 8-bit `ui_in`/`uo_out`, unused
   pins tied low/unused, `info.yaml` matching the real Tiny Tapeout schema).
3. A local, ready-to-push repo directory (`forge export-silicon`) - never pushed anywhere by the
   tool itself.

It does **not** order fabrication, submit to a shuttle, create a third-party account, or pay
anything, anywhere, ever. "Status: exported" is the ceiling - this project cannot and will not
move a circuit past that state on its own.

## What is supported

- Purely combinational circuits (no LATCH, no REF), up to ~500 gates, with 8 or fewer inputs and
  8 or fewer outputs (the ttsky wrapper's pin budget).
- Everything outside that is refused with one of four specific reasons (tested in
  `packages/silicon/test/verilog.test.ts`): unflattenable REF, LATCH without a documented reset
  convention (see "LATCH is refused" below), too large, or too many pins.

## LATCH is refused - a real spec conflict, not a missing feature

BUILD.md 4.2 originally instructed emitting LATCH as `always_latch` (based on an earlier,
pre-semantics-verification feasibility spike). Since then, `docs/NEW.md`'s `latch-reconcile`
work independently VERIFIED the real on-chain LATCH semantics against the vendored
`NetlistVM.sol` source and live `step()` calls: every latch updates unconditionally every tick,
`state[t+1]=f(state[t],inputs)`, with no enable signal in the wire format at all. That is
register/flip-flop timing, not the level-sensitive gated-D-latch `always_latch` models - using
`always_latch` here would reintroduce semantics this project already disproved. Per BUILD.md
section 0 rule 9 ("if this file conflicts with what you observe, stop and report the conflict;
do not guess"), LATCH export stays refused (reason: "latch without a documented reset
convention") until someone explicitly decides the reset/initial-state convention and the
clock-domain mapping (there is a real `clk` pin available on the ttsky wrapper that was never
used for this in the earlier spike).

## Real result: one circuit actually exported and run (BUILD.md 4.5)

Task 12 (GC-012, "4-to-2 one-hot encoder+error detector") - the headline q=4.0 beat from the
FabX replay - was exported via `forge export-silicon 12` and pushed to
github.com/davieslennox0/maj3-silicon-spike (a repo this account owns, cloned from the official
Tiny Tapeout `ttsky` template; same safe pattern as the earlier feasibility spike).

Real GitHub Actions run: https://github.com/davieslennox0/maj3-silicon-spike/actions/runs/40368814040

| | |
|---|---|
| Synthesis (`gds` job) | ✅ passed |
| Tiny Tapeout precheck (`precheck` job) | ✅ passed, 15/15 checks (Magic DRC, KLayout FEOL/BEOL/offgrid/pin-label/zero-area, pin/boundary/power-pin/layer/cell-name/urpm-nwell/analog-pin checks, Verilog syntax) |
| Cell count | 34 cells, 173.9168 &micro;m&sup2; |
| GDS sha256 | `1b499ee47227f969890580ff8f32fd288e2d41c0fe06f5067fe9749f18002e5e` (final `tt_submission` GDS of run 40368814040, 625,450 bytes) |
| Overall workflow status | shows `failure` - but only because two UNRELATED jobs fail: `viewer` (GitHub Pages isn't enabled on that repo - a cosmetic visualization deploy, nothing to do with the design) and `gl_test` (needs a cocotb testbench that was never written for this spike repo). Neither affects the synthesis/DRC result above. |

This is the second circuit independently confirmed through this exact real pipeline (the first,
from the earlier feasibility spike, was the 6-NAND MAJ3). Both real; both still just "exported."

## Open shuttles (checked 2026-10-18, BUILD.md 4.0)

| Run | Closes | Shuttle |
|---|---|---|
| TTGF26d / TTGF26c | 2026-12-07 | w.s Run #3 |
| TTSKY26d | 2026-11-30 | CI-2612 |

These dates will be stale by the time anyone reads this - re-check tinytapeout.com/runs before
relying on them for a real submission.

## How an owner actually orders fabrication (not done by this project)

See docs/USER-STEPS.md. In short: push the exported directory into a real `ttsky`-template
clone, confirm the Actions flow is green, then go to tinytapeout.com yourself, pick an open
shuttle, and pay there. Nothing here automates that step, on purpose.

**Re-run note (2026-10-26).** The spike repository's history was rewritten (author identity and removal of an unrelated file), which changed its commit hashes, so the CI was run again on the new head `1da583a6` (run 40368814040). Same Verilog (byte-identical to the previous head), same results: `gds` and `precheck` succeed (15 of 15 precheck rows), `gl_test` and `viewer` fail as documented, synthesis reports 34 cells and 173.9168 um^2. The GDS file hash differs from the earlier run's (`1857e6b1325f19d65bd4647d9ca18c166d2c0ea3dc88464a21ad59729eadf256`, run 39150702389, which is superseded and no longer matches any commit): the layout was regenerated and its bytes are not identical; the cause (for example embedded timestamps) was not investigated. The magic-streamout GDS is 625,450 bytes (`1b499ee47227f969890580ff8f32fd288e2d41c0fe06f5067fe9749f18002e5e`); the KLayout-streamed copy in the same run is 376,798 bytes (`b0f8617bdb846cb83616b767ab4172341e5f205d79c16027519f8645d7edf7be`).
