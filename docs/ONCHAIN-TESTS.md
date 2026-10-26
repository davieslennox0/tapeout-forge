# On-chain tests, 2026-10-26

A separate throwaway test wallet (`0x155d4248621Bf2601A9F9171327b8081D302b171`, funded with about 0.036 OKB) ran this project's scripts against the real X Layer registry (`0xAFDd108b0efCC1FF4d1e1d32579F80501774912d`) and the OrderGuard processor (`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`). It spent about 0.017 OKB. Its four registry entries are the "additional test registrations" (ids 11 to 14) in docs/TAPEOUTS.md, separate from the five showcase circuits (ids 6 to 10), so the registry holds nine entries. The wallet's key and keystore password live outside this repository and are not tracked.

| task | in/out | path | circuit | mint tx | tape-out tx | register tx | registry entry |
|---|---|---|---|---|---|---|---|
| GC-007 | 2/1 | verified on-chain via processor.eval | 11 | `0x7022098c610040990d44a35d24af62144dd9c7206c324492d22bb4c85bc20872` | `0xdb02c5015e7aacbc59443f7c0bc482e897cb5d1ee0d398640268d6c5fe773039` | `0x6f57fedcfefed369b4ccf94939d25e5b5b4a6394c79d9375b89a405185c01a97` | verified=true, depth 0 (Finding 1) |
| GC-016 | 5/1 | verified on-chain via processor.eval | 12 | `0x0ad1302c40ba817f0e7a51d225d387b6c5a424e18e6b6e1df860b246e4dde99d` | `0xc7f2c944747ecb4c540bfcb0ac4d519180e75daec5e6b559ec906df7f616660c` | `0xbc4e4d7f73d59832fd76e25201b20d67fc4978b53351e7c24e5496f5d97ab4ec` | verified=true, depth 10 |
| GC-013 | 8/1 | attestation-only (8 inputs), not verified on-chain via processor.eval | 13 | `0xb57db3bbfadd789e2de87f64c6c3f0d0ffedcf89ad578e2447b42060a9f544a0` | `0xf5993734f556974ec25c2557fbec98199cc56eb16504c6c74186550afab3142a` | `0xa8ef31b43147bc5c64f31b5c8a18a7704dedb620618b15ca9e3d45f8107f880f` | verified=false, depth 10 |
| GC-022 | 4/4 | verified on-chain via processor.eval | 14 | `0xd70fe212c91047c1213fa26d44e6c4c9ac50f131b064929100693a96ddf74adf` | `0xeaedee4324d255b3851d5140cd178682a72a4592a0b426b48e66c2ecebe7558f` | `0x52c6bacddeb13a73ca836738338bfa40848f91b937d1199820fc87bcf07e7e76` | verified=true, depth 7 |

Each was checked with `scripts/verify-live.sh` (`SUMMARY: PASS`: the on-chain netlist equals the stored hex, and every input row evaluated on-chain without reverting for the circuits with up to 6 inputs). Register gas used: 243,784 / 2,391,792 / 119,121 / 1,425,542, each costing between 0.0000024 and 0.0000478 OKB at 20,000,001 wei/gas.

Also exercised, with no spend: re-submitting an equal-cost circuit reverts with `NotStrictlyBetter` (selector `0xe6f473d7`); `forge verify-onchain` against a real circuit reports `match: true`; `scripts/go-live.sh` in dry-run skips all five showcase circuits as already registered; mint dedup skipped a re-mint twice ("existing transistor balance already covers the gates needed"); the register-tx capture added to `register.sh` printed the real hash each time.

## Findings

1. **Registry depth 0.** `gallery.full.json` had no `depth` field, so `register.sh` passed `depth = 0`. The registry prices depth 0 as 1 (`gates x 1` instead of `gates x depth^3`). The five showcase entries and the GC-007 test entry were registered this way and cannot be corrected (the registry is immutable). Fixed for future registrations: `depth` was added to every gallery row (derived exactly from `C = totalGates x depth^3`, valid for all 22 rows), and `register.sh` now refuses depth 0. Entries 12 to 14 carry correct depths.
2. **`tapeout.sh` and the public RPC.** Twice the tape-out mined but `cast send` failed reading the receipt ("null response"), and once it failed before sending. Hardened: the send is now split from the wait, null replies are tolerated, and on a send error the tx is looked up by its on-chain event (sender-filtered) before anything is reported (`scripts/lib-tx.sh`, 8 offline tests in `scripts/test-tx-recovery.sh`, run in CI).

## What the registry validates (read-only, from `contracts/src/ForgeRegistry.sol`)

- `submit()` takes `gates`, `depth`, `nIn` and `nOut` **from the caller**. It never reads the processor's `circuitInfo`, netlist or depth, so none of those values is checked against the circuit.
- The only on-chain check, for `nIn <= 6`, is that the caller's `expectedOutputs[i]` equal `eval(circuitId, i)` of the same circuit. `register.sh` fetches the expected outputs from that very `eval()`, so "verified on-chain via processor.eval" means "the processor reproduces its own outputs", not "the circuit implements the task". Spec equivalence is checked off-chain (`verify-live.sh` compares the on-chain netlist bytes with the stored netlist; `verify_independent.py` checks that netlist against the task vectors).
- Ranking uses `gates x max(depth,1)^3` from the caller's numbers, so any submitter can claim a low depth. A clean v2 that only re-registers fixes the six mispriced entries, not this self-reporting.

### Impact of the six depth-0 entries (registry cost vs. true cost)

| task | on-chain cost (depth read as 1) | true cost (`gates x depth^3`) | understated by |
|---|---|---|---|
| GC-012 | 56 | 28,672 | 512x |
| GC-037 | 36 | 26,244 | 729x |
| GC-050 | 46 | 15,778 | 343x |
| GC-014 | 12 | 4,116 | 343x |
| GC-046 | 92 | 92,000 | 1000x |
| GC-007 | 7 | 875 | 125x |

A challenger's honest submission for these six specs is compared against the understated cost, so it can be rejected as `NotStrictlyBetter` even when it is truly cheaper.

### A clean v2 registry: cost and impact (not deployed)

- **Cost.** Deploying the registry used 460,958 gas on the fork. Registering the circuits again (the circuits already exist on the processor, so no new mint or tape-out fee) used 119,121 to 2,391,792 gas per entry in the live runs, each under 0.00005 OKB at today's price. Redeploy plus re-registering the six affected entries is well under 0.001 OKB in total, and under 0.002 OKB if the three correct test entries are re-registered too.
- **Impact.**
  - The new registry has a new address; the README, web app, SUBMISSION, DEMO and CLAIMS text must name which one is canonical.
  - v1 stays on-chain forever with the six depth-0 entries, so the docs must say v1 is superseded.
  - Because the registry cannot link to its predecessor, a reader following old links still lands on the mispriced entries.
  - If v2 should also stop self-reported cost, it needs to read gates from `circuitInfo` and compute depth from the on-chain netlist inside the contract. That raises gas roughly in proportion to the gate count and needs new tests; it is a design change, not just a redeploy.
- **Decision needed from the owner:** redeploy a v2 with corrected re-registration (cheap), or keep v1 and document the six entries as a known limit (this document and docs/SUBMISSION.md already do).

## Nandout, read-only

Our local simulation was compared with the real `eval()` of Nandout's processor on sampled inputs (12 per circuit) for its 10 combinational circuits: 120 of 120 match. Circuit 6 holds a latch, so `eval()` reverts and it was skipped. Nothing of Nandout's was modified. See docs/NANDOUT-CASE-STUDY.md.
