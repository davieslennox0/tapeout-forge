import results from "./data/benchmark-fourier39.json";
import classificationData from "./data/benchmark-fourier39-classification.json";

interface CircuitResult {
  chain: string; processor: string; circuitId: number;
  nIn: number; nOut: number; latches: number;
  gatesBefore: number; gatesAfter: number; gateReductionPct: number;
  depthBefore: number; depthAfter: number;
  bytesBefore: number; bytesAfter: number; chunksBefore: number; chunksAfter: number;
  afterMethod: string; equivalent: boolean | null; equivMethod: string;
  eStepBefore: number; eStepAfter: number; gasSavedPerStep: number;
  runtimeMs: number; readBlock: number; note: string;
}
interface Classification { processor: string; circuitId: number; group: "A" | "B"; reason: string }

const rows = results as CircuitResult[];
const classification = classificationData as Classification[];
const groupOf = new Map(classification.map((c) => [`${c.processor.toLowerCase()}:${c.circuitId}`, c]));
const classify = (r: CircuitResult) => groupOf.get(`${r.processor.toLowerCase()}:${r.circuitId}`)!;

const groupA = rows.filter((r) => classify(r).group === "A");
const groupB = rows.filter((r) => classify(r).group === "B");

function stat(label: string, value: string): string {
  return `<div><div class="dim mono" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase">${label}</div><div style="font-size:26px;font-weight:600;margin-top:4px">${value}</div></div>`;
}

function renderGroup(headlineId: string, tableId: string, groupRows: CircuitResult[]) {
  const valid = groupRows.filter((r) => r.afterMethod !== "FAILED");
  const improved = valid.filter((r) => r.gatesAfter < r.gatesBefore);
  const unprovenEquiv = valid.filter((r) => r.equivalent !== true);
  const reductions = valid.map((r) => r.gateReductionPct).sort((a, b) => a - b);
  const median = reductions.length ? reductions[Math.floor(reductions.length / 2)] : 0;
  const best = Math.max(0, ...reductions);
  const totalGasSaved = valid.reduce((s, r) => s + r.gasSavedPerStep, 0);

  document.getElementById(headlineId)!.innerHTML = [
    stat("Improved", `${improved.length}/${valid.length}`),
    stat("Median reduction", `${median.toFixed(1)}%`),
    stat("Best reduction", `${best.toFixed(1)}%`),
    stat("Gas saved / step", totalGasSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })),
  ].join("");

  const tbody = document.querySelector(`#${tableId} tbody`)!;
  for (const r of groupRows) {
    const tr = document.createElement("tr");
    const eqClass = r.equivalent === true ? "ok" : r.equivalent === false ? "bad" : "warn";
    const eqText = r.equivalent === true ? "yes" : r.equivalent === false ? "NO (mismatch)" : "not proven";
    tr.innerHTML = `
      <td class="mono">#${r.circuitId}</td>
      <td class="mono"><a href="https://www.oklink.com/xlayer/address/${r.processor}" target="_blank" rel="noopener">${r.processor.slice(0, 8)}…${r.processor.slice(-4)}</a></td>
      <td class="num">${r.nIn}/${r.nOut}</td>
      <td class="num mono">${r.gatesBefore}→${r.gatesAfter}</td>
      <td class="num">${r.gateReductionPct.toFixed(1)}%</td>
      <td class="num mono">${r.depthBefore}→${r.depthAfter}</td>
      <td class="num mono">${r.chunksBefore}→${r.chunksAfter}</td>
      <td class="${eqClass}">${eqText}</td>
      <td class="muted" style="font-size:12px">${r.afterMethod}</td>
    `;
    tbody.appendChild(tr);
  }
  return { valid, improved, unprovenEquiv };
}

renderGroup("headlineA", "tblA", groupA);
renderGroup("headlineB", "tblB", groupB);

const classTbody = document.querySelector("#tblClass tbody")!;
for (const r of rows) {
  const c = classify(r);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="mono">#${r.circuitId}</td>
    <td class="mono"><a href="https://www.oklink.com/xlayer/address/${r.processor}" target="_blank" rel="noopener">${r.processor.slice(0, 8)}…${r.processor.slice(-4)}</a></td>
    <td class="${c.group === "A" ? "ok" : "warn"}">${c.group}</td>
    <td style="font-size:13px">${c.reason}</td>
  `;
  classTbody.appendChild(tr);
}

const alreadyOptimalAll = rows.filter((r) => r.afterMethod !== "FAILED" && r.gatesAfter === r.gatesBefore);
const unprovenAll = rows.filter((r) => r.afterMethod !== "FAILED" && r.equivalent !== true);
const notes: string[] = [];
notes.push(
  `<p><b>Exactly one circuit is explicitly named by the source site</b>: #3 on <code class="mono">0xa93e80…2aa3</code> (nIn=320) — the circuits page itself labels it "21nandkit DOT32_T · 三值点积" (a ternary dot product), and the physics page's Law 15 (experiment E3) names DOT32_T by name as its real-circuit test subject. Confirmed functional — also a useful check that wide input count alone doesn't mean "probe" (see #1, #9, both nIn>20 and in Group A).</p>`
);
notes.push(
  `<p>The physics page's controlled law experiments (Law 1 "depth is free", Law 3 "memory-squared", the E1b hierarchy experiment) use separately-sized synthetic/injected netlists (a fixed 2,000-gate circuit for Law 1; up to 100,064 gates for E1b) that don't match any of these 23 circuits' exact gate counts — so no other circuit here is claimed as a literal 1:1 match to a named experiment. What the physics page does confirm: its E11b/E13 cross-validation drew <i>random real on-chain circuits</i> and explicitly reports the draw included repeats ("10 of 30 random BSC draws were the same 1-gate netlist") — the same shape as #288/#314/#1387 below, strong circumstantial support for their classification.</p>`
);
notes.push(`<p><b>#66 is a judgment call, not a sourced fact</b>: 88 inputs but only 100 gates/depth 4 is too shallow to combine that many inputs meaningfully — placed in Group B on structural grounds alone, flagged here as less certain than the others.</p>`);
if (alreadyOptimalAll.length) notes.push(`<p><b>Already optimal (0% reduction), not oversold as a win:</b> ${alreadyOptimalAll.map((r) => `#${r.circuitId}`).join(", ")}.</p>`);
if (unprovenAll.length) notes.push(`<p><b>Equivalence not proven within this run's limits:</b> ${unprovenAll.map((r) => `#${r.circuitId}`).join(", ")}. Gate counts shown but not confirmed to compute the same function.</p>`);
const dropped = rows.filter((r) => r.chunksAfter < r.chunksBefore);
if (dropped.length) notes.push(`<p><b>Chunk count dropped</b> (fewer 24,000-byte storage chunks): ${dropped.map((r) => `#${r.circuitId}`).join(", ")} — all Group B. The source site's own physics notes show chunk-splicing cost growing roughly with the 4th power of chunk count, so these matter more than a linear gate saving would suggest.</p>`);
notes.push(`<p class="muted" style="font-size:13px">Full data, every netlist, and reproduction steps: <a href="https://github.com/davieslennox0/tapeout-forge/tree/main/benchmarks/fourier39" target="_blank" rel="noopener">benchmarks/fourier39</a> in the repo.</p>`);
document.getElementById("notes")!.innerHTML = notes.join("");
