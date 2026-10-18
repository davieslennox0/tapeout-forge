// 3.0b: one-time capture of a committed tasks.json snapshot (real vectors + our already-built
// netlist hex from gallery.json) so verify_independent.py never needs network access again.
import { readFileSync, writeFileSync } from 'node:fs';

const gallery = JSON.parse(readFileSync('apps/web/src/data/gallery.json', 'utf8'));
const bank = JSON.parse(readFileSync('docs/fabx-tasks.json', 'utf8')).tasks;

async function fetchVectors(id: number) {
  const res = await fetch('https://api.fabx.tech/v1/pod/tasks/' + id + '/vectors?chainId=196');
  const d = await res.json();
  return (d.vectors as { input: string; expectedOut: string }[]).map((v) => ({
    input: v.input, expectedOut: v.expectedOut,
  }));
}

async function main() {
  const tasks: any[] = [];
  for (const row of gallery) {
    const t = bank.find((x: any) => x.id === row.id);
    const vectors = await fetchVectors(row.id);
    tasks.push({
      id: row.id, name: row.name, nIn: row.nIn, nOut: row.nOut,
      Cref: row.Cref, netlistHex: row.netlistHex, vectors,
    });
    process.stderr.write(`captured ${row.id}: ${vectors.length} vectors\n`);
  }
  const out = {
    _comment: 'Committed snapshot for scripts/verify_independent.py - real vectors + our already-built netlist hex (from apps/web/src/data/gallery.json), captured once so the independent verifier needs zero network access and cannot be broken by a lost /tmp file again.',
    _capturedDate: new Date().toISOString().slice(0, 10),
    _sourceUrl: 'https://api.fabx.tech/v1/pod/tasks/{id}/vectors?chainId=196',
    tasks,
  };
  writeFileSync('packages/core/scripts/tasks.json', JSON.stringify(out, null, 2));
  process.stderr.write(`wrote packages/core/scripts/tasks.json (${tasks.length} tasks)\n`);
}
main();
