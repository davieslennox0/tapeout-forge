// Benchmarks Forgeout's optimizer + equivalence checker against the public 39-circuit set at
// https://nand.aihashrate.stream/circuits/ (snapshot 2026-11-17 05:39, read 2026-11-18). This run
// covers the 23 X Layer circuits (source-circuits.json, scraped from that page's own data-* table
// attributes, not retyped by hand). All circuits are pure NAND, 0 latches, per the source page.
//
// Gas-per-step formula and X Layer constants from https://nand.aihashrate.stream/physics/ ("定律里
// 的系数" table, read 2026-11-18): E_step = alpha + betaN*N_NAND + betaL*N_LATCH + betaIn*n_in +
// betaOut*n_out. Credited explicitly in results.md.
//
// Run: npx tsx benchmarks/fourier39/run.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  circuitDepth, checkEquivalence, dedupe, exhaustiveTruthTable, fromNetlist, optimize,
  parse as parseNetlist, serialize, type Netlist, type Objective,
} from "../../packages/core/src/index.js";
import { fetchNetlist, getCircuitInfo } from "../../packages/chain/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RPC = "https://rpc.xlayer.tech";
const CHAIN_ID = 196;
const CHUNK_MAX = 24000;
const EXHAUSTIVE_CAP = 20;
const OBJECTIVES: Objective[] = ["area", "depth", "balanced", "c"];

// X Layer energy-additive-law constants (https://nand.aihashrate.stream/physics/, table under
// "定律里的系数（和公式同一份数据）", frozen/fitted coefficients, read 2026-11-18).
const XL = { alpha: 20319, betaN: 2280.82, betaL: 3179.81, betaIn: 324.71, betaOut: -1237.1 };

function eStep(nGates: number, nLatch: number, nIn: number, nOut: number): number {
  return XL.alpha + XL.betaN * nGates + XL.betaL * nLatch + XL.betaIn * nIn + XL.betaOut * nOut;
}

interface SourceRow {
  chain: string; processor: string; circuitId: number;
  gates: number; latches: number; nIn: number; nOut: number; depth: number; chunks: number;
}
const sourceRows: SourceRow[] = JSON.parse(readFileSync(join(__dirname, "source-circuits.json"), "utf8"));

async function rpcBlockNumber(): Promise<number> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const j = (await res.json()) as { result: string };
  return parseInt(j.result, 16);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

interface CircuitResult {
  chain: string; processor: string; circuitId: number;
  nIn: number; nOut: number; latches: number;
  gatesBefore: number; gatesAfter: number; gateReductionPct: number;
  depthBefore: number; depthAfter: number;
  bytesBefore: number; bytesAfter: number;
  chunksBefore: number; chunksAfter: number;
  afterMethod: string;
  equivalent: boolean | null; equivMethod: string;
  eStepBefore: number; eStepAfter: number; gasSavedPerStep: number;
  runtimeMs: number;
  readBlock: number;
  note: string;
}

/** Per-output independent optimize() + independent re-verification (fabx-replay-v2.ts's own
 *  established pattern, reused here against the REAL on-chain netlist instead of fetched vectors
 *  since we already have the true original netlist). Only valid for nIn<=EXHAUSTIVE_CAP. */
function perOutputOptimize(original: Netlist): { gates: number; depth: number; verified: boolean } {
  let totalGates = 0;
  let maxDepth = 0;
  let allVerified = true;
  for (let k = 0; k < original.nOut; k++) {
    const tt = fromNetlist(original, k);
    let best: { gates: number; depth: number; netlist: Netlist } | null = null;
    for (const obj of OBJECTIVES) {
      const r = optimize(original.nIn, tt, obj);
      if (best === null || r.gates < best.gates || (r.gates === best.gates && r.depth < best.depth)) {
        best = { gates: r.gates, depth: r.depth, netlist: r.netlist };
      }
    }
    // Independent re-verification: re-derive the candidate's own truth table and compare bit-for-
    // bit against the true on-chain output, not trusting optimize()'s internal check.
    const got = exhaustiveTruthTable(best!.netlist).map((row) => row[0]);
    const want: number[] = [];
    for (let x = 0; x < 1 << original.nIn; x++) want.push(Number((tt >> BigInt(x)) & 1n));
    if (JSON.stringify(got) !== JSON.stringify(want)) allVerified = false;
    totalGates += best!.gates;
    maxDepth = Math.max(maxDepth, best!.depth);
  }
  return { gates: totalGates, depth: maxDepth, verified: allVerified };
}

function checkEquivWithTimeout(a: Netlist, b: Netlist, timeoutMs: number): { equivalent: boolean | null; method: string } {
  const tmp = join(__dirname, `.tmp-check-${a.nIn}-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify({ aHex: toHex(serialize(a)), bHex: toHex(serialize(b)), nIn: a.nIn, nOut: a.nOut }));
  try {
    const repoRoot = join(__dirname, "../..");
    const out = execFileSync("npx", ["tsx", join(__dirname, "check-one.ts"), tmp], { timeout: timeoutMs, encoding: "utf8", cwd: repoRoot });
    const r = JSON.parse(out);
    return { equivalent: r.equivalent, method: r.method };
  } catch (e) {
    const msg = String((e as Error).message || e);
    return { equivalent: null, method: msg.includes("ETIMEDOUT") || msg.includes("timed out") ? "timeout" : `error: ${msg.slice(0, 200)}` };
  } finally {
    execFileSync("rm", ["-f", tmp]);
  }
}

async function runOne(row: SourceRow): Promise<CircuitResult> {
  const t0 = Date.now();
  const readBlock = await rpcBlockNumber();
  const original = await fetchNetlist(RPC, row.processor, BigInt(row.circuitId));
  const info = await getCircuitInfo(RPC, row.processor, BigInt(row.circuitId));

  const netlistBytes = serialize(original);
  writeFileSync(
    join(__dirname, "netlists", `${row.chain}-${row.processor}-${row.circuitId}.json`),
    JSON.stringify(
      {
        chain: row.chain, processor: row.processor, circuitId: row.circuitId,
        nIn: original.nIn, nOut: original.nOut, latches: info.nState,
        gates: original.gates.length, netlistHex: "0x" + toHex(netlistBytes),
        provenance: { rpc: RPC, chainId: CHAIN_ID, readBlock, readAt: new Date().toISOString() },
      },
      null,
      2
    )
  );

  const gatesBefore = original.gates.length;
  const depthBefore = circuitDepth(original);
  const bytesBefore = netlistBytes.length;
  const chunksBefore = Math.max(1, Math.ceil(bytesBefore / CHUNK_MAX));

  const deduped = dedupe(original);
  let gatesAfter = deduped.gates.length;
  let depthAfter = depthBefore; // dedupe is depth-neutral by construction
  let afterMethod = "dedupe";
  let equivalent: boolean | null = null;
  let equivMethod = "not run";
  let note = "";

  if (original.nIn <= EXHAUSTIVE_CAP) {
    const po = perOutputOptimize(original);
    if (po.gates < gatesAfter || (po.gates === gatesAfter && po.depth < depthAfter)) {
      gatesAfter = po.gates;
      depthAfter = po.depth;
      afterMethod = "per-output optimize (area/depth/balanced/c, best of 4)";
      equivalent = po.verified;
      equivMethod = "exhaustive, per-output, independently re-derived (not trusting optimize()'s own check)";
    } else {
      const eq = checkEquivalence(original, deduped);
      equivalent = eq.equivalent;
      equivMethod = `${eq.method} (whole-circuit, dedupe chosen over per-output optimize)`;
    }
  } else {
    note = `nIn=${original.nIn} exceeds optimize()'s exhaustive-truth-table cap (${EXHAUSTIVE_CAP}); only structural dedupe() was attempted, not full re-synthesis.`;
    const eq = checkEquivWithTimeout(original, deduped, 120_000);
    equivalent = eq.equivalent;
    equivMethod = eq.method === "timeout" ? "SAT-DPLL, timed out after 120s - NOT PROVEN" : eq.method === "not run" ? eq.method : `${eq.method} (child process, nIn>${EXHAUSTIVE_CAP})`;
  }

  // Never report a regression: dedupe's own trailing-buffer overhead (2 gates/output when the
  // outputs don't already land trailing) can make "after" bigger than doing nothing, as happened
  // for a real circuit in this run (#49: 27 gates -> 32 via dedupe). The honest result there is
  // "no improvement found", not a negative reduction dressed up as output.
  if (gatesAfter >= gatesBefore) {
    gatesAfter = gatesBefore;
    depthAfter = depthBefore;
    afterMethod = afterMethod === "dedupe" || afterMethod.startsWith("per-output") ? `${afterMethod}, both regressed or tied - kept original` : afterMethod;
    equivalent = true;
    equivMethod = "trivial (original kept unchanged - no candidate improved on it)";
    note = note ? `${note} Neither method improved on the original; original kept.` : "Neither dedupe() nor per-output optimize improved on the original; original kept.";
  }

  const bytesAfter = gatesAfter * 7; // pure NAND, 7 bytes/gate (0 latches across this whole set)
  const chunksAfter = Math.max(1, Math.ceil(bytesAfter / CHUNK_MAX));
  const gateReductionPct = gatesBefore > 0 ? ((gatesBefore - gatesAfter) / gatesBefore) * 100 : 0;
  const eStepBefore = eStep(gatesBefore, info.nState, original.nIn, original.nOut);
  const eStepAfter = eStep(gatesAfter, info.nState, original.nIn, original.nOut);

  return {
    chain: row.chain, processor: row.processor, circuitId: row.circuitId,
    nIn: original.nIn, nOut: original.nOut, latches: info.nState,
    gatesBefore, gatesAfter, gateReductionPct,
    depthBefore, depthAfter,
    bytesBefore, bytesAfter, chunksBefore, chunksAfter,
    afterMethod, equivalent, equivMethod,
    eStepBefore, eStepAfter, gasSavedPerStep: eStepBefore - eStepAfter,
    runtimeMs: Date.now() - t0,
    readBlock,
    note,
  };
}

async function main() {
  mkdirSync(join(__dirname, "netlists"), { recursive: true });
  const results: CircuitResult[] = [];
  const rows = process.env.LIMIT ? sourceRows.slice(0, Number(process.env.LIMIT)) : sourceRows;
  for (const row of rows) {
    process.stderr.write(`running ${row.chain} ${row.processor} #${row.circuitId} (nIn=${row.nIn}, gates=${row.gates})...\n`);
    try {
      const r = await runOne(row);
      results.push(r);
      process.stderr.write(`  -> ${r.gatesBefore} -> ${r.gatesAfter} gates (${r.gateReductionPct.toFixed(1)}%), equivalent=${r.equivalent}, ${r.runtimeMs}ms\n`);
    } catch (e) {
      process.stderr.write(`  FAILED: ${e}\n`);
      results.push({
        chain: row.chain, processor: row.processor, circuitId: row.circuitId,
        nIn: row.nIn, nOut: row.nOut, latches: row.latches,
        gatesBefore: row.gates, gatesAfter: row.gates, gateReductionPct: 0,
        depthBefore: row.depth, depthAfter: row.depth,
        bytesBefore: row.gates * 7, bytesAfter: row.gates * 7, chunksBefore: row.chunks, chunksAfter: row.chunks,
        afterMethod: "FAILED", equivalent: null, equivMethod: "not run",
        eStepBefore: 0, eStepAfter: 0, gasSavedPerStep: 0, runtimeMs: 0, readBlock: 0,
        note: `FAILED: ${e}`,
      });
    }
  }
  writeFileSync(join(__dirname, "raw-results.json"), JSON.stringify(results, null, 2));
  process.stderr.write(`\nDone: ${results.length} circuits.\n`);
}

main();
