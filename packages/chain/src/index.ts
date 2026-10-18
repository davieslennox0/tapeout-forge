import type { Netlist } from "@tapeout-forge/core";
import { evalCombinational } from "@tapeout-forge/core";

export interface RpcError {
  code: number;
  message: string;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  return json.result;
}

function toU256Hex(v: bigint | number): string {
  return BigInt(v).toString(16).padStart(64, "0");
}

/** eval(uint256 id, bytes inputs) - selector 934d06ea, VERIFIED (BUILD.md section 3). */
function encodeEvalCalldata(id: bigint, inputs: Uint8Array): string {
  const selector = "934d06ea";
  const idHead = toU256Hex(id);
  const offsetHead = toU256Hex(64); // bytes arg starts right after the two 32B head slots
  const lenHead = toU256Hex(inputs.length);
  const dataHex = Buffer.from(inputs).toString("hex");
  const paddedLen = Math.ceil(inputs.length / 32) * 32;
  const dataPadded = dataHex.padEnd(paddedLen * 2, "0");
  return "0x" + selector + idHead + offsetHead + lenHead + dataPadded;
}

/** Decodes a single `bytes` ABI return value (offset=0x20, then length, then data). */
function decodeBytesReturn(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length < 128) throw new Error(`decodeBytesReturn: return data too short (${clean.length} hex chars)`);
  const length = parseInt(clean.slice(64, 128), 16);
  const dataHex = clean.slice(128, 128 + length * 2);
  return Uint8Array.from(Buffer.from(dataHex, "hex"));
}

export interface EvalCallResult {
  outputBytes: Uint8Array;
  /** bit0 = first output pin (BUILD.md section 3). */
  outputBits: number[];
}

export async function callEval(
  rpcUrl: string,
  processor: string,
  id: bigint,
  inputs: Uint8Array,
  nOut: number
): Promise<EvalCallResult> {
  const data = encodeEvalCalldata(id, inputs);
  const resultHex = await rpcCall(rpcUrl, "eth_call", [{ to: processor, data }, "latest"]);
  const outputBytes = decodeBytesReturn(resultHex);
  const outputBits: number[] = [];
  for (let k = 0; k < nOut; k++) {
    const byteIdx = k >> 3;
    const bitIdx = k & 7;
    outputBits.push(byteIdx < outputBytes.length ? (outputBytes[byteIdx] >> bitIdx) & 1 : 0);
  }
  return { outputBytes, outputBits };
}

/** Packs input bits (bit0 = first pin) into bytes for the eval() call's `inputs` argument. */
export function packInputBits(bits: number[]): Uint8Array {
  const nBytes = Math.ceil(bits.length / 8) || 1;
  const out = new Uint8Array(nBytes);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) out[i >> 3] |= 1 << (i & 7);
  }
  return out;
}

export interface VerifyOnchainResult {
  onchain: EvalCallResult;
  localSimulation: number[] | null;
  match: boolean | null; // null if no local netlist was available to compare
  netlistFetchAttempted: boolean;
  note: string;
}

/**
 * Compares a REAL eth_call to eval() against a local simulation, IF a local
 * netlist is supplied. BUILD.md 1.9 also asks to "fetch netlist(id) if that
 * function exists" - NOT attempted here: there is no VERIFIED selector/ABI
 * for such a getter (nothing in BUILD.md section 3 confirms one exists), and
 * guessing one would require computing a correct keccak256 selector hash
 * from scratch with no way to verify it's right if it silently fails -
 * exactly the kind of invented-fact risk BUILD.md's honesty rule forbids.
 * Logged as UNVERIFIED/skipped, per BUILD.md's own permission to do so,
 * rather than risk a wrong guess that looks like a real result.
 */
export async function verifyOnchain(
  rpcUrl: string,
  processor: string,
  id: bigint,
  inputBits: number[],
  localNetlist: Netlist | null
): Promise<VerifyOnchainResult> {
  const inputs = packInputBits(inputBits);
  const onchain = await callEval(rpcUrl, processor, id, inputs, localNetlist?.nOut ?? 1);

  let localSimulation: number[] | null = null;
  let match: boolean | null = null;
  if (localNetlist) {
    localSimulation = evalCombinational(localNetlist, inputBits);
    match = JSON.stringify(localSimulation) === JSON.stringify(onchain.outputBits);
  }

  return {
    onchain,
    localSimulation,
    match,
    netlistFetchAttempted: false,
    note:
      "netlist(id) ABI is UNVERIFIED (no confirmed getter selector in BUILD.md) - not attempted. " +
      (localNetlist
        ? "Compared against the user-supplied --netlist-hex instead."
        : "No local netlist supplied - only the raw eval() result is reported, not a comparison."),
  };
}
