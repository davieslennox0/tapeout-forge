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
  it("EXACT_SYNTHESIS_MAX_INPUTS is 3 (documented BUILD.md 1.4 fallback, not 4)", () => {
    expect(EXACT_SYNTHESIS_MAX_INPUTS).toBe(3);
    expect(isExactSynthesizable(3)).toBe(true);
    expect(isExactSynthesizable(4)).toBe(false);
  });

  it("finds a correct, proven-minimum-DEPTH MAJ3 (NOT minimum gate count - see exact.ts docstring)", () => {
    const maj3Rows = exhaustiveTruthTable(hand6Gates).map((r) => r[0]);
    const tt = fromRows(maj3Rows);
    const synth = exactSynthesize(3, tt);
    expect(() => validate(synth)).not.toThrow();
    const synthRows = exhaustiveTruthTable(synth).map((r) => r[0]);
    expect(synthRows).toEqual(maj3Rows); // functionally correct

    // Depth-optimal: matches the known-minimum depth (4, same as hand6Gates).
    expect(circuitDepth(synth)).toBe(4);
    expect(circuitDepth(hand6Gates)).toBe(4);

    // NOT gate-count-optimal: this library's realization uses MORE total
    // gates (8) than the hand-derived 6-gate circuit for the same function
    // and same depth - documented limitation, asserted explicitly so this
    // test fails loudly if that ever silently changes.
    expect(synth.gates.length).toBe(8);
    expect(hand6Gates.gates.length).toBe(6);
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
