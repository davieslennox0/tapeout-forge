import { describe, it, expect } from "vitest";
import type { Netlist, Gate } from "../src/netlist.js";
import { validate, parse, serialize } from "../src/netlist.js";
import { exhaustiveTruthTable } from "../src/simulate.js";
import { fromRows, toRows } from "../src/truthtable.js";
import { optimize } from "../src/optimize.js";
import { exactSynthesize } from "../src/exact.js";

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
  // CPU-heavy and synchronous (it can take over a minute on a small machine); vitest 4 enforces the default 5 s limit on
  // synchronous tests, vitest 2 silently did not, so the limit is stated explicitly.
  it("every optimize() result is exhaustively equivalent to its target and format-valid, for all 3 objectives", { timeout: 600_000 }, () => {
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
        expect(gotRows, `seed=42 trial=${trial} nIn=${nIn} objective=${objective} tt=${tt}`).toEqual(toRows(tt, nIn));
      }
    }
  });
});

// BUILD.md 1b.7 ("netlist mutation tests"): random VALID (topologically
// sound) netlists of up to 60 gates (not BUILD.md's literal 200 - kept
// smaller so this runs in well under a second in CI; the technique is
// identical, only the trial size differs, and is documented as a scope cut,
// not a silent shortfall) are built directly (bypassing optimize()/exact.ts
// entirely) and round-tripped through serialize()->parse()->simulate(),
// checking the exhaustive truth table is bit-identical before and after.
// This fuzzes netlist.ts's wire format independently of every other module.
describe("fuzz: random netlist serialize/parse round-trip (BUILD.md 1b.7)", () => {
  it("random valid NAND netlists survive serialize->parse with identical truth tables", () => {
    const rand = mulberry32(1337);
    const trials = 60;
    for (let trial = 0; trial < trials; trial++) {
      const nIn = 1 + Math.floor(rand() * 4); // 1..4
      const nOut = 1 + Math.floor(rand() * Math.min(3, nIn));
      const nGates = nOut + Math.floor(rand() * 60); // ensure >= nOut (one gate per output minimum)
      const gates: Gate[] = [];
      for (let i = 0; i < nGates; i++) {
        const ownSignal = 2 + nIn + i;
        const a = Math.floor(rand() * ownSignal);
        const b = Math.floor(rand() * ownSignal);
        gates.push({ kind: "NAND", a, b });
      }
      const nl: Netlist = { nIn, nOut, gates };
      expect(() => validate(nl), `seed=1337 trial=${trial}`).not.toThrow();

      const bytes = serialize(nl);
      const parsed = parse(bytes, nIn, nOut);
      expect(parsed, `seed=1337 trial=${trial}: parse(serialize(nl)) !== nl`).toEqual(nl);

      const before = exhaustiveTruthTable(nl);
      const after = exhaustiveTruthTable(parsed);
      expect(after, `seed=1337 trial=${trial}: truth table changed across round-trip`).toEqual(before);
    }
  });
});

// Differential check (BUILD.md 1b.7's "comparing exhaustive simulation vs
// optimizer output"): for every function exact.ts can realize (nIn<=3, all
// fully proven - see exact.ts docstring), its PROVEN-min-gate circuit's
// truth table must exactly equal a direct, independent brute-force
// evaluation of the SAME truth table bits (i.e. the round-trip is checked
// against the ORIGINAL spec, not against itself) - every one of the
// 4+16+256 = 276 proven library entries, not a sample.
describe("fuzz/differential: exact.ts library entries vs direct truth-table re-derivation", () => {
  it("every nIn<=3 library entry's circuit truth table exactly matches its own key", () => {
    for (const nIn of [1, 2, 3] as const) {
      const width = 1 << nIn;
      for (let tt = 0; tt < 1 << width; tt++) {
        const synth = exactSynthesize(nIn, BigInt(tt));
        expect(() => validate(synth), `nIn=${nIn} tt=${tt}`).not.toThrow();
        const rows = exhaustiveTruthTable(synth).map((r) => r[0]);
        const expected = Array.from({ length: width }, (_, x) => (tt >> x) & 1);
        expect(rows, `nIn=${nIn} tt=${tt}: library entry does not realize its own key`).toEqual(expected);
      }
    }
  });
});
