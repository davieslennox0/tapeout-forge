import type { Netlist, Gate } from "./netlist.js";
import type { TruthTable } from "./truthtable.js";
// Statically imported (not read via node:fs at runtime) so this module bundles cleanly for
// both Node (CLI/tests) and the browser (apps/web) from the same source - see docs/NEW.md.
// Only n=1..3 exist (EXACT_SYNTHESIS_MAX_INPUTS=3; n=4 was abandoned, BUILD.md Phase 1c.4).
import libN1 from "../data/exact-min-gate-lib-1.json" with { type: "json" };
import libN2 from "../data/exact-min-gate-lib-2.json" with { type: "json" };
import libN3 from "../data/exact-min-gate-lib-3.json" with { type: "json" };

/**
 * PHASE 1b UPDATE (docs/NEW.md): now loads exact-min-gate-lib-N.json -
 * SAT-based, true minimum GATE COUNT, UNSAT-at-(r-1) PROVEN for n<=3 (every
 * function independently solved) and for n=4's 222 NPN-canonical
 * representatives. Fixes the Phase-1 gap this docstring used to describe
 * (MAJ3 used to come out at 8 gates here; it's proven-minimum 6 now,
 * matching BUILD.md's hand circuit and resolving Task 8 as a genuine tie,
 * not an optimizer artifact).
 *
 * See packages/core/scripts/sat_exact_synth.py's own docstring for a real
 * bug this found and fixed along the way: naively solving only an
 * NPN-canonical representative and bolting inverter gates onto it to reach
 * other class members does NOT give each member's true minimum, because
 * input/output negation costs a real NAND gate in this technology (unlike
 * idealized AIG representations where edge inversion is free). n=4's
 * ~65314 non-representative entries are therefore a verified-correct
 * (every entry is simulated against its truth table before being accepted)
 * but NOT independently-proven-minimal upper bound - not currently
 * surfaced to callers of exactSynthesize() as a distinct return field, but
 * recorded in the raw JSON's "proven" field for anyone who needs it.
 *
 * The OLD exact-lib-N.json (min-DEPTH, not min-gate) files remain in data/
 * for provenance but are no longer loaded by this module.
 */
export const EXACT_SYNTHESIS_MAX_INPUTS = 3;

export interface ExactLibEntry {
  gates: [number, number][];
}

const cache = new Map<number, Record<string, ExactLibEntry>>();

const STATIC_LIBS: Record<number, unknown> = { 1: libN1, 2: libN2, 3: libN3 };

function loadLib(nIn: number): Record<string, ExactLibEntry> {
  const cached = cache.get(nIn);
  if (cached) return cached;
  const lib = STATIC_LIBS[nIn] as Record<string, ExactLibEntry> | undefined;
  if (!lib) throw new Error(`exact.ts: no statically-bundled library for nIn=${nIn}`);
  cache.set(nIn, lib);
  return lib;
}

export function isExactSynthesizable(nIn: number): boolean {
  return nIn >= 1 && nIn <= EXACT_SYNTHESIS_MAX_INPUTS;
}

/**
 * Returns a PROVEN-minimum-GATE-COUNT NAND-only netlist (single output,
 * output = last gate) for the given truth table (see module docstring for
 * the n=4-non-representative caveat). If the target is already a base
 * signal (a constant or a single literal), two trivial double-negation
 * buffer gates are emitted so the "output = last gate" convention still
 * holds (costed honestly as 2 gates, not reported as the library's 0-gate
 * entry - callers comparing against Cref should be aware a bare-literal
 * target costs 2 gates here, not 0).
 */
export function exactSynthesize(nIn: number, tt: TruthTable): Netlist {
  if (!isExactSynthesizable(nIn)) {
    throw new Error(
      `exactSynthesize: nIn=${nIn} exceeds EXACT_SYNTHESIS_MAX_INPUTS=${EXACT_SYNTHESIS_MAX_INPUTS}`
    );
  }
  const lib = loadLib(nIn);
  const key = tt.toString();
  const entry = lib[key];
  if (!entry) throw new Error(`exactSynthesize: truth table ${key} not found in nIn=${nIn} library`);

  if (entry.gates.length === 0) {
    // Target is a base signal (const0/const1/an input literal). Find which one.
    const width = 1 << nIn;
    const fullMask = (1 << width) - 1;
    const base: number[] = [0, fullMask];
    for (let i = 0; i < nIn; i++) {
      let v = 0;
      for (let x = 0; x < width; x++) if ((x >> i) & 1) v |= 1 << x;
      base.push(v);
    }
    const baseSignalIndex = base.indexOf(Number(tt)); // index i -> signal i (0,1 consts; 2..1+nIn inputs)
    const gates: Gate[] = [
      { kind: "NAND", a: baseSignalIndex, b: baseSignalIndex },
      { kind: "NAND", a: 2 + nIn, b: 2 + nIn }, // signal (2+nIn) is the gate above; double-negate
    ];
    return { nIn, nOut: 1, gates };
  }

  const gates: Gate[] = entry.gates.map(([a, b]) => ({ kind: "NAND", a, b }));
  return { nIn, nOut: 1, gates };
}
