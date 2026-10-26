# CLAIMS.md: every public claim mapped to evidence

Written 2026-10-26 (release prep). Scope: README.md, the web app (apps/web/index.html and src/main.ts), docs/SUBMISSION.md and docs/DEMO.md.

- **SUPPORTED** = backed by the evidence in the third column (a file, a transaction, a test or a command).
- **UNSUPPORTED** = not backed, or contradicted, when checked. Each one was removed or softened; the row says how.
- "Re-run 2026-10-26" means the command or read was repeated during this release prep. Anything else rests on committed evidence that was not repeated.

## Provenance (post-2026-10-16 work)

Only work done after the event start on 2026-10-16 counts. The first commit in this repository is `891b4eb` (2026-10-18), the repository was created 2026-10-18, and the last commit before this release prep is dated 2026-10-20; the release-prep and Phase 11 commits are dated 2026-10-26. Concepts carried over from the author's earlier project Nandout (github.com/davieslennox0/nandout, created 2026-10-11) are listed, with how each was re-implemented, in [docs/REUSED.md](REUSED.md). Nandout is also used as test input only in [docs/NANDOUT-CASE-STUDY.md](NANDOUT-CASE-STUDY.md); nothing of Nandout's is claimed as work done for this event.

## Claims that were UNSUPPORTED and were fixed

| # | Where | Claim as found | Problem | Fix |
|---|---|---|---|---|
| U1 | README, docs/DEMO.md | `forge verify-onchain --processor 0x57F3…a355 --id 65` | Circuit 65 is not on OrderGuard (`circuitInfo` reverts "no circuit"). It is on FAB_TST `0x87BF…f9a6` (3 inputs, 1 output, 6 gates). | Processor corrected in README, DEMO and SUBMISSION. |
| U2 | CLI | The same command "works" | With `--inputs 0x07` the CLI produced 8 bits and failed with "expected 3 input bits, got 8". | Fixed in `packages/chain/src/index.ts`; two regression tests added; command re-run: `match: true`. |
| U3 | docs/DEMO.md | `forge replay` "replays our optimizer" | The command only prints the committed table from docs/FABX-REPLAY.md; it does not re-run the optimizer. | Reworded; README now says so; the live re-run script is named. |
| U4 | Web page | "Latches only with a documented reset convention" (silicon export) | docs/SILICON.md says LATCH export is refused. | Web text now says circuits with latches are refused. |
| U5 | Web page | "ABC and rewriting for larger functions" in a browser tool | ABC does not run in the browser build. | Text now says ABC runs in the CLI only. |
| U6 | README | "50 tests passing, including a fuzz suite that has caught 2 real bugs" | Stale count; only one fuzz-caught bug is documented (docs/NEW.md 2026-10-18). | Now "62 vitest + 8 Foundry tests"; one bug stated. |
| U7 | README, web, SUBMISSION, DEMO | Registry "not deployed", tape-outs "not yet done" | Stale: the registry is live; five showcase circuits (ids 6 to 10) and four additional test registrations (ids 11 to 14) are on-chain. | Updated to the facts in section 1 below. |
| U8 | docs/DEMO.md | "it's not done yet" (tape-out) | Stale, same reason. | Reworded. |
| U9 | README, SUBMISSION | Users "reached via" Discord; "Why they'd pay" stated as fact | No outreach or paying users exist; these are plans and hypotheses. | Now "to be reached… no outreach is claimed yet" and "hypothesis, UNVALIDATED". |
| U10 | docs/DEMO.md | Repo link presented as available | The repo is currently private. | Note added. |
| U11 | Web page, README, DEMO | Silicon CI run `maj3-silicon-spike/actions/runs/39150702389` offered as checkable evidence | That repo is private, so outside reviewers cannot open the run. The run itself checks out for the owner (below). | Left as is and flagged here; the owner decides whether to make it public. |
| U12 | docs/SUBMISSION.md, docs/GO-LIVE.md, BUILD.md, docs/USER-STEPS.md | GC-039 listed among the final circuits | GC-039 was not tapped out. | Corrected (release prep step 2). |

## 1. Registry and tape-outs

| Claim | Where | Status | Evidence |
|---|---|---|---|
| ForgeRegistry is deployed on X Layer at `0xAFDd108b0efCC1FF4d1e1d32579F80501774912d` | README, web, SUBMISSION, DEMO | SUPPORTED | Deploy tx `0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66` (status 1, docs/TAPEOUTS.md header). Re-run 2026-10-26: `scripts/verify-live.sh` read the registry entry for each circuit. |
| Five showcase circuits are tapped out and registered: GC-012, GC-037, GC-050, GC-014, GC-046 (circuit ids 6 to 10); four additional test registrations (ids 11 to 14, GC-007, GC-016, GC-013, GC-022) exist from a separate wallet, nine registry entries in total | README, web, SUBMISSION, DEMO | SUPPORTED | docs/TAPEOUTS.md (tape-out and register tx hashes). Re-run 2026-10-26: `verify-live.sh` on all five, receipts status 1 on the OrderGuard processor, `SUMMARY: PASS` each. |
| The five showcase registry entries have submitter `0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5` | SUBMISSION | SUPPORTED | Same `verify-live.sh` output (registry entry field). |
| GC-012, GC-037, GC-050, GC-014 are "verified on-chain via processor.eval" | README, web, SUBMISSION, DEMO | SUPPORTED | Registry entries show `verified = true`; on-chain netlist bytes equal our stored hex; all 16 input rows evaluated on-chain with no reverts (`verify-live.sh`). |
| GC-046 is "attestation-only (8 inputs), not verified on-chain via processor.eval" | same | SUPPORTED | Registry entry shows `verified = false` (empty expected outputs by design, contracts/src/ForgeRegistry.sol). |
| GC-039 was not tapped out | README, SUBMISSION, docs | SUPPORTED | Not in docs/TAPEOUTS.md. |
| No FabX PoD or reward claim for these circuits | README, SUBMISSION | SUPPORTED | They are on OrderGuard (`0x57F3…a355`), not a FabX PoD processor (BUILD.md section 7). No reward amount appears anywhere. |
| The other 13 gallery circuits are not tapped out | SUBMISSION, DEMO | SUPPORTED | docs/TAPEOUTS.md lists nine (five showcase plus four test) of the 22. |
| Additional test registrations 11 to 14: submitter `0x155d…b171`, all mint, tape-out and register tx hashes | SUBMISSION, DEMO, README | SUPPORTED | docs/TAPEOUTS.md (separate section), docs/ONCHAIN-TESTS.md; each checked with `verify-live.sh` (`SUMMARY: PASS`) on 2026-10-26. |
| Six registry entries (ids 6 to 11) have `depth = 0`, are immutable, and misprice the registry's best comparison | SUBMISSION, web | SUPPORTED | `best(bytes32)` reads on 2026-10-26: depth 0 for GC-012, 037, 050, 014, 046, 007; `contracts/src/ForgeRegistry.sol` `cost()` prices depth 0 as 1. |
| "Verified on-chain via processor.eval" = the registry compared caller-supplied outputs with the processor's eval of the same circuit (up to 6 inputs); it does not compare against the task spec | SUBMISSION, web | SUPPORTED | `ForgeRegistry.submit()` source; `register.sh` fetches the expected outputs from the same circuit's `eval()`; the spec comparison is `verify-live.sh` and `verify_independent.py`. |
| ForgeRegistry is ownerless | README, web | SUPPORTED | contracts/src/ForgeRegistry.sol header (no admin, no pause); 8 Foundry tests pass on a fork, re-run 2026-10-26. |
| Registry gas measured for n = 3 to 6; block gas limit 210,000,000 | README, web | SUPPORTED | `forge test --fork-url https://rpc.xlayer.tech`: `test_GasMeasurement_n3` to `n6` pass (docs/GAS-VERIFY.md). `cast block latest` gasLimit = 210000000, re-run 2026-10-26. |

## 2. Replay and verification

| Claim | Where | Status | Evidence |
|---|---|---|---|
| 46 of 100 FabX tasks have a complete, checkable spec; beat 22, tie 11, lose 13 | README, web, SUBMISSION, DEMO | SUPPORTED | `forge replay` output, re-run 2026-10-26: "Counts: beat 22 / tie 11 / lose 13 / skip 0 (of 46 attempted)". It prints the committed docs/FABX-REPLAY.md table (see U3). |
| The other 54 tasks are sampled-only and excluded to avoid overfitting | README, web, DEMO | SUPPORTED | docs/VECTOR-SPEC-CHECK.md; docs/FABX-REPLAY.md scope line. |
| 22/22 beats re-checked by an independent offline tool: 25,856 output-bit comparisons, 0 mismatches | README, web, DEMO | SUPPORTED | `python3 -I packages/core/scripts/verify_independent.py`, re-run 2026-10-26: "22 tasks, 25856 output-bit comparisons, 0 mismatches". |
| "0 mismatches across two independent verifiers" | web | SUPPORTED, partly re-run | The second tool `verify_beats.py` is documented in docs/BEAT-VERIFY.md; it needs network and was not re-run today. |
| "Almost 26,000 comparisons" | DEMO | SUPPORTED | 25,856 (above). |
| Exact synthesis is proven minimal only up to 3 inputs; 13 of 46 tasks still lose | README, web, DEMO | SUPPORTED | `packages/core/src/exact.ts` (`EXACT_SYNTHESIS_MAX_INPUTS = 3`); replay counts. |
| Equivalence is checked exhaustively up to 20 inputs and by SAT beyond | web | SUPPORTED | `packages/core/src/equivalence.ts` (`EXHAUSTIVE_MAX_INPUTS = 20`, built-in `sat-dpll` method; an external solver is only detected, not used). |
| `q = Cref / C` capped at 4; `C = area × depth³` with two output buffers per output | web | SUPPORTED | `packages/core/src/cost.ts`; docs/CONVENTION-CHECK.md. Cross-check against the live task bank: docs/FABX-REPLAY.md. |
| Costs are never converted into reward amounts; F and K_task are undefined publicly | README, web, DEMO | SUPPORTED | fabx.tech formula page, expanded panels (research notes RESULTS2.md, Step 4, kept outside this repo); no payout figure appears in the repo. |
| LATCH semantics resolved (forward feedback allowed, `step(uint256,bytes,bytes)`), confirmed against the vendored NetlistVM, the deployed selectors and a live 3-tick test on FAB_TST id=49 | README | SUPPORTED | docs/NEW.md (latch-reconcile entry); `packages/core` regression test reproducing the live sequence. The `step()` ABI for full sequential evaluation and latch power-up on silicon remain unverified (listed under Limits). |
| 62 vitest + 8 Foundry tests pass | README | SUPPORTED | `pnpm test`, 2026-10-26: core 43, chain 8, silicon 8, cli 3. Foundry 8/8 on a fork. Orchestrator suite `scripts/test-go-live.sh`: 16/16 on a local fork. |
| Verify-onchain reads a real circuit and matches local simulation | README, DEMO | SUPPORTED | `forge verify-onchain --processor 0x87BF…f9a6 --id 65 --inputs 0x07` re-run 2026-10-26: `match: true`. |
| Dry-run calldata and fees for all 22 beats; mint "gating" was an EIP-7702 artifact, 4/4 plain EOAs mint | README, web | SUPPORTED | docs/TAPEOUT-DRYRUN.md; docs/NEW.md (mint-diagnosis entry); `apps/web/src/data/gallery.full.json` calldata. Not repeated today. |

## 3. Silicon export

| Claim | Where | Status | Evidence |
|---|---|---|---|
| Task 12 (GC-012) was run through Tiny Tapeout's CI: GDS and precheck succeeded | README, web, SUBMISSION, DEMO | SUPPORTED | Run 39150702389 on `maj3-silicon-spike`, re-read 2026-10-26: `gds: success`, `precheck: success`. See U11: the repo is private. |
| The workflow's overall status is a failure because two unrelated jobs fail (`viewer`, `gl_test`) | web, docs/SILICON.md, SUBMISSION | SUPPORTED | Same run, re-read 2026-10-26: conclusion `failure`, `viewer: failure`, `gl_test: failure`. |
| 34 cells, 173.9168 µm², 15/15 precheck checks, GDS sha256 `1857e6b1…adf256` | README, web, SUBMISSION, DEMO | SUPPORTED, not repeated | docs/SILICON.md and the committed run notes; the artifact was not re-downloaded today. |
| Layout generated and not ordered; "We do not claim a physical chip exists" | README, web, SUBMISSION, DEMO | SUPPORTED | Required wording is used verbatim (docs/SILICON.md line 3). No order is claimed, and this project's tooling never pushes, pays or submits (docs/SILICON.md). |
| Silicon export supports combinational circuits only; latches refused | web (after fix), README | SUPPORTED | docs/SILICON.md "LATCH is refused"; `packages/silicon/test/verilog.test.ts`. |

## 4. Web and access

| Claim | Where | Status | Evidence |
|---|---|---|---|
| The page runs in the browser; nothing is uploaded | web | SUPPORTED | `apps/web` is a static Vite build with no backend; `pnpm --filter @forgeout/web build` succeeds (2026-10-26). |
| "Browse 22 verified circuits" | web | SUPPORTED | `gallery.json` has 22 rows. |
| The gallery and registry panel show tape-out status for the five showcase circuits and describe the four test registrations | web | SUPPORTED | `gallery.json` carries `tapeout` for ids 12, 14, 37, 46, 50; built and checked 2026-10-26. The deployed copy at forge.fanside.xyz does not have this update yet (owner step). |
| https://forge.fanside.xyz is reachable | SUBMISSION | SUPPORTED | HTTP 200 observed 2026-10-23; not re-checked 2026-10-26. |
| DeWEB was researched and not deployed | README, SUBMISSION | SUPPORTED | docs/DEWEB-RESEARCH.md; no publish transaction. |

## 5. Business claims

| Claim | Where | Status | Evidence |
|---|---|---|---|
| Revenue model is UNVALIDATED; no pricing or paying users | README, SUBMISSION | SUPPORTED | Stated as such; no customer evidence exists. |
| Users "might pay" because verification matters (not gas savings) | README, SUBMISSION | SUPPORTED as a hypothesis only | Labelled "hypothesis, UNVALIDATED" after the fix (U9). |
| "Winner-take-the-bonus" scoring makes one-off optimization weak to sell | README, SUBMISSION | SUPPORTED | fabx.tech "best original design" rule (RESULTS2.md Step 4). |

## 6. Limits that apply to all of the above

F and K_task are undefined and no reward amount is reported. The LATCH `step()` ABI and latch power-up state on silicon are unverified. No proven-exact synthesis above 3 inputs (13 of 46 complete-spec tasks lose). 54 sampled-only tasks are excluded. The silicon export is generated layout, not ordered. The generated Tiny Tapeout project still fails two CI jobs. Nandout results are analysis only (0 gates saved on 10 analysed circuits; one latch circuit not analysed).
