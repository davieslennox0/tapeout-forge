# New work log (append-only, one line per feature built)

- 2026-10-18: Repo created, BUILD.md + docs/fabx-tasks.json committed.
- 2026-10-18: 0.1 pnpm monorepo scaffold (packages/core, cli, chain; contracts/, apps/web/, silicon/ empty).
- 2026-10-18: Phase 0 complete — docs, config, CI workflow, install+test verified green.
- 2026-10-18: 1.1 netlist.ts (parse/serialize/validate, round-trip tested).
- 2026-10-18: 1.2 simulate.ts (exhaustive evaluator + multi-tick LATCH; LATCH semantics UNVERIFIED, documented).
- 2026-10-18: 1.3 truthtable.ts + aig.ts (structural hashing, circuitDepth — independently verified BUILD.md's claimed depth-4 for the hand-derived 6-NAND MAJ3).
- 2026-10-18: 1.4 exact.ts + scripts/gen-exact-lib.ts — TWO deviations from the literal spec, both logged: (a) ships exact MINIMUM-DEPTH synthesis, not minimum gate count (a true min-gate-count exact synthesizer needs SAT-based search, judged too large for this session); (b) 1-3 inputs only, not 4 (222 NPN classes not built — BUILD.md's own sanctioned fallback). Caught via a failing test: the library's MAJ3 realization is 8 gates at depth 4, not the 6-gate depth-4 circuit from BUILD.md section 6 — both are depth-optimal, only one is gate-count-optimal.
- 2026-10-18: 1.5 optimize.ts (dedupe/structural rewriting, Shannon/mux decomposition for nIn>3, small 2-order Pareto front, Cref/4 early-stop).
- 2026-10-18: 1.6 equivalence.ts (exhaustive <=20 inputs; Tseitin CNF + DPLL SAT miter above - external cadical/minisat detection only, not wired, documented).
