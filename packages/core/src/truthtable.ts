import type { Netlist } from "./netlist.js";
import { exhaustiveTruthTable } from "./simulate.js";

/** A single-output boolean function over nIn inputs, packed bit x = f(x). */
export type TruthTable = bigint;

export function fromNetlist(nl: Netlist, outIdx = 0): TruthTable {
  const rows = exhaustiveTruthTable(nl);
  let tt = 0n;
  for (let x = 0; x < rows.length; x++) if (rows[x][outIdx]) tt |= 1n << BigInt(x);
  return tt;
}

export function bit(tt: TruthTable, x: number): number {
  return Number((tt >> BigInt(x)) & 1n);
}

export function fromRows(rows: number[]): TruthTable {
  let tt = 0n;
  for (let x = 0; x < rows.length; x++) if (rows[x]) tt |= 1n << BigInt(x);
  return tt;
}

export function toRows(tt: TruthTable, nIn: number): number[] {
  const rows: number[] = [];
  for (let x = 0; x < 1 << nIn; x++) rows.push(bit(tt, x));
  return rows;
}

export function parseHex(nIn: number, hex: string): TruthTable {
  const clean = hex.trim().replace(/^0x/i, "") || "0";
  const mask = (1n << BigInt(1 << nIn)) - 1n;
  return BigInt("0x" + clean) & mask;
}

export function toHex(tt: TruthTable, nIn: number): string {
  const hexLen = Math.ceil((1 << nIn) / 4);
  return "0x" + tt.toString(16).padStart(hexLen, "0");
}
