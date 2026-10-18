// 3.1 data source: for all 22 real beats, build the combined multi-output netlist (same
// convention as dry_run_tapeout.ts: 2 buffer NANDs per output appended, matching xl-tapeout.js),
// its hex, and the real tapeout(bytes,uint32,uint32) calldata (via `cast calldata` against the
// ABI verified in docs/TAPEOUT-DRYRUN.md - never sent, just encoded). Output consumed by
// apps/web's static "Verified improvements" gallery. Read-only; no chain writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { optimize, serialize, type Netlist, type Gate } from '../src/index.js';

const bank = JSON.parse(readFileSync('docs/fabx-tasks.json', 'utf8'));
const tasks = bank.tasks;

// All 22 beats, (taskId, objective), read straight from docs/FABX-REPLAY.md's table.
const beats: [number, string][] = [
  [7,'area'],[12,'area'],[13,'area'],[14,'area'],[16,'depth'],[21,'area'],[22,'depth'],[23,'depth'],
  [35,'area'],[36,'depth'],[37,'area'],[39,'area'],[40,'area'],[43,'area'],[44,'area'],[45,'depth'],
  [46,'depth'],[47,'area'],[50,'area'],[53,'area'],[54,'area'],[55,'depth']
];

async function fetchVectors(id: number) {
  const res = await fetch('https://api.fabx.tech/v1/pod/tasks/' + id + '/vectors?chainId=196');
  const d = await res.json();
  return d.vectors as {input:string, expectedOut:string}[];
}

function combine(nIn: number, perOutputGates: {a:number,b:number}[][]): Netlist {
  const nOut = perOutputGates.length;
  const withBuffers: {a:number,b:number}[][] = perOutputGates.map(gs => {
    const lastLocalSig = 2 + nIn + gs.length - 1;
    const buf1 = 2 + nIn + gs.length;
    return [...gs, { a: lastLocalSig, b: lastLocalSig }, { a: buf1, b: buf1 }];
  });
  const combined: Gate[] = [];
  const offsets: number[] = [];
  let cum = 0;
  for (const gs of withBuffers) { offsets.push(cum); cum += gs.length - 1; }
  const remap = (sig: number, offset: number) => (sig >= 2 + nIn ? sig + offset : sig);
  for (let k = 0; k < nOut; k++) {
    const gs = withBuffers[k];
    for (let i = 0; i < gs.length - 1; i++) {
      combined.push({ kind: 'NAND', a: remap(gs[i].a, offsets[k]), b: remap(gs[i].b, offsets[k]) });
    }
  }
  for (let k = 0; k < nOut; k++) {
    const gs = withBuffers[k];
    const last = gs[gs.length - 1];
    combined.push({ kind: 'NAND', a: remap(last.a, offsets[k]), b: remap(last.b, offsets[k]) });
  }
  return { nIn, nOut, gates: combined };
}

function buildCalldata(nlHex: string, nIn: number, nOut: number): string {
  // Real ABI from docs/TAPEOUT-DRYRUN.md: tapeout(bytes,uint32,uint32). Encoding only, never sent.
  const out = execSync(
    `cast calldata "tapeout(bytes,uint32,uint32)" ${nlHex} ${nIn} ${nOut}`,
    { encoding: 'utf8' }
  );
  return out.trim();
}

async function main() {
  const rows: any[] = [];
  for (const [id, obj] of beats) {
    const t = tasks.find((x: any) => x.id === id);
    const vecs = await fetchVectors(id);
    const width = 1 << t.nIn;
    const mask = width - 1;
    const cols: bigint[] = Array.from({ length: t.nOut }, () => 0n);
    for (const v of vecs) {
      const inp = parseInt(v.input, 16) & mask;
      const o = parseInt(v.expectedOut, 16);
      for (let k = 0; k < t.nOut; k++) if ((o >> k) & 1) cols[k] |= 1n << BigInt(inp);
    }
    const perOutputGates: { a: number; b: number }[][] = [];
    for (let k = 0; k < t.nOut; k++) {
      const r = optimize(t.nIn, cols[k], obj as any, { cref: t.Cref });
      perOutputGates.push(r.netlist.gates.map((g: any) => ({ a: g.a, b: g.b })));
    }
    const nl = combine(t.nIn, perOutputGates);
    const bytes = serialize(nl);
    const hex = '0x' + Buffer.from(bytes).toString('hex');
    const calldata = buildCalldata(hex, t.nIn, t.nOut);
    // bestC independently re-confirmed in docs/BEAT-VERIFY.md (0/22 mismatches); not recomputed
    // here since that's already the single verified source - avoids a second, divergent C.
    const confirmedC: Record<number, number> = {
      7:875, 12:28672, 13:29000, 14:4116, 16:26000, 21:12348, 22:10290, 23:18432,
      35:371293, 36:81000, 37:26244, 39:205632, 40:222912, 43:889253, 44:113135, 45:93000,
      46:92000, 47:26068, 50:15778, 53:49392, 54:53217, 55:64152,
    };
    const C = confirmedC[id];
    const q = Math.min(4, Math.max(0.25, t.Cref / C));
    rows.push({
      id, name: t.name, nIn: t.nIn, nOut: t.nOut, Cref: t.Cref, C, q: Math.round(q * 1000) / 1000,
      objective: obj, totalGates: nl.gates.length, netlistHex: hex, calldata,
    });
    process.stderr.write(`gallery: built ${id} (${nl.gates.length} gates)\n`);
  }
  writeFileSync('apps/web/src/data/gallery.json', JSON.stringify(rows, null, 2));
  process.stderr.write(`wrote ${rows.length} rows to apps/web/src/data/gallery.json\n`);
}
main();
