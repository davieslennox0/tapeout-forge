# FabX replay (BUILD.md step 1.10, re-run post-Phase-1b)

**PHASE 1b UPDATE**: Task 8 is now a PROVEN tie, not an optimizer artifact. SAT-based exact synthesis (packages/core/scripts/sat_exact_synth.py) proves MAJ3's true minimum is 6 gates/depth 4 (UNSAT at 5 gates - exhaustively checked, not sampled), which with the 2 output buffers is exactly 8 gates/depth 6/C=1728=Cref. Independently cross-checked with ABC's own technology mapper (yosys-abc, NAND2+INV genlib, `strash;balance;rewrite;refactor;...;dch;map`): ABC also finds area=6/delay=4/lev=4 - a different 6-gate wiring (2 inverters + 4 NAND2s vs. our pure-NAND circuit) but the identical cost, via a completely independent method. No better-than-6-gate MAJ3 circuit can exist.

**Additionally content-verified on real chain data**: FAB_TST ("FAB-Genisis", 0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6) circuit id=65 was fetched (netlist(uint256), VERIFIED ABI - see docs/NEW.md) and its real `eval()` output was checked against all 8 input rows live on X Layer - it is EXACTLY the 3-input majority function (not just a shape match: every row confirmed), with 6 real NAND gates at depth 4, identical to our proven optimum. This is the strongest evidence yet that 6 gates/depth 4 is not just theoretically optimal but is what a real, currently-deployed circuit on the actual PoD mining processor achieves.

**Convention resolved from data**: Task 8's real bank entry (refNand=8, refDepth=6, area=8, Cref=1728=8×6³) exactly matches the WITH-output-buffers numbers, not without. FabX's refNand/refDepth/area/Cref already include the 2 contract-appended buffer NANDs per output. All C/q below use that convention.

**Known limitation, unchanged from Phase 1**: this replay still builds specs from hand-identified standard-gate names (23/100 tasks), NOT from on-chain reference netlists as BUILD.md 1b.4 asked for. Phase 1b DID find and verify the real on-chain ABI for this (circuitInfo(uint256)/netlist(uint256) on both OrderGuard and the FAB_TST/"FAB-Genisis" processor - see docs/NEW.md and packages/chain/src/index.ts), but found no reliable way to map a specific FAB_TST circuit ID to a specific GC-XXX task ID: FAB_TST hosts 100+ circuits that look like a PoD-mining submission ledger (many near-duplicate small functions, no task-ID field anywhere in the task bank JSON or on-chain data), so structural (nIn,nOut,gates) matching produced ambiguous many-to-many results rather than a trustworthy 1:1 mapping. This is reported as a genuine blocker, not a silently-skipped requirement - see docs/NEW.md for the specific evidence (e.g. circuit id 65 on FAB_TST independently has nIn=3/nOut=1/gates=6/depth=4, exactly matching our proven MAJ3 - plausible corroboration for Task 8, but not a confirmed mapping).

**Coverage**: 23/100 tasks attempted (unambiguous standard-gate/arithmetic names only). Skipped: 12, 24, 26, 27, 28, 29, 30 (12, 24, 26: ambiguous exact output encoding; 27-30: sequential, LATCH synthesis not implemented in Phase 1 optimize.ts).

| id | name | tier | kind | Cref | best C (ours, buffered) | q | status |
|---|---|---|---|---|---|---|---|
| 7 | GC-007 双输入同或门 | 简单 | comb | 1512 | 875 | 1.728 | beaten |
| 22 | GC-022 四位回绕加一器 | 简单 | comb | 16767 | 15360 | 1.092 | beaten |
| 1 | GC-001 单比特反相器 | 简单 | comb | 81 | 81 | 1.000 | tie-or-optimal |
| 2 | GC-002 双输入与非门 | 简单 | comb | 81 | 81 | 1.000 | tie-or-optimal |
| 3 | GC-003 双输入与门 | 简单 | comb | 256 | 256 | 1.000 | tie-or-optimal |
| 6 | GC-006 双输入异或门 | 简单 | comb | 750 | 750 | 1.000 | tie-or-optimal |
| 8 | GC-008 三输入多数表决器 | 简单 | comb | 1728 | 1728 | 1.000 | tie-or-optimal |
| 9 | GC-009 单比特二选一选择器 | 简单 | comb | 750 | 750 | 1.000 | tie-or-optimal |
| 10 | GC-010 单比特一分二分配器 | 简单 | comb | 1125 | 1125 | 1.000 | tie-or-optimal |
| 19 | GC-019 单比特半减器 | 简单 | comb | 1375 | 1375 | 1.000 | tie-or-optimal |
| 20 | GC-020 单比特全减器 | 简单 | comb | 8704 | 8704 | 1.000 | tie-or-optimal |
| 23 | GC-023 四位回绕减一器 | 简单 | comb | 24000 | 25515 | 0.941 | lost |
| 11 | GC-011 带使能的二到四译码器 | 简单 | comb | 8918 | 9604 | 0.929 | lost |
| 17 | GC-017 单比特半加器 | 简单 | comb | 1125 | 1250 | 0.900 | lost |
| 14 | GC-014 四位全零检测器 | 简单 | comb | 8748 | 10935 | 0.800 | lost |
| 16 | GC-016 四位数据偶校验检查器 | 简单 | comb | 32832 | 43200 | 0.760 | lost |
| 18 | GC-018 单比特全加器 | 简单 | comb | 6656 | 9216 | 0.722 | lost |
| 5 | GC-005 双输入或非门 | 简单 | comb | 750 | 1296 | 0.579 | lost |
| 4 | GC-004 双输入或门 | 简单 | comb | 320 | 625 | 0.512 | lost |
| 15 | GC-015 四位偶校验位生成器 | 简单 | comb | 7168 | 18000 | 0.398 | lost |
| 13 | GC-013 四位相等比较器 | 简单 | comb | 48384 | 609212 | 0.250 | lost |
| 21 | GC-021 二位无符号大小比较器 | 简单 | comb | 16384 | 66550 | 0.250 | lost |
| 25 | GC-025 四位位序反转器 | 简单 | comb | 64 | 1024 | 0.250 | lost |

**Counts**: beaten-or-at-cap=2 (of which at the 4x cap=0), tie/already-optimal=9, lost (our optimizer did worse than the reference)=12.

**Task 8 explicitly**: reference refNand=8, refDepth=6, area=8 (Cref=1728). Our optimizer's best C=1728 -> tie-or-optimal.

**Honest summary**: the optimizer does **not** beat most references for small, already hand-optimized standard gates/arithmetic - it frequently ties or loses, because its only area-reduction technique is exact structural-duplicate removal (dedupe), not full Boolean factoring. This is a valid, reported result, not a success claim.
