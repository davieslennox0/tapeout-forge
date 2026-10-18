#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  parse as parseNetlist,
  serialize,
  exhaustiveTruthTable,
  fromRows,
  parseHex,
  optimize,
  computeCost,
  checkEquivalence,
  type Netlist,
  type Objective,
} from "@tapeout-forge/core";
import { exprToRows } from "./expr.js";
import { X_LAYER_COST } from "../../../config/cost.js";
import { X_LAYER } from "../../../config/chains.js";
import { verifyOnchain } from "@tapeout-forge/chain";

interface Args {
  file?: string;
  format?: "hex" | "csv" | "expr" | "netlist";
  nin?: number;
  nout?: number;
  objective: Objective;
  cref?: number;
  countBuffers: boolean;
  out?: string;
  gasFixed: number;
  gasPerGate: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    objective: "balanced",
    countBuffers: false,
    gasFixed: X_LAYER_COST.gasFixed,
    gasPerGate: X_LAYER_COST.gasPerGate,
  };
  const rest = argv.slice(1); // drop the "optimize" subcommand
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--format") args.format = next() as Args["format"];
    else if (a === "--nin") args.nin = Number(next());
    else if (a === "--nout") args.nout = Number(next());
    else if (a === "--objective") args.objective = next() as Objective;
    else if (a === "--cref") args.cref = Number(next());
    else if (a === "--count-buffers") args.countBuffers = true;
    else if (a === "--out") args.out = next();
    else if (a === "--gas-fixed") args.gasFixed = Number(next());
    else if (a === "--gas-per-gate") args.gasPerGate = Number(next());
    else if (!a.startsWith("--")) args.file = a;
    else throw new Error(`forge optimize: unknown flag ${a}`);
  }
  return args;
}

function loadTarget(args: Args): { nIn: number; tt: bigint; before?: Netlist } {
  if (!args.file) throw new Error("forge optimize: missing <file>");
  const content = readFileSync(args.file, "utf8").trim();
  if (args.format === "expr") {
    const { vars, rows } = exprToRows(content);
    return { nIn: vars.length, tt: fromRows(rows) };
  }
  if (args.format === "csv") {
    if (args.nin === undefined) throw new Error("forge optimize: --nin required for --format csv");
    const rows = content.split(/\r?\n/).filter((l) => l.length > 0).map((l) => (l.trim() === "1" ? 1 : 0));
    if (rows.length !== 1 << args.nin) throw new Error(`forge optimize: csv has ${rows.length} rows, expected ${1 << args.nin}`);
    return { nIn: args.nin, tt: fromRows(rows) };
  }
  if (args.format === "netlist") {
    if (args.nin === undefined || args.nout === undefined) {
      throw new Error("forge optimize: --nin and --nout required for --format netlist");
    }
    const bytes = Uint8Array.from(Buffer.from(content.replace(/^0x/i, ""), "hex"));
    const before = parseNetlist(bytes, args.nin, args.nout);
    const rows = exhaustiveTruthTable(before).map((r) => r[0]);
    return { nIn: args.nin, tt: fromRows(rows), before };
  }
  // default: hex truth table
  if (args.nin === undefined) throw new Error("forge optimize: --nin required for --format hex");
  return { nIn: args.nin, tt: parseHex(args.nin, content) };
}

function report(label: string, nl: Netlist, gasFixed: number, gasPerGate: number) {
  const cost = computeCost(nl, { gasFixed, gasPerGate });
  console.log(
    `${label}: gates=${cost.userGates} depth=${cost.depthWithoutBuffers} ` +
      `(with 2*nOut buffers: gates=${cost.userGates + cost.bufferGates} depth=${cost.depthWithBuffers}) ` +
      `gas=${cost.gasPerEval} C(no-buf)=${cost.fabx.withoutBuffers.C} C(buf)=${cost.fabx.withBuffers.C}`
  );
}

interface VerifyArgs {
  processor?: string;
  id?: bigint;
  inputs?: number[];
  netlistHex?: string;
  nin?: number;
  nout?: number;
}

function parseVerifyArgs(argv: string[]): VerifyArgs {
  const args: VerifyArgs = {};
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--processor") args.processor = next();
    else if (a === "--id") args.id = BigInt(next());
    else if (a === "--inputs") {
      const hex = next().replace(/^0x/i, "");
      const bytes = Buffer.from(hex, "hex");
      const bits: number[] = [];
      for (const b of bytes) for (let i = 0; i < 8; i++) bits.push((b >> i) & 1);
      args.inputs = bits;
    } else if (a === "--netlist-hex") args.netlistHex = next();
    else if (a === "--nin") args.nin = Number(next());
    else if (a === "--nout") args.nout = Number(next());
    else throw new Error(`forge verify-onchain: unknown flag ${a}`);
  }
  return args;
}

async function runVerifyOnchain(argv: string[]) {
  const args = parseVerifyArgs(argv);
  if (!args.processor || args.id === undefined || !args.inputs) {
    throw new Error("forge verify-onchain: --processor, --id and --inputs are required");
  }
  let localNetlist: Netlist | null = null;
  if (args.netlistHex) {
    if (args.nin === undefined || args.nout === undefined) {
      throw new Error("forge verify-onchain: --nin and --nout required with --netlist-hex");
    }
    const content = readFileSync(args.netlistHex, "utf8").trim().replace(/^0x/i, "");
    localNetlist = parseNetlist(Uint8Array.from(Buffer.from(content, "hex")), args.nin, args.nout);
  }
  const result = await verifyOnchain(X_LAYER.rpcUrl, args.processor, args.id, args.inputs, localNetlist);
  console.log(`onchain output bits: [${result.onchain.outputBits.join(",")}]`);
  if (result.localSimulation) console.log(`local simulation:     [${result.localSimulation.join(",")}]`);
  console.log(`match: ${result.match === null ? "N/A" : result.match}`);
  console.log(`note: ${result.note}`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "verify-onchain") {
    await runVerifyOnchain(argv);
    return;
  }
  if (argv[0] !== "optimize") {
    console.log(
      "usage:\n" +
        "  forge optimize <file> --format hex|csv|expr|netlist [--nin N] [--nout N] --objective area|depth|balanced [--cref N] [--count-buffers] [--out path]\n" +
        "  forge verify-onchain --processor <addr> --id <n> --inputs <hex> [--netlist-hex <file> --nin N --nout N]"
    );
    process.exit(argv.length === 0 ? 0 : 1);
  }
  const args = parseArgs(argv);
  const { nIn, tt, before } = loadTarget(args);

  if (before) report("before", before, args.gasFixed, args.gasPerGate);

  const result = optimize(nIn, tt, args.objective, { cref: args.cref });
  report("after", result.netlist, args.gasFixed, args.gasPerGate);

  if (before) {
    const eq = checkEquivalence(before, result.netlist);
    console.log(`verified: ${eq.equivalent} (method=${eq.method})`);
  } else {
    const gotRows = exhaustiveTruthTable(result.netlist).map((r) => r[0]);
    const wantRows = Array.from({ length: 1 << nIn }, (_, x) => Number((tt >> BigInt(x)) & 1n));
    const matches = JSON.stringify(gotRows) === JSON.stringify(wantRows);
    console.log(`verified: ${matches} (method=exhaustive, direct truth-table comparison)`);
  }

  if (args.cref !== undefined) {
    console.log(`Cref=${args.cref} metCref4xCap=${result.metCref4xCap}`);
  }

  const netlistHex = "0x" + Buffer.from(serialize(result.netlist)).toString("hex");
  console.log(`netlist (${args.objective}, nIn=${nIn}, nOut=1): ${netlistHex}`);
  if (args.out) {
    writeFileSync(args.out, netlistHex + "\n");
    console.log(`written to ${args.out}`);
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
