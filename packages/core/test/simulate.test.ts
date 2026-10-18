import { describe, it, expect } from "vitest";
import type { Netlist, Gate } from "../src/netlist.js";
import { exhaustiveTruthTable, simulateTicks } from "../src/simulate.js";

const maj3Gates: Gate[] = [
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
];
const maj3: Netlist = { nIn: 3, nOut: 1, gates: maj3Gates };

describe("simulate", () => {
  it("12-NAND netlist from BUILD.md implements 3-input majority", () => {
    const table = exhaustiveTruthTable(maj3);
    for (let x = 0; x < 8; x++) {
      const a = x & 1, b = (x >> 1) & 1, c = (x >> 2) & 1;
      const expected = a + b + c >= 2 ? 1 : 0;
      expect(table[x][0]).toBe(expected);
    }
  });

  it("LATCH: output lags input by one tick, initial state 0 (documented assumption)", () => {
    const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 2 }] };
    const results = simulateTicks(nl, [[1], [0], [1]]);
    expect(results[0].outputs[0]).toBe(0); // reads initial state, not this tick's input
    expect(results[1].outputs[0]).toBe(1); // reads tick0's d (=1)
    expect(results[2].outputs[0]).toBe(0); // reads tick1's d (=0)
  });
});
