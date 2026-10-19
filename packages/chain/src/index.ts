import type { Netlist } from "@forgeout/core";
import { evalCombinational, parse as parseNetlist } from "@forgeout/core";
import { keccak256 } from "js-sha3";

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

function selector(sig: string): string {
  return keccak256(sig).slice(0, 8);
}

/** eval(uint256 id, bytes inputs) - selector 934d06ea, VERIFIED (BUILD.md section 3). */
function encodeEvalCalldata(id: bigint, inputs: Uint8Array): string {
  const sel = "934d06ea";
  const idHead = toU256Hex(id);
  const offsetHead = toU256Hex(64);
  const lenHead = toU256Hex(inputs.length);
  const dataHex = Buffer.from(inputs).toString("hex");
  const paddedLen = Math.ceil(inputs.length / 32) * 32;
  const dataPadded = dataHex.padEnd(paddedLen * 2, "0");
  return "0x" + sel + idHead + offsetHead + lenHead + dataPadded;
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

export interface CircuitInfo {
  nIn: number;
  nOut: number;
  nState: number;
  gateCount: number;
}

/**
 * circuitInfo(uint256) -> (nIn, nOut, nState, gateCount). VERIFIED (Phase
 * 1b): selector 084d60f1 = keccak256("circuitInfo(uint256)"), empirically
 * confirmed by calling it against processor
 * 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 ids 1-5 (all nState=0,
 * gateCount matching the netlist() byte length / 7 exactly) and against
 * 0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6 ("FAB_TST") ids 1-110, where
 * id=49 returned nState=1 - a real on-chain LATCH circuit (see
 * docs/NEW.md). This resolves Phase 1's "UNVERIFIED, not attempted"
 * stance in the old verifyOnchain() docstring - the selector was found by
 * computing keccak256 of several plausible candidate signatures and
 * testing each via a real eth_call, not guessed-and-assumed.
 */
export async function getCircuitInfo(rpcUrl: string, processor: string, id: bigint): Promise<CircuitInfo> {
  const data = "0x" + selector("circuitInfo(uint256)") + toU256Hex(id);
  const resultHex = await rpcCall(rpcUrl, "eth_call", [{ to: processor, data }, "latest"]);
  const hex = resultHex.replace(/^0x/, "");
  const words = [0, 1, 2, 3].map((i) => Number(BigInt("0x" + hex.slice(i * 64, i * 64 + 64))));
  return { nIn: words[0], nOut: words[1], nState: words[2], gateCount: words[3] };
}

/**
 * netlist(uint256) -> bytes (the raw TAP-02 gate stream). VERIFIED (Phase
 * 1b): selector 3fc4be56 = keccak256("netlist(uint256)"), confirmed the
 * same way as circuitInfo above - decoded bytes round-trip exactly through
 * @forgeout/core's parse() (topological-order/future-signal validation
 * passes) for every id tested. This is the ACTUAL on-chain reference
 * netlist, not a reconstruction.
 */
export async function getNetlistBytes(rpcUrl: string, processor: string, id: bigint): Promise<Uint8Array> {
  const data = "0x" + selector("netlist(uint256)") + toU256Hex(id);
  const resultHex = await rpcCall(rpcUrl, "eth_call", [{ to: processor, data }, "latest"]);
  return decodeBytesReturn(resultHex);
}

/** Fetches circuitInfo + netlist and parses into our own Netlist type via core's parse(). */
export async function fetchNetlist(rpcUrl: string, processor: string, id: bigint): Promise<Netlist> {
  const info = await getCircuitInfo(rpcUrl, processor, id);
  const bytes = await getNetlistBytes(rpcUrl, processor, id);
  return parseNetlist(bytes, info.nIn, info.nOut);
}

export interface VerifyOnchainResult {
  onchain: EvalCallResult;
  localSimulation: number[] | null;
  match: boolean | null; // null if no local netlist was available to compare
  netlistFetchAttempted: boolean;
  note: string;
}

/**
 * Compares a REAL eth_call to eval() against a local simulation. PHASE 1b
 * UPDATE: now fetches the real on-chain netlist itself via fetchNetlist()
 * (netlist(id)'s ABI is now VERIFIED, see getNetlistBytes's docstring) when
 * no local netlist is explicitly supplied, instead of requiring one.
 *
 * NOTE: eval() reverts with "has latch: use step" for circuits with
 * nState>0 (empirically observed against FAB_TST id=49) - this function
 * does not attempt eval() for such circuits; a separate step() mechanism
 * clearly exists but its selector/ABI was not found after probing 10
 * plausible candidate signatures, and BUILD.md's honesty rule forbids
 * guessing further rather than reporting that plainly (see docs/NEW.md).
 */
export async function verifyOnchain(
  rpcUrl: string,
  processor: string,
  id: bigint,
  inputBits: number[],
  localNetlist?: Netlist | null
): Promise<VerifyOnchainResult> {
  const info = await getCircuitInfo(rpcUrl, processor, id);
  if (info.nState > 0) {
    return {
      onchain: { outputBytes: new Uint8Array(), outputBits: [] },
      localSimulation: null,
      match: null,
      netlistFetchAttempted: false,
      note: `circuit ${id} has nState=${info.nState}>0 - eval() reverts ("has latch: use step") for stateful circuits; step()'s ABI is UNVERIFIED (not guessed), so this comparison cannot run.`,
    };
  }

  const netlist = localNetlist ?? (await fetchNetlist(rpcUrl, processor, id));
  const inputs = packInputBits(inputBits);
  const onchain = await callEval(rpcUrl, processor, id, inputs, netlist.nOut);
  const localSimulation = evalCombinational(netlist, inputBits);
  const match = JSON.stringify(localSimulation) === JSON.stringify(onchain.outputBits);

  return {
    onchain,
    localSimulation,
    match,
    netlistFetchAttempted: !localNetlist,
    note: localNetlist
      ? "Compared against the user-supplied --netlist-hex."
      : "Compared against the REAL on-chain netlist, fetched via netlist(id) (VERIFIED ABI, see getNetlistBytes docstring) - not user-supplied.",
  };
}
