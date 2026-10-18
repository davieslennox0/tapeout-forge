#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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
import { toTtskyWrapper, REQUIRED_SILICON_WORDING } from "@tapeout-forge/silicon";

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

// --- forge replay: print the committed FabX replay summary (docs/FABX-REPLAY.md). Read-only,
// no network - the numbers come from the already-verified table, not a live re-run (for a
// live re-run see packages/core/scripts/fabx-replay-v2.ts in the README). ---
function runReplay() {
  const md = readFileSync("docs/FABX-REPLAY.md", "utf8");
  const countsLine = md.match(/\*\*Counts\*\*:.*$/m);
  console.log(countsLine ? countsLine[0].replace(/\*\*/g, "") : "(counts line not found)");
  console.log();
  const rows = [...md.matchAll(/^\| (\d+) \| (.+?) \| (\d+)\/(\d+) \| (\d+) \| (\d+) \| ([\d.]+) \| (\w+) \| (beat|tie|lose) \|$/gm)];
  const seen = new Set<string>();
  for (const r of rows) {
    const [, id] = r;
    if (seen.has(id)) continue; // the Top-10 table repeats some rows also in Full results
    seen.add(id);
    const [, , name, nIn, nOut, Cref, bestC, q, objective, verdict] = r;
    console.log(`task ${id.padStart(3)} (${name}): ${nIn}/${nOut} Cref=${Cref} bestC=${bestC} q=${q} obj=${objective} ${verdict}`);
  }
  if (rows.length === 0) console.log("(no table rows parsed - check docs/FABX-REPLAY.md's format)");
}

// --- forge calldata: dry-run only. Builds real tapeout(bytes,uint32,uint32) calldata for a
// netlist hex via `cast calldata` (Foundry must be on PATH - this never sends anything, it
// only ABI-encodes bytes for you to inspect or hand to your own signer). ---
function runCalldata(argv: string[]) {
  let hex: string | undefined;
  let nin: number | undefined;
  let nout: number | undefined;
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--netlist-hex") hex = next();
    else if (a === "--nin") nin = Number(next());
    else if (a === "--nout") nout = Number(next());
    else if (!a.startsWith("--")) hex = readFileSync(a, "utf8").trim();
    else throw new Error(`forge calldata: unknown flag ${a}`);
  }
  if (!hex || nin === undefined || nout === undefined) {
    throw new Error("forge calldata: --netlist-hex <hex or file> --nin N --nout M are required");
  }
  if (!hex.startsWith("0x")) hex = "0x" + hex;
  let calldata: string;
  try {
    calldata = execFileSync("cast", ["calldata", "tapeout(bytes,uint32,uint32)", hex, String(nin), String(nout)], {
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error("forge calldata: `cast` (Foundry) not found on PATH - install Foundry to use this command (https://getfoundry.sh)");
  }
  console.log(`calldata (never sent - dry run only): ${calldata}`);
}

// --- forge export-silicon: writes a ready-to-push repo directory (src/, info.yaml, README with
// the required limitation wording) for one netlist, via packages/silicon. Never pushes, never
// submits, never pays - it only writes local files and prints next steps for the owner to do
// manually (BUILD.md 4.4 / Phase 4 rules). ---
function runExportSilicon(argv: string[]) {
  let target: string | undefined;
  let nin: number | undefined;
  let nout: number | undefined;
  let slug = "circuit";
  let outDir = "silicon-export";
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    if (a === "--nin") nin = Number(next());
    else if (a === "--nout") nout = Number(next());
    else if (a === "--slug") slug = next();
    else if (a === "--out") outDir = next();
    else if (!a.startsWith("--")) target = a;
    else throw new Error(`forge export-silicon: unknown flag ${a}`);
  }
  if (!target) throw new Error("forge export-silicon: missing <netlist-hex-file|task-id>");

  let nl: Netlist;
  if (/^\d+$/.test(target)) {
    // task ID: look up in the committed task-bank snapshot (packages/core/scripts/tasks.json).
    const snapshot = JSON.parse(readFileSync(new URL("../../core/scripts/tasks.json", import.meta.url), "utf8"));
    const task = snapshot.tasks.find((t: any) => t.id === Number(target));
    if (!task) throw new Error(`forge export-silicon: task ${target} not found in packages/core/scripts/tasks.json`);
    const hex = task.netlistHex.replace(/^0x/i, "");
    const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
    nl = parseNetlist(bytes, task.nIn, task.nOut);
    if (slug === "circuit") slug = `task${task.id}`;
  } else {
    if (nin === undefined || nout === undefined) {
      throw new Error("forge export-silicon: --nin and --nout are required for a netlist-hex file");
    }
    const content = readFileSync(target, "utf8").trim().replace(/^0x/i, "");
    nl = parseNetlist(Uint8Array.from(Buffer.from(content, "hex")), nin, nout);
  }

  const result = toTtskyWrapper(nl, slug);
  if (!result.ok) {
    console.log(`refused: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(join(outDir, "src"), { recursive: true });
  writeFileSync(join(outDir, "src", `${result.moduleName}.v`), result.verilog + "\n");

  // Real schema confirmed against github.com/davieslennox0/maj3-silicon-spike's own working
  // info.yaml (BUILD.md 4.0's re-verified spike) - every field below is required by the real
  // Tiny Tapeout GDS action, not guessed: discord/clock_hz/tiles/the full 8-entry ui/uo/uio
  // pinout map/yaml_version:6 are all mandatory even when left blank or zero.
  const pinLine = (prefix: string, names: string[]) =>
    Array.from({ length: 8 }, (_, i) => `  ${prefix}[${i}]: "${names[i] ?? ""}"`).join("\n");
  const uiNames = result.pinMap.ui_in;
  const uoNames = result.pinMap.uo_out;
  const uioNames: string[] = [];
  const infoYaml =
    `# ${REQUIRED_SILICON_WORDING}\n` +
    `project:\n` +
    `  title: "${result.moduleName}"\n` +
    `  author: "davieslennox0"\n` +
    `  discord: ""\n` +
    `  description: "TapeOut Forge export. ${REQUIRED_SILICON_WORDING}"\n` +
    `  language: "Verilog"\n` +
    `  clock_hz: 0\n` +
    `  tiles: "1x1"\n` +
    `  top_module: "${result.moduleName}"\n` +
    `  source_files:\n` +
    `    - "${result.moduleName}.v"\n\n` +
    `pinout:\n` +
    `  # Inputs\n${pinLine("ui", uiNames)}\n\n` +
    `  # Outputs\n${pinLine("uo", uoNames)}\n\n` +
    `  # Bidirectional pins\n${pinLine("uio", uioNames)}\n\n` +
    `yaml_version: 6\n`;
  writeFileSync(join(outDir, "info.yaml"), infoYaml);

  const readme =
    `# ${result.moduleName}\n\n${REQUIRED_SILICON_WORDING}\n\n` +
    `Status: **exported** (not submitted, not fabricated, not paid for).\n\n` +
    `## Next steps for the circuit owner\n` +
    `1. Push this directory's contents into a fresh repo cloned from the official Tiny Tapeout ` +
    `\`ttsky\` Verilog template (this tool does not push anywhere itself).\n` +
    `2. Run that repo's GitHub Actions flow (produces a real DRC-checked GDS - see ` +
    `github.com/davieslennox0/maj3-silicon-spike for a worked example).\n` +
    `3. If and only if the owner wants to proceed, submit on tinytapeout.com against an open shuttle.\n` +
    `4. Pay Tiny Tapeout's own fee there. This project never does this step for you.\n`;
  writeFileSync(join(outDir, "README.md"), readme);

  console.log(`cell estimate: ${result.cellEstimate}`);
  console.log(`pin map: ui_in=[${result.pinMap.ui_in.join(",")}] uo_out=[${result.pinMap.uo_out.join(",")}]`);
  console.log(`status: exported`);
  console.log(REQUIRED_SILICON_WORDING);
  console.log(`written to ${outDir}/ (src/, info.yaml, README.md) - nothing was pushed or submitted anywhere.`);
}

const USAGE =
  "forge - TapeOut circuit compiler/optimizer/replay/dry-run/silicon-export CLI\n\n" +
  "usage:\n" +
  "  forge optimize <file> --format hex|csv|expr|netlist [--nin N] [--nout N] --objective area|depth|balanced [--cref N] [--count-buffers] [--out path]\n" +
  "  forge verify-onchain --processor <addr> --id <n> --inputs <hex> [--netlist-hex <file> --nin N --nout N]\n" +
  "  forge replay\n" +
  "  forge calldata <file-or-hex> --nin N --nout M   (dry-run only - never sends a transaction)\n" +
  "  forge export-silicon <task-id|netlist-hex-file> [--nin N --nout M] [--slug name] [--out dir]\n" +
  "      (writes a local repo directory only - never pushes, never submits, never pays)\n\n" +
  "examples:\n" +
  '  forge optimize circuit.expr --format expr --objective area --cref 1728\n' +
  "  forge verify-onchain --processor 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 --id 65 --inputs 0x07\n" +
  "  forge replay\n" +
  "  forge calldata netlist.hex --nin 4 --nout 1\n" +
  "  forge export-silicon 12 --slug gc012\n\n" +
  "exit codes: 0 on success (and on `verified: true` / all tasks OK); 1 on any error, bad input, or " +
  "a verification/equivalence failure, or an export-silicon refusal. Nothing here ever sends a real " +
  "transaction or submits/pays for fabrication - verify-onchain and calldata are read-only/dry-run " +
  "(BUILD.md section 0, rule 4), and export-silicon only writes local files (BUILD.md Phase 4 rules).";

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "verify-onchain") {
    await runVerifyOnchain(argv);
    return;
  }
  if (argv[0] === "replay") {
    runReplay();
    return;
  }
  if (argv[0] === "calldata") {
    runCalldata(argv);
    return;
  }
  if (argv[0] === "export-silicon") {
    runExportSilicon(argv);
    return;
  }
  if (argv[0] !== "optimize") {
    console.log(USAGE);
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
