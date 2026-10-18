// BUILD.md section 6 benchmarks. Run: npx tsx scripts/bench.ts > ../../docs/BENCH.md
import { optimize, fromRows, exhaustiveTruthTable } from "../src/index.js";

interface Bench {
  name: string;
  nIn: number;
  nOut: number;
  fn: (bits: number[]) => number[];
}

function maj(a: number, b: number, c: number): number {
  return a + b + c >= 2 ? 1 : 0;
}

const benches: Bench[] = [
  {
    name: "4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout)",
    nIn: 9,
    nOut: 5,
    fn: (bits) => {
      const a = bits.slice(0, 4).reduce((s, b, i) => s | (b << i), 0);
      const b = bits.slice(4, 8).reduce((s, b, i) => s | (b << i), 0);
      const cin = bits[8];
      const sum = a + b + cin;
      return [0, 1, 2, 3].map((i) => (sum >> i) & 1).concat([(sum >> 4) & 1]);
    },
  },
  {
    name: "4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt)",
    nIn: 8,
    nOut: 3,
    fn: (bits) => {
      const x = bits.slice(0, 4).reduce((s, b, i) => s | (b << i), 0);
      const y = bits.slice(4, 8).reduce((s, b, i) => s | (b << i), 0);
      return [x > y ? 1 : 0, x === y ? 1 : 0, x < y ? 1 : 0];
    },
  },
  {
    name: "2:1 mux (i0, i1, sel -> out)",
    nIn: 3,
    nOut: 1,
    fn: ([i0, i1, sel]) => [sel ? i1 : i0],
  },
  {
    name: "4:1 mux (i0..i3, sel0, sel1 -> out)",
    nIn: 6,
    nOut: 1,
    fn: (bits) => {
      const sel = bits[4] + 2 * bits[5];
      return [bits[sel]];
    },
  },
  {
    name: "8-bit parity (in[0..7] -> out)",
    nIn: 8,
    nOut: 1,
    fn: (bits) => [bits.reduce((a, b) => a ^ b, 0)],
  },
];

const lines: string[] = [];
lines.push("# Benchmarks (BUILD.md section 6)");
lines.push("");
lines.push("Gates/depth shown WITHOUT the 2*nOut contract buffers (user circuit only); C is computed WITH buffers (the convention resolved in docs/FABX-REPLAY.md). Every result below is verified exhaustively equivalent to its spec before being reported - optimize() producing a wrong circuit would throw, not silently report a number.");
lines.push("");
lines.push("| benchmark | objective | gates | depth | C (buffered) |");
lines.push("|---|---|---|---|---|");

const summary: Record<string, { area: number; depth: number; balanced: number }> = {};

for (const bench of benches) {
  const width = 1 << bench.nIn;
  const cols: number[][] = Array.from({ length: bench.nOut }, () => []);
  for (let x = 0; x < width; x++) {
    const bits: number[] = [];
    for (let i = 0; i < bench.nIn; i++) bits.push((x >> i) & 1);
    const out = bench.fn(bits);
    for (let k = 0; k < bench.nOut; k++) cols[k].push(out[k]);
  }

  for (const obj of ["area", "depth", "balanced", "c"] as const) {
    let totalGates = 0;
    let maxDepth = 0;
    for (let k = 0; k < bench.nOut; k++) {
      const tt = fromRows(cols[k]);
      const res = optimize(bench.nIn, tt, obj);
      const got = exhaustiveTruthTable(res.netlist).map((r) => r[0]);
      if (JSON.stringify(got) !== JSON.stringify(cols[k])) {
        throw new Error(`bench: optimize() produced an INCORRECT circuit for "${bench.name}" output ${k} (objective ${obj})`);
      }
      totalGates += res.gates;
      maxDepth = Math.max(maxDepth, res.depth);
    }
    const bufferGates = 2 * bench.nOut;
    const c = (totalGates + bufferGates) * Math.max(maxDepth + 2, 1) ** 3;
    lines.push(`| ${bench.name} | ${obj} | ${totalGates} | ${maxDepth} | ${c} |`);
    summary[bench.name] = summary[bench.name] ?? ({} as any);
    summary[bench.name][obj] = c;
  }
}

lines.push("");
lines.push("## Does depth ever beat area on C?");
lines.push("");
let anyDepthWins = false;
for (const bench of benches) {
  const s = summary[bench.name];
  const depthWins = s.depth < s.area;
  if (depthWins) anyDepthWins = true;
  lines.push(`- **${bench.name}**: area-objective C=${s.area}, depth-objective C=${s.depth} - ${depthWins ? "depth WINS on C" : "area wins or ties on C"}.`);
}
lines.push("");
lines.push(
  anyDepthWins
    ? "**Yes**, for at least one benchmark above, minimizing depth produces a lower overall C than minimizing gate count - because C's depth term is cubed, a circuit with more gates but meaningfully less depth can still win."
    : "**No**, for none of these benchmarks does the depth-objective candidate achieve a lower C than the area-objective candidate. In this implementation, since both objectives currently select from the SAME small 2-order candidate set (see optimize.ts), 'area' already tends to pick the lower-depth option too whenever it also happens to need fewer gates; a genuinely depth-vs-area tradeoff would need a richer candidate search than this session built."
);

console.log(lines.join("\n"));
