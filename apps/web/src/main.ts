// 3.1: static app, TS engine runs entirely in the browser (no backend). Mirrors
// packages/cli's `forge optimize` logic (see docs/NEW.md) so the two stay consistent.
import {
  parse as parseNetlist, serialize, exhaustiveTruthTable, fromRows, parseHex,
  optimize, computeCost, checkEquivalence, type Netlist, type Objective,
} from '@tapeout-forge/core';
import { exprToRows } from './expr.js';
import gallery from './data/gallery.json';

const $ = (id: string) => document.getElementById(id)!;
let lastHex = '';

// Buffer is a Node global, not available in the browser - these replace the two Buffer.from(...)
// calls the CLI's equivalent logic uses, so this stays a pure browser build.
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadTarget(): { nIn: number; tt: bigint; before?: Netlist } {
  const fmt = ($('fmt') as HTMLSelectElement).value;
  const content = ($('input') as HTMLTextAreaElement).value.trim();
  if (fmt === 'expr') {
    const { vars, rows } = exprToRows(content);
    if (vars.length === 0) throw new Error('no variables found in expression');
    return { nIn: vars.length, tt: fromRows(rows) };
  }
  if (fmt === 'csv') {
    const ninStr = ($('nin') as HTMLInputElement).value;
    const rows = content.split(/\r?\n/).filter((l) => l.length > 0).map((l) => (l.trim() === '1' ? 1 : 0));
    const nIn = ninStr ? Number(ninStr) : Math.log2(rows.length);
    if (!Number.isInteger(nIn) || rows.length !== 1 << nIn) throw new Error(`csv has ${rows.length} rows; not a power of 2, or doesn't match --nIn`);
    return { nIn, tt: fromRows(rows) };
  }
  // hex (netlist or truth-table hex)
  const nin = Number(($('nin') as HTMLInputElement).value);
  const nout = Number(($('nout') as HTMLInputElement).value || '1');
  if (!nin) throw new Error('nIn is required for hex input');
  if (content.length > 0 && /^0x?[0-9a-fA-F]+$/.test(content) && content.replace(/^0x/i, '').length > (1 << nin) / 4) {
    try {
      const bytes = hexToBytes(content);
      const before = parseNetlist(bytes, nin, nout);
      const rows = exhaustiveTruthTable(before).map((r) => r[0]);
      return { nIn: nin, tt: fromRows(rows), before };
    } catch { /* fall through to truth-table hex */ }
  }
  return { nIn: nin, tt: parseHex(nin, content) };
}

function reportLine(label: string, nl: Netlist) {
  const c = computeCost(nl, { gasFixed: 43783, gasPerGate: 1952 });
  return `${label}: gates=${c.userGates} depth=${c.depthWithoutBuffers} ` +
    `(with 2×nOut buffers: gates=${c.userGates + c.bufferGates} depth=${c.depthWithBuffers}) ` +
    `gas≈${c.gasPerEval} C(no-buf)=${c.fabx.withoutBuffers.C} C(buf)=${c.fabx.withBuffers.C}`;
}

$('run').addEventListener('click', () => {
  const out = $('out');
  try {
    const { nIn, tt, before } = loadTarget();
    const objective = ($('obj') as HTMLSelectElement).value as Objective;
    const crefStr = ($('cref') as HTMLInputElement).value;
    const cref = crefStr ? Number(crefStr) : undefined;
    const result = optimize(nIn, tt, objective, { cref });
    let verifyLine: string;
    if (before) {
      const eq = checkEquivalence(before, result.netlist);
      verifyLine = `verified: ${eq.equivalent} (method=${eq.method})`;
    } else {
      const got = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
      const want = Array.from({ length: 1 << nIn }, (_, x) => Number((tt >> BigInt(x)) & 1n));
      verifyLine = `verified: ${JSON.stringify(got) === JSON.stringify(want)} (method=exhaustive, direct truth-table comparison)`;
    }
    const hex = '0x' + bytesToHex(serialize(result.netlist));
    lastHex = hex;
    const lines = [
      before ? reportLine('before', before) : null,
      reportLine('after', result.netlist),
      verifyLine,
      cref !== undefined ? `Cref=${cref} metCref4xCap=${result.metCref4xCap}` : null,
      `netlist (nIn=${nIn}, nOut=1): ${hex}`,
    ].filter(Boolean);
    out.innerHTML = '<pre>' + lines.join('\n') + '</pre>';
    ($('dl') as HTMLButtonElement).disabled = false;
  } catch (e: any) {
    out.innerHTML = `<pre class="err">${String(e?.message ?? e)}</pre>`;
    ($('dl') as HTMLButtonElement).disabled = true;
  }
});

$('dl').addEventListener('click', () => {
  const blob = new Blob([lastHex + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'netlist.hex';
  a.click();
});

// Gallery (static, precomputed by packages/core/scripts/dump_gallery.ts from the real replay).
function copyBtn(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = 'copy';
  b.onclick = () => navigator.clipboard.writeText(text);
  return b;
}
const tbody = document.querySelector('#gallery tbody')!;
for (const row of gallery as any[]) {
  const tr = document.createElement('tr');
  const hexCell = document.createElement('td');
  hexCell.innerHTML = `<code class="hex">${row.netlistHex}</code>`;
  hexCell.appendChild(copyBtn(row.netlistHex));
  const cdCell = document.createElement('td');
  cdCell.innerHTML = `<code class="hex">${row.calldata}</code>`;
  cdCell.appendChild(copyBtn(row.calldata));
  tr.innerHTML = `<td>${row.id} <span class="badge">${row.name}</span></td><td>${row.nIn}/${row.nOut}</td><td>${row.Cref}</td><td>${row.C}</td><td>${row.q}×</td>`;
  tr.appendChild(hexCell);
  tr.appendChild(cdCell);
  tbody.appendChild(tr);
}

// Registry — not deployed anywhere real yet (Phase 2 only verified ForgeRegistry on a fork).
const REGISTRY_ADDRESS: string | null = null;
$('registry').innerHTML = REGISTRY_ADDRESS
  ? `<p>Registry at <code>${REGISTRY_ADDRESS}</code> — live lookup not yet wired up.</p>`
  : '<p class="muted">Not deployed. ForgeRegistry.sol is built and ABI-verified on an X Layer fork (see docs/GAS-VERIFY.md) but has not been deployed to the real chain. See docs/USER-STEPS.md for the deployment checklist.</p>';
