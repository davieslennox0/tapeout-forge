// 3.1: static app, TS engine runs entirely in the browser (no backend). Mirrors
// packages/cli's `forge optimize` logic (see docs/NEW.md) so the two stay consistent.
// Restyled per the approved design mockup; all real engine calls below are unchanged
// from the pre-redesign version, only the DOM output is restructured.
import {
  parse as parseNetlist, serialize, exhaustiveTruthTable, fromRows, parseHex,
  optimize, computeCost, checkEquivalence, type Netlist, type Objective,
} from '@forgeout/core';
import { exprToRows } from './expr.js';
import gallery from './data/gallery.json';
import { PRODUCT_NAME } from '../../../config/name.js';

document.title = PRODUCT_NAME;

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
    if (!Number.isInteger(nIn) || rows.length !== 1 << nIn) throw new Error(`csv has ${rows.length} rows; not a power of 2, or doesn't match nIn`);
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

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function resultRow(label: string, before: string | number, after: string | number, changed: boolean): string {
  return `<div style="display:grid;grid-template-columns:minmax(150px,1.5fr) 1fr 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #262B31;align-items:baseline">
    <span style="color:#B7BEC4">${label}</span>
    <span style="text-align:right" class="mono">${before}</span>
    <span style="text-align:right" class="mono" style="${changed ? 'color:#E0904F;font-weight:500' : ''}">${after}</span>
  </div>`;
}

$('run').addEventListener('click', () => {
  const out = $('out');
  try {
    const { nIn, tt, before } = loadTarget();
    const objective = ($('obj') as HTMLSelectElement).value as Objective;
    const crefStr = ($('cref') as HTMLInputElement).value;
    const cref = crefStr ? Number(crefStr) : undefined;
    const result = optimize(nIn, tt, objective, { cref });
    const GAS = { gasFixed: 43783, gasPerGate: 1952 };
    const afterCost = computeCost(result.netlist, GAS);

    let verified: boolean;
    let verifyMethod: string;
    if (before) {
      const eq = checkEquivalence(before, result.netlist);
      verified = eq.equivalent;
      verifyMethod = eq.method;
    } else {
      const got = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
      const want = Array.from({ length: 1 << nIn }, (_, x) => Number((tt >> BigInt(x)) & 1n));
      verified = JSON.stringify(got) === JSON.stringify(want);
      verifyMethod = 'exhaustive, direct truth-table comparison';
    }

    const hex = '0x' + bytesToHex(serialize(result.netlist));
    lastHex = hex;

    const beforeCost = before ? computeCost(before, GAS) : null;
    const rows = [
      ['NAND gates', beforeCost ? beforeCost.userGates : '—', afterCost.userGates],
      ['Depth', beforeCost ? beforeCost.depthWithoutBuffers : '—', afterCost.depthWithoutBuffers],
      ['Eval gas, estimated', beforeCost ? fmtNum(beforeCost.gasPerEval) : '—', fmtNum(afterCost.gasPerEval)],
      ['Cost C (area × depth³)', beforeCost ? fmtNum(beforeCost.fabx.withBuffers.C) : '—', fmtNum(afterCost.fabx.withBuffers.C)],
    ];
    if (cref !== undefined) {
      const q = Math.min(4, cref / afterCost.fabx.withBuffers.C);
      rows.push(['q against reference ' + fmtNum(cref), '—', q.toFixed(2) + '×']);
    }

    out.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px">
        <span style="font-size:14px;color:${verified ? '#0D0F11' : '#E8EAEC'};background:${verified ? '#6FCF97' : '#b00020'};border-radius:6px;padding:4px 10px;font-weight:500">
          ${verified ? `Equivalent · ${verifyMethod}` : `NOT equivalent (${verifyMethod})`}
        </span>
      </div>
      <div style="overflow-x:auto"><div style="min-width:420px">
        <div style="display:grid;grid-template-columns:minmax(150px,1.5fr) 1fr 1fr;gap:12px;padding:0 0 10px;font-size:13px;color:#8D969E;border-bottom:1px solid #262B31">
          <span>Measure</span><span style="text-align:right">Before</span><span style="text-align:right">After</span>
        </div>
        ${rows.map(([l, b, a]) => resultRow(String(l), b as any, a as any, true)).join('')}
      </div></div>
      <div style="border-top:1px solid #262B31;margin-top:16px;padding-top:16px;font-size:14px;color:#8D969E;word-break:break-all">
        netlist (nIn=${nIn}, nOut=${result.netlist.nOut}): <span class="mono" style="color:#E8EAEC">${hex}</span>
      </div>`;
    ($('dl') as HTMLButtonElement).disabled = false;
  } catch (e: any) {
    out.innerHTML = `<div style="color:#E07878">${String(e?.message ?? e)}</div>`;
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

// Verified-improvements list: real data from gallery.json (22 real FabX-replay beats,
// packages/core/scripts/dump_gallery.ts), with a block-explorer-style rows-per-page control.
type GalleryRow = {
  id: number; name: string; nIn: number; nOut: number; Cref: number; C: number; q: number;
  netlistHex?: string; calldata?: string; // absent when built with REVEAL_NETLISTS=false
};
const galleryRows = gallery as GalleryRow[];
const PAGE_SIZES = [10, 20, galleryRows.length]; // galleryRows.length acts as "All" (22)
let pageSize = 10;

function copyBtn(text: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn btn-small';
  b.textContent = label;
  b.onclick = () => {
    navigator.clipboard.writeText(text);
    const prev = b.textContent;
    b.textContent = 'copied';
    setTimeout(() => { b.textContent = prev; }, 1200);
  };
  return b;
}

function renderPager() {
  const el = $('pager');
  el.innerHTML = '';
  for (const size of PAGE_SIZES) {
    const on = pageSize === size;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = size === galleryRows.length ? `All · ${size}` : String(size);
    btn.style.cssText = `min-height:44px;padding:0 18px;border:1px solid ${on ? '#E0904F' : '#3A4149'};border-radius:8px;background:${on ? 'rgba(224,144,79,0.14)' : 'transparent'};color:${on ? '#F2B07A' : '#E8EAEC'};font-size:15px;font-weight:500;cursor:pointer;font-family:inherit`;
    btn.onclick = () => { pageSize = size; renderGallery(); };
    el.appendChild(btn);
  }
}

function renderGallery() {
  const container = $('gallery');
  container.innerHTML = '';
  const visible = galleryRows.slice(0, pageSize);
  for (const row of visible) {
    const qPct = Math.min(100, (row.q / 4) * 100);
    const item = document.createElement('div');
    item.style.cssText = 'display:grid;grid-template-columns:minmax(220px,2fr) 90px 110px 110px minmax(160px,1.4fr) auto;gap:16px;padding:16px 24px;align-items:center;border-bottom:1px solid #20252A';
    item.innerHTML = `
      <div style="min-width:0">
        <div class="mono dim" style="font-size:13px">GC-${String(row.id).padStart(3, '0')}</div>
        <div style="font-weight:500">${row.name}</div>
        ${row.tapeout ? `<div class="mono" style="font-size:12px;margin-top:4px;color:#E0904F">Taped out · circuit #${row.tapeout.circuitId} · <a href="https://www.oklink.com/xlayer/tx/${row.tapeout.tapeoutTx}" style="color:inherit">tx</a><br><span class="dim">${row.tapeout.status}</span></div>` : ''}
      </div>
      <span class="mono muted" style="font-size:14px">${row.nIn}/${row.nOut}</span>
      <span class="mono muted" style="text-align:right;font-size:14px">${fmtNum(row.Cref)}</span>
      <span class="mono" style="text-align:right;font-size:14px">${fmtNum(row.C)}</span>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1;height:8px;border-radius:4px;background:#262B31"><div style="width:${qPct.toFixed(1)}%;height:8px;border-radius:4px;background:#E0904F"></div></div>
        <span class="mono" style="font-size:14px;font-weight:500;min-width:56px;text-align:right;color:#E0904F">${row.q.toFixed(2)}×</span>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end"></div>`;
    const btnCell = item.lastElementChild as HTMLElement;
    if (row.netlistHex && row.calldata) {
      btnCell.appendChild(copyBtn(row.netlistHex, 'Netlist'));
      btnCell.appendChild(copyBtn(row.calldata, 'Calldata'));
    } else {
      const span = document.createElement('span');
      span.className = 'dim';
      span.style.fontSize = '13px';
      span.textContent = row.tapeout ? 'Netlist is on-chain' : 'Published after tape-out';
      btnCell.appendChild(span);
    }
    container.appendChild(item);
  }
}

$('verified-intro').textContent =
  '46 of the 100 FabX tasks have a complete, checkable spec. On those, Forgeout beats the reference cost on 22, ties 11, and trails on 13. Each result below was re-checked by a separate from-scratch tool with no shared code.';
renderPager();
renderGallery();

// Registry — ForgeRegistry is live on X Layer (chain 196); five circuits are registered (docs/TAPEOUTS.md).
const REGISTRY_ADDRESS: string | null = '0xAFDd108b0efCC1FF4d1e1d32579F80501774912d';
const TAPED_OUT = (gallery as any[]).filter((r) => r.tapeout);
$('registry-panel').innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px">
       <div style="font-size:18px;font-weight:600">Best-circuit lookup</div>
       <span class="badge">Live on X Layer</span>
     </div>
     <p class="muted" style="margin:0 0 18px">Registry at <a class="mono" href="https://www.oklink.com/xlayer/address/${REGISTRY_ADDRESS}" style="color:inherit">${REGISTRY_ADDRESS}</a>. An ownerless contract keeps the best verified circuit for each function. Anyone can replace it with a strictly better one. In-page lookup is not wired up yet; read it with <code>best(bytes32)</code>.</p>
     <p class="muted" style="margin:0 0 8px">Five circuits are registered on the OrderGuard processor:</p>
     <ul style="margin:0;padding-left:20px">${TAPED_OUT.map((r) => `<li class="mono" style="font-size:14px">GC-${String(r.id).padStart(3, '0')} · circuit #${r.tapeout.circuitId} · ${r.tapeout.status}</li>`).join('')}</ul>`;
