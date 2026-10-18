# Reused from earlier work

Carried over from earlier projects:

- `docs/fabx-tasks.json` — the live 100-task FabX bank, fetched from `api.fabx.tech`
  by a research agent prior to this project's start (2026-10-18), via a headless
  browser against `https://api.fabx.tech/v1/pod/taskbank`. Reused as-is since it is
  a point-in-time data capture, not code.
- The gas-cost figures in `config/cost.ts` (43,783 fixed + 1,952/gate on X Layer) and
  the FabX formula/address facts in `BUILD.md` section 3 were MEASURED/VERIFIED by
  research agents in prior sessions (see `maj3-silicon-spike` repo and the
  `fleg` research scratch directory). No code was reused, only these data points.
- The MAJ3 netlist examples in `BUILD.md` section 6 and the Verilog-latch lint fix
  (`always_latch`) came from the `maj3-silicon-spike` feasibility spike
  (github.com/davieslennox0/maj3-silicon-spike), a separate repo, referenced but
  not copied into this one.

No other code, package, or file in this repo predates 2026-10-16.
