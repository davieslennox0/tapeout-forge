# Forgeout vs. the public 39-circuit set (23 X Layer circuits)

**Source dataset**: [nand.aihashrate.stream/circuits/](https://nand.aihashrate.stream/circuits/) (39 circuits, 16 BSC + 23 X Layer, all pure NAND / 0 latches; list snapshot 2026-11-17 05:39, read 2026-11-18). This run covers the 23 X Layer circuits only; the 16 BSC circuits are out of scope for this pass.
**Gas formula**: `E_step = alpha + betaN*N_NAND + betaL*N_LATCH + betaIn*n_in + betaOut*n_out`, constants from [nand.aihashrate.stream/physics/](https://nand.aihashrate.stream/physics/) ("定律里的系数" table, read 2026-11-18). X Layer: alpha=20,319, betaN=2,280.82, betaL=3,179.81, betaIn=324.71, betaOut=-1,237.10 (all gas; betaOut is negative in their fit, used as given, not clamped).

**Method**: for each circuit, the real on-chain netlist is fetched directly via `netlist(id)`/`circuitInfo(id)` on its own processor contract (saved to `netlists/`, with the read block for provenance). For circuits with nIn<=20, Forgeout's full optimizer runs independently per output bit (area/depth/balanced/c objectives, best of 4), each candidate independently re-derived and bit-compared against the real on-chain function - not trusted from the optimizer's own internal check. For nIn>20 (exact synthesis and exhaustive truth tables aren't feasible past that size - `optimize()` itself refuses above 20), only the structural `dedupe()` pass runs (works on any nIn, provably depth-neutral and gate-count non-increasing by construction), with equivalence re-checked via the SAT-based checker under a 120s timeout in a separate process. Whichever of (per-output optimize, dedupe) gives fewer gates is reported as "after"; ties go to lower depth.

**Headline**: 14/23 circuits improved, 9 already optimal (0% reduction), median reduction 1.2%, best 100.0%. Total gas saved across all 23: 102,096,346 gas/step (sum of each circuit's own E_step delta). 2 circuit(s) could not be proven equivalent within this run's limits - see notes below, not counted as verified.

## Full results

| id | processor | nIn/nOut | gates before→after | reduction | depth before→after | chunks before→after | equivalent | method | runtime |
|---|---|---|---|---|---|---|---|---|---|
| #3968 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 4/4 | 20→14 | 30.0% | 5→3 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 11.6s |
| #4746 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 4/4 | 20→14 | 30.0% | 5→3 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.4s |
| #49 | [0x7f2d31…4687](https://www.oklink.com/xlayer/address/0x7f2d3131a76d9aefb49f44657da6e1acac334687) | 6/4 | 27→27 | 0.0% | 17→17 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 1.9s |
| #6082 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 9/5 | 66→66 | 0.0% | 17→17 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.3s |
| #977 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 9/5 | 72→72 | 0.0% | 23→23 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 1.6s |
| #66 | [0xf5c2bc…4298](https://www.oklink.com/xlayer/address/0xf5c2bca1f38c6861f6d1303c0cbe840671ae4298) | 88/16 | 100→100 | 0.0% | 4→4 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 3.6s |
| #451 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 8/8 | 147→147 | 0.0% | 11→11 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.1s |
| #2109 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 11/8 | 248→248 | 0.0% | 35→35 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.5s |
| #6464 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 500→1 | 99.8% | 499→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.0s |
| #5 | [0x08f4cb…2998](https://www.oklink.com/xlayer/address/0x08f4cb11ae76c1c96437e72190777223b45a2998) | 16/16 | 652→644 | 1.2% | 44→44 | 1→1 | ✓ yes | dedupe | 58.5s |
| #8 | [0xf40eed…cb44](https://www.oklink.com/xlayer/address/0xf40eed30b189e11124901f73e1518daea69acb44) | 16/16 | 652→644 | 1.2% | 44→44 | 1→1 | ✓ yes | dedupe | 58.1s |
| #3079 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 709→1 | 99.9% | 709→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #1 | [0xf9bbdc…0a0f](https://www.oklink.com/xlayer/address/0xf9bbdc7f678eb3a49d338ffacdaad9339de50a0f) | 36/14 | 1193→1193 | 0.0% | 66→66 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 121.4s |
| #1 | [0x8dff4c…6ef5](https://www.oklink.com/xlayer/address/0x8dff4c46c608aba7e48b77e213288d9f6bc36ef5) | 16/16 | 1204→1204 | 0.0% | 114→114 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 68.9s |
| #4859 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 1303→1 | 99.9% | 1303→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #3 | [0x832000…80fc](https://www.oklink.com/xlayer/address/0x832000e803885c572fa4ce0bf488ab9946b880fc) | 30/30 | 2355→2340 | 0.6% | 140→140 | 1→1 | ? not proven | dedupe | 121.4s |
| #3 | [0xa93e80…2aa3](https://www.oklink.com/xlayer/address/0xa93e807fab41431827ebba57443fb687a95e2aa3) | 320/32 | 3829→3829 | 0.0% | 139→139 | 2→2 | ✓ yes | dedupe, both regressed or tied - kept original | 121.8s |
| #731 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 4983→1 | 100.0% | 4983→1 | 2→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #9 | [0xb99c73…29aa](https://www.oklink.com/xlayer/address/0xb99c7388b6426367e496e902174a631f640729aa) | 24/12 | 5996→5584 | 6.9% | 437→437 | 2→2 | ? not proven | dedupe | 121.6s |
| #782 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 6821→1 | 100.0% | 6821→1 | 2→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.1s |
| #288 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.1s |
| #314 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.1s |
| #1387 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.3s |

## Notes / honesty checks

- **Already optimal (0% gate reduction), not oversold as a "win"**: #49, #6082, #977, #66, #451, #2109, #1, #1, #3.
- **Equivalence not proven within this run's limits**: #3 (SAT-DPLL, timed out after 120s - NOT PROVEN); #9 (SAT-DPLL, timed out after 120s - NOT PROVEN). Their gate counts above are real, but not independently confirmed to compute the same function - treat as unverified, not as a beat.
- **Chunk count dropped (fewer 24,000-byte storage chunks needed)**: #731 (2→1), #782 (2→1), #288 (3→1), #314 (3→1), #1387 (3→1). The source page's own physics notes show chunk-splicing cost scaling roughly with the 4th power of chunk count, so these are disproportionately valuable reductions, not just linear gate savings.
- **Wide-input circuits (nIn>20), optimizer not fully applicable**: #66 (nIn=88), #1 (nIn=36), #3 (nIn=30), #3 (nIn=320), #9 (nIn=24). Only structural dedup ran; full re-synthesis needs an exhaustive truth table, infeasible at this width (2^88 rows).
- Several circuits in this set look like deliberate physics-probe constructions from the source site itself (e.g. long single-input NAND chains used to test their own depth-scaling law, or many parallel 2-input gates used to test chunk scaling), not hand-written "real" functions - noted here rather than presented as if Forgeout found a clever win on meaningful logic.
- Netlists saved under `netlists/` include the exact read block and RPC used, so every number above is reproducible.
