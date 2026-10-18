import type { Netlist, Gate, NandGate } from "./netlist.js";
import { NetlistError } from "./netlist.js";
import type { TruthTable } from "./truthtable.js";
import { exactSynthesize, EXACT_SYNTHESIS_MAX_INPUTS } from "./exact.js";
import { circuitDepth, structuralHash } from "./aig.js";

export type Objective = "area" | "depth" | "balanced";

interface BuildCtx {
  nl: NandGate[];
  memo: Map<string, number>;
  nInTotal: number;
}

function spliceExactSubcircuit(ctx: BuildCtx, sub: Netlist, n: number): number {
  const localToGlobal = new Map<number, number>();
  localToGlobal.set(0, 0);
  localToGlobal.set(1, 1);
  for (let i = 0; i < n; i++) localToGlobal.set(2 + i, 2 + i);
  for (let i = 0; i < sub.gates.length; i++) {
    const g = sub.gates[i];
    if (g.kind !== "NAND") throw new NetlistError("exact.ts only returns NAND gates");
    const a = localToGlobal.get(g.a)!;
    const b = localToGlobal.get(g.b)!;
    const globalSignal = 2 + ctx.nInTotal + ctx.nl.length;
    ctx.nl.push({ kind: "NAND", a, b });
    localToGlobal.set(2 + n + i, globalSignal);
  }
  if (sub.gates.length === 0) {
    // target was already a base signal - exactSynthesize() itself always emits
    // >=1 gate (its own 2-gate buffer fallback), so this branch is unreachable
    // in practice; kept defensive rather than silently wrong.
    throw new NetlistError("spliceExactSubcircuit: unexpected empty sub-circuit");
  }
  return localToGlobal.get(2 + n + sub.gates.length - 1)!;
}

function nandGate(ctx: BuildCtx, a: number, b: number): number {
  const sig = 2 + ctx.nInTotal + ctx.nl.length;
  ctx.nl.push({ kind: "NAND", a, b });
  return sig;
}

/**
 * Shannon/cofactor decomposition on variable order `order` (a permutation of
 * 0..nIn-1 - `order[0]` is decomposed first, i.e. becomes the OUTERMOST mux
 * select). Bottoms out at exact.ts (proven minimum DEPTH) once <=
 * EXACT_SYNTHESIS_MAX_INPUTS variables remain. Identical cofactors (by
 * (remaining-count, truth-table) - see note below) are memoized and their
 * signal reused, which is where real gate sharing comes from for larger
 * functions; this is the "rewriting" BUILD.md 1.5 asks for.
 *
 * NOTE: memoization is sound only because decomposition always strips the
 * CURRENT LAST-remaining variable in `order` - so a given (remaining-count,
 * tt) pair always depends on exactly the same fixed variable set regardless
 * of which branch reached it.
 */
function synthesizeWithOrder(ctx: BuildCtx, order: number[], tt: TruthTable): number {
  const n = order.length;
  const key = `${n}:${tt.toString()}`;
  const cached = ctx.memo.get(key);
  if (cached !== undefined) return cached;

  let result: number;
  if (n <= EXACT_SYNTHESIS_MAX_INPUTS) {
    const sub = exactSynthesize(n, tt);
    // exact.ts's sub-circuit assumes inputs are global signals 2..1+n in
    // order - remap via `order`'s first n entries (already just 0..n-1 at
    // this depth since we strip from the end of `order`).
    result = spliceExactSubcircuit(ctx, sub, n);
  } else {
    const half = 1 << (n - 1);
    const mask = (1n << BigInt(half)) - 1n;
    const f0 = tt & mask;
    const f1 = (tt >> BigInt(half)) & mask;
    const subOrder = order.slice(0, n - 1);
    if (f0 === f1) {
      // Function doesn't depend on this variable - skip the mux entirely.
      result = synthesizeWithOrder(ctx, subOrder, f0);
    } else {
      const s0 = synthesizeWithOrder(ctx, subOrder, f0);
      const s1 = synthesizeWithOrder(ctx, subOrder, f1);
      const selSignal = 2 + order[n - 1];
      // Standard 4-NAND multiplexer: out = sel'.f0 + sel.f1
      const nsel = nandGate(ctx, selSignal, selSignal);
      const t1 = nandGate(ctx, selSignal, s1);
      const t2 = nandGate(ctx, nsel, s0);
      result = nandGate(ctx, t1, t2);
    }
  }
  ctx.memo.set(key, result);
  return result;
}

function finalize(ctx: BuildCtx, nIn: number, outSig: number): Netlist {
  const lastGateSignal = 2 + nIn + ctx.nl.length - 1;
  if (ctx.nl.length > 0 && outSig === lastGateSignal) {
    return { nIn, nOut: 1, gates: ctx.nl };
  }
  // outSig is a base signal or an earlier (shared/memoized) gate - append a
  // double-negation buffer so "output = last gate" still holds.
  const n1 = nandGate(ctx, outSig, outSig);
  nandGate(ctx, n1, n1);
  return { nIn, nOut: 1, gates: ctx.nl };
}

/** Strips structurally-redundant NAND gates (same canonical (a,b) pair as an earlier gate) and renumbers signals densely. Depth-neutral, strictly gate-count-reducing. */
export function dedupe(nl: Netlist): Netlist {
  const { canonical } = structuralHash(nl);
  const keep: number[] = []; // original gate indices to keep, in order
  for (let i = 0; i < nl.gates.length; i++) {
    const ownSignal = 2 + nl.nIn + i;
    if (canonical.get(ownSignal) === ownSignal) keep.push(i);
  }
  const remap = new Map<number, number>();
  for (let i = 0; i <= 1 + nl.nIn; i++) remap.set(i, i);
  keep.forEach((origIdx, newIdx) => {
    const origSignal = 2 + nl.nIn + origIdx;
    remap.set(origSignal, 2 + nl.nIn + newIdx);
  });
  // Non-canonical (removed) gates' signals must resolve through canonical -> remap too.
  for (let i = 0; i < nl.gates.length; i++) {
    const ownSignal = 2 + nl.nIn + i;
    if (!remap.has(ownSignal)) remap.set(ownSignal, remap.get(canonical.get(ownSignal)!)!);
  }
  const kept: Gate[] = keep.map((origIdx) => {
    const g = nl.gates[origIdx] as NandGate;
    return { kind: "NAND", a: remap.get(g.a)!, b: remap.get(g.b)! };
  });

  // Output signals must be the LAST nOut gates post-dedup (netlist.ts's
  // convention). Check whether they already landed there in order; if not,
  // append fresh double-negation buffers (correct in all cases, including
  // two outputs that happen to be equal - each still needs its own slot).
  const firstOutOrig = 2 + nl.nIn + (nl.gates.length - nl.nOut);
  const outSignals: number[] = [];
  for (let k = 0; k < nl.nOut; k++) outSignals.push(remap.get(firstOutOrig + k)!);

  const trailingStart = 2 + nl.nIn + kept.length - nl.nOut;
  const alreadyTrailing = kept.length >= nl.nOut && outSignals.every((sig, k) => sig === trailingStart + k);

  const gates: Gate[] = [...kept];
  if (!alreadyTrailing) {
    for (const sig of outSignals) {
      const n1 = 2 + nl.nIn + gates.length;
      gates.push({ kind: "NAND", a: sig, b: sig });
      gates.push({ kind: "NAND", a: n1, b: n1 });
    }
  }
  return { nIn: nl.nIn, nOut: nl.nOut, gates };
}

/** C = A . max(d,1)^3, A = g + 6s (BUILD.md section 3 / FabX cost formula). s=0 here (combinational only). */
export function computeC(gates: number, depth: number, latches = 0): number {
  const A = gates + 6 * latches;
  return A * Math.max(depth, 1) ** 3;
}

export interface OptimizeResult {
  netlist: Netlist;
  objective: Objective;
  gates: number;
  depth: number;
  c?: number;
  metCref4xCap: boolean | null; // null if no cref given
}

/**
 * Synthesizes a single-output combinational netlist for `tt` over `nIn`
 * inputs. Tries a small Pareto front (2 variable orderings: natural and
 * reversed - NOT an exhaustive search over all n! orderings, a documented
 * scope choice) and picks per `objective`. Every candidate is deduped
 * (area-improving, depth-neutral) before scoring. If `cref` is given and a
 * candidate already reaches C <= cref/4 (the FabX q-cap), later candidates
 * are skipped (BUILD.md 1.5's "stop at C <= Cref/4").
 */
export function optimize(
  nIn: number,
  tt: TruthTable,
  objective: Objective = "balanced",
  opts?: { cref?: number }
): OptimizeResult {
  if (nIn > 20) throw new NetlistError("optimize: nIn > 20 impractical for exhaustive truth tables");
  const orders = [
    Array.from({ length: nIn }, (_, i) => i),
    Array.from({ length: nIn }, (_, i) => nIn - 1 - i),
  ];

  const candidates: { netlist: Netlist; gates: number; depth: number; c: number }[] = [];
  for (const order of orders) {
    const ctx: BuildCtx = { nl: [], memo: new Map(), nInTotal: nIn };
    const outSig = synthesizeWithOrder(ctx, order, tt);
    const built = finalize(ctx, nIn, outSig);
    const deduped = dedupe(built);
    const gates = deduped.gates.length;
    const depth = circuitDepth(deduped);
    const c = computeC(gates, depth);
    candidates.push({ netlist: deduped, gates, depth, c });
    if (opts?.cref !== undefined && c <= opts.cref / 4) break; // cap already reached, stop early
  }

  // Pareto filter (drop dominated candidates: another one is <= in both gates and depth, strictly < in at least one).
  const frontier = candidates.filter(
    (cand, i) =>
      !candidates.some(
        (other, j) =>
          j !== i &&
          other.gates <= cand.gates &&
          other.depth <= cand.depth &&
          (other.gates < cand.gates || other.depth < cand.depth)
      )
  );

  let best = frontier[0];
  for (const cand of frontier) {
    if (objective === "area" && cand.gates < best.gates) best = cand;
    else if (objective === "depth" && cand.depth < best.depth) best = cand;
    else if (objective === "balanced" && cand.gates + cand.depth < best.gates + best.depth) best = cand;
  }

  return {
    netlist: best.netlist,
    objective,
    gates: best.gates,
    depth: best.depth,
    c: best.c,
    metCref4xCap: opts?.cref !== undefined ? best.c <= opts.cref / 4 : null,
  };
}
