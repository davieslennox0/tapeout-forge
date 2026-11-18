import results from "./data/benchmark-fourier39.json";

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

const rows = results as CircuitResult[];
const $ = (id: string) => document.getElementById(id)!;

const valid = rows.filter((r) => r.afterMethod !== "FAILED");
const improved = valid.filter((r) => r.gatesAfter < r.gatesBefore);
const alreadyOptimal = valid.filter((r) => r.gatesAfter === r.gatesBefore);
const unprovenEquiv = valid.filter((r) => r.equivalent !== true);
const reductions = valid.map((r) => r.gateReductionPct).sort((a, b) => a - b);
const median = reductions.length ? reductions[Math.floor(reductions.length / 2)] : 0;
const best = Math.max(0, ...reductions);
const totalGasSaved = valid.reduce((s, r) => s + r.gasSavedPerStep, 0);

function stat(label: string, value: string): string {
  return `<div><div class="dim mono" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase">${label}</div><div style="font-size:26px;font-weight:600;margin-top:4px">${value}</div></div>`;
}
$("headline").innerHTML = [
  stat("Improved", `${improved.length}/${valid.length}`),
  stat("Median reduction", `${median.toFixed(1)}%`),
  stat("Best reduction", `${best.toFixed(1)}%`),
  stat("Gas saved / step", totalGasSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })),
].join("");

const tbody = document.querySelector("#tbl tbody")!;
for (const r of rows) {
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

const notes: string[] = [];
if (alreadyOptimal.length) notes.push(`<p><b>Already optimal (0% reduction), not oversold as a win:</b> ${alreadyOptimal.map((r) => `#${r.circuitId}`).join(", ")}.</p>`);
if (unprovenEquiv.length) notes.push(`<p><b>Equivalence not proven within this run's limits:</b> ${unprovenEquiv.map((r) => `#${r.circuitId}`).join(", ")}. Gate counts shown but not confirmed to compute the same function.</p>`);
const dropped = rows.filter((r) => r.chunksAfter < r.chunksBefore);
if (dropped.length) notes.push(`<p><b>Chunk count dropped</b> (fewer 24,000-byte storage chunks): ${dropped.map((r) => `#${r.circuitId}`).join(", ")}. The source site's own physics notes show chunk-splicing cost growing roughly with the 4th power of chunk count, so these matter more than a linear gate saving would suggest.</p>`);
const wide = rows.filter((r) => r.nIn > 20);
if (wide.length) notes.push(`<p><b>Wide-input circuits (nIn&gt;20):</b> ${wide.map((r) => `#${r.circuitId} (nIn=${r.nIn})`).join(", ")}. Full re-synthesis needs an exhaustive truth table and isn't feasible at this width; only structural dedup ran.</p>`);
notes.push(`<p class="muted" style="font-size:13px">Several circuits in this set look like physics-probe constructions (long single-input NAND chains, or many parallel redundant gates) rather than hand-written functions - noted rather than presented as a clever win on meaningful logic. Full data, every netlist, and reproduction steps: <a href="https://github.com/davieslennox0/tapeout-forge/tree/main/benchmarks/fourier39" target="_blank" rel="noopener">benchmarks/fourier39</a> in the repo.</p>`);
$("notes").innerHTML = notes.join("");
