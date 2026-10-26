# Forgeout

A compiler/optimizer/equivalence-checker for [TapeOut](https://tapeout.net) circuits on X Layer.
Built for the X Layer TapeOut Accelerate hackathon (Oct 16 - Dec 7 2026).

## What it does

Given a boolean spec, an existing TapeOut netlist, or a FabX task reference, Forge returns the
a smaller or shallower NAND/LATCH circuit that is checked equivalent to the input (exhaustively up to 20 inputs; the
result is provably minimal only up to 3 inputs and heuristic above that), with an independently re-checked
equivalence result, and can register the result on-chain (ForgeRegistry) or build a (dry-run)
tape-out submission. It is infrastructure for other TapeOut builders, not a consumer app.

Terminology: in this repository "tape-out" means creating a circuit on the TapeOut protocol on X Layer (an on-chain
NFT), not silicon. Silicon is mentioned only in the Silicon export section, with its required wording.

## Quick start

Prerequisites: Node 22, pnpm 9, `iverilog` (the silicon package's tests need it), Python 3, and
[Foundry](https://getfoundry.sh) for the contract tests and the scripts. Optional: `yosys-abc` (the CLI uses it when present).

```
pnpm install
pnpm test                                   # vitest across packages (about 62 tests; some read X Layer, read-only)
cd contracts && forge install foundry-rs/forge-std --no-commit && forge test --fork-url https://rpc.xlayer.tech   # read-only fork, no key
# run the CLI from the repo root (the package's bin is a TypeScript file, so use tsx):
printf '(a&b)|(a&c)|(b&c)\n' > maj.expr
pnpm exec tsx packages/cli/src/index.ts optimize maj.expr --format expr --objective area
pnpm exec tsx packages/cli/src/index.ts replay           # prints the committed FabX replay table
python3 packages/core/scripts/verify_independent.py      # offline independent re-check of the 22 results
pnpm --filter @forgeout/web build                        # static web app in apps/web/dist
```

The CLI is named `forge` in the usage text; it is unrelated to Foundry's `forge` binary.

## Scripts that spend real funds

`scripts/tapeout.sh`, `register.sh`, `deploy-registry.sh` and `go-live.sh` can broadcast real transactions on X Layer (chain 196)
with real OKB. They are **dry-run by default**, sign only through a Foundry keystore account (`KEYSTORE_ACCOUNT` or `KEY_FILE`; a raw
`--private-key` is never accepted) and need `--broadcast` plus a typed confirmation. Know the limits before using them:

- `AUTO_CONFIRM=1` in the environment replaces the typed confirmations (go-live's `--unattended` sets it). Do not export it in a shell you use for other things.
- go-live's spend cap is checked per step, after the step has been sent, and it does not count deploy or register gas. Fund the wallet with only what you are willing to spend; the wallet balance is the real cap.
- `scripts/deploy-web.sh` and `scripts/finalize-release.sh` are operator-only: they edit the Caddy config of the host they run on and wipe a web root. Do not run them on a machine you do not operate.
- `scripts/test-go-live.sh` broadcasts to a local Anvil fork only and refuses to run against anything else.
- The runbooks in `docs/GO-LIVE.md` and `docs/USER-STEPS.md` were written for the project owner's own wallet; substitute your own keystore account name.

## Users, and how to reach them

Circuit builders and FabX Proof-of-Design miners on X Layer (to be reached via the FabX/TapeOut
Discord and the task-bank community; no outreach is claimed yet, where "my circuit beats the reference" is a concrete,
checkable claim this tool produces); contracts that depend on a circuit and want a checkable
equivalence proof before trusting it with funds; processor creators as ecosystem partners (a
shared registry of best-known circuits is more tape-out volume for them). **Why they might pay and
keep using it (hypothesis, UNVALIDATED)**: verification and headroom are the product, not raw gas savings (X Layer gas is
cheap) - a wrong "my circuit is equivalent" claim costs real money once funds depend on it, and
FabX's winner-take-the-bonus scoring means a beaten incumbent has to find out fast, not guess.

## Status (honest, as of 2026-10-26 - see BUILD.md for the full history)

- **Core engine** (packages/core): netlist parse/serialize, exhaustive + SAT equivalence
  checking, exact synthesis (proven minimal, nIn<=3), ABC-assisted optimization, cost/FabX C+q
  reporting. 62 vitest tests (core 43, chain 8, silicon 8, cli 3) and 8 Foundry tests (run against an X Layer fork) pass as of 2026-10-26; a fuzz test caught a real `optimize()` bug on 2026-10-18 (docs/NEW.md).
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
- **Real on-chain tape-outs (2026-10-26):** the canonical ForgeRegistry (v2) is on X Layer at
  `0xD304F09ba30c41196a6a3C66EBb117184306A06F`. Five showcase circuits (ids 6 to 10) are tapped out on the OrderGuard
  processor and registered there with real depths (an earlier registry, v1 `0xAFDd108b0efCC1FF4d1e1d32579F80501774912d`, is superseded: its entries were registered at depth 0): GC-012, GC-037, GC-050, GC-014, GC-046 (docs/TAPEOUTS.md). Four additional test
  registrations (ids 11 to 14: GC-007, GC-016, GC-013, GC-022, from a separate test wallet) exist in v1 only. Four are
  verified on-chain via processor.eval; GC-046 (8 inputs) is attestation-only, not verified on-chain
  via processor.eval. GC-039 was priced and fork-tested but not tapped out. These circuits are on
  OrderGuard, not a FabX PoD processor: no PoD or reward claim is made.
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
with their real netlist hex and ready-to-copy tape-out calldata; check the registry (ForgeRegistry is live on X Layer at
`0xD304F09ba30c41196a6a3C66EBb117184306A06F` (v2, canonical); the five showcase circuits are registered there: GC-012, GC-037, GC-050, GC-014, GC-046; v1 is superseded, see docs/TAPEOUTS.md).
Build it yourself: `pnpm --filter @forgeout/web build` (output in `apps/web/dist`). **The
browser build does not include ABC** (`yosys-abc` is a native binary; it can't run in a
browser) - `optimize()` falls back to its own Shannon-decomposition/exact-synthesis path there,
exactly as it does anywhere ABC happens to be missing from `PATH`. The CLI is the only place ABC
actually runs.

**CLI** (packages/cli, `forge`):
```
forge optimize <file> --format hex|csv|expr|netlist [--nin N] [--nout N] --objective area|depth|balanced [--cref N] [--count-buffers] [--out path]
forge verify-onchain --processor <addr> --id <n> --inputs <hex> [--netlist-hex <file> --nin N --nout N]
forge replay                                     (prints the committed table from docs/FABX-REPLAY.md; it does not re-run the optimizer)
forge calldata <file-or-hex> --nin N --nout M      (dry-run only - never sends a transaction)
```
Examples:
```
forge optimize circuit.expr --format expr --objective area --cref 1728
forge verify-onchain --processor 0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6 --id 65 --inputs 0x07
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

## Silicon export (BUILD.md Phase 4, stretch)

`forge export-silicon <task|netlist-hex>` turns a flat combinational TAP-02 netlist into real
structural Verilog, wrapped in the Tiny Tapeout `ttsky` top-module shape, written to a local
repo directory. It never pushes, submits, or pays for anything itself - see docs/SILICON.md for
exactly what is and is not claimed (including why LATCH export is refused, a real spec conflict
found while building this, not a missing feature).

One real circuit has been taken all the way through the actual CI pipeline: task 12 (GC-012,
the headline q=4.0 FabX beat), pushed to github.com/davieslennox0/maj3-silicon-spike (a repo
this account owns) and run for real on GitHub Actions - synthesis and DRC both passed (15/15
Tiny Tapeout precheck checks), producing a real 34-cell GDS
(run: https://github.com/davieslennox0/maj3-silicon-spike/actions/runs/40368814040). This is in
addition to the earlier feasibility spike (the 6-NAND MAJ3).

**Tapeout-ready export. We have not ordered fabrication. Ordering is a separate paid step that
the circuit owner completes on Tiny Tapeout. We do not claim a physical chip exists.** See
docs/SILICON.md and docs/LIMITS.md.

## Docs

BUILD.md (single source of truth, full phase history) - docs/FABX-REPLAY.md - docs/BEAT-ANALYSIS.md
- docs/BEAT-VERIFY.md - docs/CONVENTION-CHECK.md - docs/GAS-VERIFY.md - docs/TAPEOUT-DRYRUN.md
- docs/BENCH.md - docs/VECTOR-SPEC-CHECK.md - docs/DEWEB-RESEARCH.md - docs/SUBMISSION.md -
docs/DEMO.md - docs/USER-STEPS.md - docs/NEW.md - docs/REUSED.md - docs/LIMITS.md
