import type { Netlist } from "./netlist.js";
import { circuitDepth } from "./aig.js";
import { computeC } from "./optimize.js";

export interface GasParams {
  gasFixed: number;
  gasPerGate: number;
}

export interface FeeParams {
  tapeOutFeeOkb?: number | null;
  perTransistorFeeOkb?: number | null;
  protocolFeeOkb?: number | null;
}

export interface FabxNumbers {
  A: number;
  d: number;
  C: number;
}

export interface CostReport {
  userGates: number;
  userLatches: number;
  /** The 2 buffer NANDs per output the CONTRACT appends at tape-out (BUILD.md section 3) - not stored in our Netlist, shown separately. */
  bufferGates: number;
  depthWithoutBuffers: number;
  depthWithBuffers: number;
  /**
   * UNVERIFIED terminology ambiguity: BUILD.md's fee schedule says "0.0001
   * OKB per NAND transistor" - this could mean per NAND GATE (1 unit/gate,
   * what's used here) or per actual MOSFET transistor (a 2-input NAND is 4
   * transistors in CMOS, i.e. 4x this number). Defaulted to 1 unit/gate as
   * the simpler literal reading; flagged rather than silently assumed.
   */
  transistorCount: number;
  /** eval() always runs the deployed (buffered) circuit - gas uses userGates+bufferGates regardless of --count-buffers. */
  gasPerEval: number;
  tapeOutCostOkb: number | null;
  fabx: { withoutBuffers: FabxNumbers; withBuffers: FabxNumbers };
}

export function computeCost(nl: Netlist, gas: GasParams, fees: FeeParams = {}): CostReport {
  const userLatches = nl.gates.filter((g) => g.kind === "LATCH").length;
  const userGates = nl.gates.length;
  const bufferGates = 2 * nl.nOut;
  const depthWithoutBuffers = circuitDepth(nl);
  // Each output's 2-gate buffer chain is appended in series after it; since
  // every output gets exactly 2 buffers (BUILD.md section 3), the overall
  // critical path grows by exactly 2, not an approximation.
  const depthWithBuffers = depthWithoutBuffers + 2;
  const transistorCount = userGates;
  const totalGatesForGas = userGates + bufferGates;
  const gasPerEval = gas.gasFixed + gas.gasPerGate * totalGatesForGas;
  const tapeOutCostOkb =
    fees.tapeOutFeeOkb != null && fees.perTransistorFeeOkb != null && fees.protocolFeeOkb != null
      ? fees.tapeOutFeeOkb + fees.perTransistorFeeOkb * transistorCount + fees.protocolFeeOkb
      : null;

  return {
    userGates,
    userLatches,
    bufferGates,
    depthWithoutBuffers,
    depthWithBuffers,
    transistorCount,
    gasPerEval,
    tapeOutCostOkb,
    fabx: {
      withoutBuffers: {
        A: userGates + 6 * userLatches,
        d: depthWithoutBuffers,
        C: computeC(userGates, depthWithoutBuffers, userLatches),
      },
      withBuffers: {
        A: userGates + bufferGates + 6 * userLatches,
        d: depthWithBuffers,
        C: computeC(userGates + bufferGates, depthWithBuffers, userLatches),
      },
    },
  };
}

/** q = clamp(Cref/C, 1/4, 4) - BUILD.md / FabX formula. */
export function computeQ(cref: number, c: number): number {
  return Math.min(4, Math.max(0.25, cref / c));
}
