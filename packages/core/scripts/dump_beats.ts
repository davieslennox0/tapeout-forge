import { readFileSync, writeFileSync } from 'node:fs';
import { optimize } from '../src/index.js';

const bank = JSON.parse(readFileSync('docs/fabx-tasks.json', 'utf8'));
const tasks = bank.tasks;
// (taskId, objective) for the 22 beats, read straight from docs/FABX-REPLAY.md's table
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

async function main() {
  const out: any[] = [];
  for (const [id, obj] of beats) {
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
    const perOutput = [];
    for (let k=0;k<t.nOut;k++) {
      const r = optimize(t.nIn, cols[k], obj as any, {cref: t.Cref});
      const nl = r.netlist;
      perOutput.push({ gates: nl.gates.map((g:any)=>({a:g.a,b:g.b})), nGates: nl.gates.length });
    }
    out.push({ id, nIn: t.nIn, nOut: t.nOut, objective: obj, perOutput });
    process.stderr.write('dumped ' + id + '\n');
  }
  writeFileSync('/tmp/beats_dump.json', JSON.stringify(out));
}
main();
