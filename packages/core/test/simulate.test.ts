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

  it("LATCH: output lags input by one tick, initial state 0 (VERIFIED, see docs/NEW.md)", () => {
    const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 2 }] };
    const results = simulateTicks(nl, [[1], [0], [1]]);
    expect(results[0].outputs[0]).toBe(0); // reads initial state, not this tick's input
    expect(results[1].outputs[0]).toBe(1); // reads tick0's d (=1)
    expect(results[2].outputs[0]).toBe(0); // reads tick1's d (=0)
  });

  it("matches the real live eth_call sequence captured from FAB_TST circuit id=49 (latch-reconcile, docs/NEW.md)", () => {
    // Same netlist as above (nIn=1, nOut=1, single LATCH with d=2=the input
    // pin). Live calls: step(49, state=0x00, input=0x01) -> newState=0x01,
    // output=0x00; step(49, state=0x01, input=0x00) -> newState=0x00,
    // output=0x01; step(49, state=0x00, input=0x01) -> newState=0x01,
    // output=0x00. This anchors our simulator to the real deployed
    // contract's behaviour, not just an internal assumption.
    const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 2 }] };
    const results = simulateTicks(nl, [[1], [0], [1]]);
    expect(results[0].outputs[0]).toBe(0);
    expect(results[0].nextState.values[0]).toBe(1);
    expect(results[1].outputs[0]).toBe(1);
    expect(results[1].nextState.values[0]).toBe(0);
    expect(results[2].outputs[0]).toBe(0);
    expect(results[2].nextState.values[0]).toBe(1);
  });

  it("genuine forward feedback: LATCH.d references a NAND gate defined LATER in gate order (VERIFIED allowed, docs/NEW.md)", () => {
    // nIn=1 (signal 2 = input). gate0 (signal 3) = LATCH d=4 (points FORWARD
    // to signal 4, produced by gate1, defined after it). gate1 (signal 4) =
    // NAND(2,2) = NOT(input). Output = signal 3 (the latch).
    const nl: Netlist = {
      nIn: 1,
      nOut: 1,
      gates: [
        { kind: "LATCH", d: 4 },
        { kind: "NAND", a: 2, b: 2 },
      ],
    };
    // Pass 1 computes signal4 = NOT(input) in the SAME tick the latch reads
    // it from (as `d`), in Pass 2 - this only works because Pass 2 runs
    // after every signal this tick is known.
    // NOTE: the circuit's output pin is signal 4 (the NAND, the LAST
    // gate - the format requires outputs to be the last nOut signals), not
    // the LATCH itself; this test is about nextState (the forward-fed `d`
    // sample), not about which signal happens to be the output pin.
    const results = simulateTicks(nl, [[0], [1], [0]]);
    expect(results[0].outputs[0]).toBe(1); // signal4 = NOT(input0=0) = 1
    expect(results[0].nextState.values[0]).toBe(1); // d = signal4 (this tick) = 1
    expect(results[1].outputs[0]).toBe(0); // signal4 = NOT(input1=1) = 0
    expect(results[1].nextState.values[0]).toBe(0); // d = signal4 (this tick) = 0
    expect(results[2].outputs[0]).toBe(1); // signal4 = NOT(input2=0) = 1
    expect(results[2].nextState.values[0]).toBe(1); // d = signal4 (this tick) = 1
  });
});
