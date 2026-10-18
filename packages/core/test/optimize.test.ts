import { describe, it, expect } from "vitest";
import type { Netlist } from "../src/netlist.js";
import { validate } from "../src/netlist.js";
import { exhaustiveTruthTable } from "../src/simulate.js";
import { fromRows } from "../src/truthtable.js";
import { circuitDepth } from "../src/aig.js";
import { optimize, dedupe, computeC } from "../src/optimize.js";

describe("dedupe", () => {
  it("removes a duplicated NAND(a,b) and preserves function + depth", () => {
    const nl: Netlist = {
      nIn: 2,
      nOut: 1,
      gates: [
        { kind: "NAND", a: 2, b: 3 }, // signal4
        { kind: "NAND", a: 2, b: 3 }, // signal5 - redundant duplicate of signal4
        { kind: "NAND", a: 4, b: 5 }, // signal6 (output), reads both
      ],
    };
    const before = exhaustiveTruthTable(nl).map((r) => r[0]);
    const d = dedupe(nl);
    expect(() => validate(d)).not.toThrow();
    const after = exhaustiveTruthTable(d).map((r) => r[0]);
    expect(after).toEqual(before);
    expect(d.gates.length).toBeLessThan(nl.gates.length);
    expect(circuitDepth(d)).toBe(circuitDepth(nl));
  });
});

describe("computeC", () => {
  it("matches BUILD.md's formula C = A.max(d,1)^3, A=g+6s", () => {
    expect(computeC(8, 6, 0)).toBe(8 * 6 ** 3); // the Task 8 "Known open check" numbers
    expect(computeC(3, 0, 0)).toBe(3); // depth 0 clamps to max(d,1)=1
  });
});

describe("optimize", () => {
  it("nIn<=3 (MAJ3): correct, and matches exact.ts's depth-optimal result", () => {
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
    const rows = exhaustiveTruthTable(hand6).map((r) => r[0]);
    const tt = fromRows(rows);
    const result = optimize(3, tt, "depth");
    expect(() => validate(result.netlist)).not.toThrow();
    const gotRows = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
    expect(gotRows).toEqual(rows);
    expect(result.depth).toBe(4); // proven-minimum depth for MAJ3 (exact.ts)
  });

  it("nIn=4 (parity): correct via the Shannon/mux decomposition path", () => {
    const refRows: number[] = [];
    for (let x = 0; x < 16; x++) {
      let p = 0;
      for (let i = 0; i < 4; i++) p ^= (x >> i) & 1;
      refRows.push(p);
    }
    const tt = fromRows(refRows);
    const result = optimize(4, tt, "balanced");
    expect(() => validate(result.netlist)).not.toThrow();
    const gotRows = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
    expect(gotRows).toEqual(refRows);
    expect(result.gates).toBeGreaterThan(0);
  });

  it("respects the Cref/4 early-stop signal via metCref4xCap", () => {
    const rows = [0, 0, 0, 1, 0, 1, 1, 1]; // MAJ3 again
    const tt = fromRows(rows);
    const r = optimize(3, tt, "area", { cref: 100000 }); // trivially huge cref, cap easily met
    expect(r.metCref4xCap).toBe(true);
  });
});
