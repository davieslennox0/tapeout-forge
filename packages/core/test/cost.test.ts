import { describe, it, expect } from "vitest";
import type { Netlist } from "../src/netlist.js";
import { computeCost, computeQ } from "../src/cost.js";

// Hand-derived 6-NAND MAJ3 (BUILD.md section 6): 6 gates, depth 4 without buffers.
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

describe("computeCost: BUILD.md's Task 8 'Known open check' numbers", () => {
  it("without buffers: A=6, d=4, C=384 (matches BUILD.md section 3 exactly)", () => {
    const r = computeCost(hand6, { gasFixed: 43783, gasPerGate: 1952 });
    expect(r.fabx.withoutBuffers).toEqual({ A: 6, d: 4, C: 384 });
  });

  it("with buffers: A=8, d=6, C=1728 (matches Task 8's Cref exactly - a TIE, not a win, if FabX uses this convention)", () => {
    const r = computeCost(hand6, { gasFixed: 43783, gasPerGate: 1952 });
    expect(r.fabx.withBuffers).toEqual({ A: 8, d: 6, C: 1728 });
    expect(r.bufferGates).toBe(2);
    expect(r.userGates).toBe(6);
  });

  it("gas uses the MEASURED X Layer constants on the buffered (deployed) gate count", () => {
    const r = computeCost(hand6, { gasFixed: 43783, gasPerGate: 1952 });
    expect(r.gasPerEval).toBe(43783 + 1952 * (6 + 2));
  });
});

describe("computeQ", () => {
  it("clamps to the 4x cap when C is far below Cref", () => {
    expect(computeQ(1728, 384)).toBe(4); // 1728/384=4.5, clamped to 4
  });
  it("is exactly 1 when C equals Cref (a tie)", () => {
    expect(computeQ(1728, 1728)).toBe(1);
  });
  it("clamps to the 0.25 floor when C is far above Cref", () => {
    expect(computeQ(10, 1000)).toBe(0.25);
  });
});
