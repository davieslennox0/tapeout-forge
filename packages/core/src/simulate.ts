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
 * LATCH semantics (VERIFIED on latch-reconcile branch - docs/NEW.md - against
 * the real deployed NetlistVM.sol source plus a live eth_call test on FAB_TST
 * circuit id=49 over 3 ticks, matching exactly): every latch updates
 * unconditionally every tick (no gated/enable behaviour, none is encodable in
 * this format) - state[t+1] = f(state[t], inputs). Two passes per tick,
 * mirroring the real contract's `_execute`:
 *   Pass 1: every signal (NAND + LATCH Q) is computed in declared order. A
 *   LATCH's output signal, as read by other gates THIS tick, equals its
 *   stored state from the PREVIOUS tick (or the initial state on tick 0) -
 *   it does NOT yet read `d`.
 *   Pass 2: once every signal this tick is known, each LATCH samples `d` -
 *   which may reference a signal defined LATER in gate order (a verified
 *   feedback loop, see netlist.ts's validate()) - to produce the state for
 *   the NEXT tick.
 * The live test (id=49, a trivial 1-gate latch whose d is the input pin
 * itself) confirms the register timing (output=old state, newState=D this
 * cycle) but does not exercise a genuine *forward* d (pointing at a NAND
 * gate defined later) since no such circuit has been found on-chain yet -
 * that specific sub-case rests on the source-code + bytecode-selector
 * evidence alone, not an end-to-end live match.
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

  // Pass 1: every signal in declared order. LATCH Q = OLD stored state,
  // set immediately; `d` is recorded but NOT read yet (it may point to a
  // signal not computed until later in this same pass - verified allowed).
  const latchD: number[] = [];
  let latchIdx = 0;
  for (let i = 0; i < nl.gates.length; i++) {
    const g = nl.gates[i];
    const ownSignal = 2 + nl.nIn + i;
    if (g.kind === "NAND") {
      signals[ownSignal] = signals[g.a] && signals[g.b] ? 0 : 1;
    } else if (g.kind === "LATCH") {
      signals[ownSignal] = state.values[latchIdx] ?? 0;
      latchD[latchIdx] = g.d;
      latchIdx++;
    } else {
      throw new NetlistError("evalTick: REF gates are not executable directly - flatten first");
    }
  }
  // Pass 2: every signal this tick is now known - sample `d` for each
  // latch's next-state value (mirrors the contract's second pass).
  const nextLatchValues: number[] = latchD.map((d) => signals[d]);

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
