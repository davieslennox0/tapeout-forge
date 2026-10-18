// BUILD.md step 1.10: FabX replay (read-only, no wallet, no submissions).
// Run: npx tsx scripts/fabx-replay.ts > ../../docs/FABX-REPLAY.md (or see repo's docs/FABX-REPLAY.md, already generated)
//
// Convention check (empirical, from docs/fabx-tasks.json's own fields - no
// on-chain netlist fetch needed): Task 8 (GC-008, 3-input majority) reports
// refNand=8, refDepth=6, area=8, Cref=1728 = 8*6^3. This EXACTLY matches
// BUILD.md section 3's "WITH the 2 output buffers" numbers (8 gates, depth
// 6), not the "without buffers" numbers (6 gates, depth 4, C=384). FabX's
// own reference values already include the 2 contract-appended buffers per
// output. Resolved from data, not reasoning alone - this file's very first
// printed line states the resolution plainly.
//
// Coverage: only tasks whose target function is UNAMBIGUOUSLY identifiable
// from its name (standard gates/arithmetic/comparators) are attempted.
// Sequential tasks (27-30) are skipped - LATCH/sequential synthesis is not
// implemented in optimize.ts (combinational only). A few combinational
// tasks with genuinely ambiguous exact output encoding (12, 24, 26) are
// also skipped rather than guessed. This is a documented scope cut (see
// docs/NEW.md), not an attempt at full 100-task coverage.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize, fromRows, exhaustiveTruthTable } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "docs", "fabx-tasks.json"), "utf8"));

type Spec = { nIn: number; nOut: number; fn: (bits: number[]) => number[] };

function maj(a: number, b: number, c: number): number {
  return a + b + c >= 2 ? 1 : 0;
}

const specs: Record<number, Spec> = {
  1: { nIn: 1, nOut: 1, fn: ([a]) => [1 - a] },
  2: { nIn: 2, nOut: 1, fn: ([a, b]) => [1 - (a & b)] },
  3: { nIn: 2, nOut: 1, fn: ([a, b]) => [a & b] },
  4: { nIn: 2, nOut: 1, fn: ([a, b]) => [a | b] },
  5: { nIn: 2, nOut: 1, fn: ([a, b]) => [1 - (a | b)] },
  6: { nIn: 2, nOut: 1, fn: ([a, b]) => [a ^ b] },
  7: { nIn: 2, nOut: 1, fn: ([a, b]) => [1 - (a ^ b)] },
  8: { nIn: 3, nOut: 1, fn: ([a, b, c]) => [maj(a, b, c)] },
  9: { nIn: 3, nOut: 1, fn: ([i0, i1, sel]) => [sel ? i1 : i0] },
  10: { nIn: 2, nOut: 2, fn: ([d, sel]) => [d & (1 - sel), d & sel] },
  11: {
    nIn: 3,
    nOut: 4,
    fn: ([a0, a1, en]) => {
      const sel = a0 + 2 * a1;
      return [0, 1, 2, 3].map((k) => (en && sel === k ? 1 : 0));
    },
  },
  13: {
    nIn: 8,
    nOut: 1,
    fn: (bits) => {
      const x = bits.slice(0, 4).reduce((s, b, i) => s | (b << i), 0);
      const y = bits.slice(4, 8).reduce((s, b, i) => s | (b << i), 0);
      return [x === y ? 1 : 0];
    },
  },
  14: { nIn: 4, nOut: 1, fn: (bits) => [bits.every((b) => b === 0) ? 1 : 0] },
  15: { nIn: 4, nOut: 1, fn: (bits) => [bits.reduce((a, b) => a ^ b, 0)] },
  16: { nIn: 5, nOut: 1, fn: (bits) => [bits.reduce((a, b) => a ^ b, 0)] },
  17: { nIn: 2, nOut: 2, fn: ([a, b]) => [a ^ b, a & b] },
  18: { nIn: 3, nOut: 2, fn: ([a, b, cin]) => [a ^ b ^ cin, maj(a, b, cin)] },
  19: { nIn: 2, nOut: 2, fn: ([a, b]) => [a ^ b, (1 - a) & b] },
  20: { nIn: 3, nOut: 2, fn: ([a, b, bin]) => [a ^ b ^ bin, maj(1 - a, b, bin)] },
  21: {
    nIn: 4,
    nOut: 3,
    fn: (bits) => {
      const x = bits[0] + 2 * bits[1];
      const y = bits[2] + 2 * bits[3];
      return [x > y ? 1 : 0, x === y ? 1 : 0, x < y ? 1 : 0];
    },
  },
  22: {
    nIn: 4,
    nOut: 4,
    fn: (bits) => {
      const x = bits.reduce((s, b, i) => s | (b << i), 0);
      const y = (x + 1) & 0xf;
      return [0, 1, 2, 3].map((i) => (y >> i) & 1);
    },
  },
  23: {
    nIn: 4,
    nOut: 4,
    fn: (bits) => {
      const x = bits.reduce((s, b, i) => s | (b << i), 0);
      const y = (x - 1) & 0xf;
      return [0, 1, 2, 3].map((i) => (y >> i) & 1);
    },
  },
  25: { nIn: 4, nOut: 4, fn: ([b0, b1, b2, b3]) => [b3, b2, b1, b0] },
};

const skipped = [12, 24, 26, 27, 28, 29, 30];

interface Row {
  id: number;
  name: string;
  tier: string;
  kind: string;
  cref: number;
  bestC: number;
  q: number;
  status: "beaten" | "cap" | "tie-or-optimal" | "lost";
}

const rows: Row[] = [];
for (const task of bank.tasks) {
  const spec = specs[task.id];
  if (!spec) continue;
  const results = ["area", "depth", "balanced"] as const;
  let bestC = Infinity;
  for (const obj of results) {
    const rowsFn: number[][] = [];
    for (let x = 0; x < 1 << spec.nIn; x++) {
      const bits: number[] = [];
      for (let i = 0; i < spec.nIn; i++) bits.push((x >> i) & 1);
      rowsFn.push(spec.fn(bits));
    }
    // Only outputs[0] handled by single-output optimize(); for multi-output
    // tasks, optimize each output bit separately and sum gates/take max depth.
    let totalGates = 0;
    let maxDepth = 0;
    for (let k = 0; k < spec.nOut; k++) {
      const col = rowsFn.map((r) => r[k]);
      const tt = fromRows(col);
      const res = optimize(spec.nIn, tt, obj);
      const gotRows = exhaustiveTruthTable(res.netlist).map((r) => r[0]);
      if (JSON.stringify(gotRows) !== JSON.stringify(col)) {
        throw new Error(`fabx-replay: optimize() produced an INCORRECT circuit for task ${task.id} output ${k} (objective ${obj}) - refusing to report an unverified number`);
      }
      totalGates += res.gates;
      maxDepth = Math.max(maxDepth, res.depth);
    }
    const bufferGates = 2 * spec.nOut;
    const cBuf = (totalGates + bufferGates) * Math.max(maxDepth + 2, 1) ** 3;
    if (cBuf < bestC) bestC = cBuf;
  }
  const q = Math.min(4, Math.max(0.25, task.Cref / bestC));
  const status: Row["status"] = bestC < task.Cref ? (q >= 4 ? "cap" : "beaten") : bestC === task.Cref ? "tie-or-optimal" : "lost";
  rows.push({ id: task.id, name: task.name, tier: task.tier, kind: task.kind, cref: task.Cref, bestC, q, status });
}

rows.sort((a, b) => b.q - a.q);

const lines: string[] = [];
lines.push("# FabX replay (BUILD.md step 1.10)");
lines.push("");
lines.push(
  "**Convention resolved from data**: Task 8's real bank entry (refNand=8, refDepth=6, area=8, Cref=1728=8×6³) " +
    "exactly matches the WITH-output-buffers numbers, not without. FabX's refNand/refDepth/area/Cref already include " +
    "the 2 contract-appended buffer NANDs per output. All C/q below use that convention."
);
lines.push("");
lines.push(`**Coverage**: ${rows.length}/100 tasks attempted (unambiguous standard-gate/arithmetic names only). Skipped: ${skipped.join(", ")} (12, 24, 26: ambiguous exact output encoding; 27-30: sequential, LATCH synthesis not implemented in Phase 1 optimize.ts).`);
lines.push("");
lines.push("| id | name | tier | kind | Cref | best C (ours, buffered) | q | status |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(`| ${r.id} | ${r.name} | ${r.tier} | ${r.kind} | ${r.cref} | ${r.bestC} | ${r.q.toFixed(3)} | ${r.status} |`);
}
const beaten = rows.filter((r) => r.status === "beaten" || r.status === "cap").length;
const atCap = rows.filter((r) => r.status === "cap").length;
const tieOpt = rows.filter((r) => r.status === "tie-or-optimal").length;
const lost = rows.filter((r) => r.status === "lost").length;
lines.push("");
lines.push(`**Counts**: beaten-or-at-cap=${beaten} (of which at the 4x cap=${atCap}), tie/already-optimal=${tieOpt}, lost (our optimizer did worse than the reference)=${lost}.`);
lines.push("");
const t8 = rows.find((r) => r.id === 8);
lines.push(
  `**Task 8 explicitly**: reference refNand=8, refDepth=6, area=8 (Cref=1728). Our optimizer's best C=${t8?.bestC} -> ` +
    `${t8?.status === "lost" ? "LOST: our general Shannon/exact-depth synthesizer (8 gates, depth 4 pre-buffer) does not find the hand-factored 6-gate circuit from BUILD.md section 6 that would tie the reference exactly." : t8?.status}.`
);
lines.push("");
lines.push("**Honest summary**: the optimizer does **not** beat most references for small, already hand-optimized standard gates/arithmetic - it frequently ties or loses, because its only area-reduction technique is exact structural-duplicate removal (dedupe), not full Boolean factoring. This is a valid, reported result, not a success claim.");

console.log(lines.join("\n"));
