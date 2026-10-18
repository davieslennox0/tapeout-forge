// TAP-02-style netlist format (BUILD.md section 3). Signals are u24:
//   0 = const 0, 1 = const 1, 2..1+nIn = circuit inputs, then one signal per
//   gate in topological order (gate i's output signal = 2 + nIn + i).
// NAND = 0x00|u24 a|u24 b (7B). LATCH = 0x01|u24 d (4B).
// REF  = 0x02|addr20|u64 id|u8 nIn|u8 nOut|nIn x u24 (31+3*nIn B). All big-endian.
//
// ASSUMPTION (UNVERIFIED, undocumented in the public spec): nIn/nOut for the
// *top-level* netlist are not encoded in the gate byte-stream itself (only a
// REF sub-call carries its own nIn/nOut). They must be supplied by the caller,
// matching how task banks / circuitInfo report nIn/nOut as separate fields.

export type Signal = number;

export interface NandGate {
  kind: "NAND";
  a: Signal;
  b: Signal;
}

export interface LatchGate {
  kind: "LATCH";
  d: Signal;
}

export interface RefGate {
  kind: "REF";
  addr: string; // "0x" + 40 hex chars
  id: bigint;
  nIn: number;
  nOut: number;
  inputs: Signal[];
}

export type Gate = NandGate | LatchGate | RefGate;

export interface Netlist {
  nIn: number;
  nOut: number;
  gates: Gate[];
}

export class NetlistError extends Error {}

function readU24(buf: Uint8Array, off: number): number {
  return (buf[off] << 16) | (buf[off + 1] << 8) | buf[off + 2];
}

function writeU24(out: number[], v: number): void {
  if (v < 0 || v > 0xffffff) throw new NetlistError(`signal ${v} out of u24 range`);
  out.push((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
}

function readU64(buf: Uint8Array, off: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(buf[off + i]);
  return v;
}

function writeU64(out: number[], v: bigint): void {
  if (v < 0n || v > 0xffffffffffffffffn) throw new NetlistError(`id ${v} out of u64 range`);
  const bytes: number[] = [];
  for (let i = 0; i < 8; i++) {
    bytes.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  out.push(...bytes);
}

/** First output signal index: 2 + nIn + (gates.length - nOut). */
export function firstOutputSignal(nl: Netlist): number {
  return 2 + nl.nIn + (nl.gates.length - nl.nOut);
}

/** Output signal for output index k (0-based). */
export function outputSignal(nl: Netlist, k: number): number {
  return firstOutputSignal(nl) + k;
}

export function parse(bytes: Uint8Array, nIn: number, nOut: number): Netlist {
  const gates: Gate[] = [];
  let off = 0;
  let nextSignal = 2 + nIn;
  while (off < bytes.length) {
    const tag = bytes[off];
    if (tag === 0x00) {
      if (off + 7 > bytes.length) throw new NetlistError("truncated NAND");
      const a = readU24(bytes, off + 1);
      const b = readU24(bytes, off + 4);
      gates.push({ kind: "NAND", a, b });
      off += 7;
    } else if (tag === 0x01) {
      if (off + 4 > bytes.length) throw new NetlistError("truncated LATCH");
      const d = readU24(bytes, off + 1);
      gates.push({ kind: "LATCH", d });
      off += 4;
    } else if (tag === 0x02) {
      if (off + 31 > bytes.length) throw new NetlistError("truncated REF header");
      const addrBytes = bytes.slice(off + 1, off + 21);
      const addr =
        "0x" + Array.from(addrBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const id = readU64(bytes, off + 21);
      const rNIn = bytes[off + 29];
      const rNOut = bytes[off + 30];
      const inputsStart = off + 31;
      const inputsLen = rNIn * 3;
      if (inputsStart + inputsLen > bytes.length) throw new NetlistError("truncated REF inputs");
      const inputs: Signal[] = [];
      for (let i = 0; i < rNIn; i++) inputs.push(readU24(bytes, inputsStart + i * 3));
      gates.push({ kind: "REF", addr, id, nIn: rNIn, nOut: rNOut, inputs });
      off = inputsStart + inputsLen;
    } else {
      throw new NetlistError(`unknown gate tag 0x${tag.toString(16)} at offset ${off}`);
    }
    nextSignal++;
  }
  const nl: Netlist = { nIn, nOut, gates };
  validate(nl);
  return nl;
}

export function serialize(nl: Netlist): Uint8Array {
  const out: number[] = [];
  for (const g of nl.gates) {
    if (g.kind === "NAND") {
      out.push(0x00);
      writeU24(out, g.a);
      writeU24(out, g.b);
    } else if (g.kind === "LATCH") {
      out.push(0x01);
      writeU24(out, g.d);
    } else {
      out.push(0x02);
      const addrHex = g.addr.replace(/^0x/, "");
      if (addrHex.length !== 40) throw new NetlistError(`bad REF addr ${g.addr}`);
      for (let i = 0; i < 20; i++) out.push(parseInt(addrHex.slice(i * 2, i * 2 + 2), 16));
      writeU64(out, g.id);
      out.push(g.nIn, g.nOut);
      for (const s of g.inputs) writeU24(out, s);
    }
  }
  return new Uint8Array(out);
}

/**
 * Validates:
 *  - topological order: every reference is to a strictly lower signal.
 *  - outputs (last nOut gate signals) are not fed into any internal gate.
 * Throws NetlistError on violation (mirrors the contract's "NAND: future
 * signal" revert plus the output-feeds-internal constraint from BUILD.md).
 */
export function validate(nl: Netlist): void {
  const nGates = nl.gates.length;
  if (nl.nOut > nGates) throw new NetlistError("nOut exceeds gate count");
  const firstOut = firstOutputSignal(nl);

  const checkRef = (sig: Signal, ownSignal: number, ctx: string) => {
    if (sig < 0 || sig >= ownSignal) {
      throw new NetlistError(`${ctx}: future or self signal ${sig} >= ${ownSignal}`);
    }
  };

  for (let i = 0; i < nGates; i++) {
    const ownSignal = 2 + nl.nIn + i;
    const g = nl.gates[i];
    if (g.kind === "NAND") {
      checkRef(g.a, ownSignal, `gate ${i} (NAND.a)`);
      checkRef(g.b, ownSignal, `gate ${i} (NAND.b)`);
    } else if (g.kind === "LATCH") {
      checkRef(g.d, ownSignal, `gate ${i} (LATCH.d)`);
    } else {
      for (const s of g.inputs) checkRef(s, ownSignal, `gate ${i} (REF.input)`);
    }
  }

  // NOTE: "outputs must not feed internal gates" (BUILD.md section 3) is not
  // a separate runtime check here — given strict topological order plus the
  // "last nOut signals are outputs" convention, an internal gate (ownSignal <
  // firstOut) can never reference an output signal (index >= firstOut)
  // without *first* tripping the future-signal check above, since outputs
  // are by definition produced last. The constraint is therefore a
  // synthesis-time rule, not a parse-time one: a builder that needs an
  // output's value inside another gate must duplicate the gate (recompute it
  // earlier) rather than reference the later output signal. optimize.ts must
  // do this duplication; it cannot be expressed as reuse here.
}
