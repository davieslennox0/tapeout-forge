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

- Emit structural Verilog with LATCH as `always_latch` (plain inferred latches fail Verilator
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
- 1c.2 ABC integration (yosys-abc, custom NAND2/INV genlib, 3 resynthesis flows, every result re-verified via checkEquivalence before being trusted - never substituted, only added as extra Pareto candidates, so results can only match or beat the prior optimizer): all 5 BUILD.md section-6 benchmarks improved or matched, NONE regressed. 4-bit adder C 3,512,000 -> 1,508,980 (-57%); 4-bit comparator 1,581,986 -> 77,000 (-95%); 4:1 mux 27,000 -> 4,459 (-83%); 8-bit parity 268,272 -> 128,250 (-52%); 2:1 mux unchanged at 750 (already optimal). New finding: depth objective now genuinely beats area on C for the adder (richer candidate set makes objectives actually diverge, unlike 1b where they were identical).
- 1c.3 LATCH step()/state ABI: checked both BUILD.md-named verified sources (OKLink explorer: API needs a key we don't have, public page is a JS-only SPA with zero server-rendered content; xm1319/tapemkt repo, deployer of the OrderGuard processor: zero .sol files, and its own demo's PROCESSOR_ABI explicitly has no step() at all, meaning OrderGuard was never used with a LATCH and can't cover FAB_TST's separate mechanism). Remains UNVERIFIED after exhausting both named channels (not from guessing). All sequential tasks are excluded from the replay - already required anyway per 1c.1 since zero seq tasks have a complete spec regardless of step()'s status.
- 1c.4 n=4 library NOT built: per-class SAT too slow (75/3984 permutation-only classes in 16 min, ETA >13h, run killed at that point per the 2-hour timebox). Nothing partial shipped - no file was written (the implementation returns before any disk write on timeout). Note for any future attempt: BUILD.md's correction (permutation-only keying, not NPN) IS mathematically sound - lossless input-permutation expansion means every class member would be PROVEN minimal, not just an upper bound like 1b.2's buggy NPN approach - the blocker is pure compute time, not a method flaw. optimize.ts's exact.ts stays at EXACT_SYNTHESIS_MAX_INPUTS=3; n=4+ relies on Shannon decomposition composition plus the now-integrated ABC pass.
- 1c.5 full honest replay (packages/core/scripts/fabx-replay-v2.ts, built from REAL fetched vectors - no guessed gate names, sidesteps 1b.4's on-chain-circuit-ID-mapping blocker entirely): across all 46 complete-spec tasks, every result independently re-derived and bit-compared against the fetched truth table before being counted (0 mismatches). **beat 22/46, tie 11/46, lose 13/46, skip 0/46.** Top margin: task 12 (GC-012, 4-to-2 one-hot encoder+error detector) at the 4x q-cap, Cref=496,000 vs our C=28,672. Only 1/46 hits the cap. Median q=1.000. Task 8 (MAJ3) is a confirmed, independently re-verified TIE (C=1728=Cref) - not a beat, as flagged back in Phase 1's own result.

### Three biggest risks (Phase 1c)
1. n=4 (and beyond) still has no proven-exact synthesis - the optimizer's own from-scratch path tops out at 3-input exact blocks; everything larger relies on Shannon-decomposition composition plus ABC's heuristic resynthesis (verified-correct, but not proven-minimal). 13/46 real tasks still lose outright even with ABC's help, and those are the ones a true n=4+ exact/near-exact method would most likely help.
2. Core protocol unknowns remain genuinely unresolved, not just un-attempted: LATCH step()'s ABI (blocks ANY sequential-task replay, 46/100 tasks, permanently until someone can read the actual deployed FAB_TST bytecode or source) and FabX's hidden reward variables (F, K_task, n, m - still never public), so no  payout can be predicted even where C/q beats a reference.
3. The compute-time wall hit twice now (1b.2's NPN attempt, 1c.4's permutation attempt) on the exact same n=4 problem size suggests this specific approach (direct SAT per class, however keyed) may need a fundamentally different method (e.g. a real cut-based/structural technique, or accepting ABC's heuristic output as the practical ceiling) rather than a third retry at timeboxing the same brute-force strategy harder.
