# Forgeout vs. the public 39-circuit set (23 X Layer circuits)

**Source dataset**: [nand.aihashrate.stream/circuits/](https://nand.aihashrate.stream/circuits/) (39 circuits, 16 BSC + 23 X Layer, all pure NAND / 0 latches; list snapshot 2026-11-17 05:39, read 2026-11-18). This run covers the 23 X Layer circuits only; the 16 BSC circuits are out of scope for this pass.
**Gas formula**: `E_step = alpha + betaN*N_NAND + betaL*N_LATCH + betaIn*n_in + betaOut*n_out`, constants from [nand.aihashrate.stream/physics/](https://nand.aihashrate.stream/physics/) ("定律里的系数" table, read 2026-11-18). X Layer: alpha=20,319, betaN=2,280.82, betaL=3,179.81, betaIn=324.71, betaOut=-1,237.10 (all gas; betaOut is negative in their fit, used as given, not clamped).

**Method**: for each circuit, the real on-chain netlist is fetched directly via `netlist(id)`/`circuitInfo(id)` on its own processor contract (saved to `netlists/`, with the read block for provenance). For circuits with nIn<=20, Forgeout's full optimizer runs independently per output bit (area/depth/balanced/c objectives, best of 4), each candidate independently re-derived and bit-compared against the real on-chain function - not trusted from the optimizer's own internal check. For nIn>20 (exact synthesis and exhaustive truth tables aren't feasible past that size - `optimize()` itself refuses above 20), only the structural `dedupe()` pass runs (works on any nIn, provably depth-neutral and gate-count non-increasing by construction), with equivalence re-checked via the SAT-based checker under a 120s timeout in a separate process. Whichever of (per-output optimize, dedupe) gives fewer gates is reported as "after"; ties go to lower depth.

## Functional vs. probe circuits: how and why this run splits the set

The 23 circuits are not all the same kind of thing. Some are ordinary multi-input/multi-output combinational logic; others are, structurally, chains or mass-duplicated gates with no real function - the kind of construction you'd build to measure a cost law, not to compute something. Benchmarking both together and reporting one blended number would make Forgeout look either better or worse than it is depending on which kind dominates the sample, so this run classifies each circuit and reports the two groups separately.

**What the source site itself confirms, checked directly against both its circuits page and its physics page (`nand.aihashrate.stream/physics/`), not assumed:**
- Exactly **one** circuit in this set is explicitly named on the source site: circuit **#3** on processor `0xa93e807f...2aa3` (nIn=320, nOut=32) - the circuits page's own `data-cpu` row literally labels it `"21nandkit DOT32_T · 三值点积"` (a ternary dot product), and the physics page's Law 15 (real-circuit compilation, experiment **E3**) names `DOT32_T` by name as its real-circuit test subject. Confirmed functional, not a probe - and a useful check that *wide input count alone* doesn't mean "probe" (see #1 and #9 below).
- The physics page's controlled law experiments (Law 1 "depth is free"; Law 3 "memory-squared"; the E1b hierarchy-savings experiment) explicitly describe using **separately-sized, purpose-built or injected synthetic netlists** (a fixed 2,000-gate circuit at four depths for Law 1; up to 100,064 gates / 30 sub-circuits for E1b; "inject synthetic netlists of a few thousand to 100,000 gates" for Law 3) - none of which match any of these 23 circuits' exact gate counts. So this run does **not** claim any of the remaining 22 circuits is literally a named experiment's dataset; no such 1:1 match exists in the source text.
- What the physics page *does* confirm is the likely origin of the degenerate-looking ones: its cross-validation methodology (experiments **E11b** and **E13**, used to validate the fitted energy law against real deployed circuits) explicitly drew **random real on-chain circuits**, and explicitly reports that this random draw included repeats - "10 of 30 random BSC draws were the same 1-gate netlist" (原文: "E11b 随机抽到的 BSC 电路 30 颗里 10 颗是同一份 1 门网表"). That is exactly the shape of #288/#314/#1387 below (three identical 10,000-gate, 2-input circuits under one processor) - strong circumstantial support that the mass-duplicated and long-chain circuits in this set are real artifacts swept into that same kind of real-circuit sampling, not necessarily hand-built by the site, but genuinely non-representative of real logic design either way.
- One classification here is a judgment call, not a sourced fact: **#66** (88 inputs, only 100 gates, depth 4). No explicit label exists for it either way. It's placed in the probe group because 100 gates/depth 4 is too shallow to meaningfully combine 88 independent inputs - but unlike the chains and mass-duplicates above, this is inference from shape, not a sourced match, and is flagged as such in the table below.

**Criteria used:** Group A (functional) - plausible real combinational logic, no degenerate structure. Group B (probe) - single- or dual-input NAND chains where depth equals gate count (no logic possible, pure chain), mass-duplicated parallel gates (only 16 distinct 2-input functions exist, so thousands of them is redundancy not logic), or (one case, flagged) extreme width-to-logic ratio.

## Group A — functional circuits (headline)

4 of 12 verified functional circuits improved - 2 distinct designs: 20→14 gates, 22.0% gas/step (deployed 2x: #3968, #4746); 652→644 gates, 1.2% gas/step (deployed 2x: #5, #8). 8 already optimal. 2 unproven (listed separately below, not counted here). Best reduction: 30.0%. Verified gas saved: 63,863 gas/step (28 gates saved total).

| id | processor | nIn/nOut | gates before→after | reduction | depth before→after | chunks before→after | equivalent | method | runtime |
|---|---|---|---|---|---|---|---|---|---|
| #3968 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 4/4 | 20→14 | 30.0% | 5→3 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 11.6s |
| #4746 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 4/4 | 20→14 | 30.0% | 5→3 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.4s |
| #49 | [0x7f2d31…4687](https://www.oklink.com/xlayer/address/0x7f2d3131a76d9aefb49f44657da6e1acac334687) | 6/4 | 27→27 | 0.0% | 17→17 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 1.9s |
| #6082 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 9/5 | 66→66 | 0.0% | 17→17 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.3s |
| #977 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 9/5 | 72→72 | 0.0% | 23→23 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 1.6s |
| #451 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 8/8 | 147→147 | 0.0% | 11→11 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.1s |
| #2109 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 11/8 | 248→248 | 0.0% | 35→35 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 2.5s |
| #5 | [0x08f4cb…2998](https://www.oklink.com/xlayer/address/0x08f4cb11ae76c1c96437e72190777223b45a2998) | 16/16 | 652→644 | 1.2% | 44→44 | 1→1 | ✓ yes | dedupe | 58.5s |
| #8 | [0xf40eed…cb44](https://www.oklink.com/xlayer/address/0xf40eed30b189e11124901f73e1518daea69acb44) | 16/16 | 652→644 | 1.2% | 44→44 | 1→1 | ✓ yes | dedupe | 58.1s |
| #1 | [0xf9bbdc…0a0f](https://www.oklink.com/xlayer/address/0xf9bbdc7f678eb3a49d338ffacdaad9339de50a0f) | 36/14 | 1193→1193 | 0.0% | 66→66 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 121.4s |
| #1 | [0x8dff4c…6ef5](https://www.oklink.com/xlayer/address/0x8dff4c46c608aba7e48b77e213288d9f6bc36ef5) | 16/16 | 1204→1204 | 0.0% | 114→114 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 68.9s |
| #3 | [0xa93e80…2aa3](https://www.oklink.com/xlayer/address/0xa93e807fab41431827ebba57443fb687a95e2aa3) | 320/32 | 3829→3829 | 0.0% | 139→139 | 2→2 | ✓ yes | dedupe, both regressed or tied - kept original | 121.8s |

**Unproven - not counted above.** Gate counts below are real (read from chain), but equivalence to the original could not be proven within this run's limits, so they are *not* included in "improved"/"gas saved"/"best" above.

| id | processor | nIn/nOut | gates before→after (unverified) | reduction (unverified) | why unproven |
|---|---|---|---|---|---|
| #3 | [0x832000…80fc](https://www.oklink.com/xlayer/address/0x832000e803885c572fa4ce0bf488ab9946b880fc) | 30/30 | *2355→2340* | *0.6%* | SAT-DPLL, timed out after 120s - NOT PROVEN |
| #9 | [0xb99c73…29aa](https://www.oklink.com/xlayer/address/0xb99c7388b6426367e496e902174a631f640729aa) | 24/12 | *5996→5584* | *6.9%* | SAT-DPLL, timed out after 120s - NOT PROVEN |

## Group B — probe circuits (not representative)

These are the source site's own physics-measurement constructions (or, for #66, a shape strongly resembling one) - not hand-written functions. Included for completeness and transparency, but **excluded from the headline** because optimizing a NAND chain or deduplicating 10,000 identical redundant gates is not a meaningful demonstration of Forgeout's optimizer.

8 of 9 verified  circuits improved - 6 distinct designs: 500→1 gates, 98.1% gas/step (#6464); 709→1 gates, 98.7% gas/step (#3079); 1303→1 gates, 99.3% gas/step (#4859); 4983→1 gates, 99.8% gas/step (#731); 6821→1 gates, 99.9% gas/step (#782); 10000→1 gates, 99.9% gas/step (deployed 3x: #288, #314, #1387). 1 already optimal. 0 unproven (listed separately below, not counted here). Best reduction: 100.0%. Verified gas saved: 101,058,573 gas/step (44,308 gates saved total).

| id | processor | nIn/nOut | gates before→after | reduction | depth before→after | chunks before→after | equivalent | method | runtime |
|---|---|---|---|---|---|---|---|---|---|
| #66 | [0xf5c2bc…4298](https://www.oklink.com/xlayer/address/0xf5c2bca1f38c6861f6d1303c0cbe840671ae4298) | 88/16 | 100→100 | 0.0% | 4→4 | 1→1 | ✓ yes | dedupe, both regressed or tied - kept original | 3.6s |
| #6464 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 500→1 | 99.8% | 499→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.0s |
| #3079 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 709→1 | 99.9% | 709→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #4859 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | 1/1 | 1303→1 | 99.9% | 1303→1 | 1→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #731 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 4983→1 | 100.0% | 4983→1 | 2→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.2s |
| #782 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 6821→1 | 100.0% | 6821→1 | 2→1 | ✓ yes | per-output optimize (area/depth/balanced/c, best of 4) | 1.1s |
| #288 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.1s |
| #314 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.1s |
| #1387 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | 2/1 | 10000→1 | 100.0% | 1→1 | 3→1 | ✓ yes | dedupe | 1.3s |

### Per-circuit classification reasons

| id | processor | group | reason |
|---|---|---|---|
| #3968 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | A | 4-in/4-out, 20 gates/depth 5 - ordinary small combinational shape, no degenerate structure. |
| #4746 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | A | Same shape as #3968 (20g/d5, 4-in/4-out) - ordinary small combinational logic. |
| #49 | [0x7f2d31…4687](https://www.oklink.com/xlayer/address/0x7f2d3131a76d9aefb49f44657da6e1acac334687) | A | 6-in/4-out, 27 gates/depth 17 - plausible real multi-output logic, no degenerate structure. |
| #6082 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | A | 9-in/5-out, 66 gates/depth 17 - ordinary multi-output combinational shape. |
| #977 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | A | 9-in/5-out, 72 gates/depth 23 - ordinary multi-output combinational shape. |
| #66 | [0xf5c2bc…4298](https://www.oklink.com/xlayer/address/0xf5c2bca1f38c6861f6d1303c0cbe840671ae4298) | B | 88 inputs but only 100 gates and depth 4 - too shallow/sparse to combine 88 independent inputs meaningfully; matches the kind of wide-nIn data point the energy law's beta_in (per-input-bit) term needs to fit, not realistic design. Not explicitly labeled by the source site - classified on structure only, 0% either way. |
| #451 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | A | 8-in/8-out, 147 gates/depth 11 - ordinary multi-output combinational shape. |
| #2109 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | A | 11-in/8-out, 248 gates/depth 35 - ordinary multi-output combinational shape. |
| #6464 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | B | 1 input, 500 gates, depth 500 = gates - a pure NAND chain on a single bit (computes nothing but repeated NOT), structurally identical to the depth-scaling probes the physics page's Law 1 ('depth is free') describes testing with a fixed-size chain at varying depth. |
| #5 | [0x08f4cb…2998](https://www.oklink.com/xlayer/address/0x08f4cb11ae76c1c96437e72190777223b45a2998) | A | 16-in/16-out, 652 gates/depth 44 - substantial real-looking multi-output logic. |
| #8 | [0xf40eed…cb44](https://www.oklink.com/xlayer/address/0xf40eed30b189e11124901f73e1518daea69acb44) | A | Same shape as #5 (652g/d44, 16-in/16-out) on a different processor - substantial real-looking logic. |
| #3079 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | B | 1 input, 709 gates, depth = gates - pure single-input NAND chain, no real logic possible with 1 input; a depth-scaling probe, same family as #6464. |
| #1 | [0xf9bbdc…0a0f](https://www.oklink.com/xlayer/address/0xf9bbdc7f678eb3a49d338ffacdaad9339de50a0f) | A | 36-in/14-out, 1193 gates/depth 66 - substantial real multi-output logic (wide input count alone isn't disqualifying: see DOT32_T at nIn=320). |
| #1 | [0x8dff4c…6ef5](https://www.oklink.com/xlayer/address/0x8dff4c46c608aba7e48b77e213288d9f6bc36ef5) | A | 16-in/16-out, 1204 gates/depth 114 - substantial real-looking multi-output logic. |
| #4859 | [0x87bfca…f9a6](https://www.oklink.com/xlayer/address/0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) | B | 1 input, 1303 gates, depth = gates - pure single-input NAND chain, same depth-scaling-probe family as #6464/#3079. |
| #3 | [0x832000…80fc](https://www.oklink.com/xlayer/address/0x832000e803885c572fa4ce0bf488ab9946b880fc) | A | 30-in/30-out, 2355 gates/depth 140 - substantial real multi-output logic. |
| #3 | [0xa93e80…2aa3](https://www.oklink.com/xlayer/address/0xa93e807fab41431827ebba57443fb687a95e2aa3) | A | Explicitly labeled by the source site itself: circuits page lists it as "21nandkit DOT32_T - ternary dot product"; the physics page's Law 15 (real-circuit compilation, experiment E3) names DOT32_T by name as its real-circuit test subject. Confirmed functional, not a probe. |
| #731 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | B | 2 inputs, 4983 gates, depth = gates - a long serial chain using at most 2 inputs, not real logic; same depth-scaling-probe family as the 1-input chains. |
| #9 | [0xb99c73…29aa](https://www.oklink.com/xlayer/address/0xb99c7388b6426367e496e902174a631f640729aa) | A | 24-in/12-out, 5996 gates/depth 437 - substantial real multi-output logic, no degenerate structure. |
| #782 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | B | 2 inputs, 6821 gates, depth = gates - long serial chain, same depth-scaling-probe family as #731. |
| #288 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | B | 2 inputs, 10,000 gates, depth 1 - thousands of mutually-independent 2-input gates computing in parallel (only 16 distinct 2-input functions exist); mass-parallel redundancy, not logic. The physics page's E11b/E13 cross-validation explicitly describes drawing random real circuits that included repeated/degenerate netlists like this one (e.g. "10 of 30 random BSC draws were the same 1-gate netlist"). |
| #314 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | B | Identical shape to #288 (2-in, 10,000 gates, depth 1) - same mass-parallel-redundancy probe family, redeployed as a separate circuit id. |
| #1387 | [0x69f663…62ca](https://www.oklink.com/xlayer/address/0x69f663931209096037474d7c20402232e5c762ca) | B | Identical shape to #288/#314 (2-in, 10,000 gates, depth 1) - same mass-parallel-redundancy probe family, redeployed as a third separate circuit id. |

## Notes / honesty checks

- **Already optimal (0% gate reduction), not oversold as a "win"**: #49, #6082, #977, #451, #2109, #1, #1, #3, #66.
- **Equivalence not proven within this run's limits**: #3 (SAT-DPLL, timed out after 120s - NOT PROVEN); #9 (SAT-DPLL, timed out after 120s - NOT PROVEN). Their gate counts above are real, but not independently confirmed to compute the same function - treat as unverified, not as a beat.
- **Chunk count dropped (fewer 24,000-byte storage chunks needed)**: #731 (2→1), #782 (2→1), #288 (3→1), #314 (3→1), #1387 (3→1). The source page's own physics notes show chunk-splicing cost scaling roughly with the 4th power of chunk count, so these are disproportionately valuable reductions, not just linear gate savings. (All of these happen to be Group B circuits.)
- **Wide-input circuits (nIn>20), optimizer not fully applicable**: #66 (nIn=88), #1 (nIn=36), #3 (nIn=30), #3 (nIn=320), #9 (nIn=24). Only structural dedup ran; full re-synthesis needs an exhaustive truth table, infeasible at this width.
- Netlists saved under `netlists/` include the exact read block and RPC used, so every number above is reproducible.
