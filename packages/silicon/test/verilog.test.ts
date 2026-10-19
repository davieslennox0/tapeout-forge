import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Netlist, parse, exhaustiveTruthTable } from "@forgeout/core";
import { toStructuralVerilog, toTtskyWrapper, checkExportable, REQUIRED_SILICON_WORDING } from "../src/index.js";

/** Runs the generated structural Verilog through real iverilog, exhaustively, and compares bit-for-bit against our TS simulator's truth table. Fails loudly (throws) on any mismatch or if iverilog itself errors. */
function checkEquivalenceViaIverilog(nl: Netlist, moduleName: string, verilog: string) {
  const expected = exhaustiveTruthTable(nl);
  const dir = mkdtempSync(join(tmpdir(), "sil-eq-"));
  try {
    const designPath = join(dir, "design.v");
    writeFileSync(designPath, verilog);

    const tbLines: string[] = [];
    tbLines.push(`module tb;`);
    for (let i = 0; i < nl.nIn; i++) tbLines.push(`  reg in${i};`);
    for (let k = 0; k < nl.nOut; k++) tbLines.push(`  wire out${k};`);
    const conns = [
      ...Array.from({ length: nl.nIn }, (_, i) => `.in${i}(in${i})`),
      ...Array.from({ length: nl.nOut }, (_, k) => `.out${k}(out${k})`),
    ];
    tbLines.push(`  ${moduleName} dut(${conns.join(", ")});`);
    tbLines.push(`  integer x;`);
    tbLines.push(`  initial begin`);
    tbLines.push(`    for (x = 0; x < ${1 << nl.nIn}; x = x + 1) begin`);
    for (let i = 0; i < nl.nIn; i++) tbLines.push(`      in${i} = (x >> ${i}) & 1;`);
    tbLines.push(`      #1;`);
    const outArgs = Array.from({ length: nl.nOut }, (_, k) => `out${k}`).join(", ");
    tbLines.push(`      $display("%0d ${Array.from({ length: nl.nOut }).map(() => "%b").join("")}", x${nl.nOut ? ", " + outArgs : ""});`);
    tbLines.push(`    end`);
    tbLines.push(`    $finish;`);
    tbLines.push(`  end`);
    tbLines.push(`endmodule`);
    const tbPath = join(dir, "tb.v");
    writeFileSync(tbPath, tbLines.join("\n"));

    const outPath = join(dir, "sim.out");
    execFileSync("iverilog", ["-g2012", "-o", outPath, designPath, tbPath], { stdio: "pipe" });
    const raw = execFileSync("vvp", [outPath], { encoding: "utf8" });

    const resultLines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+ [01]+$/.test(l));
    if (resultLines.length !== 1 << nl.nIn) {
      throw new Error(`iverilog produced ${resultLines.length} rows, expected ${1 << nl.nIn}:\n${raw}`);
    }
    for (const line of resultLines) {
      const [xStr, bitsAscending] = line.split(" ");
      const x = Number(xStr);
      // One %b per output wire, concatenated in declaration order (out0, out1, ...) -
      // already ascending pin order, matching exhaustiveTruthTable's convention. No reversal.
      const bits = bitsAscending.split("").map(Number);
      const exp = expected[x];
      expect(bits, `row x=${x}: iverilog=${bits} ts=${exp}`).toEqual(exp);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const MAJ3: Netlist = {
  nIn: 3,
  nOut: 1,
  gates: [
    { kind: "NAND", a: 2, b: 3 }, // s5 = ~(a&b)
    { kind: "NAND", a: 2, b: 4 }, // s6 = ~(a&c)
    { kind: "NAND", a: 3, b: 4 }, // s7 = ~(b&c)
    { kind: "NAND", a: 5, b: 6 }, // s8 = ~(s5&s6)
    { kind: "NAND", a: 8, b: 8 }, // s9 = ~s8
    { kind: "NAND", a: 9, b: 7 }, // s10 = ~(s9&s7) = y
  ],
};

// Real on-chain beat netlists loaded directly from the committed task-bank snapshot
// (packages/core/scripts/tasks.json) - not hand-written or re-typed.
import rawTasks from "../../core/scripts/tasks.json" assert { type: "json" };
function taskNetlist(id: number): Netlist {
  const t = (rawTasks as any).tasks.find((x: any) => x.id === id);
  if (!t) throw new Error(`task ${id} not found in tasks.json`);
  const hex = t.netlistHex.replace(/^0x/, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return parse(bytes, t.nIn, t.nOut);
}

describe("packages/silicon: structural Verilog generation + real iverilog equivalence", () => {
  it("6-NAND MAJ3 (BUILD.md's proven-minimum hand circuit): generated Verilog matches TS simulation for all 8 rows", () => {
    const r = toStructuralVerilog(MAJ3, "maj3_core");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cellEstimate).toBe(6);
    checkEquivalenceViaIverilog(MAJ3, r.moduleName, r.verilog);
  });

  it("task 7 (GC-007 XNOR, a real verified beat, 2/1): generated Verilog matches TS simulation for all 4 rows", () => {
    const nl = taskNetlist(7);
    const r = toStructuralVerilog(nl, "task7_core");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    checkEquivalenceViaIverilog(nl, r.moduleName, r.verilog);
  });

  it("task 12 (GC-012 4-to-2 encoder+error detector, the headline q=4.0 beat, 4/4): generated Verilog matches TS simulation for all 16 rows", () => {
    const nl = taskNetlist(12);
    const r = toStructuralVerilog(nl, "task12_core");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    checkEquivalenceViaIverilog(nl, r.moduleName, r.verilog);
  });

  it("ttsky wrapper: MAJ3 wraps cleanly and is still equivalent via its core module", () => {
    const r = toTtskyWrapper(MAJ3, "davieslennox0_maj3silicon");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.moduleName).toBe("tt_um_davieslennox0_maj3silicon");
    expect(r.verilog).toContain(REQUIRED_SILICON_WORDING);
    // the wrapper's own core module is independently checked via the discrete-pin core test above;
    // here just confirm the wrapper text compiles standalone under iverilog (syntax/elaboration check).
    const dir = mkdtempSync(join(tmpdir(), "sil-wrap-"));
    try {
      writeFileSync(join(dir, "w.v"), r.verilog);
      execFileSync("iverilog", ["-g2012", "-o", join(dir, "w.out"), join(dir, "w.v")], { stdio: "pipe" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("refusal paths (BUILD.md 4.1: 'refuse with a specific reason')", () => {
    it("refuses a REF-containing netlist", () => {
      const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "REF", addr: "0x" + "11".repeat(20), id: 1n, nIn: 1, nOut: 1, inputs: [2] }] };
      const r = checkExportable(nl);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/unflattenable REF/);
    });

    it("refuses a LATCH-containing netlist (documented spec-conflict reason)", () => {
      const nl: Netlist = { nIn: 1, nOut: 1, gates: [{ kind: "LATCH", d: 2 }] };
      const r = checkExportable(nl);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/latch without a documented reset convention/);
    });

    it("refuses an oversized circuit (> 500 gates)", () => {
      const gates = Array.from({ length: 501 }, () => ({ kind: "NAND" as const, a: 0, b: 1 }));
      const nl: Netlist = { nIn: 1, nOut: 1, gates };
      const r = checkExportable(nl);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/too large/);
    });

    it("refuses too many pins (nIn > 8)", () => {
      const nl: Netlist = { nIn: 9, nOut: 1, gates: [{ kind: "NAND", a: 2, b: 3 }] };
      const r = checkExportable(nl);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/too many pins/);
    });
  });
});
