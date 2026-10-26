import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { keccak256 } from "js-sha3";
import { packInputBits, callEval, fetchNetlist, verifyOnchain, getCircuitInfo } from "../src/index.js";
import { evalCombinational } from "@forgeout/core";
import { X_LAYER, FAB_TST_PROCESSOR } from "../../../config/chains.js";

const PROCESSOR = "0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355"; // "OrderGuard" (VERIFIED via name(), see docs/NEW.md)
const FAB_TST = "0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6"; // "FAB-Genisis" (VERIFIED via name(), see docs/NEW.md)

describe("packInputBits", () => {
  it("bit0 = first pin, packed little-end-first into bytes", () => {
    expect(Array.from(packInputBits([1, 0, 1]))).toEqual([0b101]);
    expect(Array.from(packInputBits(new Array(9).fill(1)))).toEqual([0xff, 0x01]);
  });
});

describe("callEval against the live X Layer processor (real network)", () => {
  // BUILD.md 1.9 / 1b.5: local simulation vs real eval() on circuits 1,3,4,5.
  // PHASE 1b UPDATE: netlist(id) and circuitInfo(uint256)'s ABI are now
  // VERIFIED (see src/index.ts docstrings) - this is a REAL full comparison,
  // not a PENDING placeholder like Phase 1 shipped.
  const circuitIds = [1n, 2n, 3n, 4n, 5n];

  it("real on-chain netlist, simulated locally, matches real eval() exactly - for every input row", async () => {
    for (const id of circuitIds) {
      const info = await getCircuitInfo(X_LAYER.rpcUrl, PROCESSOR, id);
      expect(info.nState).toBe(0); // all 5 are combinational (VERIFIED empirically)
      const netlist = await fetchNetlist(X_LAYER.rpcUrl, PROCESSOR, id);
      expect(netlist.nIn).toBe(info.nIn);
      expect(netlist.gates.length).toBe(info.gateCount);

      // Exhaustive: every input row, not just one.
      for (let x = 0; x < 1 << netlist.nIn; x++) {
        const bits: number[] = [];
        for (let i = 0; i < netlist.nIn; i++) bits.push((x >> i) & 1);
        const local = evalCombinational(netlist, bits);
        const onchain = await callEval(X_LAYER.rpcUrl, PROCESSOR, id, packInputBits(bits), netlist.nOut);
        expect(onchain.outputBits).toEqual(local);
      }
    }
  }, 60000);

  it("verifyOnchain() fetches the real netlist itself and reports match=true", async () => {
    const r = await verifyOnchain(X_LAYER.rpcUrl, PROCESSOR, 3n, [1, 1, 0]);
    expect(r.match).toBe(true);
    expect(r.netlistFetchAttempted).toBe(true);
  });

  it("a real on-chain LATCH circuit (FAB_TST id=49, nState=1) makes eval() revert with 'has latch: use step'", async () => {
    const info = await getCircuitInfo(X_LAYER.rpcUrl, FAB_TST, 49n);
    expect(info.nState).toBe(1);
    const r = await verifyOnchain(X_LAYER.rpcUrl, FAB_TST, 49n, [1]);
    expect(r.match).toBeNull();
    expect(r.note).toMatch(/UNVERIFIED/);
  });
});

describe("verifyOnchain with whole-byte inputs, as the CLI passes them (`--inputs 0x07`)", () => {
  it("FAB_TST id=65 (3-input MAJ3): 8 padded bits [1,1,1,0,0,0,0,0] match the real eval()", async () => {
    const r = await verifyOnchain(X_LAYER.rpcUrl, FAB_TST, 65n, [1, 1, 1, 0, 0, 0, 0, 0]);
    expect(r.match).toBe(true);
    expect(r.onchain.outputBits).toEqual([1]);
  }, 30000);
  it("refuses a set bit beyond the circuit's nIn instead of silently dropping it", async () => {
    await expect(verifyOnchain(X_LAYER.rpcUrl, FAB_TST, 65n, [1, 1, 1, 1, 0, 0, 0, 0])).rejects.toThrow(/beyond/);
  }, 30000);
});

describe("FAB_TST processor address integrity (2026-10-19 check: two spellings had appeared across reports, only one in any committed file)", () => {
  function isEip55Checksummed(address: string): boolean {
    const addr = address.replace(/^0x/, "");
    const hash = keccak256(addr.toLowerCase());
    let expected = "";
    for (let i = 0; i < addr.length; i++) {
      const c = addr[i];
      if (/[0-9]/.test(c)) { expected += c; continue; }
      expected += parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c.toLowerCase();
    }
    return expected === addr;
  }

  it("config/chains.ts's FAB_TST_PROCESSOR is EIP-55 checksummed", () => {
    expect(isEip55Checksummed(FAB_TST_PROCESSOR)).toBe(true);
  });

  it("config/chains.ts's FAB_TST_PROCESSOR matches the address docs/PROCESSOR-EVIDENCE.md confirms", () => {
    const evidence = readFileSync(
      new URL("../../../docs/PROCESSOR-EVIDENCE.md", import.meta.url),
      "utf8",
    );
    const m = evidence.match(/Use `(0x[0-9a-fA-F]{40})` for anything targeting FabX PoD mining/);
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe(FAB_TST_PROCESSOR.toLowerCase());
  });
});
