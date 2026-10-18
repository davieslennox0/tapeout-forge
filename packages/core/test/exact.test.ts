import { describe, it, expect } from "vitest";
import type { Netlist } from "../src/netlist.js";
import { validate } from "../src/netlist.js";
import { exhaustiveTruthTable } from "../src/simulate.js";
import { fromRows, parseHex } from "../src/truthtable.js";
import { circuitDepth } from "../src/aig.js";
import { exactSynthesize, isExactSynthesizable, EXACT_SYNTHESIS_MAX_INPUTS } from "../src/exact.js";

const hand6Gates: Netlist = {
  nIn: 3,
  nOut: 1,
  gates: [
    { kind: "NAND", a: 2, b: 3 },
    { kind: "NAND", a: 2, b: 4 },
    { kind: "NAND", a: 3, b: 4 },
    { kind: "NAND", a: 5, b: 6 },
    { kind: "NAND", a: 8, b: 8 },
    { kind: "NAND", a: 9, b: 7 },
  ],
};

describe("exact synthesis", () => {
  it("EXACT_SYNTHESIS_MAX_INPUTS is 3 (n=4 SAT library covers only 222 NPN representatives so far, see exact.ts docstring)", () => {
    expect(EXACT_SYNTHESIS_MAX_INPUTS).toBe(3);
    expect(isExactSynthesizable(3)).toBe(true);
    expect(isExactSynthesizable(4)).toBe(false);
  });

  it("finds a correct, PROVEN-minimum-GATE-COUNT MAJ3 (Phase 1b fix: was min-depth-only/8-gates before)", () => {
    const maj3Rows = exhaustiveTruthTable(hand6Gates).map((r) => r[0]);
    const tt = fromRows(maj3Rows);
    const synth = exactSynthesize(3, tt);
    expect(() => validate(synth)).not.toThrow();
    const synthRows = exhaustiveTruthTable(synth).map((r) => r[0]);
    expect(synthRows).toEqual(maj3Rows); // functionally correct

    // Phase 1b's SAT exact synthesizer proves 6 gates is the true minimum
    // for MAJ3 (UNSAT at 5, see packages/core/scripts/sat_exact_synth.py),
    // matching the hand-derived circuit's gate count exactly - this was the
    // bug Phase 1 shipped (8 gates from a min-DEPTH-only library) and this
    // assertion is written to fail loudly if it ever regresses.
    expect(synth.gates.length).toBe(6);
    expect(circuitDepth(synth)).toBe(4);
    expect(hand6Gates.gates.length).toBe(6);
    expect(circuitDepth(hand6Gates)).toBe(4);
  });

  it("handles a trivial target (bare input literal) via the 2-gate buffer fallback", () => {
    // f(a,b,c) = a exactly (bit0 of truth table index = a).
    const tt = parseHex(3, "aa"); // 0b10101010: bit x set iff x&1 -> this is literally "a"
    const synth = exactSynthesize(3, tt);
    expect(synth.gates.length).toBe(2);
    const rows = exhaustiveTruthTable(synth).map((r) => r[0]);
    for (let x = 0; x < 8; x++) expect(rows[x]).toBe(x & 1);
  });

  it("throws for nIn=4 (documented limitation, not silently wrong)", () => {
    expect(() => exactSynthesize(4, 0n)).toThrow(/EXACT_SYNTHESIS_MAX_INPUTS/);
  });
});
