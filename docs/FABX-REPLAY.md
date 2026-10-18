# FabX replay (BUILD.md step 1.10)

**Convention resolved from data**: Task 8's real bank entry (refNand=8, refDepth=6, area=8, Cref=1728=8×6³) exactly matches the WITH-output-buffers numbers, not without. FabX's refNand/refDepth/area/Cref already include the 2 contract-appended buffer NANDs per output. Cross-checked against GC-001 (single-bit inverter: refNand=3, refDepth=3 = 1 real NAND + 2 buffers, depth 1+2=3 - a bare inverter needs only 1 gate, confirming the reference count already includes buffers, not just task 8). All C/q below use that convention.

**Coverage**: 23/100 tasks attempted (unambiguous standard-gate/arithmetic names only). Skipped: 12, 24, 26 (ambiguous exact output encoding - would require guessing FabX's precise output format, not attempted), 27-30 (sequential; LATCH synthesis is not implemented in Phase 1's optimize.ts, which is combinational-only).

| id | name | tier | kind | Cref | best C (ours, buffered) | q | status |
|---|---|---|---|---|---|---|---|
| 7 | GC-007 双输入同或门 (XNOR) | 简单 | comb | 1512 | 875 | 1.728 | beaten |
| 22 | GC-022 四位回绕加一器 (4-bit wrap incr) | 简单 | comb | 16767 | 15360 | 1.092 | beaten |
| 20 | GC-020 单比特全减器 (full subtractor) | 简单 | comb | 8704 | 8575 | 1.015 | beaten |
| 1 | GC-001 单比特反相器 (inverter) | 简单 | comb | 81 | 81 | 1.000 | tie-or-optimal |
| 2 | GC-002 双输入与非门 (NAND) | 简单 | comb | 81 | 81 | 1.000 | tie-or-optimal |
| 3 | GC-003 双输入与门 (AND) | 简单 | comb | 256 | 256 | 1.000 | tie-or-optimal |
| 4 | GC-004 双输入或门 (OR) | 简单 | comb | 320 | 320 | 1.000 | tie-or-optimal |
| 5 | GC-005 双输入或非门 (NOR) | 简单 | comb | 750 | 750 | 1.000 | tie-or-optimal |
| 9 | GC-009 单比特二选一选择器 (2:1 mux) | 简单 | comb | 750 | 750 | 1.000 | tie-or-optimal |
| 10 | GC-010 单比特一分二分配器 (1:2 demux) | 简单 | comb | 1125 | 1125 | 1.000 | tie-or-optimal |
| 23 | GC-023 四位回绕减一器 (4-bit wrap decr) | 简单 | comb | 24000 | 24786 | 0.968 | lost |
| 11 | GC-011 带使能的二到四译码器 (2:4 decoder+en) | 简单 | comb | 8918 | 9604 | 0.929 | lost |
| 19 | GC-019 单比特半减器 (half subtractor) | 简单 | comb | 1375 | 1500 | 0.917 | lost |
| 6 | GC-006 双输入异或门 (XOR) | 简单 | comb | 750 | 875 | 0.857 | lost |
| 17 | GC-017 单比特半加器 (half adder) | 简单 | comb | 1125 | 1375 | 0.818 | lost |
| 8 | GC-008 三输入多数表决器 (3-input majority) | 简单 | comb | 1728 | 2160 | 0.800 | lost |
| 14 | GC-014 四位全零检测器 (4-bit zero detector) | 简单 | comb | 8748 | 10935 | 0.800 | lost |
| 18 | GC-018 单比特全加器 (full adder) | 简单 | comb | 6656 | 8918 | 0.746 | lost |
| 16 | GC-016 四位数据偶校验检查器 (5-bit parity check) | 简单 | comb | 32832 | 45254 | 0.726 | lost |
| 21 | GC-021 二位无符号大小比较器 (2-bit comparator) | 简单 | comb | 16384 | 32076 | 0.511 | lost |
| 15 | GC-015 四位偶校验位生成器 (4-bit parity gen) | 简单 | comb | 7168 | 19683 | 0.364 | lost |
| 13 | GC-013 四位相等比较器 (4-bit equality) | 简单 | comb | 48384 | 584647 | 0.250 | lost |
| 25 | GC-025 四位位序反转器 (4-bit bit-reverser) | 简单 | comb | 64 | 1024 | 0.250 | lost |

**Counts**: beaten-or-at-cap = 3 (of which at the 4x cap = 0), tie/already-optimal = 7, lost (our optimizer did worse than the reference) = 13.

**Task 8 explicitly**: reference refNand=8, refDepth=6, area=8 (Cref=1728). Our optimizer's best C=2160 → **LOST**. Our general Shannon/exact-depth synthesizer finds an 8-gate, depth-4 (pre-buffer) circuit, not the hand-factored 6-gate, depth-4 circuit from BUILD.md section 6 that would tie the reference exactly (both are depth-optimal; only the hand one is gate-count-optimal - see exact.ts's documented min-depth-not-min-gates limitation).

**Open question found during this replay (GC-025, not resolved, flagged rather than guessed)**: GC-025's own reference numbers (refNand=8, refDepth=2, matching 0 real gates + 8 contract buffers, depth 0+2) imply the reference bit-reverser circuit uses **zero real NAND gates** - a pure rewiring, which makes sense since reversing bit order needs no logic. Our TAP-02 netlist model (netlist.ts) requires every output to be among our own gates' signals (the "last nOut gates" convention), so we cannot represent "output = a bare input signal" with zero gates - our minimum is 2 gates/output (a double-negation buffer). Whether the real on-chain format actually permits designating a bare input (or even a REF) as an output directly, bypassing the "last N gates" requirement, is UNVERIFIED - not guessed at or implemented speculatively. This is a real question for whoever has netlist(id)/ABI access to resolve, not something this session invented a fix for.

**Honest summary**: the optimizer does **not** beat most references for small, already hand-optimized standard gates/arithmetic - it frequently ties or loses, because its only area-reduction technique is exact structural-duplicate removal (dedupe) plus a trivial-literal shortcut (added mid-replay after it was caught undercounting GC-025), not full Boolean factoring or algebraic minimization. This is a valid, reported result, not a success claim. A real area-minimizing rewrite engine (factoring, Espresso-style two-level minimization, or exhaustive small-circuit search beyond exact.ts's depth-only proof) is the clear next-highest-value improvement, not attempted here.
