// BUILD.md 1c.5: full replay over the tasks 1c.1 proved have a COMPLETE
// deterministic spec (46/100; see docs/VECTOR-SPEC-CHECK.md) - built from
// REAL fetched vectors (api.fabx.tech), not guessed gate names (fixes
// fabx-replay.ts's Phase-1/1b approach, which hand-specified `specs` by
// reading task names). Every result is independently re-verified against
// the fetched truth table via exhaustiveTruthTable before being reported.
// Run: npx tsx scripts/fabx-replay-v2.ts > ../../docs/FABX-REPLAY.md

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize, fromRows, exhaustiveTruthTable, type Netlist } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "docs", "fabx-tasks.json"), "utf8"));

interface TaskMeta {
  id: number; name: string; nIn: number; nOut: number; kind: string;
  refNand: number; refLatch: number; refDepth: number; area: number; Cref: number;
}
const tasks: TaskMeta[] = bank.tasks;

async function fetchVectors(id: number): Promise<{ input: string; expectedOut: string }[]> {
  const res = await fetch(`https://api.fabx.tech/v1/pod/tasks/${id}/vectors?chainId=196`);
  const d = await res.json();
  return d.vectors;
}

function computeBufferedC(gates: number, depth: number, nOut: number): number {
  const A = gates + 2 * nOut;
  return A * Math.max(depth + 2, 1) ** 3;
}

interface Result {
  id: number; name: string; nIn: number; nOut: number; kind: string;
  refNand: number; refDepth: number; Cref: number;
  bestC: number | null; objective: string | null; q: number | null;
  verdict: "beat" | "tie" | "lose" | "skip"; reason?: string;
}

async function replayTask(t: TaskMeta): Promise<Result> {
  const vecs = await fetchVectors(t.id);
  const width = 1 << t.nIn;
  const mask = width - 1;
  // Decode: build nOut separate truth tables from the exhaustive (verified
  // complete in 1c.1) low-bit residues.
  const cols: bigint[] = Array.from({ length: t.nOut }, () => 0n);
  const seen = new Map<number, number>(); // residue -> packed output int, for the consistency check
  for (const v of vecs) {
    const inp = parseInt(v.input, 16) & mask;
    const out = parseInt(v.expectedOut, 16);
    if (seen.has(inp) && seen.get(inp) !== out) {
      return { id: t.id, name: t.name, nIn: t.nIn, nOut: t.nOut, kind: t.kind, refNand: t.refNand, refDepth: t.refDepth, Cref: t.Cref, bestC: null, objective: null, q: null, verdict: "skip", reason: "inconsistent vectors (should not happen post-1c.1 gating)" };
    }
    seen.set(inp, out);
    for (let k = 0; k < t.nOut; k++) if ((out >> k) & 1) cols[k] |= 1n << BigInt(inp);
  }
  if (seen.size !== width) {
    return { id: t.id, name: t.name, nIn: t.nIn, nOut: t.nOut, kind: t.kind, refNand: t.refNand, refDepth: t.refDepth, Cref: t.Cref, bestC: null, objective: null, q: null, verdict: "skip", reason: `incomplete coverage (${seen.size}/${width})` };
  }

  const objectives = ["area", "depth", "balanced", "c"] as const;
  let best: { objective: string; gates: number; depth: number } | null = null;
  for (const obj of objectives) {
    let totalGates = 0, maxDepth = 0;
    const nets: Netlist[] = [];
    for (let k = 0; k < t.nOut; k++) {
      const res = optimize(t.nIn, cols[k], obj, { cref: t.Cref });
      nets.push(res.netlist);
      totalGates += res.gates;
      maxDepth = Math.max(maxDepth, res.depth);
    }
    // Independent re-verification (BUILD.md 1b.5/1c.5): re-derive the exact
    // truth table from each output's candidate netlist and compare bit-for-
    // bit against the vectors we fetched - not trusting optimize()'s own
    // internal check.
    for (let k = 0; k < t.nOut; k++) {
      const got = exhaustiveTruthTable(nets[k]).map((r) => r[0]);
      const expectedBit: number[] = [];
      for (let x = 0; x < width; x++) expectedBit.push(Number((cols[k] >> BigInt(x)) & 1n));
      if (JSON.stringify(got) !== JSON.stringify(expectedBit)) {
        throw new Error(`task ${t.id} output ${k} objective ${obj}: INDEPENDENT RE-VERIFICATION FAILED`);
      }
    }
    const c = computeBufferedC(totalGates, maxDepth, t.nOut);
    if (best === null || c < computeBufferedC(best.gates, best.depth, t.nOut)) {
      best = { objective: obj, gates: totalGates, depth: maxDepth };
    }
  }
  const bestC = computeBufferedC(best!.gates, best!.depth, t.nOut);
  const q = Math.min(4, Math.max(0.25, t.Cref / bestC));
  const verdict = bestC < t.Cref ? "beat" : bestC === t.Cref ? "tie" : "lose";
  return { id: t.id, name: t.name, nIn: t.nIn, nOut: t.nOut, kind: t.kind, refNand: t.refNand, refDepth: t.refDepth, Cref: t.Cref, bestC, objective: best!.objective, q, verdict };
}

async function main() {
  const vectorCheck = JSON.parse(readFileSync("/tmp/vector_check_results.json", "utf8"));
  const completeIds: number[] = vectorCheck.filter((x: any) => x.status === "COMPLETE").map((x: any) => x.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const results: Result[] = [];
  for (const id of completeIds.sort((a, b) => a - b)) {
    const t = byId.get(id)!;
    try {
      results.push(await replayTask(t));
    } catch (e) {
      results.push({ id: t.id, name: t.name, nIn: t.nIn, nOut: t.nOut, kind: t.kind, refNand: t.refNand, refDepth: t.refDepth, Cref: t.Cref, bestC: null, objective: null, q: null, verdict: "skip", reason: String(e) });
    }
  }

  const beat = results.filter((r) => r.verdict === "beat");
  const tie = results.filter((r) => r.verdict === "tie");
  const lose = results.filter((r) => r.verdict === "lose");
  const skip = results.filter((r) => r.verdict === "skip");
  const scored = results.filter((r) => r.q !== null) as (Result & { q: number })[];
  const atCap = scored.filter((r) => r.q >= 4);
  const sortedQ = scored.map((r) => r.q).sort((a, b) => a - b);
  const median = sortedQ.length ? sortedQ[Math.floor(sortedQ.length / 2)] : null;

  const lines: string[] = [];
  lines.push("# FabX replay (BUILD.md 1c.5 - rebuilt from REAL fetched vectors, not guessed gate names)");
  lines.push("");
  lines.push(`Scope: the 46 tasks 1c.1 proved have a COMPLETE deterministic spec (comb, nIn<=8; see docs/VECTOR-SPEC-CHECK.md). The other 54 (8 wide-input combinational tasks with 9 to 18 inputs + all 46 sequential) are excluded - sampled vectors only, fitting them would be overfitting per BUILD.md's explicit rule. Convention: WITH 2*nOut buffer gates and +2 depth (resolved from Task 8's real Cref=1728 in Phase 1b/1c). Every "beat" below is independently re-derived and bit-compared against the real fetched vectors before being counted, not trusted from optimize()'s own internal check.`);
  lines.push("");
  lines.push(`**Counts**: beat ${beat.length} / tie ${tie.length} / lose ${lose.length} / skip ${skip.length} (of ${results.length} attempted). At the 4x q-cap: ${atCap.length}/${scored.length}. Median q: ${median?.toFixed(3)}.`);
  lines.push("");
  lines.push("## Top 10 margins (Cref/bestC, descending - biggest beats first)");
  lines.push("");
  lines.push("| task | name | nIn/nOut | Cref | bestC | q | objective | verdict |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const byMargin = [...scored].sort((a, b) => b.q - a.q).slice(0, 10);
  for (const r of byMargin) {
    lines.push(`| ${r.id} | ${r.name.replace(/\|/g, "/")} | ${r.nIn}/${r.nOut} | ${r.Cref} | ${r.bestC} | ${r.q!.toFixed(3)} | ${r.objective} | ${r.verdict} |`);
  }
  lines.push("");
  lines.push("## Full results (all 46)");
  lines.push("");
  lines.push("| task | name | nIn/nOut | Cref | bestC | q | objective | verdict |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.name.replace(/\|/g, "/")} | ${r.nIn}/${r.nOut} | ${r.Cref} | ${r.bestC ?? "-"} | ${r.q?.toFixed(3) ?? "-"} | ${r.objective ?? "-"} | ${r.verdict}${r.reason ? ` (${r.reason})` : ""} |`);
  }
  lines.push("");
  lines.push(`## Task 8 (GC-008, 3-input majority) explicitly`);
  const t8 = results.find((r) => r.id === 8)!;
  lines.push(`refNand=${t8.refNand}, refDepth=${t8.refDepth}, Cref=${t8.Cref}. Our best: C=${t8.bestC} via objective=${t8.objective} -> **${t8.verdict}**.`);

  console.log(lines.join("\n"));
}

main();
