import { Netlist, NetlistError } from "./netlist.js";

/**
 * Longest combinational path to a final output OR a LATCH's data input
 * (BUILD.md section 1.3 / the FabX cost formula's `d`). A LATCH's own output
 * (Q) is treated as a fresh depth-0 source for whatever reads it afterward -
 * it is a registered value, not part of the same combinational stage as its
 * `d` input. REF gates are not supported (flatten first).
 */
// NOTE (latch-reconcile branch, docs/NEW.md): now that LATCH.d may point
// forward (validated in netlist.ts), this function is DELIBERATELY left
// single-pass, reading depth[g.d] at the point each LATCH is reached - this
// mirrors the real deployed contract's own `_depth()`, which has the exact
// same single-pass structure and would equally read a not-yet-computed
// forward target as its default (0). The goal here is to predict the
// chain's actual cost number, not a theoretically "more correct" value, so
// bug-for-bug fidelity with the contract is the right choice IF the
// contract really has this property - that specific interaction (a LATCH
// whose `d` forward-references a not-yet-computed NAND) was NOT
// independently tested against live chain data; no such circuit was found
// on-chain. UNVERIFIED for that specific sub-case.
export function circuitDepth(nl: Netlist): number {
  const depth = new Array<number>(2 + nl.nIn + nl.gates.length).fill(0);
  let maxDepth = 0;
  for (let i = 0; i < nl.gates.length; i++) {
    const g = nl.gates[i];
    const ownSignal = 2 + nl.nIn + i;
    if (g.kind === "NAND") {
      depth[ownSignal] = Math.max(depth[g.a], depth[g.b]) + 1;
    } else if (g.kind === "LATCH") {
      maxDepth = Math.max(maxDepth, depth[g.d]); // path ends here
      depth[ownSignal] = 0; // Q is a fresh depth-0 source
    } else {
      throw new NetlistError("circuitDepth: REF gates not supported - flatten first");
    }
  }
  const firstOut = 2 + nl.nIn + (nl.gates.length - nl.nOut);
  for (let k = 0; k < nl.nOut; k++) maxDepth = Math.max(maxDepth, depth[firstOut + k]);
  return maxDepth;
}

export interface StructuralHashResult {
  /** Each gate's own signal -> the canonical signal to use instead (itself if unique). */
  canonical: Map<number, number>;
  /** Per-signal depth, computed on the deduped (canonical) structure. */
  depth: number[];
  /** Count of NAND gates that compute the same (a,b) pair as an earlier gate - removable. */
  redundantGates: number;
}

/**
 * Structural hashing over NAND gates: since every netlist signal is already
 * a NAND(a,b) output, two gates with the same canonical (a,b) pair compute
 * the identical function and are redundant - one can be deleted and every
 * reference to it rewritten to the earlier (canonical) signal. This is the
 * dedup step optimize.ts's rewriting (1.5) runs before anything else.
 * LATCH/REF gates are never deduped (each is its own canonical signal).
 */
export function structuralHash(nl: Netlist): StructuralHashResult {
  const seen = new Map<string, number>();
  const canonical = new Map<number, number>();
  const depth = new Array<number>(2 + nl.nIn + nl.gates.length).fill(0);
  let redundant = 0;
  for (let i = 0; i < nl.gates.length; i++) {
    const g = nl.gates[i];
    const ownSignal = 2 + nl.nIn + i;
    if (g.kind !== "NAND") {
      canonical.set(ownSignal, ownSignal);
      continue;
    }
    const ca = canonical.get(g.a) ?? g.a;
    const cb = canonical.get(g.b) ?? g.b;
    const key = ca <= cb ? `${ca},${cb}` : `${cb},${ca}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      canonical.set(ownSignal, existing);
      redundant++;
      depth[ownSignal] = depth[existing];
    } else {
      seen.set(key, ownSignal);
      canonical.set(ownSignal, ownSignal);
      depth[ownSignal] = Math.max(depth[ca], depth[cb]) + 1;
    }
  }
  return { canonical, depth, redundantGates: redundant };
}
