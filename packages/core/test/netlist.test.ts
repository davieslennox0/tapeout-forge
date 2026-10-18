import { describe, it, expect } from "vitest";
import { parse, serialize, validate, outputSignal, type Netlist, type Gate } from "../src/netlist.js";

// BUILD.md section 6: 12-NAND MAJ3. inputs a=2,b=3,c=4; gate i -> signal 5+i.
const maj3Gates: Gate[] = [
  { kind: "NAND", a: 2, b: 3 }, // 5
  { kind: "NAND", a: 2, b: 4 }, // 6
  { kind: "NAND", a: 3, b: 4 }, // 7
  { kind: "NAND", a: 5, b: 5 }, // 8
  { kind: "NAND", a: 6, b: 6 }, // 9
  { kind: "NAND", a: 7, b: 7 }, // 10
  { kind: "NAND", a: 8, b: 8 }, // 11
  { kind: "NAND", a: 9, b: 9 }, // 12
  { kind: "NAND", a: 11, b: 12 }, // 13
  { kind: "NAND", a: 13, b: 13 }, // 14
  { kind: "NAND", a: 10, b: 10 }, // 15
  { kind: "NAND", a: 14, b: 15 }, // 16
];
const maj3: Netlist = { nIn: 3, nOut: 1, gates: maj3Gates };

describe("netlist", () => {
  it("validates the known-good MAJ3 netlist", () => {
    expect(() => validate(maj3)).not.toThrow();
    expect(outputSignal(maj3, 0)).toBe(16);
  });

  it("round-trips serialize -> parse", () => {
    const bytes = serialize(maj3);
    expect(bytes.length).toBe(12 * 7); // 12 NAND gates, 7 bytes each
    const back = parse(bytes, 3, 1);
    expect(back).toEqual(maj3);
  });

  it("round-trips parse -> serialize on raw bytes", () => {
    const bytes = serialize(maj3);
    const back = serialize(parse(bytes, 3, 1));
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it("rejects a future-signal reference", () => {
    const bad: Netlist = { nIn: 2, nOut: 1, gates: [{ kind: "NAND", a: 5, b: 2 }] };
    expect(() => validate(bad)).toThrow(/future or self signal/);
  });

  it("an internal gate can never legally reference a later output signal", () => {
    // Given strict topological order + "last nOut signals are outputs",
    // this is always also a future-signal violation - there is no way to
    // construct a case that violates "outputs feed internal gates" alone.
    // See netlist.ts's comment on this. A builder that needs an output's
    // value elsewhere must duplicate the gate (optimize.ts's job).
    const bad: Netlist = {
      nIn: 2,
      nOut: 1,
      gates: [
        { kind: "NAND", a: 5, b: 2 }, // signal 4: references signal 5, not yet produced
        { kind: "NAND", a: 2, b: 3 }, // signal 5 (output)
      ],
    };
    expect(() => validate(bad)).toThrow(/future or self signal/);
  });

  it("LATCH.d may reference a signal defined LATER in gate order (VERIFIED forward feedback, docs/NEW.md)", () => {
    const nl: Netlist = {
      nIn: 1,
      nOut: 1,
      gates: [
        { kind: "LATCH", d: 4 }, // signal 3; d points forward to signal 4
        { kind: "NAND", a: 2, b: 2 }, // signal 4
      ],
    };
    expect(() => validate(nl)).not.toThrow();
  });

  it("LATCH.d still rejected if it points past the end of the whole netlist", () => {
    const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 99 }] };
    expect(() => validate(nl)).toThrow(/out of range/);
  });

  it("NAND still rejects a future-signal reference even when a LATCH elsewhere is allowed to", () => {
    const nl: Netlist = {
      nIn: 1,
      nOut: 1,
      gates: [
        { kind: "NAND", a: 4, b: 2 }, // signal 3: NAND may NOT reference signal 4 (not yet produced)
        { kind: "NAND", a: 2, b: 2 }, // signal 4
      ],
    };
    expect(() => validate(nl)).toThrow(/future or self signal/);
  });

  it("LATCH round-trips", () => {
    const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 2 }] };
    const bytes = serialize(nl);
    expect(bytes.length).toBe(4);
    expect(parse(bytes, 1, 1)).toEqual(nl);
  });

  it("REF round-trips", () => {
    const nl: Netlist = {
      nIn: 2,
      nOut: 1,
      gates: [
        {
          kind: "REF",
          addr: "0x00112233445566778899aabbccddeeff00112233",
          id: 7n,
          nIn: 2,
          nOut: 1,
          inputs: [2, 3],
        },
      ],
    };
    const bytes = serialize(nl);
    expect(bytes.length).toBe(31 + 3 * 2);
    expect(parse(bytes, 2, 1)).toEqual(nl);
  });
});
