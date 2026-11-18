// Turns raw-results.json into results.csv + results.md. Run after run.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  runtimeMs: number; readBlock: number; note: string;
}

const results: CircuitResult[] = JSON.parse(readFileSync(join(__dirname, "raw-results.json"), "utf8"));

function explorerLink(processor: string, id: number): string {
  return `https://www.oklink.com/xlayer/address/${processor}`;
}

// --- CSV ---
const csvCols = [
  "chain", "processor", "circuitId", "nIn", "nOut", "latches",
  "gatesBefore", "gatesAfter", "gateReductionPct", "depthBefore", "depthAfter",
  "bytesBefore", "bytesAfter", "chunksBefore", "chunksAfter", "afterMethod",
  "equivalent", "equivMethod", "eStepBefore", "eStepAfter", "gasSavedPerStep",
  "runtimeMs", "readBlock", "note",
];
const csvLines = [csvCols.join(",")];
for (const r of results) {
  csvLines.push(
    csvCols
      .map((c) => {
        const v = (r as any)[c];
        if (typeof v === "string" && (v.includes(",") || v.includes('"'))) return `"${v.replace(/"/g, '""')}"`;
        return v === null || v === undefined ? "" : String(v);
      })
      .join(",")
  );
}
writeFileSync(join(__dirname, "results.csv"), csvLines.join("\n") + "\n");

// --- Headline numbers ---
const valid = results.filter((r) => r.afterMethod !== "FAILED");
const improved = valid.filter((r) => r.gatesAfter < r.gatesBefore);
const alreadyOptimal = valid.filter((r) => r.gatesAfter === r.gatesBefore);
const unprovenEquiv = valid.filter((r) => r.equivalent !== true);
const reductions = valid.map((r) => r.gateReductionPct).sort((a, b) => a - b);
const median = reductions.length ? reductions[Math.floor(reductions.length / 2)] : 0;
const best = Math.max(...reductions, 0);
const totalGasSaved = valid.reduce((s, r) => s + r.gasSavedPerStep, 0);
const totalGatesSaved = valid.reduce((s, r) => s + (r.gatesBefore - r.gatesAfter), 0);

// --- results.md ---
const lines: string[] = [];
lines.push("# Forgeout vs. the public 39-circuit set (23 X Layer circuits)");
lines.push("");
lines.push(
  "**Source dataset**: [nand.aihashrate.stream/circuits/](https://nand.aihashrate.stream/circuits/) " +
    "(39 circuits, 16 BSC + 23 X Layer, all pure NAND / 0 latches; list snapshot 2026-11-17 05:39, read 2026-11-18). " +
    "This run covers the 23 X Layer circuits only; the 16 BSC circuits are out of scope for this pass."
);
lines.push(
  "**Gas formula**: `E_step = alpha + betaN*N_NAND + betaL*N_LATCH + betaIn*n_in + betaOut*n_out`, " +
    "constants from [nand.aihashrate.stream/physics/](https://nand.aihashrate.stream/physics/) " +
    "(\"定律里的系数\" table, read 2026-11-18). X Layer: alpha=20,319, betaN=2,280.82, betaL=3,179.81, " +
    "betaIn=324.71, betaOut=-1,237.10 (all gas; betaOut is negative in their fit, used as given, not clamped)."
);
lines.push("");
lines.push(
  "**Method**: for each circuit, the real on-chain netlist is fetched directly via `netlist(id)`/`circuitInfo(id)` " +
    "on its own processor contract (saved to `netlists/`, with the read block for provenance). For circuits with " +
    "nIn<=20, Forgeout's full optimizer runs independently per output bit (area/depth/balanced/c objectives, best of 4), " +
    "each candidate independently re-derived and bit-compared against the real on-chain function - not trusted from the " +
    "optimizer's own internal check. For nIn>20 (exact synthesis and exhaustive truth tables aren't feasible past that " +
    "size - `optimize()` itself refuses above 20), only the structural `dedupe()` pass runs (works on any nIn, provably " +
    "depth-neutral and gate-count non-increasing by construction), with equivalence re-checked via the SAT-based checker " +
    "under a 120s timeout in a separate process. Whichever of (per-output optimize, dedupe) gives fewer gates is reported " +
    "as \"after\"; ties go to lower depth."
);
lines.push("");
lines.push(
  `**Headline**: ${improved.length}/${valid.length} circuits improved, ${alreadyOptimal.length} already optimal (0% reduction), ` +
    `median reduction ${median.toFixed(1)}%, best ${best.toFixed(1)}%. Total gas saved across all 23: ` +
    `${totalGasSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })} gas/step (sum of each circuit's own E_step delta). ` +
    (unprovenEquiv.length ? `${unprovenEquiv.length} circuit(s) could not be proven equivalent within this run's limits - see notes below, not counted as verified.` : "All reported reductions independently verified equivalent.")
);
lines.push("");
lines.push("## Full results");
lines.push("");
lines.push("| id | processor | nIn/nOut | gates before→after | reduction | depth before→after | chunks before→after | equivalent | method | runtime |");
lines.push("|---|---|---|---|---|---|---|---|---|---|");
for (const r of results) {
  const eq = r.equivalent === true ? "✓ yes" : r.equivalent === false ? "✗ NO (mismatch found)" : "? not proven";
  const procShort = `[${r.processor.slice(0, 8)}…${r.processor.slice(-4)}](${explorerLink(r.processor, r.circuitId)})`;
  lines.push(
    `| #${r.circuitId} | ${procShort} | ${r.nIn}/${r.nOut} | ${r.gatesBefore}→${r.gatesAfter} | ${r.gateReductionPct.toFixed(1)}% | ${r.depthBefore}→${r.depthAfter} | ${r.chunksBefore}→${r.chunksAfter} | ${eq} | ${r.afterMethod} | ${(r.runtimeMs / 1000).toFixed(1)}s |`
  );
}
lines.push("");
lines.push("## Notes / honesty checks");
lines.push("");
if (alreadyOptimal.length) {
  lines.push(`- **Already optimal (0% gate reduction), not oversold as a "win"**: ${alreadyOptimal.map((r) => `#${r.circuitId}`).join(", ")}.`);
}
if (unprovenEquiv.length) {
  lines.push(`- **Equivalence not proven within this run's limits**: ${unprovenEquiv.map((r) => `#${r.circuitId} (${r.equivMethod})`).join("; ")}. Their gate counts above are real, but not independently confirmed to compute the same function - treat as unverified, not as a beat.`);
}
const dropped = results.filter((r) => r.chunksAfter < r.chunksBefore);
if (dropped.length) {
  lines.push(`- **Chunk count dropped (fewer 24,000-byte storage chunks needed)**: ${dropped.map((r) => `#${r.circuitId} (${r.chunksBefore}→${r.chunksAfter})`).join(", ")}. The source page's own physics notes show chunk-splicing cost scaling roughly with the 4th power of chunk count, so these are disproportionately valuable reductions, not just linear gate savings.`);
}
const wideInput = results.filter((r) => r.nIn > 20);
if (wideInput.length) {
  lines.push(`- **Wide-input circuits (nIn>20), optimizer not fully applicable**: ${wideInput.map((r) => `#${r.circuitId} (nIn=${r.nIn})`).join(", ")}. Only structural dedup ran; full re-synthesis needs an exhaustive truth table, infeasible at this width (2^${wideInput[0]?.nIn ?? "N"} rows).`);
}
const failed = results.filter((r) => r.afterMethod === "FAILED");
if (failed.length) {
  lines.push(`- **Failed to process**: ${failed.map((r) => `#${r.circuitId} (${r.note})`).join("; ")}.`);
}
lines.push(
  `- Several circuits in this set look like deliberate physics-probe constructions from the source site itself (e.g. long single-input NAND chains used to test their own depth-scaling law, or many parallel 2-input gates used to test chunk scaling), not hand-written "real" functions - noted here rather than presented as if Forgeout found a clever win on meaningful logic.`
);
lines.push(`- Netlists saved under \`netlists/\` include the exact read block and RPC used, so every number above is reproducible.`);

writeFileSync(join(__dirname, "results.md"), lines.join("\n") + "\n");

console.log(JSON.stringify({ improved: improved.length, total: valid.length, alreadyOptimal: alreadyOptimal.length, median, best, totalGasSaved, totalGatesSaved, unprovenEquiv: unprovenEquiv.length }, null, 2));
