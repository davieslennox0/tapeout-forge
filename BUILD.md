# TapeOut Forge: scope, rules and build plan (single source of truth)

Working name: change it in one place (`config/name.ts`).
Built for the X Layer TapeOut Accelerate hackathon (Oct 16 to Dec 7 2026, 23:59 UTC).

If you are an AI coding agent reading this file: do the work in "PHASE 0" and "PHASE 1" only,
then stop and report. Follow every rule below.

---------------------------------------------------------------------------------------------

## 0. WHY THIS PROJECT IS DIFFERENT (read first, applies to every decision)

1. It EXTENDS TapeOut. It is infrastructure for other TapeOut builders (a compiler, a verifier, a
   registry). It is NOT a consumer app that merely calls circuits. If any step starts drifting
   toward "an app that uses TapeOut circuits for some other business", stop and report the drift.
2. Do not pivot. Do not propose new product ideas. If something is blocked, report the blocker
   and the smallest workaround. Do not rebuild scope.
3. Honest claims only. Mark every fact VERIFIED (source URL / tx / log) or UNVERIFIED. Never
   invent chain data, ABIs, addresses, fee numbers, task values or results.
4. Chain access is READ-ONLY (eth_call, eth_estimateGas). Never ask for, read, print or commit a
   private key. No transactions, no spending, no wallet connections, no submissions to any
   third-party service unless the maintainer explicitly says so in this session.
5. Only work completed after Oct 16 2026 counts for the hackathon. Keep `docs/REUSED.md` (what
   was carried over from earlier projects) and `docs/NEW.md` (append one line per feature built).
   Small commits, one per numbered step, so history proves when work was done.
6. Never write "chip", "taped out to silicon" or "fabricated" without the qualifier in section 7.
7. Keep every chain constant (gas, fees, unit prices, RPC URLs, addresses) in config files.
8. Use few tokens: small files, no large installs beyond what is listed, no long explanations.
9. If this file conflicts with what you observe, stop and report the conflict; do not guess.

---------------------------------------------------------------------------------------------

## 1. WHAT WE ARE BUILDING

A compiler for TapeOut circuits on X Layer: it takes a spec or an existing netlist and returns the
cheapest or shallowest provably equivalent version, tapes it out with an onchain proof, and can
export a tapeout-ready silicon layout.

Users: circuit builders and FabX Proof-of-Design (PoD) miners on X Layer; contracts that depend
on a circuit and want a proof they can check; FabX and processor creators as ecosystem partners.

Value to X Layer: a shared registry of best-known verified circuits, more tape-out volume,
DeWEB-hosted tooling, equivalence proofs that raise trust in circuits other contracts rely on,
and a verifiable path from onchain circuit to open-source silicon. Gas on X Layer is cheap, so
do NOT claim large gas savings; the value is cost, score, trust and reach.

Non-goals: consumer app, marketplace, token, MCP server (TapeAPI already ships one), Hot-Path
Compiler, any claim that "any circuit becomes a chip".

---------------------------------------------------------------------------------------------

## 2. HACKATHON RULES (VERIFIED from the official X Layer TapeOut Accelerate page)

- Event Oct 16 to Dec 7 2026, submit by Dec 7 23:59 UTC (marked provisional).
- Existing projects eligible, but only work completed during the event is judged.
- Must use TapeOut circuits, contracts or onchain data on X Layer, or run on X Layer DeWEB, and
  provide the addresses. Circuit projects submit processor address and circuit ID. Websites, apps
  and tools submit an access link and explain which TapeOut ecosystem features they use.
  Interfaces and computation may run offchain. No own processor required. No revenue required.
- Description must cover: product, target users and how to reach them, revenue model, why users
  would pay and keep using it. Demo video up to 3 minutes.
- Judging: user value and commercial potential; innovation; ecosystem integration (DeWEB, FabX,
  TapeCode, TapeKit, TapeSend; none required); product readiness and user experience.

---------------------------------------------------------------------------------------------

## 3. TAPEOUT FACTS

Netlist format (source: public reverse-engineered spec + TAP-20 draft review; VERIFY on chain):
- Signals are u24: 0 = const 0, 1 = const 1, 2..1+nIn = inputs, then one signal per gate in order.
- Gates are in topological order; a gate may only reference lower signals (contract reverts
  "NAND: future signal" otherwise).
- NAND = 0x00 | u24 a | u24 b (7 bytes). LATCH = 0x01 | u24 d (4 bytes).
  REF = 0x02 | addr20 | u64 id | u8 nIn | u8 nOut | nIn x u24 (31 + 3*nIn bytes). Big-endian.
- The last nOut signals are the outputs. Treat "outputs must not feed internal gates" as a
  constraint (seen in a public studio DSL): duplicate a gate if an output is also needed inside.
- The contract appends 2 buffer NANDs per output at tape-out. Model them separately.
- eval(uint256 id, bytes inputs) returns bytes; bit0 = first pin; selector 934d06ea.

Cost model (MEASURED by a research agent on X Layer; re-verify): eval gas about 43,783 fixed plus
about 1,952 per gate, fitted over 4 circuits on processor
0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355. BNB's figure (about 2,317 per gate) differs, so
these are per-chain config. Fees seen on that processor: tape-out 0.0013 OKB, 0.0001 OKB per NAND
transistor, 0.00066 OKB protocol fee; processor creators set their own unit prices.

FabX PoD scoring (VERIFIED on fabx.tech/en/pod/formula and via api.fabx.tech, reported by a
research agent; re-verify before relying on it):
- H = (b* x F + K_task x q) x P ; q = clamp(C_ref / C, 1/4, 4) ; C = A x max(d,1)^3 ;
  A = g + 6s (g = NAND gates, s = LATCHes, d = longest combinational path). REF is ineligible.
- Task bank: 100 tasks (GC-001 to GC-100; 30 easy, 50 medium, 20 hard; 54 combinational, 46
  sequential) with refNand, refLatch, refDepth, area, Cref, runGas.
- Test vectors are public and fixed. No commit-reveal on circuit content; only a tie-break
  commitDesign for exact cost ties. Claim-time verification samples 3 or more vectors, backed by
  a permissionless, no-stake challenge mechanism.
- Winner-take-the-bonus: only the single lowest-cost design per (task, processor) earns the
  K_task x q bonus; everyone else gets burn-only hashrate.
- F, n, m and K_task are UNDEFINED publicly. Forge reports C and q (given a Cref) ONLY. It never
  reports hashrate H or $FAB amounts as fact.
- Addresses: FAB-Genesis NFT 0xBe6f94115D32f3AC3252bc4626573e739bEeb714 (confirmed by a decoded
  call). The FAB_TST processor 0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6 is only
  correlation-matched (multiplier 6); do not use it in any submission until explicitly confirmed.

Known open check: Task 8 (3-input majority) has Cref 1728 = 8 x 6^3, which equals our 6-NAND MAJ3
counted WITH the 2 output buffers (8 gates, depth 6). Counted without buffers the same netlist is
6 gates, depth 4 (C = 384, q = 4). Which convention FabX uses decides whether we win or tie.
Step 1.10 resolves this from data. Do not claim a result before it does.

---------------------------------------------------------------------------------------------

## 4. COMPONENTS

1. core (TypeScript): netlist parse/serialize/flatten-REF; truth table and And-Inverter Graph;
   optimizer with objectives area | depth | balanced and a Pareto front; stop at the q cap;
   exact-synthesis library for 4 inputs or fewer (222 NPN classes, precomputed offline);
   equivalence = exhaustive up to 20 inputs, SAT miter above that; LATCH handled by cutting at
   latches (Q = pseudo-input, D = pseudo-output) plus multi-tick step simulation; cost and C/q
   report.
2. chain (read-only): cross-check a local simulation against live eval().
3. contracts (Foundry, ownerless, later phase): ForgeRegistry maps specHash to the best verified
   circuit (processor, circuitId, gates, depth, proofHash, submitter). Anyone may replace it with
   a strictly better verified circuit. For 6 inputs or fewer the contract verifies equivalence
   itself by calling processor.eval on every row against a stored truth table (measure gas before
   fixing the limit); larger circuits are marked "offchain-proof" (attestation only). Verify the
   processor ABI (netlist, circuitInfo, eval) on the deployed contract before coding.
4. watchtower (later phase): exhaustive checker that finds counterexamples against circuits that
   pass sampled vectors but fail the full public vector set. Whether challengers are rewarded is
   UNKNOWN; read the challenge mechanics first and report.
5. app (later phase): static web app hosted on X Layer DeWEB (research the TapeKit/DeWEB publish
   flow first), plus CLI and HTTP API.
6. silicon export (stretch): see section 7.

---------------------------------------------------------------------------------------------

## 5. REVENUE (UNVALIDATED; needs at least one real builder conversation before the demo)

Because vectors and circuits are public and only the lowest cost wins, a one-off optimization
has little pricing power once many people have the tool. Value to sell: coverage and speed (batch
runs across all tasks), monitoring for new tasks and beaten incumbents, registry listings, a
paid API/CI tier for large circuits, verified-optimization jobs for teams, and watchtower
service if challenges turn out to be rewarded.

---------------------------------------------------------------------------------------------

## 6. TESTS REQUIRED BEFORE PHASE 1 IS "DONE"

- The 12-NAND MAJ3 netlist below optimizes to 6 NAND or fewer, with exhaustive equivalence.
- Round-trip parse/serialize on all example netlists; fuzz test on random 3 to 6 input truth
  tables: every optimized result is exhaustively equivalent and format-valid.
- Benchmarks (4-bit adder, 4-bit comparator, 2:1 and 4:1 mux, parity): gates and depth under each
  objective in docs/BENCH.md; state honestly whether depth beats area on C for any benchmark.
- If the RPC is reachable: local simulation equals eval() on circuits 1, 3, 4, 5 of processor
  0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355. If not, write the exact command for the
  maintainer to run and mark the test PENDING.

MAJ3 test netlist (12 NAND; inputs a=2, b=3, c=4; gate i has output signal 5+i):
 5=NAND(2,3) 6=NAND(2,4) 7=NAND(3,4) 8=NAND(5,5) 9=NAND(6,6) 10=NAND(7,7)
 11=NAND(8,8) 12=NAND(9,9) 13=NAND(11,12) 14=NAND(13,13) 15=NAND(10,10) 16=NAND(14,15)
Expected: output 1 iff at least two inputs are 1.
Hand-derived 6-NAND version: n5=NAND(a,b) n6=NAND(a,c) n7=NAND(b,c) n8=NAND(n5,n6)
n9=NAND(n8,n8) y=NAND(n9,n7). Treat as an upper bound; exact synthesis may do better.

---------------------------------------------------------------------------------------------

## 7. SILICON EXPORT (stretch phase; NOT part of Phase 0 or 1)

- Emit structural Verilog with LATCH as a register (`always @(posedge clk)`), NOT `always_latch` - TAP-02s VERIFIED LATCH semantics (unconditional every-tick update, no enable pin) do not match a level-sensitive gated latch at all; `always_latch` was the original plan here and is WRONG, corrected 2026-10-19 after packages/silicon discovered this conflict for real while building the exporter. Plain inferred latches also fail Verilator
  lint; shown in a feasibility spike), wrap in the Tiny Tapeout ttsky template top module
  (8-bit in/out), generate a repo and info.yaml, and run the GitHub Actions flow. Record the
  layout (GDS) hash.
- Feasibility spike (agent report; re-check the green run): github.com/davieslennox0/maj3-silicon-spike.
  MAJ3 mapped to 26 cells; a 1-bit latch mapped to sky130_fd_sc_hd__dlxtp_1.
- Supported: combinational circuits under about 500 cells, no REF (flattened first), LATCH only
  with a documented reset convention. Everything else is refused with a reason.
- Order handoff: the output is a ready-to-submit repo plus a verified layout, with the shuttle
  name and close date read from tinytapeout.com/runs at export time. Status field:
  exported | submitted | fabricated. This project stays at "exported".
- REQUIRED WORDING (README and demo): "Tapeout-ready export. We have not ordered fabrication.
  Ordering is a separate paid step that the circuit owner completes on Tiny Tapeout. We do not
  claim a physical chip exists."

---------------------------------------------------------------------------------------------

## 8. TIMELINE (cut from the bottom when late)

W1-3 core engine and tests | W4 registry and tape-out on X Layer | W5 FabX scoring input, watchtower,
web app on DeWEB, CLI/API | W6 silicon export (cut first) | W7 demo video, README, submission form.

---------------------------------------------------------------------------------------------

## PHASE 0: scaffold (about 10 minutes)

0.1 `git init`; TypeScript monorepo (pnpm or npm workspaces): packages/core, packages/cli,
    packages/chain; contracts/ (empty), apps/web (empty), silicon/ (empty). Vitest. MIT license.
0.2 docs/REUSED.md (template: "Carried over from earlier projects: ..."), docs/NEW.md (append-only
    log), docs/LIMITS.md (copy the REQUIRED WORDING from section 7).
0.3 config/name.ts (product name); config/chains.ts (X Layer, chain 196, RPC https://rpc.xlayer.tech);
    config/cost.ts: gasFixed=43783, gasPerGate=1952 (marked MEASURED, per-chain), unit price and
    tape-out fee fields (null by default).
0.4 GitHub Actions workflow running install and tests on push.
0.5 First commit.

## PHASE 1: core engine (packages/core, cli, chain)

1.1 netlist.ts: types Signal, NAND, LATCH, REF; parse(bytes) and serialize(netlist) exactly per
    section 3 (u24/u64 big-endian). Validate topological order, outputs last, outputs not feeding
    internal gates (duplicate if needed). Round-trip tests.
1.2 simulate.ts: exhaustive evaluator (bit-packed inputs/outputs, bit0 = first pin) and multi-tick
    step simulation for LATCH. LATCH semantics are UNVERIFIED: implement initial state 0, update
    on tick, as a parameter, and document the assumption.
1.3 truthtable.ts and aig.ts: AIG from a truth table or netlist; structural hashing; depth
    (longest combinational path to an output or latch input).
1.4 exact.ts: exact synthesis for 4 inputs or fewer, minimum NAND2. Precompute a JSON library for
    all 222 NPN classes offline (script in packages/core/scripts, output committed). If too slow,
    ship 3 inputs and log the limit.
1.5 optimize.ts: objectives area | depth | balanced; Pareto front (gates vs depth); rewriting and
    depth balancing for larger functions; stop at C <= Cref/4 when a Cref is supplied. Optionally
    call yosys/abc (`abc -g NAND`) if on PATH; never require it.
1.6 equivalence.ts: exhaustive up to 20 inputs; above that a SAT miter (cadical/minisat if on PATH,
    else a JS SAT library; log which). Never mark a result "verified" unless one of these passed.
1.7 cost.ts: gates (user gates and the 2 buffer NANDs per output shown separately), depth, transistor
    count, tape-out cost in OKB if prices are set, gas per eval = fixed + perGate x gates, and FabX
    C = A x max(d,1)^3 and q = clamp(Cref/C, 0.25, 4). Support --count-buffers. Never output H or $FAB.
1.8 cli: `forge optimize <file> --objective area|depth|balanced [--cref N] [--count-buffers]` reading a
    truth table (hex/CSV), a boolean expression or a netlist hex; prints before/after (gates, depth,
    gas, C, q), the verification method used, and writes the netlist hex.
1.9 chain (read-only): `forge verify-onchain --processor <addr> --id <n> --inputs <hex>` compares the
    local simulation with eth_call to eval(uint256,bytes). Also fetch netlist(id) if that function
    exists; if its ABI cannot be confirmed, log UNVERIFIED and skip.
1.10 FabX replay (read-only; no wallet, no submissions, no claims). Input: docs/fabx-tasks.json (the
    100-task bank, supplied by the maintainer; if absent, fetch the bank read-only from
    api.fabx.tech and save it, logging the endpoint).
    - Determine the counting convention: for at least 3 tasks recompute area and depth from the
      on-chain reference netlist and check whether FabX's area/depth include the 2 output buffers.
      Report which convention reproduces Cref.
    - For every task build the spec, run the optimizer under all three objectives, compute C and q
      under the matched convention.
    - Write docs/FABX-REPLAY.md: table sorted by margin (task, difficulty, comb/seq, Cref, best C, q,
      objective), with counts: tasks beaten, tasks at the 4x cap, tasks where the reference already
      looks optimal, tasks skipped and why. Report Task 8 explicitly: reference refNand/refDepth/area,
      and whether our 6-NAND MAJ3 beats, ties or loses.
    - State plainly if the optimizer cannot beat most references; that is a valid result.

## WHEN PHASE 1 IS DONE

Print: what passes, what is UNVERIFIED, the benchmark table, the FabX replay summary, and the three
biggest risks you saw. Then STOP. Do not start the registry, watchtower, app or silicon phases.

## RESUMING AFTER A CUTOFF

Read this file and docs/NEW.md, then continue from the first unfinished numbered step.

## RESULT OF PHASE 1 (recorded)
- Task 8: Cref=1728 is reproduced by the WITH-buffers convention (A=8, d=6). Our 6-NAND MAJ3 TIES the reference (q=1). It does not beat it. Do not claim otherwise anywhere.
- Optimizer gap: MAJ3 came out at 8 gates, not <=6. Only duplicate removal + Shannon decomposition exist. Real Boolean minimization is the blocker. No new features until it is fixed.

## PHASE 1b: real minimization and full replay (do this next; then STOP)
1b.0 Check `df -h /`. If under 5 GB free, report and stop; do not delete anything of mine. Prefer a clean machine (VPS or GitHub Codespace).
1b.1 ABC integration. Install yosys/abc if missing (report size first). Write a genlib with NAND2 (area 1, delay 1) and INV (area 1, delay 1; an inverter is emitted as NAND(x,x)). Run several flows (strash; resyn2 variants; dch; map for area and for delay), keep the best per objective. NEVER trust ABC output: re-verify every result with equivalence.ts, and reject on any mismatch.
1b.2 Exact synthesis for <=4 inputs via SAT (cadical/pysat), per NPN class (222), computing both min-gate and min-C (gates x depth^3, with-buffers convention) variants. Commit the JSON library. Use it to settle: what is the true minimum for MAJ3, and does a 5-gate version exist? Report the proof status (UNSAT at r-1) for MAJ3.
1b.3 Cut rewriting: replace 4-input cuts in larger netlists with the exact library when C improves, iterate to a fixed point, re-verify each step.
1b.4 Replay coverage: build specs from the ON-CHAIN reference netlists (read-only), simulated locally; do not parse gate names. Combinational tasks: optimize and compare C under the matched convention. Sequential tasks: optimize the combinational logic between latches only and compare. Target all 100 tasks; list each skipped task and why.
1b.5 Independently validate every "beat": re-simulate candidate vs reference over the full input space (or a SAT miter above 20 inputs), under the matched convention. Report invalid ones loudly.
1b.6 LATCH semantics: scan circuits on processor 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 (read-only, circuitInfo nState>0). If one exists, compare step()/eval against local simulation and fix the model. If none, say UNVERIFIED.
1b.7 Harden tests: differential fuzz (random truth tables 3-6 inputs, random netlists up to 200 gates) comparing exhaustive simulation vs optimizer output vs ABC; netlist mutation tests; seeds logged; run in CI.
1b.8 Update docs/FABX-REPLAY.md: counts over all 100 tasks (beats / ties / loses / skipped), top 10 margins, share of tasks at the 4x cap, and median q. Then print the 3 biggest risks and STOP.

## RESULT OF PHASE 1b (recorded)
- MAJ3 minimum PROVEN: 6 gates, depth 4 (SAT, UNSAT at 5). On-chain FAB_TST id=65 is already exactly this. Easy-task references are likely optimal; do not claim wins there.
- CORRECTION: "222 NPN classes" is WRONG for NAND-only cost (negation is not free). Library key = input permutation only, or exact function. n<=3 library is proven; n=4 is optional.
- Replay stuck at 23/100: on-chain circuit ids carry no task id. Use the task bank records instead.

## PHASE 1c (timebox: ~1 week of effort, then STOP and report)
1c.0 Run in the Codespace or VPS (>=5 GB free). Never trust ABC output; re-verify every result.
1c.1 Task bank first. Fetch ONE raw task record from api.fabx.tech (read-only) and print its fields. Report whether it holds a COMPLETE spec (truth table / deterministic function) or only sampled vectors. Replay only tasks with a complete spec. Do NOT fit sampled vectors (that is overfitting, not a valid circuit). List every skipped task with the reason.
1c.2 Optimizer objective = minimise C directly (A*max(d,1)^3, with-buffers convention). Run ABC area and delay flows plus our own rewriting, keep the best by C. The result must never be worse than the input. Re-check the 4-bit adder, comparator, mux, parity and report C before/after.
1c.3 LATCH: get step()/state ABI from the processor's verified source on the explorer or the tapemkt repo (read-only, no guessing signatures). Test on circuit id=49. If still unresolved, say UNVERIFIED and exclude sequential tasks from the replay with a count.
1c.4 n=4 library: one background run, max 2 hours, keyed by input permutation. If incomplete, ship nothing partial and log it.
1c.5 Update docs/FABX-REPLAY.md: over the replayable tasks give beats / ties / loses / skipped counts, the 10 largest margins with independent re-verification of each beat, the share at the 4x cap, and median q.
1c.6 Print the 3 biggest risks and STOP.

## RESULT OF PHASE 1c (recorded)
- 1c.1 task bank spec completeness (VERIFIED, live api.fabx.tech fetch of all 100 tasks' vectors): the 256-vector sample is a COMPLETE deterministic spec only for comb tasks with nIn<=8 (46/100 tasks) - verified by exhaustive residue-class coverage with zero inconsistency. The other 54 (8 comb with nIn>8, all 46 seq) are SAMPLED ONLY (256 random points out of a space up to 2^18 or 2^(nIn*cycles)) - fitting them would be overfitting, excluded per BUILD.md's own rule. See docs/VECTOR-SPEC-CHECK.md.
- 1c.2 ABC integration (yosys-abc, custom NAND2/INV genlib, 3 resynthesis flows, every result re-verified via checkEquivalence before being trusted - never substituted, only added as extra Pareto candidates, so results can only match or beat the prior optimizer): all 5 BUILD.md section-6 benchmarks improved or matched, NONE regressed. 4-bit adder C 3,512,000 -> 1,508,980 (-57%); 4-bit comparator 1,581,986 -> 77,000 (-95%); 4:1 mux 27,000 -> 4,459 (-83%); 8-bit parity 268,272 -> 128,250 (-52%); 2:1 mux unchanged at 750 (already optimal). New finding: depth objective now genuinely beats area on C for the adder (richer candidate set makes objectives actually diverge, unlike 1b where they were identical). Note: these percentages are against our own naive baselines, not a reference win - never claim otherwise.
- 1c.3 LATCH step()/state ABI: checked both BUILD.md-named verified sources (OKLink explorer: API needs a key we don't have, public page is a JS-only SPA with zero server-rendered content; xm1319/tapemkt repo, deployer of the OrderGuard processor: zero .sol files, and its own demo's PROCESSOR_ABI explicitly has no step() at all, meaning OrderGuard was never used with a LATCH and can't cover FAB_TST's separate mechanism). Remains UNVERIFIED after exhausting both named channels (not from guessing). All sequential tasks are excluded from the replay - already required anyway per 1c.1 since zero seq tasks have a complete spec regardless of step()'s status.
- 1c.4 n=4 library NOT built: per-class SAT too slow (75/3984 permutation-only classes in 16 min, ETA >13h; killed immediately on request rather than waiting for the 2-hour watchdog). Nothing partial shipped - no file was ever written. Do NOT retry this strategy (tried twice now, NPN-keyed and permutation-keyed). BUILD.md's permutation-only correction is still mathematically sound (lossless expansion = every member proven, not just upper-bound) - the blocker is pure compute time, not the method. optimize.ts's exact.ts stays at EXACT_SYNTHESIS_MAX_INPUTS=3; n=4+ relies on Shannon decomposition composition plus the now-integrated ABC pass.
- 1c.5 full honest replay (packages/core/scripts/fabx-replay-v2.ts, built from REAL fetched vectors - no guessed gate names, sidesteps 1b.4's on-chain-circuit-ID-mapping blocker entirely): across all 46 complete-spec tasks, every result independently re-derived and bit-compared against the fetched truth table before being counted (0 mismatches). **beat 22/46, tie 11/46, lose 13/46, skip 0/46.** Top margin: task 12 (GC-012, 4-to-2 one-hot encoder+error detector) at the 4x q-cap, Cref=496,000 vs our C=28,672. Only 1/46 hits the cap. Median q=1.000 (margins mostly small). Task 8 (MAJ3) is a confirmed, independently re-verified TIE (C=1728=Cref) - not a beat, as flagged back in Phase 1's own result.
- UNVERIFIED (carried forward): LATCH step() ABI; F, K_task, n, m; the with-buffers counting convention beyond Task 8.

### Three biggest risks (Phase 1c)
1. n=4 (and beyond) still has no proven-exact synthesis - the optimizer's own from-scratch path tops out at 3-input exact blocks; everything larger relies on Shannon-decomposition composition plus ABC's heuristic resynthesis (verified-correct, but not proven-minimal). 13/46 real tasks still lose outright even with ABC's help, and those are the ones a true n=4+ exact/near-exact method would most likely help.
2. Core protocol unknowns remain genuinely unresolved, not just un-attempted: LATCH step()'s ABI (blocks ANY sequential-task replay, 46/100 tasks, permanently until someone can read the actual deployed FAB_TST bytecode or source) and FabX's hidden reward variables (F, K_task, n, m - still never public), so no payout can be predicted even where C/q beats a reference.
3. The compute-time wall hit twice now (1b.2's NPN attempt, 1c.4's permutation attempt) on the exact same n=4 problem size suggests this specific approach (direct SAT per class, however keyed) may need a fundamentally different method (e.g. a real cut-based/structural technique, or accepting ABC's heuristic output as the practical ceiling) rather than a third retry at timeboxing the same brute-force strategy harder.

## PHASE 2 (read-only and dry-run; then STOP)
RULES (extra): No broadcasts. No transactions. No keys. Fork mode (anvil --fork-url) is allowed because it is read-only. Never invent addresses: find them from docs/repos and log the source.
2.0 Beat analysis: from the replay give the distribution of q among the 22 beats (min/median/max), a breakdown by task difficulty tier and nIn, and the list of the 13 losses with nIn and gate count vs Cref. State plainly how much of the headline is small margins.
2.1 Independent re-verification: for each of the 22 beats re-check equivalence against the task spec with a SECOND tool (yosys/abc `cec` or an independent Python truth-table check, not our TS code). Any disagreement is a bug: stop and report.
2.2 Convention check: find every place the with-buffers convention (2 buffer NANDs per output, A=g+6s) could differ from FabX's checker. Look for evidence in api.fabx.tech or the on-chain circuitInfo fields for a circuit of known C (FAB_TST ids). Report which tasks' beat/tie/loss status would flip under the no-buffers convention.
2.3 Contracts (Foundry, ownerless): ForgeRegistry (specHash -> best verified circuit: processor, circuitId, gates, depth, proofHash, submitter; replace only with strictly better verified). On-chain verification for n<=6 by calling processor.eval on all rows against the stored truth table; larger n = attestation only. First verify the processor ABI (eval, circuitInfo, netlist) against the deployed contract on a fork, log the source for every address. Tests: rejects non-equivalent submission, rejects non-improvement, accepts improvement. Measure gas for n=3..6 on the fork; write docs/GAS-VERIFY.md and set the n limit from the numbers.
2.4 Tape-out dry run: script that builds the tape-out call for a netlist, runs eth_estimateGas on the fork, and prints calldata, estimated gas and the fee in OKB from config. Never sends. Output a table for the top 5 beats (by q) and 3 representative ties: tape-out cost per circuit and total.
2.5 Update docs/NEW.md, README skeleton (product, users, revenue placeholders, the required LIMITATION wording), push. Print: what passes, what is UNVERIFIED, 3 biggest risks. STOP.

## RESULT OF PHASE 2 (recorded)
- Beats: 22/46, q min 1.075, median 1.926, max 4.0. All 22 re-verified by an independent Python simulator, 0 disagreements. With-buffers convention confirmed on 3 primitive tasks.
- ForgeRegistry built and ABI-verified on a fork; verify gas n=3..6: 342,856 / 690,567 / 2,190,727 / 7,556,637. MAX_ONCHAIN_VERIFY_INPUTS=6.
- Mint blocker was a test-account artifact (EIP-7702 delegation on anvil's dev address). Sampled only 4 real addresses.
- LATCH semantics reconciled on main after merge (forward feedback allowed; step(uint256,bytes,bytes)). aig.ts depth claim UNVERIFIED.

## PHASE 3 (user-facing; prepare, never spend; then STOP)
RULES (extra): No transactions on any real chain. Deploy and tape-out steps are written as scripts + a docs/USER-STEPS.md checklist for ME to run with my own key. Never print "$FAB" or reward amounts; show q and C only.
3.0 Research first: the X Layer DeWEB / TapeKit publish flow (official docs only; log sources; mark UNVERIFIED anything not found). Decide how a static app is deployed and what 'run on DeWEB' requires. Report before building.
3.1 apps/web: static app (no backend), the TS engine running in the browser. Inputs: truth table / boolean expression / netlist hex. Outputs: before/after table (gates, depth, gas, C), q against a user-entered Cref, equivalence method used, downloadable netlist hex. Plus a 'Verified improvements' gallery from the replay: for each of the 22 beats show task, our C vs Cref, q, netlist hex, the two verifier names, and a copy button for the tape-out calldata. Plus a read-only registry view (specHash -> best circuit) that works once the registry address is in config; show 'not deployed' otherwise.
3.2 CLI polish: 'forge replay', 'forge optimize', 'forge verify-onchain', 'forge calldata' (dry-run only). Help text, examples, exit codes. The CLI is the place where ABC runs; say in the README that the browser build does not include ABC.
3.3 README.md: product, target users and how to reach them, revenue model (marked UNVALIDATED), why users pay, what is verified vs UNVERIFIED, the required silicon LIMITATION wording if the silicon export is mentioned at all, and the honest limits (n>3 exact synthesis missing; 13/46 lose; sequential tasks not replayed; F/K_task unknown).
3.4 docs/SUBMISSION.md: draft answers for every form field in the hackathon rules (product, users, how to reach them, revenue, why users pay, TapeOut features used, addresses), with TODO markers for anything that needs a deployed address or tape-out id.
3.5 docs/DEMO.md: a 3-minute script with timestamps, the exact commands/clicks, and what to show on screen; lead with the replay result and the independent verification.
3.6 docs/USER-STEPS.md: ordered checklist for me: deploy registry (command, expected gas, cost), tape out chosen circuits (calldata from 3.2, fee in OKB), register them, publish the app on DeWEB, make the repo public. Each step says what could go wrong.
3.7 Tests + CI green. Update docs/NEW.md. Print what passes, what is UNVERIFIED, 3 biggest risks. STOP.

## RESULT OF MERGE (recorded)
- latch-reconcile merged into main (f53b2f4). 58/58 tests, replay unchanged (22/11/13), Python re-verification 0/22 mismatches.
- KNOWN GAP: the independent verifier script depended on a /tmp intermediate that was lost; it was rebuilt from the documented task list. Make it self-contained (step 3.0b).
- TOOLING: 'forge install --no-commit' still stages .gitmodules/lib in this Foundry version. Check 'git status' before every commit.

## PHASE 3 ADDITION
3.0b Make the independent verifier self-contained and re-runnable by anyone: scripts/verify_independent.py reads a committed tasks.json snapshot (task id, spec, Cref, our netlist hex) from the repo, needs only Python stdlib, takes no network, prints one line per task plus a summary, exits non-zero on any mismatch. Document the one command in the README. Commit the snapshot with the date and source URL it came from.

## PHASE 4: silicon export (stretch; then STOP)
RULES (extra): No ordering, no payment, no Tiny Tapeout submission, no third-party accounts. Run the open-source flow only in a repo we own, on GitHub Actions. Status never goes beyond 'exported'. Required wording wherever silicon is mentioned: "Tapeout-ready export. We have not ordered fabrication. Ordering is a separate paid step that the circuit owner completes on Tiny Tapeout. We do not claim a physical chip exists." Never write 'chip' or 'taped out to silicon' unqualified.
4.0 Re-verify the spike: open github.com/davieslennox0/maj3-silicon-spike, confirm the latest Actions run is green and what it produced (cell count, GDS artifact). Report what you actually see; mark anything unconfirmed UNVERIFIED. Read tinytapeout.com/runs for the open shuttles and their close dates; log them with the date checked.
4.1 packages/silicon (or silicon/): netlist -> structural Verilog. Flatten REF first. NAND as a primitive expression. LATCH as a register (always @(posedge clk)), NOT always_latch - corrected 2026-10-19, see section 7s note above and docs/NEW.md. Document the latch reset convention in the generated header comment. Supported: combinational, up to about 500 cells, flattened. Everything else: refuse with a specific reason (too large, unflattenable REF, latch without a reset convention, too many pins for the 8-bit in/out wrapper). Never emit something unverified.
4.2 Wrapper in the Tiny Tapeout ttsky template top-module shape (8 inputs, 8 outputs, plus bidirectional/enable pins per the template). Map circuit pins to the template's ui_in/uo_out; unused outputs tied low. Generate info.yaml, src/ and the test scaffold from the template, with the project name and a description that includes the limitation wording.
4.3 Equivalence of the Verilog: simulate the generated Verilog with iverilog or Verilator for all input rows (or the sampled set above 12 inputs) and compare with our netlist simulation. Fail loudly on any mismatch. Add tests with the 6-NAND MAJ3 and two of the 22 verified circuits that fit the template.
4.4 'forge export-silicon <netlist|task>' CLI command: writes a ready-to-push repo directory and prints: cell estimate, pin map, status 'exported', the limitation text, and the next-step list for the owner (push repo, run Actions, submit on Tiny Tapeout, pay). It never pushes anywhere by itself.
4.5 Actions run: with the spike repo or a new repo of ours, push one exported circuit and run the GitHub Actions flow. Record the run URL, cell count, and GDS hash. If the run fails, report the log tail; do not hide it.
4.6 Web: wire the 'Silicon path' section (apps/web) to real output only after 4.5 is green: show the exported circuits with their run links and hashes. Until then it stays labelled 'In development'.
4.7 Docs: docs/SILICON.md (what is and is not claimed, supported limits, how an owner orders), update README/SUBMISSION/DEMO with the exact wording, and docs/NEW.md. Print what passes, what is UNVERIFIED, the 3 biggest risks. STOP.

## PHASE 5: go-live preparation (everything except submission; then STOP)
GLOBAL RULES: single agent, one step at a time, checkpoint each step to docs/NEW.md with a small commit, resumable (on restart, read docs/NEW.md and continue from the first unfinished step). Keep outputs lean (usage is limited). NEVER broadcast a transaction, never ask for, read, print, log or commit a private key, never touch fanside.xyz or any site block other than forge.fanside.xyz. Scripts that could spend are DRY-RUN by default; broadcast needs --broadcast plus a typed confirmation of total OKB, contract and chain id 196, and a spend cap from config. Mark anything unverified as UNVERIFIED.

5.0 GATE: read docs/PROCESSOR-EVIDENCE.md on main. If it does not exist yet, stop and say 'waiting for processor evidence'. If its verdict is not CONFIRMED (a real claim transaction links a processor to PoD mining), stop after steps 5.1 and 5.2 and print the two options (confirmed-processor path unavailable; own-processor path via the Processor Factory, with its fees read from official docs) for the owner to choose. Never guess a processor address. Cite the source for whichever address is used.
5.1 Leak fix: add apps/web build flag REVEAL_NETLISTS (default false). False: gallery keeps task, name, in/out, reference C, our C, q; netlist and calldata buttons replaced by 'Published after tape-out'; netlist hex and calldata are stripped from the built bundle at build time. Verify by grepping dist/ for the hex of GC-012 and GC-046 (must find none). Redeploy to forge.fanside.xyz with scripts/deploy-web.sh (back up the Caddyfile, caddy validate before reload, compare fanside.xyz before/after). Document the flip in USER-STEPS.md.
5.2 Read-only health check of fanside.xyz from the VPS: curl -sI from the VPS itself, caddy status, whether a site block for fanside.xyz exists, certificate validity. Report only; change nothing.
5.3 (only if 5.0 passed) Scripts on a branch deploy-scripts: scripts/check-wallet.sh (read-only: balance, nonce, OKB needed vs held), scripts/deploy-registry.sh, scripts/tapeout.sh <task> (mint transistors if needed, tape out, parse circuit id, append processor, circuit id, tx hash to docs/TAPEOUTS.md), scripts/register.sh <task>. Keys only via a keystore account name or KEY_FILE read by cast; never --private-key on the command line. Test everything end to end on an anvil fork with an impersonated test address, never the real chain. Measure the registry's deployment gas on the fork and record it. Spend cap = costs from docs plus 20%. Re-check the live transistor supply and cap (read-only) and the fee parameters on the chosen processor before fixing the numbers.
5.4 docs/GO-LIVE.md for the owner, exact commands in order: create a NEW wallet with cast wallet import (interactive), fund amount (computed), check-wallet, deploy-registry dry-run then broadcast, tape out GC-012 first, then GC-046, 045, 043, 044, register each, flip REVEAL_NETLISTS=true and redeploy, then make the repo public (gh repo edit ... --visibility public --accept-visibility-change-consequences). For each step: expected cost, what could go wrong, how to verify success on-chain.
5.5 Merge the deploy-scripts branch into main only after: tests green (vitest and forge), CI green, a grep of the branch for key material finds nothing, and every script defaults to dry-run. Gated merge, no force-push, no deletions.
5.6 Low priority, time-boxed to what is cheap: correct the LATCH rule in BUILD.md (register, not always_latch), record the Tiny Tapeout template version in the silicon export metadata, add the missing test scaffold so the generated silicon project passes every CI job if that is straightforward (otherwise leave the 'layout generated' wording).
5.7 Print: what is done, what is UNVERIFIED, the exact next command for the owner, the 3 biggest risks. STOP. Do not touch SUBMISSION.md or DEMO.md.

## PHASE 5 ADDENDUM (processor CONFIRMED: 0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6, FAB_TST; mining/reward contract 0x4F6A2312D80753BdAFd35DDB1Bf4BB14C43F8265)
The cost table and calldata in docs/ were priced against OrderGuard (0x57F3...). They are STALE. Do not reuse them.
5.3a Re-price against FAB_TST, read-only: tape-out function ABI and fee parameters (unit price, tape-out fee, protocol fee), transistor mint path and any gating, from the processor itself (eth_call) and the real tape-out transactions found in docs/PROCESSOR-EVIDENCE.md. Rebuild calldata for the 5 beats (GC-012, 46, 45, 43, 44) for THIS processor and re-run the fork gas measurement. Write docs/COSTS.md with the new totals and mark the old table SUPERSEDED.
5.3b Claim path, read-only, before any script that spends: from the real claim transactions in docs/PROCESSOR-EVIDENCE.md, decode the claim function on the mining contract (ABI, how a claim identifies the TASK, what proof or vectors are needed, any eligibility such as holding a FAB-Genesis NFT or a stake, any fee, any challenge window or cooldown). Confirm every decoded field against at least two real claims. Write docs/CLAIM-PATH.md. If eligibility requires something the owner lacks, or the claim cannot be made for our circuits, say so plainly and stop that step.
5.3c Add scripts/claim.sh <task> (dry-run by default, same broadcast gating) only if 5.3b is fully understood. It must never claim a circuit that is not strictly better than the task reference, and never print reward amounts.
5.3d Order check: tape-out first, claim second, per task, one at a time, verifying each on-chain before the next.

## PHASE 6 RESULT (recorded)
- FAB_TST processor 0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6 is CONFIRMED but its transistor token (0xBe6f...eb714, same as FAB-Genesis) is exhausted: 1,000,000/1,000,000. No acquisition route found (trace incomplete: RPC 100-block limit). FabX PoD is NOT pursued; listed as a limitation.
- The 5 transactions in PROCESSOR-EVIDENCE.md are start() task-submission calls, not claims. Claim path is unknown.
- OrderGuard (0x57F3...) uses a separate transistor token (0x8e71...9D9e) with headroom.

## PHASE 7: retarget go-live to the hackathon path (then STOP)
RULES unchanged: read-only on the real chain, simulation only on an anvil fork, no keys, no broadcast, scripts dry-run by default, guards before any send, never touch other sites. Resumable via docs/NEW.md.
7.1 Make the target processor configurable (config/chains.ts), default OrderGuard. Keep FAB_TST constants with a note. Every broadcast script guard checks eth_getCode non-empty AND name() equals the string read from chain for the chosen processor at config time (record it in config with a source note; do not hardcode labels from the API). Read the live transistor supply and price for the chosen processor's own transistor contract.
7.2 Final circuit list: GC-012, GC-037, GC-050, GC-039, GC-046 (confirm each is still strictly better than its reference; if not, say so and propose a replacement). For each: gates including buffers, transistors needed, fees (mint, tape-out, protocol), fork gas, total OKB; the sum and the headroom left in the token's cap. Write docs/COSTS.md (SUPERSEDES the OrderGuard table and the FAB_TST re-pricing).
7.3 Fork test of the full chain for all five from an impersonated test address: mint, tape out, register in ForgeRegistry. n<=6 circuits must reach verified=true by on-chain eval; GC-046 (8 inputs) must go through the attestation path: report whether it works end to end, and what the registry stores. Record gas.
7.4 Read-only pricing of an own-processor option: Processor Factory address (cite the official source), creation ABI and fee, whether a new processor brings its own transistor token or uses a shared one, and the supply it would have. Document only, build nothing.
7.5 Update docs/GO-LIVE.md and docs/USER-STEPS.md with the final order and the exact funding amount (total plus 20% for gas), and the wallet checklist (new wallet, keystore, no key on the command line). Do not edit SUBMISSION.md or DEMO.md.
7.6 Gated merge to main (tests green, CI green, no key material), then print the exact next commands for the owner and the 3 biggest risks. STOP.

## PHASE 7 RESULT (recorded)
- Final circuits GC-012/037/050/039/046: 0.0447 OKB fees, 349 transistors (9,958 headroom), fork-tested mint -> tape-out -> register. 4 reach verified=true on-chain, GC-046 (8 inputs) is attestation-only. Funding target in docs 0.05364 OKB (total+20%), gas inclusion UNVERIFIED.
- GC-039 register costs 18.19M gas (outlier). These circuits are on OrderGuard: NOT FabX-PoD-eligible; never imply PoD rewards.

## PHASE 8: pre-flight for the owner's broadcast (then STOP)
RULES unchanged: read-only on the real chain, simulation only on a fork, no keys, no transactions, scripts dry-run by default, never touch other sites. Resumable via docs/NEW.md.
8.1 Read-only facts: current X Layer gas price (eth_gasPrice), and whether a transaction of about 19M gas is accepted: test with eth_call and an explicit gas parameter of 20,000,000 against an existing deployed contract, and report any 'gas cap' or 'exceeds' error and the node's behavior. Record the RPC used and the date.
8.2 Funding: compute the total OKB needed = fees + transistor mints + (all gas x gas price x 1.5 safety). Two variants: with GC-039, and with GC-014 instead (price and fork-test GC-014 as a drop-in: mint -> tape-out -> register, report verified flag and gas). Update docs/GO-LIVE.md and docs/COSTS.md: make GC-039 explicitly OPTIONAL and LAST, with the estimateGas check required before sending it; state both funding amounts and whether gas is included.
8.3 scripts/preflight.sh (read-only): checks chain id 196, ACTIVE_PROCESSOR code non-empty and name() matches the recorded string, the transistor token supply headroom for the planned circuits, wallet balance vs the funding amount (address passed as an argument, never a key), gas price, and, if the registry address is configured, its code. Prints PASS/FAIL per item and exits non-zero on any FAIL. Add its use as step 0 in GO-LIVE.md.
8.4 scripts/verify-live.sh <task> (read-only, run AFTER each tape-out/register): fetch circuitInfo and the netlist bytes from the processor and compare byte-for-byte with our netlist hex; evaluate the on-chain circuit against our local simulation on every input row (n<=6) or a fixed sample plus all-zero/all-one (n>6); read the registry entry (verified flag, gates, depth, submitter); print a one-line summary and append a row to docs/TAPEOUTS.md (task, processor, circuit id, tx hashes passed as arguments, verified, date). Test it on the fork against the circuits from the Phase 7 fork run.
8.5 Make GO-LIVE.md a single copy-paste runbook: for each command, the expected output shape, the on-chain check to run, and 'if it fails: stop, do not retry blindly' guidance (a failed tape-out or register can still cost gas). Include the order: preflight, deploy registry, GC-012, verify-live, GC-037, GC-050, GC-046, then optional GC-039 (or GC-014), then flip REVEAL_NETLISTS=true and redeploy, then repo public.
8.6 Gated merge to main (tests, CI, no key material), then print: the funding amount to send, the first three commands to run, and the 3 biggest risks. STOP. Do not touch SUBMISSION.md or DEMO.md.

## PHASE 9: GO-LIVE ORCHESTRATION (prep only, NO broadcast by the agent)
RULES: never broadcast, never read/print/log a private key, mnemonic or keystore password, never use --private-key. Keys only via keystore account name (cast --account). Read-only chain access for the agent. Honest claims, post-Oct-16 work only, never write "chip" unqualified. Do not touch fanside.xyz; only forge.fanside.xyz via scripts/deploy-web.sh.

1. Preflight (read-only): run scripts/preflight.sh --variant gc014. Confirm: chain id 196, OrderGuard code non-empty and name()=="OrderGuard", deployer address 0x319e4047a52cdd1529fc91b26f3c21f84945eadd has >= 0.05462 OKB, no stray key files tracked (git ls-files + secret scan from the wallet-safety phase). Report every PASS/FAIL. If anything FAILs, STOP and report.
2. scripts/go-live.sh <account-name> [--variant gc014|gc039] [--broadcast]: ordered orchestrator. Dry-run by default. Sequence:
   a. preflight
   b. deploy ForgeRegistry (deploy-registry.sh), record the address in config + docs/TAPEOUTS.md header
   c. for each of GC-012, GC-037, GC-050, GC-014, GC-046: tapeout.sh -> register.sh -> verify-live.sh (byte-compare netlist, on-chain eval, append to docs/TAPEOUTS.md)
   d. GC-039 only if --variant gc039, last, only after a fresh live gas estimate that fits the remaining balance
   Behavior: before EACH broadcast print circuit, contract, chain id 196, exact OKB cost and cumulative spend vs the 0.05462 cap; require the owner to type the OKB total. Abort the whole run if cumulative spend would exceed the cap, if any step fails, or if verify-live finds a mismatch. Resumable: skip steps already recorded as done in docs/TAPEOUTS.md (check on-chain state, not just the file). Never retry a failed broadcast automatically.
3. Run `scripts/go-live.sh <account-name> --variant gc014` in DRY-RUN and fix anything it flags. Show the full dry-run output, with per-step and total OKB costs.
4. scripts/finalize-release.sh (read-only dry-run unless --apply): requires every planned circuit to be verified on-chain in docs/TAPEOUTS.md; then sets REVEAL_NETLISTS=true, rebuilds, runs scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile, and prints (does not run) the repo-public command: gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences. Before any visibility change, run the secret scan on full git history and report.
5. Tests for the orchestrator: cap abort, resume-skip, mismatch abort, refuses without typed confirmation, refuses a --private-key flag. Update docs/GO-LIVE.md and docs/USER-STEPS.md with the exact owner commands in order. Commit, gated merge to main (tests + CI green). STOP and print the commands below.

## PHASE 11: NANDOUT CASE STUDY (read-only, NO transactions)
RULES: read-only chain access, no keys, no broadcast, do not modify or re-tape-out anything Nandout owns, honest numbers only, post-Oct-16 work claimed is the analysis and tooling only.
1. Identify Nandout's deployed circuits (contract/circuit ids on the processor it uses; sources: repo davieslennox0 Nandout if present locally, nandout.xyz, on-chain reads). List each with id, inputs, outputs, gate count, processor, and whether the netlist is readable on-chain.
2. For each readable circuit: run forge optimize; verify equivalence with the same checks used for replay (exhaustive for n<=? per existing rule, independent Python verifier scripts/verify_independent.py); record gates before/after, depth, and the estimated mint + gas saving using config/cost.ts. Include circuits where nothing improves.
3. Write docs/NANDOUT-CASE-STUDY.md: table, method, limits, and exact wording that Nandout is an existing project used only as test input; add the entry to docs/REUSED.md.
4. Do not touch apps/web or SUBMISSION.md. Commit docs only, gated merge. Print a 5-line summary: total gates saved, best case, worst case, anything that surprised you. STOP.
