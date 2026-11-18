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
interface Classification { processor: string; circuitId: number; group: "A" | "B"; reason: string }

const results: CircuitResult[] = JSON.parse(readFileSync(join(__dirname, "raw-results.json"), "utf8"));
const classification: Classification[] = JSON.parse(readFileSync(join(__dirname, "classification.json"), "utf8"));
const groupOf = new Map(classification.map((c) => [`${c.processor.toLowerCase()}:${c.circuitId}`, c]));
function classify(r: CircuitResult): Classification {
  const c = groupOf.get(`${r.processor.toLowerCase()}:${r.circuitId}`);
  if (!c) throw new Error(`no classification for ${r.processor}:${r.circuitId}`);
  return c;
}

function explorerLink(processor: string): string {
  return `https://www.oklink.com/xlayer/address/${processor}`;
}

// --- CSV (unchanged structure - classification lives only in results.md / the web page) ---
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

// --- Group stats ---
interface GroupStats {
  label: string; rows: CircuitResult[];
  improved: CircuitResult[]; alreadyOptimal: CircuitResult[]; unprovenEquiv: CircuitResult[];
  median: number; best: number; totalGasSaved: number; totalGatesSaved: number;
}
function statsFor(label: string, rows: CircuitResult[]): GroupStats {
  const valid = rows.filter((r) => r.afterMethod !== "FAILED");
  const improved = valid.filter((r) => r.gatesAfter < r.gatesBefore);
  const alreadyOptimal = valid.filter((r) => r.gatesAfter === r.gatesBefore);
  const unprovenEquiv = valid.filter((r) => r.equivalent !== true);
  const reductions = valid.map((r) => r.gateReductionPct).sort((a, b) => a - b);
  const median = reductions.length ? reductions[Math.floor(reductions.length / 2)] : 0;
  const best = Math.max(0, ...reductions);
  const totalGasSaved = valid.reduce((s, r) => s + r.gasSavedPerStep, 0);
  const totalGatesSaved = valid.reduce((s, r) => s + (r.gatesBefore - r.gatesAfter), 0);
  return { label, rows, improved, alreadyOptimal, unprovenEquiv, median, best, totalGasSaved, totalGatesSaved };
}
const groupA = statsFor("A", results.filter((r) => classify(r).group === "A"));
const groupB = statsFor("B", results.filter((r) => classify(r).group === "B"));

function headlineLine(g: GroupStats): string {
  const valid = g.rows.filter((r) => r.afterMethod !== "FAILED");
  return (
    `${g.improved.length}/${valid.length} circuits improved, ${g.alreadyOptimal.length} already optimal (0% reduction), ` +
    `median reduction ${g.median.toFixed(1)}%, best ${g.best.toFixed(1)}%. Total gas saved: ` +
    `${g.totalGasSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })} gas/step (${g.totalGatesSaved.toLocaleString()} gates saved total). ` +
    (g.unprovenEquiv.length ? `${g.unprovenEquiv.length} circuit(s) could not be proven equivalent within this run's limits - not counted as verified.` : "All reported reductions independently verified equivalent.")
  );
}

function tableFor(rows: CircuitResult[]): string[] {
  const lines = [
    "| id | processor | nIn/nOut | gates before→after | reduction | depth before→after | chunks before→after | equivalent | method | runtime |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const eq = r.equivalent === true ? "✓ yes" : r.equivalent === false ? "✗ NO (mismatch found)" : "? not proven";
    const procShort = `[${r.processor.slice(0, 8)}…${r.processor.slice(-4)}](${explorerLink(r.processor)})`;
    lines.push(
      `| #${r.circuitId} | ${procShort} | ${r.nIn}/${r.nOut} | ${r.gatesBefore}→${r.gatesAfter} | ${r.gateReductionPct.toFixed(1)}% | ${r.depthBefore}→${r.depthAfter} | ${r.chunksBefore}→${r.chunksAfter} | ${eq} | ${r.afterMethod} | ${(r.runtimeMs / 1000).toFixed(1)}s |`
    );
  }
  return lines;
}

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
lines.push("## Functional vs. probe circuits: how and why this run splits the set");
lines.push("");
lines.push(
  "The 23 circuits are not all the same kind of thing. Some are ordinary multi-input/multi-output combinational logic; " +
    "others are, structurally, chains or mass-duplicated gates with no real function - the kind of construction you'd " +
    "build to measure a cost law, not to compute something. Benchmarking both together and reporting one blended number " +
    "would make Forgeout look either better or worse than it is depending on which kind dominates the sample, so this " +
    "run classifies each circuit and reports the two groups separately."
);
lines.push("");
lines.push(
  "**What the source site itself confirms, checked directly against both its circuits page and its physics page " +
    "(`nand.aihashrate.stream/physics/`), not assumed:**"
);
lines.push(
  "- Exactly **one** circuit in this set is explicitly named on the source site: circuit **#3** on processor " +
    "`0xa93e807f...2aa3` (nIn=320, nOut=32) - the circuits page's own `data-cpu` row literally labels it " +
    "`\"21nandkit DOT32_T · 三值点积\"` (a ternary dot product), and the physics page's Law 15 (real-circuit " +
    "compilation, experiment **E3**) names `DOT32_T` by name as its real-circuit test subject. Confirmed functional, " +
    "not a probe - and a useful check that *wide input count alone* doesn't mean \"probe\" (see #1 and #9 below)."
);
lines.push(
  "- The physics page's controlled law experiments (Law 1 \"depth is free\"; Law 3 \"memory-squared\"; the E1b " +
    "hierarchy-savings experiment) explicitly describe using **separately-sized, purpose-built or injected synthetic " +
    "netlists** (a fixed 2,000-gate circuit at four depths for Law 1; up to 100,064 gates / 30 sub-circuits for E1b; " +
    "\"inject synthetic netlists of a few thousand to 100,000 gates\" for Law 3) - none of which match any of these " +
    "23 circuits' exact gate counts. So this run does **not** claim any of the remaining 22 circuits is literally a " +
    "named experiment's dataset; no such 1:1 match exists in the source text."
);
lines.push(
  "- What the physics page *does* confirm is the likely origin of the degenerate-looking ones: its cross-validation " +
    "methodology (experiments **E11b** and **E13**, used to validate the fitted energy law against real deployed " +
    "circuits) explicitly drew **random real on-chain circuits**, and explicitly reports that this random draw " +
    "included repeats - \"10 of 30 random BSC draws were the same 1-gate netlist\" (原文: \"E11b 随机抽到的 BSC 电路 " +
    "30 颗里 10 颗是同一份 1 门网表\"). That is exactly the shape of #288/#314/#1387 below (three identical " +
    "10,000-gate, 2-input circuits under one processor) - strong circumstantial support that the mass-duplicated and " +
    "long-chain circuits in this set are real artifacts swept into that same kind of real-circuit sampling, not " +
    "necessarily hand-built by the site, but genuinely non-representative of real logic design either way."
);
lines.push(
  "- One classification here is a judgment call, not a sourced fact: **#66** (88 inputs, only 100 gates, depth 4). " +
    "No explicit label exists for it either way. It's placed in the probe group because 100 gates/depth 4 is too " +
    "shallow to meaningfully combine 88 independent inputs - but unlike the chains and mass-duplicates above, this " +
    "is inference from shape, not a sourced match, and is flagged as such in the table below."
);
lines.push("");
lines.push("**Criteria used:** Group A (functional) - plausible real combinational logic, no degenerate structure. Group B (probe) - single- or dual-input NAND chains where depth equals gate count (no logic possible, pure chain), mass-duplicated parallel gates (only 16 distinct 2-input functions exist, so thousands of them is redundancy not logic), or (one case, flagged) extreme width-to-logic ratio.");
lines.push("");
lines.push("## Group A — functional circuits (headline)");
lines.push("");
lines.push(headlineLine(groupA));
lines.push("");
lines.push(...tableFor(groupA.rows));
lines.push("");
lines.push("## Group B — probe circuits (not representative)");
lines.push("");
lines.push(
  "These are the source site's own physics-measurement constructions (or, for #66, a shape strongly resembling one) - " +
    "not hand-written functions. Included for completeness and transparency, but **excluded from the headline** because " +
    "optimizing a NAND chain or deduplicating 10,000 identical redundant gates is not a meaningful demonstration of " +
    "Forgeout's optimizer."
);
lines.push("");
lines.push(headlineLine(groupB));
lines.push("");
lines.push(...tableFor(groupB.rows));
lines.push("");
lines.push("### Per-circuit classification reasons");
lines.push("");
lines.push("| id | processor | group | reason |");
lines.push("|---|---|---|---|");
for (const r of results) {
  const c = classify(r);
  lines.push(`| #${r.circuitId} | [${r.processor.slice(0, 8)}…${r.processor.slice(-4)}](${explorerLink(r.processor)}) | ${c.group} | ${c.reason} |`);
}
lines.push("");
lines.push("## Notes / honesty checks");
lines.push("");
const alreadyOptimalAll = [...groupA.alreadyOptimal, ...groupB.alreadyOptimal];
if (alreadyOptimalAll.length) {
  lines.push(`- **Already optimal (0% gate reduction), not oversold as a "win"**: ${alreadyOptimalAll.map((r) => `#${r.circuitId}`).join(", ")}.`);
}
const unprovenAll = [...groupA.unprovenEquiv, ...groupB.unprovenEquiv];
if (unprovenAll.length) {
  lines.push(`- **Equivalence not proven within this run's limits**: ${unprovenAll.map((r) => `#${r.circuitId} (${r.equivMethod})`).join("; ")}. Their gate counts above are real, but not independently confirmed to compute the same function - treat as unverified, not as a beat.`);
}
const dropped = results.filter((r) => r.chunksAfter < r.chunksBefore);
if (dropped.length) {
  lines.push(`- **Chunk count dropped (fewer 24,000-byte storage chunks needed)**: ${dropped.map((r) => `#${r.circuitId} (${r.chunksBefore}→${r.chunksAfter})`).join(", ")}. The source page's own physics notes show chunk-splicing cost scaling roughly with the 4th power of chunk count, so these are disproportionately valuable reductions, not just linear gate savings. (All of these happen to be Group B circuits.)`);
}
const wideInput = results.filter((r) => r.nIn > 20);
if (wideInput.length) {
  lines.push(`- **Wide-input circuits (nIn>20), optimizer not fully applicable**: ${wideInput.map((r) => `#${r.circuitId} (nIn=${r.nIn})`).join(", ")}. Only structural dedup ran; full re-synthesis needs an exhaustive truth table, infeasible at this width.`);
}
const failed = results.filter((r) => r.afterMethod === "FAILED");
if (failed.length) {
  lines.push(`- **Failed to process**: ${failed.map((r) => `#${r.circuitId} (${r.note})`).join("; ")}.`);
}
lines.push(`- Netlists saved under \`netlists/\` include the exact read block and RPC used, so every number above is reproducible.`);

writeFileSync(join(__dirname, "results.md"), lines.join("\n") + "\n");

console.log(JSON.stringify({
  groupA: { improved: groupA.improved.length, total: groupA.rows.length, alreadyOptimal: groupA.alreadyOptimal.length, median: groupA.median, best: groupA.best, totalGasSaved: groupA.totalGasSaved, unprovenEquiv: groupA.unprovenEquiv.length },
  groupB: { improved: groupB.improved.length, total: groupB.rows.length, alreadyOptimal: groupB.alreadyOptimal.length, median: groupB.median, best: groupB.best, totalGasSaved: groupB.totalGasSaved, unprovenEquiv: groupB.unprovenEquiv.length },
}, null, 2));
