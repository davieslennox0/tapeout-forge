import { describe, it, expect } from "vitest";
import { validate } from "../src/netlist.js";
import { exhaustiveTruthTable } from "../src/simulate.js";
import { fromRows, toRows } from "../src/truthtable.js";
import { optimize } from "../src/optimize.js";

// Deterministic PRNG so failures are reproducible without a fixed seed file.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("fuzz: random 3-6 input truth tables (BUILD.md section 6)", () => {
  it("every optimize() result is exhaustively equivalent to its target and format-valid, for all 3 objectives", () => {
    const rand = mulberry32(42);
    const trials = 40;
    for (let trial = 0; trial < trials; trial++) {
      const nIn = 3 + Math.floor(rand() * 4); // 3..6
      const width = 1 << nIn;
      const rows: number[] = [];
      for (let x = 0; x < width; x++) rows.push(rand() < 0.5 ? 0 : 1);
      const tt = fromRows(rows);

      for (const objective of ["area", "depth", "balanced"] as const) {
        const result = optimize(nIn, tt, objective);
        expect(() => validate(result.netlist)).not.toThrow();
        const gotRows = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
        expect(gotRows, `trial=${trial} nIn=${nIn} objective=${objective} tt=${tt}`).toEqual(toRows(tt, nIn));
      }
    }
  });
});
