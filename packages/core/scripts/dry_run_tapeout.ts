// BUILD.md 2.4: tape-out dry run. Builds REAL tapeout(bytes,uint32,uint32) calldata for
// combined multi-output netlists (with 2 buffer NANDs per output, appended explicitly in the
// submitted bytes - matching the real convention observed in xm1319/tapemkt's xl-tapeout.js,
// which manually includes its 2 buffers rather than relying on any contract-side auto-append),
// runs eth_estimateGas against the real fork, and prints calldata + gas + OKB fee. NEVER sends
// to the real chain (fork-only; the local mint() below is a disposable fork-only tx, never
// broadcast to X Layer itself).
import { readFileSync, writeFileSync } from 'node:fs';
import { optimize, serialize, type Netlist, type Gate } from '../src/index.js';

const bank = JSON.parse(readFileSync('docs/fabx-tasks.json', 'utf8'));
const tasks = bank.tasks;

// top 5 beats by q + 3 representative ties (simplest/headline/mid-complexity), from docs/FABX-REPLAY.md
const selected: [number, string][] = [
  [12,'area'],[46,'depth'],[45,'depth'],[43,'area'],[44,'area'], // top-5 beats by q
  [1,'area'],[8,'area'],[20,'area'],                             // 3 representative ties
];

async function fetchVectors(id: number) {
  const res = await fetch('https://api.fabx.tech/v1/pod/tasks/' + id + '/vectors?chainId=196');
  const d = await res.json();
  return d.vectors as {input:string, expectedOut:string}[];
}

// Combine nOut independently-optimized single-output circuits into one multi-output netlist
// where the LAST nOut signals are the outputs, in order (BUILD.md section 3's format rule),
// each output's own 2 buffer NANDs appended at the very end of ITS OWN gate chain so that,
// after interleaving, each output's true final buffer gate lands in the correct one of the
// final nOut slots.
function combine(nIn: number, perOutputGates: {a:number,b:number}[][]): Netlist {
  const nOut = perOutputGates.length;
  // Each output's gates (local signal space: inputs 2..1+nIn, then 2+nIn+i for its own gate i),
  // with 2 buffer NANDs appended referencing its own last signal.
  const withBuffers: {a:number,b:number}[][] = perOutputGates.map(gs => {
    const lastLocalSig = 2 + nIn + gs.length - 1; // this output's pre-buffer result signal
    const buf1 = 2 + nIn + gs.length;             // buffer 1's own local signal
    return [...gs, { a: lastLocalSig, b: lastLocalSig }, { a: buf1, b: buf1 }];
  });

  const combined: Gate[] = [];
  // Phase A: every output's gates except its own last (buffer-2), offset by cumulative count so far.
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
  // Phase B: each output's true final gate, in order - these become the last nOut signals.
  for (let k = 0; k < nOut; k++) {
    const gs = withBuffers[k];
    const last = gs[gs.length - 1];
    combined.push({ kind: 'NAND', a: remap(last.a, offsets[k]), b: remap(last.b, offsets[k]) });
  }
  return { nIn, nOut, gates: combined };
}

async function main() {
  const rows: any[] = [];
  for (const [id, obj] of selected) {
    const t = tasks.find((x:any)=>x.id===id);
    const vecs = await fetchVectors(id);
    const width = 1 << t.nIn;
    const mask = width - 1;
    const cols: bigint[] = Array.from({length:t.nOut}, ()=>0n);
    for (const v of vecs) {
      const inp = parseInt(v.input, 16) & mask;
      const o = parseInt(v.expectedOut, 16);
      for (let k=0;k<t.nOut;k++) if ((o>>k)&1) cols[k] |= 1n << BigInt(inp);
    }
    const perOutputGates: {a:number,b:number}[][] = [];
    for (let k=0;k<t.nOut;k++) {
      const r = optimize(t.nIn, cols[k], obj as any, {cref: t.Cref});
      perOutputGates.push(r.netlist.gates.map((g:any)=>({a:g.a,b:g.b})));
    }
    const nl = combine(t.nIn, perOutputGates);
    const bytes = serialize(nl);
    const hex = '0x' + Buffer.from(bytes).toString('hex');
    rows.push({ id, name: t.name, nIn: t.nIn, nOut: t.nOut, objective: obj, totalGates: nl.gates.length, hex });
    process.stderr.write(`built ${id}: ${nl.gates.length} gates, ${bytes.length} bytes\n`);
  }
  writeFileSync('/tmp/tapeout_calldata.json', JSON.stringify(rows));
}
main();
