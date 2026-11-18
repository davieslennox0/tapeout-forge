// Child-process worker: runs ONE equivalence check and exits. Invoked by run.ts via execFileSync
// with a timeout for the >20-input circuits, where checkEquivalence() auto-dispatches to the
// embedded SAT-DPLL solver (packages/core/src/equivalence.ts) and could in principle blow up -
// isolating it in its own process means a hung check can be killed without taking run.ts with it.
import { readFileSync } from "node:fs";
import { parse, checkEquivalence } from "../../packages/core/src/index.js";

const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const a = parse(Buffer.from(input.aHex, "hex"), input.nIn, input.nOut);
const b = parse(Buffer.from(input.bHex, "hex"), input.nIn, input.nOut);
const result = checkEquivalence(a, b);
process.stdout.write(JSON.stringify(result));
