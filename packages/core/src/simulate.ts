import { Netlist, NetlistError } from "./netlist.js";

export interface LatchState {
  /** Stored value per LATCH gate, in the order LATCH gates appear in nl.gates. */
  values: number[];
}

/**
 * UNVERIFIED assumption (BUILD.md step 1.2 explicitly flags LATCH semantics
 * as unverified): initial latch state is 0 for every latch.
 */
export function initialLatchState(nl: Netlist): LatchState {
  const n = nl.gates.filter((g) => g.kind === "LATCH").length;
  return { values: new Array(n).fill(0) };
}

export interface TickResult {
  /** Index by signal number; signals[0]=0 (const0), signals[1]=1 (const1). */
  signals: number[];
  /** Length nl.nOut. bit0 = first output pin (ascending signal index = ascending pin index - ASSUMED, not separately specified). */
  outputs: number[];
  nextState: LatchState;
}

/**
 * Evaluate one combinational tick.
 *
 * LATCH semantics (UNVERIFIED - the wire format 0x01|u24 d has no explicit
 * enable bit, only a data input `d`): a LATCH gate's output signal, as read
 * by later gates in THIS tick, equals its CURRENT stored state (previous
 * tick's value, or the initial state 0). Its `d` operand is evaluated in
 * this same tick (legal per topological order, since d < the latch's own
 * signal) and becomes the stored state for the NEXT tick. In other words:
 * every latch updates unconditionally every tick - there is no gated/enable
 * behaviour, because none is encodable in this format. This is a documented
 * assumption, not a verified fact; re-check step 1.9 against a live LATCH
 * circuit if one can be found.
 *
 * REF gates are not executed here - flatten them first (not implemented in
 * Phase 1; FabX submissions forbid REF anyway per BUILD.md section 3).
 */
export function evalTick(nl: Netlist, inputBits: number[], state: LatchState): TickResult {
  if (inputBits.length !== nl.nIn) {
    throw new NetlistError(`expected ${nl.nIn} input bits, got ${inputBits.length}`);
  }
  const nSignals = 2 + nl.nIn + nl.gates.length;
  const signals = new Array<number>(nSignals).fill(0);
  signals[1] = 1;
  for (let i = 0; i < nl.nIn; i++) signals[2 + i] = inputBits[i] ? 1 : 0;

  const nextLatchValues: number[] = [];
  let latchIdx = 0;
  for (let i = 0; i < nl.gates.length; i++) {
    const g = nl.gates[i];
    const ownSignal = 2 + nl.nIn + i;
    if (g.kind === "NAND") {
      signals[ownSignal] = signals[g.a] && signals[g.b] ? 0 : 1;
    } else if (g.kind === "LATCH") {
      signals[ownSignal] = state.values[latchIdx] ?? 0;
      nextLatchValues[latchIdx] = signals[g.d];
      latchIdx++;
    } else {
      throw new NetlistError("evalTick: REF gates are not executable directly - flatten first");
    }
  }

  const firstOut = 2 + nl.nIn + (nl.gates.length - nl.nOut);
  const outputs: number[] = [];
  for (let k = 0; k < nl.nOut; k++) outputs.push(signals[firstOut + k]);

  return { signals, outputs, nextState: { values: nextLatchValues } };
}

/** Convenience for purely combinational netlists (no LATCH/REF): single tick from a fresh (all-0 latch) state. */
export function evalCombinational(nl: Netlist, inputBits: number[]): number[] {
  return evalTick(nl, inputBits, initialLatchState(nl)).outputs;
}

/** Exhaustive truth table for a combinational netlist: all 2^nIn rows, inputs ascending. */
export function exhaustiveTruthTable(nl: Netlist): number[][] {
  const n = nl.nIn;
  if (n > 20) throw new NetlistError("exhaustiveTruthTable: nIn > 20 is impractical");
  const rows: number[][] = [];
  for (let x = 0; x < 1 << n; x++) {
    const bits: number[] = [];
    for (let i = 0; i < n; i++) bits.push((x >> i) & 1);
    rows.push(evalCombinational(nl, bits));
  }
  return rows;
}

/** Multi-tick simulation, carrying latch state forward across calls. */
export function simulateTicks(nl: Netlist, inputsPerTick: number[][]): TickResult[] {
  let state = initialLatchState(nl);
  const results: TickResult[] = [];
  for (const inputBits of inputsPerTick) {
    const r = evalTick(nl, inputBits, state);
    results.push(r);
    state = r.nextState;
  }
  return results;
}
