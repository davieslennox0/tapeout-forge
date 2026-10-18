import { describe, it, expect } from "vitest";
import type { Netlist } from "../src/netlist.js";
import {
  checkEquivalence,
  checkEquivalenceSat,
  isExternalSatOnPath,
} from "../src/equivalence.js";

const hand6: Netlist = {
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

const twelve: Netlist = {
  nIn: 3,
  nOut: 1,
  gates: [
    { kind: "NAND", a: 2, b: 3 },
    { kind: "NAND", a: 2, b: 4 },
    { kind: "NAND", a: 3, b: 4 },
    { kind: "NAND", a: 5, b: 5 },
    { kind: "NAND", a: 6, b: 6 },
    { kind: "NAND", a: 7, b: 7 },
    { kind: "NAND", a: 8, b: 8 },
    { kind: "NAND", a: 9, b: 9 },
    { kind: "NAND", a: 11, b: 12 },
    { kind: "NAND", a: 13, b: 13 },
    { kind: "NAND", a: 10, b: 10 },
    { kind: "NAND", a: 14, b: 15 },
  ],
};

const notA: Netlist = { nIn: 3, nOut: 1, gates: [{ kind: "NAND", a: 2, b: 2 }] };

describe("checkEquivalence (exhaustive path, nIn<=20)", () => {
  it("two different-size MAJ3 realizations are equivalent", () => {
    const r = checkEquivalence(hand6, twelve);
    expect(r.method).toBe("exhaustive");
    expect(r.equivalent).toBe(true);
  });

  it("finds a real counterexample for a genuinely different function", () => {
    const r = checkEquivalence(hand6, notA);
    expect(r.equivalent).toBe(false);
    expect(r.counterexample).toBeDefined();
  });
});

describe("checkEquivalenceSat (Tseitin CNF + DPLL, exercised directly on small netlists)", () => {
  it("proves UNSAT (equivalent) for the same two MAJ3 realizations", () => {
    const r = checkEquivalenceSat(hand6, twelve);
    expect(r.method).toBe("sat-dpll");
    expect(r.equivalent).toBe(true);
  });

  it("finds a SAT counterexample for a genuinely different function", () => {
    const r = checkEquivalenceSat(hand6, notA);
    expect(r.equivalent).toBe(false);
    expect(r.counterexample).toBeDefined();
    expect(r.counterexample!.length).toBe(3);
  });
});

describe("isExternalSatOnPath", () => {
  it("runs without throwing (detection-only, documented - not invoked)", () => {
    expect(typeof isExternalSatOnPath()).toBe("boolean");
  });
});
