# CLAIMS.md: every public claim mapped to evidence

Written 2026-10-26 (release prep). Scope: README.md, the web app (apps/web/index.html and src/main.ts), docs/SUBMISSION.md and docs/DEMO.md.

- **SUPPORTED** = backed by the evidence in the third column (a file, a transaction, a test or a command).
- **UNSUPPORTED** = not backed, or contradicted, when checked. Each one was removed or softened; the row says how.
- "Re-run 2026-10-26" means the command or read was repeated during this release prep. Anything else rests on committed evidence that was not repeated.

## Provenance (post-2026-10-16 work)

Only work done after the event start on 2026-10-16 counts. The first commit in this repository is `6abce68` (2026-10-18), the repository was created 2026-10-18, and the last commit before this release prep is dated 2026-10-20; the release-prep and Phase 11 commits are dated 2026-10-26. Concepts carried over from the author's earlier project Nandout (github.com/davieslennox0/nandout, created 2026-10-11) are listed, with how each was re-implemented, in [docs/REUSED.md](REUSED.md). Nandout is also used as test input only in [docs/NANDOUT-CASE-STUDY.md](NANDOUT-CASE-STUDY.md); nothing of Nandout's is claimed as work done for this event.

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
| U11 | Web page, README, DEMO | Silicon CI run offered as checkable evidence while the spike repo was private, and later served from a repository whose history GitHub still exposed | Outside reviewers could not open it; the earlier repository still served pre-rewrite commits and runs. | The spike repository was recreated (public, clean history); CI was re-run there (run 40386501894, head `85213559`) and every link, hash and caveat points at it. |
| U12 | docs/SUBMISSION.md, docs/GO-LIVE.md, BUILD.md, docs/USER-STEPS.md | GC-039 listed among the final circuits | GC-039 was not tapped out. | Corrected (release prep step 2). |

## 1. Registry and tape-outs

| Claim | Where | Status | Evidence |
|---|---|---|---|
| ForgeRegistry v2 (canonical) is deployed on X Layer at `0xD304F09ba30c41196a6a3C66EBb117184306A06F`; v1 (`0xAFDd108b0efCC1FF4d1e1d32579F80501774912d`) is superseded | README, web, SUBMISSION, DEMO | SUPPORTED | v2 deploy tx `0x35f2670b12b7af4907f57933a2394bc5b04eb74708e4061e9e5d83f203ce3748` (status 1, block 74267262); runtime bytecode identical to v1 apart from the metadata hash (compared 2026-10-26); v1 deploy tx `0xad49…cc66` (docs/TAPEOUTS.md). `verify-live.sh` read each v2 entry on 2026-10-26. |
| Five showcase circuits are tapped out and registered: GC-012, GC-037, GC-050, GC-014, GC-046 (circuit ids 6 to 10); four additional test registrations (ids 11 to 14, GC-007, GC-016, GC-013, GC-022) exist from a separate wallet in registry v1 (nine v1 entries in total); the five showcase circuits are also registered in the canonical v2 | README, web, SUBMISSION, DEMO | SUPPORTED | docs/TAPEOUTS.md (tape-out and register tx hashes). Re-run 2026-10-26: `verify-live.sh` on all five, receipts status 1 on the OrderGuard processor, `SUMMARY: PASS` each. |
| The five showcase registry entries have submitter `0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5` | SUBMISSION | SUPPORTED | Same `verify-live.sh` output (registry entry field). |
| GC-012, GC-037, GC-050, GC-014 are "verified on-chain via processor.eval" | README, web, SUBMISSION, DEMO | SUPPORTED | Registry entries show `verified = true`; on-chain netlist bytes equal our stored hex; all 16 input rows evaluated on-chain with no reverts (`verify-live.sh`). |
| GC-046 is "attestation-only (8 inputs), not verified on-chain via processor.eval" | same | SUPPORTED | Registry entry shows `verified = false` (empty expected outputs by design, contracts/src/ForgeRegistry.sol). |
| GC-039 was not tapped out | README, SUBMISSION, docs | SUPPORTED | Not in docs/TAPEOUTS.md. |
| No FabX PoD or reward claim for these circuits | README, SUBMISSION | SUPPORTED | They are on OrderGuard (`0x57F3…a355`), not a FabX PoD processor (BUILD.md section 7). No reward amount appears anywhere. |
| The other 13 gallery circuits are not tapped out | SUBMISSION, DEMO | SUPPORTED | docs/TAPEOUTS.md lists nine (five showcase plus four test) of the 22. |
| Additional test registrations 11 to 14: submitter `0x155d…b171`, all mint, tape-out and register tx hashes | SUBMISSION, DEMO, README | SUPPORTED | docs/TAPEOUTS.md (separate section), docs/ONCHAIN-TESTS.md; each checked with `verify-live.sh` (`SUMMARY: PASS`) on 2026-10-26. |
| Registry v1's six entries (ids 6 to 11) have `depth = 0`, are immutable and misprice v1's best comparison; the five showcase circuits were re-registered in v2 with real depths (8, 9, 7, 7, 10) | SUBMISSION, web | SUPPORTED | `best(bytes32)` reads on 2026-10-26: v1 depth 0 for GC-012, 037, 050, 014, 046, 007; v2 depths 8, 9, 7, 7, 10 for the five showcase tasks; `ForgeRegistry.cost()` prices depth 0 as 1. |
| "Verified on-chain via processor.eval" = the registry compared caller-supplied outputs with the processor's eval of the same circuit (up to 6 inputs); it does not compare against the task spec | SUBMISSION, web | SUPPORTED | `ForgeRegistry.submit()` source; `register.sh` fetches the expected outputs from the same circuit's `eval()`. `verify-live.sh` checks that the tape-out tx succeeded on the processor, that the on-chain netlist bytes equal the stored netlist and that `eval()` does not revert; only `packages/core/scripts/verify_independent.py` compares netlists with the task vectors. |
| The registry freeze, fake-verification and spec-binding limits listed in docs/LIMITS.md exist | SUBMISSION, web | SUPPORTED | `contracts/src/ForgeRegistry.sol:59-90` (no check of gates, `nIn` or processor; `cost()` with `gates = 0` is 0; replacement needs a strictly lower cost); found in the 2026-10-26 pre-publication audit and the v2 runtime code was confirmed identical to a local compile. |
| The FabX task bank is unchanged since the replay (100 tasks, no differing field) | README, web, SUBMISSION, DEMO | SUPPORTED | Live `api.fabx.tech/v1/pod/taskbank` compared field by field with `docs/fabx-tasks.json` on 2026-10-26; see docs/TAPEOUT-STATUS-2026-10-26.md. |
| The 54 tasks not replayed are 8 wide-input combinational (9 to 18 inputs) plus 46 sequential | README, web, SUBMISSION, DEMO | SUPPORTED | Computed from the live task bank against the 46 replayed ids, 2026-10-26 (earlier text said 44 wide-input; corrected). |
| Spend caps and confirmations: AUTO_CONFIRM is refused unless go-live.sh --unattended is the caller; the cap counts fees plus a gas reserve and is checked before each tape-out is sent against the remaining budget | README, SUBMISSION | SUPPORTED | `scripts/test-go-live.sh` tests 14 to 17 (fork), and a full unattended multi-circuit run on a fork on 2026-10-26: with a 0.02 OKB cap the run finished GC-012 and refused GC-037 before sending (3 transactions sent in total); with a 0.054 OKB cap it resumed and completed all five circuits at 0.0536 OKB cumulative. |
| No known dependency vulnerabilities in the repo's lockfile | SECURITY.md | SUPPORTED | `pnpm audit` (pnpm 9.15.9) on the updated lockfile, 2026-10-26: "No known vulnerabilities found"; tests pass on vitest 4.1.12 (63 tests: core 43, silicon 9, chain 8, cli 3) and the web app builds on vite 6.4.x. Before the update it reported 3 critical, 2 high and 9 moderate, all in dev-only tooling. Your local `node_modules` may still hold the old versions until you run `pnpm install`. |
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
| Costs are never converted into reward amounts; F and K_task are undefined publicly | README, web, DEMO | SUPPORTED | fabx.tech formula page, expanded panels (external evidence: research notes RESULTS2.md, Step 4, which are not in this repository; not independently reproducible from the repo); no payout figure appears in the repo. |
| LATCH semantics resolved (forward feedback allowed, `step(uint256,bytes,bytes)`), confirmed against the vendored NetlistVM, the deployed selectors and a live 3-tick test on FAB_TST id=49 | README | SUPPORTED | docs/NEW.md (latch-reconcile entry); `packages/core` regression test reproducing the live sequence. The `step()` ABI for full sequential evaluation and latch power-up on silicon remain unverified (listed under Limits). |
| 63 vitest + 8 Foundry tests pass | README | SUPPORTED | `pnpm test` on vitest 4.1.12, 2026-10-26: core 43, chain 8, silicon 9, cli 3. Foundry 8/8 on a fork. Offline recovery tests `scripts/test-tx-recovery.sh`: 8/8. Orchestrator suite `scripts/test-go-live.sh`: 27/27 on a local fork (the summary now runs last, so every test affects the exit code). |
| Verify-onchain reads a real circuit and matches local simulation | README, DEMO | SUPPORTED | `forge verify-onchain --processor 0x87BF…f9a6 --id 65 --inputs 0x07` re-run 2026-10-26: `match: true`. |
| Dry-run calldata and fees for all 22 beats; mint "gating" was an EIP-7702 artifact, 4/4 plain EOAs mint | README, web | SUPPORTED | docs/TAPEOUT-DRYRUN.md; docs/NEW.md (mint-diagnosis entry); `apps/web/src/data/gallery.full.json` calldata. Not repeated today. |

## 3. Silicon export

| Claim | Where | Status | Evidence |
|---|---|---|---|
| Task 12 (GC-012) was run through Tiny Tapeout's CI: GDS and precheck succeeded | README, web, SUBMISSION, DEMO | SUPPORTED | Run 40386501894 on `maj3-silicon-spike` (public, head `85213559`), watched to completion 2026-10-26: `gds: success`, `precheck: success`, `gl_test: success`, `viewer: failure`; the separate `test` and `docs` workflows succeeded (runs 40386501940 and 40386501840). |
| The spike repo's one failing check is `viewer` (GitHub Pages not enabled), unrelated to the synthesis/DRC result | web, docs/SILICON.md, SUBMISSION | SUPPORTED | `gh run view 40386501894` on 2026-10-26: `gds`, `precheck`, `gl_test` success, `viewer` failure; `test` and `docs` workflows success. Before the recreation, `gl_test`, `test` and `docs` also failed (template testbench and datasheet placeholder); the new repository fills both in. |
| 34 cells, 173.9168 µm², 15/15 precheck checks, GDS sha256 `de5bf394…a9097` | README, web, SUBMISSION, DEMO | SUPPORTED | Downloaded the artifact of run 40386501894 on 2026-10-26: `synthesis-stats.txt` (34 cells, 173.917 um^2), `precheck_reports/results.md` (15 rows, all pass), `sha256sum` of the final `tt_submission` GDS = `de5bf3943a43fb8cfefb3680b7e6bb77c690ff991314c7293dbd02bfed2a9097` (625,450 bytes). The GDS bytes differ between runs of the same Verilog (three runs, three hashes, same size), so the hash identifies this run's file only; the cause was not investigated. |
| Layout generated and not ordered; "We do not claim a physical chip exists" | README, web, SUBMISSION, DEMO | SUPPORTED | Required wording is used verbatim (docs/SILICON.md line 3). No order is claimed, and this project's tooling never pushes, pays or submits (docs/SILICON.md). |
| Silicon export supports combinational circuits only; latches refused | web (after fix), README | SUPPORTED | docs/SILICON.md "LATCH is refused"; `packages/silicon/test/verilog.test.ts`. |

## 4. Web and access

| Claim | Where | Status | Evidence |
|---|---|---|---|
| The page runs in the browser; nothing is uploaded | web | SUPPORTED | `apps/web` is a static Vite build with no backend; `pnpm --filter @forgeout/web build` succeeds (2026-10-26). |
| "Browse 22 verified circuits" | web | SUPPORTED | `gallery.json` has 22 rows. |
| The gallery and registry panel show tape-out status for the five showcase circuits and describe the four test registrations | web | SUPPORTED | `gallery.json` carries `tapeout` for ids 12, 14, 37, 46, 50; built and checked 2026-10-26. The deployed copy at forgeout.xyz has this update (checked on the live bundle 2026-10-26). |
| https://forgeout.xyz (and www) is the canonical web address and is live | SUBMISSION, web | SUPPORTED | Re-run 2026-10-26 after deploy: `curl https://forgeout.xyz` and `https://www.forgeout.xyz` return 200; certificate issued by Let's Encrypt (valid to 2027-01-24); the served bundle contains 24 netlist and 22 calldata entries, the nine-entries registry text and the depth-0 limit card. The earlier host (a subdomain of another domain) is no longer cited anywhere. |
| The registry panel badge reads "Registry live", not a claim that lookup works | web | SUPPORTED | `best(bytes32)` is not wired into the page (the panel says so); the badge states only that the registry is deployed. |
| English task names are primary in the gallery, with the Chinese title kept as secondary text | web | SUPPORTED, translations unreviewed | `nameEn` in `gallery.full.json` is a translation of each Chinese title written during release prep, not an official FabX name; a native speaker has not reviewed it. |
| The "4.0x" stat is one task; median q among the 22 wins is 1.93x | web | SUPPORTED | `gallery.full.json`: exactly one row at q = 4 (GC-012); median of the 22 q values = 1.926, computed in the page from the same data. |
| "Checked improvements" names the off-chain equivalence checks; "verified on-chain via processor.eval" is kept only for the on-chain label | web | SUPPORTED | Wording changed in `index.html`/`main.ts`; the exact on-chain labels are unchanged. |
| DeWEB was researched and not deployed | README, SUBMISSION | SUPPORTED | docs/DEWEB-RESEARCH.md; no publish transaction. |

## 5. Business claims

| Claim | Where | Status | Evidence |
|---|---|---|---|
| Revenue model is UNVALIDATED; no pricing or paying users | README, SUBMISSION | SUPPORTED | Stated as such; no customer evidence exists. |
| Users "might pay" because verification matters (not gas savings) | README, SUBMISSION | SUPPORTED as a hypothesis only | Labelled "hypothesis, UNVALIDATED" after the fix (U9). |
| "Winner-take-the-bonus" scoring makes one-off optimization weak to sell | README, SUBMISSION | SUPPORTED | fabx.tech "best original design" rule (external evidence: RESULTS2.md Step 4, not in this repository). |

## 6. Limits that apply to all of the above

F and K_task are undefined and no reward amount is reported. The LATCH `step()` ABI and latch power-up state on silicon are unverified. No proven-exact synthesis above 3 inputs (13 of 46 complete-spec tasks lose). 54 sampled-only tasks are excluded. The silicon export is generated layout, not ordered. The generated Tiny Tapeout project has one failing check (`viewer`: GitHub Pages is not enabled on that repository). Nandout results are analysis only (0 gates saved on 10 analysed circuits; one latch circuit not analysed).
