import { describe, it, expect } from "vitest";
import type { Netlist } from "../src/netlist.js";
import { circuitDepth, structuralHash } from "../src/aig.js";
import { fromNetlist, toRows, parseHex, toHex, fromRows } from "../src/truthtable.js";
import { exhaustiveTruthTable } from "../src/simulate.js";

// Hand-derived 6-NAND MAJ3 from BUILD.md section 6.
const hand6: Netlist = {
  nIn: 3,
  nOut: 1,
  gates: [
    { kind: "NAND", a: 2, b: 3 }, // n5 = NAND(a,b) -> signal5
    { kind: "NAND", a: 2, b: 4 }, // n6 = NAND(a,c) -> signal6
    { kind: "NAND", a: 3, b: 4 }, // n7 = NAND(b,c) -> signal7
    { kind: "NAND", a: 5, b: 6 }, // n8 = NAND(n5,n6) -> signal8
    { kind: "NAND", a: 8, b: 8 }, // n9 = NAND(n8,n8) -> signal9
    { kind: "NAND", a: 9, b: 7 }, // y  = NAND(n9,n7) -> signal10
  ],
};

describe("aig: circuitDepth", () => {
  it("matches BUILD.md's claimed depth 4 for the hand-derived 6-NAND MAJ3", () => {
    expect(circuitDepth(hand6)).toBe(4);
  });

  it("LATCH ends a path and resets depth at its Q output", () => {
    // 2 NAND deep into a latch's d, then 1 more NAND after reading Q.
    const nl: Netlist = {
      nIn: 1,
      nOut: 1,
      gates: [
        { kind: "NAND", a: 2, b: 2 }, // signal3, depth1 (NOT input)
        { kind: "NAND", a: 3, b: 3 }, // signal4, depth2
        { kind: "LATCH", d: 4 }, // signal5, Q resets to depth0; path-to-latch depth was 2
        { kind: "NAND", a: 5, b: 5 }, // signal6, depth1 (from Q, not 3)
      ],
    };
    expect(circuitDepth(nl)).toBe(2); // the pre-latch path (2) beats the post-latch path (1)
  });
});

describe("aig: structuralHash", () => {
  it("finds a duplicated NAND(a,b) and reports it as redundant", () => {
    const nl: Netlist = {
      nIn: 2,
      nOut: 1,
      gates: [
        { kind: "NAND", a: 2, b: 3 }, // signal4
        { kind: "NAND", a: 2, b: 3 }, // signal5, identical to signal4 - redundant
        { kind: "NAND", a: 4, b: 5 }, // signal6 (output)
      ],
    };
    const r = structuralHash(nl);
    expect(r.redundantGates).toBe(1);
    expect(r.canonical.get(5)).toBe(4);
  });
});

describe("truthtable", () => {
  it("fromNetlist matches exhaustiveTruthTable column, and round-trips via rows/hex", () => {
    const tt = fromNetlist(hand6, 0);
    const rows = exhaustiveTruthTable(hand6).map((r) => r[0]);
    expect(toRows(tt, 3)).toEqual(rows);
    expect(fromRows(rows)).toBe(tt);
    expect(parseHex(3, toHex(tt, 3))).toBe(tt);
  });
});
