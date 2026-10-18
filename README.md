# Forgeout

A compiler/optimizer/equivalence-checker for [TapeOut](https://tapeout.net) circuits on X Layer.
Built for the X Layer TapeOut Accelerate hackathon (Oct 16 - Dec 7 2026).

## What it does

Given a boolean spec, an existing TapeOut netlist, or a FabX task reference, Forge returns the
cheapest or shallowest provably-equivalent NAND/LATCH circuit, with an independently-verified
equivalence proof, and can register the result on-chain (ForgeRegistry) or build a (dry-run)
tape-out submission. It is infrastructure for other TapeOut builders, not a consumer app.

## Users, and how to reach them

Circuit builders and FabX Proof-of-Design miners on X Layer (reached via the FabX/TapeOut
Discord and the task-bank community, where "my circuit beats the reference" is a concrete,
checkable claim this tool produces); contracts that depend on a circuit and want a checkable
equivalence proof before trusting it with funds; processor creators as ecosystem partners (a
shared registry of best-known circuits is more tape-out volume for them). **Why they'd pay and
keep using it**: verification and headroom are the product, not raw gas savings (X Layer gas is
cheap) - a wrong "my circuit is equivalent" claim costs real money once funds depend on it, and
FabX's winner-take-the-bonus scoring means a beaten incumbent has to find out fast, not guess.

## Status (honest, as of Phase 3 - see BUILD.md for the full history)

- **Core engine** (packages/core): netlist parse/serialize, exhaustive + SAT equivalence
  checking, exact synthesis (proven minimal, nIn<=3), ABC-assisted optimization, cost/FabX C+q
  reporting. 50 tests passing, including a fuzz suite that has caught 2 real bugs.
- **Real FabX replay** (docs/FABX-REPLAY.md): across the 46/100 FabX tasks that have a complete,
  verifiable spec (the other 54 are sampled-only - fitting them would be overfitting, so they
  are excluded, not guessed at): **beat 22, tie 11, lose 13**. Every beat independently
  re-verified by a second, from-scratch, fully offline tool with zero shared code and zero
  network calls - run it yourself:
  ```
  python3 packages/core/scripts/verify_independent.py
  ```
  reads only the committed snapshot at `packages/core/scripts/tasks.json` (real vectors + our
  already-built netlist hex, captured once from api.fabx.tech - see that file's own header).
  Prints one line per task and exits non-zero on any mismatch. Last run: 22/22 tasks,
  25,856 output-bit comparisons, **0 mismatches**.
- **LATCH semantics: RESOLVED, not a gap anymore.** Forward feedback (a gate reading a later
  latch) is real and allowed, confirmed three ways: Nandout's vendored `NetlistVM.sol` source,
  the real deployed contract's selectors/bytecode (`step(uint256,bytes,bytes)`), and a live
  on-chain test against circuit id=49 over 3 ticks. `netlist.ts`/`simulate.ts` updated
  accordingly (docs/NEW.md).
- **ForgeRegistry** (contracts/): an ownerless on-chain registry, ABI-verified against the real
  deployed processor on a fork, with real measured gas for n=3..6 (docs/GAS-VERIFY.md).
- **Tape-out dry run** (docs/TAPEOUT-DRYRUN.md): real calldata + real fees for all 22 real beats.
  The apparent mint-gating restriction found during the dry run turned out NOT to be a real
  barrier: it was an artifact of the specific test address's own on-chain code (an EIP-7702
  delegation designator failing an ERC1155 receiver check), not a Genesis-NFT/allowlist gate -
  4/4 plain-EOA addresses tested mint successfully (docs/NEW.md).
- **Known gaps, still genuinely open**: no proven-exact synthesis above 3 inputs (13/46 real
  tasks still lose outright); FabX's hidden reward variables (F, K_task, n, m) remain publicly
  undefined, so no real $FAB payout can be predicted - this tool only ever reports C and q.

## Revenue (UNVALIDATED - see BUILD.md section 5)

No pricing or paying users yet. Because FabX's vectors and circuits are public and only the
single lowest-cost design wins (winner-take-the-bonus, not proportional), a one-off optimization
has little standalone pricing power. Candidate value: batch coverage/speed across all tasks,
monitoring for new tasks or beaten incumbents, registry listings, a paid API/CI tier for large
circuits, and a watchtower/challenge service if FabX's challenge mechanism turns out to be
rewarded (currently unknown). Needs at least one real builder conversation before the demo.

## Try it

**Web app** (apps/web): a static site, the whole TS engine running in your browser - nothing is
sent anywhere. Paste a truth table, boolean expression, or netlist hex and get the optimized
circuit, cost report, and a downloadable netlist hex; browse the 22 real verified-beat circuits
with their real netlist hex and ready-to-copy tape-out calldata; check the registry (shows "not
deployed" honestly - ForgeRegistry is verified on a fork, not deployed to the real chain yet).
Build it yourself: `pnpm --filter @tapeout-forge/web build` (output in `apps/web/dist`). **The
browser build does not include ABC** (`yosys-abc` is a native binary; it can't run in a
browser) - `optimize()` falls back to its own Shannon-decomposition/exact-synthesis path there,
exactly as it does anywhere ABC happens to be missing from `PATH`. The CLI is the only place ABC
actually runs.

**CLI** (packages/cli, `forge`):
```
forge optimize <file> --format hex|csv|expr|netlist [--nin N] [--nout N] --objective area|depth|balanced [--cref N] [--count-buffers] [--out path]
forge verify-onchain --processor <addr> --id <n> --inputs <hex> [--netlist-hex <file> --nin N --nout N]
forge replay
forge calldata <file-or-hex> --nin N --nout M      (dry-run only - never sends a transaction)
```
Examples:
```
forge optimize circuit.expr --format expr --objective area --cref 1728
forge verify-onchain --processor 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 --id 65 --inputs 0x07
forge replay
forge calldata netlist.hex --nin 4 --nout 1
```
Exit codes: 0 on success; 1 on any error or a verification/equivalence failure.
`verify-onchain` and `calldata` are both read-only/dry-run - nothing here ever sends a real
transaction (BUILD.md section 0, rule 4).

## DeWEB (optional - not required for this hackathon)

Researched, not deployed (docs/DEWEB-RESEARCH.md): TapeKit/`tape://` really does cover X Layer
(chainId 196, real contract addresses verified), and apps/web's static build already satisfies
its relative-path/MIME/NFC constraints so it's publishable later without changes. Not actually
published here - that requires owning a circuit NFT, opening its container, and a signed
transaction, which Phase 3's rules forbid ("never spend"). Per BUILD.md section 2, DeWEB
integration is explicitly optional for the hackathon submission. See docs/USER-STEPS.md for the
checklist to actually do it with your own key.

## Silicon export (stretch goal, not part of Phases 0-2)

A feasibility spike (github.com/davieslennox0/maj3-silicon-spike) confirmed a TapeOut NAND/LATCH
netlist can be mechanically mapped to a real, DRC-clean Sky130 GDS via TinyTapeout's own CI.
**Tapeout-ready export. We have not ordered fabrication. Ordering is a separate paid step that
the circuit owner completes on Tiny Tapeout. We do not claim a physical chip exists.** See
docs/LIMITS.md.

## Docs

BUILD.md (single source of truth, full phase history) - docs/FABX-REPLAY.md - docs/BEAT-ANALYSIS.md
- docs/BEAT-VERIFY.md - docs/CONVENTION-CHECK.md - docs/GAS-VERIFY.md - docs/TAPEOUT-DRYRUN.md
- docs/BENCH.md - docs/VECTOR-SPEC-CHECK.md - docs/DEWEB-RESEARCH.md - docs/SUBMISSION.md -
docs/DEMO.md - docs/USER-STEPS.md - docs/NEW.md - docs/REUSED.md - docs/LIMITS.md
