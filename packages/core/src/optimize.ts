import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Netlist, Gate, NandGate } from "./netlist.js";
import { NetlistError } from "./netlist.js";
import type { TruthTable } from "./truthtable.js";
import { exactSynthesize, EXACT_SYNTHESIS_MAX_INPUTS } from "./exact.js";
import { circuitDepth, structuralHash } from "./aig.js";
import { checkEquivalence } from "./equivalence.js";

export type Objective = "area" | "depth" | "balanced" | "c";

/** BUILD.md 1c.2's target metric: C under the WITH-BUFFERS convention (2 extra NAND buffers appended per single output, +2 depth), matching cost.ts's fabx.withBuffers for a single-output netlist (bufferGates=2). */
export function bufferedC(gates: number, depth: number): number {
  return computeC(gates + 2, depth + 2);
}

/**
 * BUILD.md 1c.2: "Run ABC area and delay flows plus our own rewriting, keep
 * the best by C." Never required (BUILD.md 1.5) - returns [] if yosys-abc or
 * python3 are missing, or anything about the round-trip fails. NEVER trusted
 * directly: every returned netlist is re-verified by the caller against a
 * known-correct netlist via checkEquivalence before being used (BUILD.md
 * 1b.1's "NEVER trust ABC output" rule, re-affirmed in 1c.0).
 */
function isAbcOnPath(): boolean {
  try {
    execFileSync("which", ["yosys-abc"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function tryAbcCandidates(nl: Netlist): Netlist[] {
  if (nl.nOut !== 1) return []; // abc_map.py only handles the single-output case optimize() builds
  let dir: string | undefined;
  try {
    dir = mkdtempSync(join(tmpdir(), "forge-abc-"));
    const inPath = join(dir, "in.json");
    const outPath = join(dir, "out.json");
    writeFileSync(inPath, JSON.stringify({ nIn: nl.nIn, gates: nl.gates.map((g) => (g as NandGate)) }));
    const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");
    execFileSync("python3", [join(scriptsDir, "abc_map.py"), inPath, outPath], { stdio: "ignore", timeout: 30_000 });
    const raw = JSON.parse(readFileSync(outPath, "utf8")) as { flow: string; netlist: { nIn: number; gates: { a: number; b: number }[] } }[];
    return raw.map((r) => ({
      nIn: r.netlist.nIn,
      nOut: 1,
      gates: r.netlist.gates.map((g): NandGate => ({ kind: "NAND", a: g.a, b: g.b })),
    }));
  } catch {
    return [];
  } finally {
    if (dir) {
      try {
        unlinkSync(join(dir, "in.json"));
        unlinkSync(join(dir, "out.json"));
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}

interface BuildCtx {
  nl: NandGate[];
  memo: Map<string, number>;
  nInTotal: number;
}

/**
 * Permutes tt's bits ONCE so that, from then on, bit position i of the
 * (possibly further cofactored) table always means global variable
 * `order[i]` - establishing the invariant synthesizeWithOrder's recursive
 * shift/mask cofactor split (which always strips the CURRENT top bit)
 * relies on. Without this, decomposing on a non-identity order silently
 * split the wrong bit (always the raw top bit, regardless of what `order`
 * said), which a fuzz test caught producing a genuinely wrong circuit.
 */
function permuteBits(tt: TruthTable, nIn: number, order: number[]): TruthTable {
  const width = 1 << nIn;
  let out = 0n;
  for (let p = 0; p < width; p++) {
    let x = 0;
    for (let i = 0; i < nIn; i++) if ((p >> i) & 1) x |= 1 << order[i];
    if ((tt >> BigInt(x)) & 1n) out |= 1n << BigInt(p);
  }
  return out;
}

function spliceExactSubcircuit(ctx: BuildCtx, sub: Netlist, n: number, order: number[]): number {
  const localToGlobal = new Map<number, number>();
  localToGlobal.set(0, 0);
  localToGlobal.set(1, 1);
  // Local input i of exact.ts's sub-circuit is, by the permutation invariant
  // above, global variable order[i] - NOT global input i directly.
  for (let i = 0; i < n; i++) localToGlobal.set(2 + i, 2 + order[i]);
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
 * CALLER MUST pre-permute `tt` via permuteBits(tt, order.length, order)
 * before the first call (optimize() does this) - this function's recursive
 * shift/mask cofactor split assumes bit position i already means global
 * variable order[i], established once at the top, not re-derived here.
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
    result = spliceExactSubcircuit(ctx, sub, n, order);
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

/**
 * If `tt` is EXACTLY a constant or a single input literal (no actual logic
 * needed - a pure wire), returns a minimal 2-gate double-negation buffer
 * netlist directly, bypassing Shannon decomposition entirely. Without this,
 * optimize() would decompose on every variable down to exact.ts's base case
 * even for a bare pass-through output, building a full mux tree (8+ gates)
 * for what should cost ~2 - a real inefficiency this caught in step 1.10's
 * FabX replay (GC-025, a bit-reverser, whose outputs are bare input
 * literals), not a cosmetic one.
 */
function literalNetlistIfTrivial(nIn: number, tt: TruthTable): Netlist | null {
  const width = 1 << nIn;
  const fullMask = (1n << BigInt(width)) - 1n;
  const bufferFrom = (baseSignal: number): Netlist => ({
    nIn,
    nOut: 1,
    gates: [
      { kind: "NAND", a: baseSignal, b: baseSignal },
      { kind: "NAND", a: 2 + nIn, b: 2 + nIn },
    ],
  });
  if (tt === 0n) return bufferFrom(0);
  if (tt === fullMask) return bufferFrom(1);
  for (let i = 0; i < nIn; i++) {
    let v = 0n;
    for (let x = 0; x < width; x++) if ((x >> i) & 1) v |= 1n << BigInt(x);
    if (tt === v) return bufferFrom(2 + i);
  }
  return null;
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

  const trivial = literalNetlistIfTrivial(nIn, tt);
  if (trivial) {
    const gates = trivial.gates.length;
    const depth = circuitDepth(trivial);
    const c = computeC(gates, depth);
    return { netlist: trivial, objective, gates, depth, c, metCref4xCap: opts?.cref !== undefined ? c <= opts.cref / 4 : null };
  }

  const orders = [
    Array.from({ length: nIn }, (_, i) => i),
    Array.from({ length: nIn }, (_, i) => nIn - 1 - i),
  ];

  const candidates: { netlist: Netlist; gates: number; depth: number; c: number }[] = [];
  for (const order of orders) {
    const ctx: BuildCtx = { nl: [], memo: new Map(), nInTotal: nIn };
    const permutedTt = permuteBits(tt, nIn, order);
    const outSig = synthesizeWithOrder(ctx, order, permutedTt);
    const built = finalize(ctx, nIn, outSig);
    const deduped = dedupe(built);
    const gates = deduped.gates.length;
    const depth = circuitDepth(deduped);
    const c = computeC(gates, depth);
    candidates.push({ netlist: deduped, gates, depth, c });
    if (opts?.cref !== undefined && c <= opts.cref / 4) break; // cap already reached, stop early
  }

  // BUILD.md 1c.2: also try ABC (optional, never required) on our own best-so-far
  // candidate. Every ABC result is re-verified against that candidate's netlist
  // (already known correct, built directly from `tt`) before being trusted - a
  // mismatch is silently dropped, never surfaced as a usable candidate. Since
  // these are ADDED to `candidates` (not substituted), the final result can only
  // match or beat the non-ABC baseline on every objective, never regress it.
  if (isAbcOnPath()) {
    const baseline = candidates[0].netlist;
    for (const abcNl of tryAbcCandidates(baseline)) {
      let verified = false;
      try {
        verified = checkEquivalence(abcNl, baseline).equivalent;
      } catch {
        verified = false;
      }
      if (!verified) continue;
      const gates = abcNl.gates.length;
      const depth = circuitDepth(abcNl);
      const c = computeC(gates, depth);
      candidates.push({ netlist: abcNl, gates, depth, c });
    }
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
    else if (objective === "c" && bufferedC(cand.gates, cand.depth) < bufferedC(best.gates, best.depth)) best = cand;
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
