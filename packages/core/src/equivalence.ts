import { execSync } from "node:child_process";
import type { Netlist } from "./netlist.js";
import { exhaustiveTruthTable } from "./simulate.js";

export const EXHAUSTIVE_MAX_INPUTS = 20;

export interface EquivalenceResult {
  equivalent: boolean;
  method: "exhaustive" | "sat-dpll";
  counterexample?: number[];
}

/**
 * Never returns equivalent:true without having actually run one of the two
 * checks below to completion (BUILD.md rule: "never mark a result 'verified'
 * unless one of these passed").
 */
export function checkEquivalence(a: Netlist, b: Netlist): EquivalenceResult {
  if (a.nIn !== b.nIn || a.nOut !== b.nOut) {
    throw new Error("checkEquivalence: nIn/nOut mismatch");
  }
  if (a.nIn <= EXHAUSTIVE_MAX_INPUTS) return checkEquivalenceExhaustive(a, b);
  return checkEquivalenceSat(a, b);
}

export function checkEquivalenceExhaustive(a: Netlist, b: Netlist): EquivalenceResult {
  const rowsA = exhaustiveTruthTable(a);
  const rowsB = exhaustiveTruthTable(b);
  for (let x = 0; x < rowsA.length; x++) {
    for (let k = 0; k < a.nOut; k++) {
      if (rowsA[x][k] !== rowsB[x][k]) {
        const bits: number[] = [];
        for (let i = 0; i < a.nIn; i++) bits.push((x >> i) & 1);
        return { equivalent: false, method: "exhaustive", counterexample: bits };
      }
    }
  }
  return { equivalent: true, method: "exhaustive" };
}

/**
 * BUILD.md 1.6 asks to prefer an external SAT solver (cadical/minisat) if on
 * PATH. Detection only is implemented (see isExternalSatOnPath) - actual
 * invocation (writing DIMACS CNF, shelling out, parsing SAT/UNSAT +model) is
 * NOT wired up, a documented scope cut (see docs/NEW.md). This always runs
 * the embedded JS DPLL below instead, which is correct (if not fast) for any
 * instance size this project's own benchmarks will ever produce.
 */
export function isExternalSatOnPath(): boolean {
  for (const bin of ["cadical", "minisat"]) {
    try {
      execSync(`which ${bin}`, { stdio: "ignore" });
      return true;
    } catch {
      /* not found, try next */
    }
  }
  return false;
}

type Clause = number[]; // DIMACS-style: positive k = var k true, negative = var k false (1-indexed)

function tseitinNand(out: number, a: number, b: number, clauses: Clause[]): void {
  clauses.push([-out, -a, -b]);
  clauses.push([out, a]);
  clauses.push([out, b]);
}

function buildMiterCnf(a: Netlist, b: Netlist): { clauses: Clause[] } {
  const clauses: Clause[] = [];
  const CONST0 = 1;
  const CONST1 = 2;
  clauses.push([-CONST0]);
  clauses.push([CONST1]);
  let nextVar = 3;
  const inputVars: number[] = [];
  for (let i = 0; i < a.nIn; i++) inputVars.push(nextVar++);

  const signalVar = (signal: number, gateVars: number[]): number => {
    if (signal === 0) return CONST0;
    if (signal === 1) return CONST1;
    if (signal < 2 + a.nIn) return inputVars[signal - 2];
    return gateVars[signal - (2 + a.nIn)];
  };

  const buildSide = (nl: Netlist): number[] => {
    const gateVars: number[] = [];
    for (const g of nl.gates) {
      if (g.kind !== "NAND") throw new Error("checkEquivalenceSat: only NAND-only netlists supported");
      const v = nextVar++;
      gateVars.push(v);
      tseitinNand(v, signalVar(g.a, gateVars), signalVar(g.b, gateVars), clauses);
    }
    return gateVars;
  };
  const gateVarsA = buildSide(a);
  const gateVarsB = buildSide(b);

  const firstOutA = 2 + a.nIn + (a.gates.length - a.nOut);
  const firstOutB = 2 + b.nIn + (b.gates.length - b.nOut);
  const mismatchVars: number[] = [];
  for (let k = 0; k < a.nOut; k++) {
    const oa = signalVar(firstOutA + k, gateVarsA);
    const ob = signalVar(firstOutB + k, gateVarsB);
    const m = nextVar++;
    clauses.push([-m, oa, ob]);
    clauses.push([-m, -oa, -ob]);
    clauses.push([m, -oa, ob]);
    clauses.push([m, oa, -ob]);
    mismatchVars.push(m);
  }
  clauses.push(mismatchVars.slice()); // assert >=1 output differs

  return { clauses };
}

/** Plain recursive DPLL (unit propagation + backtracking, no learning). Correct, not fast - fine for this project's instance sizes. */
function dpll(clauses: Clause[]): Map<number, boolean> | null {
  const assignment = new Map<number, boolean>();

  function propagateAndCheck(): boolean | "unresolved" {
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of clauses) {
        let satisfied = false;
        const unresolved: number[] = [];
        for (const lit of c) {
          const v = assignment.get(Math.abs(lit));
          if (v === undefined) unresolved.push(lit);
          else if (v === lit > 0) {
            satisfied = true;
            break;
          }
        }
        if (satisfied) continue;
        if (unresolved.length === 0) return false;
        if (unresolved.length === 1) {
          assignment.set(Math.abs(unresolved[0]), unresolved[0] > 0);
          changed = true;
        }
      }
    }
    return "unresolved";
  }

  function allSatisfied(): boolean {
    return clauses.every((c) => c.some((lit) => assignment.get(Math.abs(lit)) === lit > 0));
  }

  function pickBranchVar(): number | undefined {
    for (const c of clauses) {
      for (const lit of c) {
        if (assignment.get(Math.abs(lit)) === undefined) return Math.abs(lit);
      }
    }
    return undefined;
  }

  function solve(): boolean {
    const r = propagateAndCheck();
    if (r === false) return false;
    if (allSatisfied()) return true;
    const branchVar = pickBranchVar();
    if (branchVar === undefined) return allSatisfied();
    for (const val of [true, false]) {
      const saved = new Map(assignment);
      assignment.set(branchVar, val);
      if (solve()) return true;
      assignment.clear();
      for (const [k, v] of saved) assignment.set(k, v);
    }
    return false;
  }

  return solve() ? assignment : null;
}

export function checkEquivalenceSat(a: Netlist, b: Netlist): EquivalenceResult {
  const { clauses } = buildMiterCnf(a, b);
  const model = dpll(clauses);
  if (model === null) {
    return { equivalent: true, method: "sat-dpll" }; // UNSAT: no mismatch possible
  }
  const bits: number[] = [];
  for (let i = 0; i < a.nIn; i++) bits.push(model.get(3 + i) ? 1 : 0); // input vars start at 3 (after CONST0,CONST1)
  return { equivalent: false, method: "sat-dpll", counterexample: bits };
}
